/**
 * Phase 2: pure-logic helpers for the full user-flow lifecycle.
 *
 *   pending  →  email_verified  →  receipt_uploaded  →  confirmed
 *                                                    ↘  cancelled
 *
 *   pending  →  waitlist (full turn)
 *
 * All exports are pure where possible; the only DB-touching ones
 * (advanceStatus, createVerificationTokenForIscrizione,
 * consumeVerificationToken) are explicitly named and isolated here so
 * the API routes stay thin.
 *
 * No imports from app/ — this module is reusable from scripts, jobs and
 * server actions.
 */

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendStatusChangeAdminNotification } from "@/lib/mail";

/* ---------- Lock helpers (pure) ---------- */

/** Number of days before turno.startDate at which the volunteer's panel
 * becomes read-only. */
export const EDITS_LOCK_DAYS = 7;
export const EDITS_LOCK_MS = EDITS_LOCK_DAYS * 24 * 60 * 60 * 1000;

/**
 * Returns the timestamp at which the registration should be locked for
 * edits, or null if the turno is more than 7 days away.
 *
 * We compute this lazily (the route sets it on first access after the
 * window has passed) rather than via a cron, so a new server boots
 * straight into the right state.
 */
export function computeEditsLockedAt(
  turnoStartDate: Date,
  now: Date = new Date()
): Date | null {
  if (!(turnoStartDate instanceof Date) || isNaN(turnoStartDate.getTime())) {
    return null;
  }
  const lockAt = new Date(turnoStartDate.getTime() - EDITS_LOCK_MS);
  if (lockAt.getTime() > now.getTime()) return null;
  return lockAt;
}

/**
 * True when the volunteer is allowed to edit their registration from
 * the personal panel.
 *
 *   - false if `editsLockedAt` is set (admin or system locked it)
 *   - false if status === "confirmed" (admin already approved)
 *   - false if the turno starts in < EDITS_LOCK_DAYS
 *   - true otherwise
 */
export function isRegistrationEditable(
  iscrizione: {
    editsLockedAt: Date | null;
    status: string;
    turno: { startDate: Date };
  },
  now: Date = new Date()
): boolean {
  if (iscrizione.editsLockedAt) return false;
  if (iscrizione.status === "confirmed") return false;
  if (iscrizione.status === "cancelled") return false;
  const cutoff = new Date(iscrizione.turno.startDate.getTime() - EDITS_LOCK_MS);
  if (cutoff.getTime() <= now.getTime()) return false;
  return true;
}

/* ---------- Status advancement ---------- */

const TIMESTAMP_BY_STATUS: Record<string, string> = {
  email_verified: "emailVerifiedAt",
  receipt_uploaded: "receiptUploadedAt",
  confirmed: "confirmedAt",
  cancelled: "cancelledAt"
};

const ALLOWED_STATUSES = new Set([
  "pending",
  "email_verified",
  "receipt_uploaded",
  "confirmed",
  "cancelled",
  "waitlist"
]);

/**
 * Atomically set Iscrizione.status to `newStatus` and stamp the matching
 * lifecycle timestamp (emailVerifiedAt / receiptUploadedAt / confirmedAt /
 * cancelledAt). Other statuses (pending, waitlist) don't have a dedicated
 * timestamp — they only update `status`.
 *
 * Writes a coarse `status_change` AuditLog row so the timeline shows
 * the transition. Per-field changes are logged separately by the edit
 * route; this is just the status flip itself.
 *
 * Returns the updated Iscrizione (or null if the row was missing).
 */
export async function advanceStatus(
  iscrizioneId: string,
  newStatus: string,
  payload?: {
    /** Admin user id to attribute the change to (audit log). */
    actorId?: string | null;
    /** Extra data to merge into the update — e.g. editsLockedAt on confirm. */
    data?: Record<string, unknown>;
    /** Skip the admin notification (e.g. when called from a bulk script). */
    skipNotification?: boolean;
    /** IP / UA for audit log. */
    ip?: string | null;
    ua?: string | null;
  }
) {
  if (!ALLOWED_STATUSES.has(newStatus)) {
    throw new Error(`advanceStatus: unknown status '${newStatus}'`);
  }

  const before = await prisma.iscrizione.findUnique({
    where: { id: iscrizioneId },
    select: { id: true, status: true, firstName: true, lastName: true, email: true, turnoId: true }
  });
  if (!before) return null;

  const oldStatus = before.status;
  if (oldStatus === newStatus) {
    // No-op — the caller may still want the row back, so just refetch.
    return prisma.iscrizione.findUnique({ where: { id: iscrizioneId } });
  }

  const data: Record<string, unknown> = { status: newStatus };
  const tsField = TIMESTAMP_BY_STATUS[newStatus];
  if (tsField) data[tsField] = new Date();
  if (payload?.data) Object.assign(data, payload.data);

  const updated = await prisma.iscrizione.update({
    where: { id: iscrizioneId },
    data
  });

  // Audit log (best-effort — never throw)
  void logAudit({
    userId: payload?.actorId ?? iscrizioneId,
    action: "status_change",
    entity: "iscrizione",
    entityId: iscrizioneId,
    fieldName: "status",
    oldValue: oldStatus,
    newValue: newStatus,
    details: JSON.stringify({ from: oldStatus, to: newStatus }),
    ipAddress: payload?.ip ?? null,
    userAgent: payload?.ua ?? null
  });

  // Admin notification (best-effort). We re-fetch with the turno
  // relation so the mail function has the turno number for the
  // subject — the update() above returns the row without relations.
  if (!payload?.skipNotification) {
    const withTurno = await prisma.iscrizione.findUnique({
      where: { id: iscrizioneId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        turno: { select: { number: true } }
      }
    });
    if (withTurno) {
      void sendStatusChangeAdminNotification(withTurno, oldStatus, newStatus).catch(
        (err) => console.error("[userFlow] status-change admin mail failed:", err)
      );
    }
  }

  return updated;
}

/* ---------- Verification tokens ---------- */

/**
 * SHA-256 of a raw token, base64url-encoded. Mirrors the Web-Crypto
 * path used in src/lib/magicLink.ts so we can run in either runtime.
 */
export async function hashVerificationToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64urlFromBytes(new Uint8Array(digest));
}

/** 32 random bytes, base64url-encoded (~43 chars). */
export function mintVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64urlFromBytes(bytes);
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Mint a fresh token row for an Iscrizione. Returns the RAW token (caller
 * emails it; the DB only ever stores the hash).
 *
 * `authorizesStatus` is what the Iscrizione.status will be set to when
 * the token is consumed. Default = "email_verified" (the first step of
 * the lifecycle).
 */
export async function createVerificationTokenForIscrizione(
  iscrizioneId: string,
  authorizesStatus: string = "email_verified",
  ttlMs: number = 24 * 60 * 60 * 1000
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = mintVerificationToken();
  const tokenHash = await hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.iscrizioneVerificationToken.create({
    data: {
      iscrizioneId,
      tokenHash,
      authorizesStatus,
      expiresAt
    }
  });
  return { rawToken, expiresAt };
}

/**
 * Consume a verification token:
 *   1. Hash the raw token.
 *   2. Look up the row by tokenHash.
 *   3. Verify it isn't already consumed, isn't expired, and authorizes
 *      the expected status.
 *   4. Stamp consumedAt atomically (updateMany with consumedAt: null in
 *      the WHERE so a parallel redeem loses the race).
 *
 * Returns the Iscrizione.id on success, or null on any failure.
 */
export async function consumeVerificationToken(
  raw: string,
  expectedAuthorizesStatus: string
): Promise<string | null> {
  if (!raw || typeof raw !== "string") return null;
  const tokenHash = await hashVerificationToken(raw);
  const now = new Date();
  const row = await prisma.iscrizioneVerificationToken.findUnique({
    where: { tokenHash }
  });
  if (!row) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt.getTime() < now.getTime()) return null;
  if (row.authorizesStatus !== expectedAuthorizesStatus) return null;

  const upd = await prisma.iscrizioneVerificationToken.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now }
  });
  if (upd.count === 0) return null;
  return row.iscrizioneId;
}

/* ---------- File validation ---------- */

const ALLOWED_RECEIPT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png"
]);
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Type/size gate for a receipt upload. Server-side defence in depth
 * (the browser may have skipped our accept attribute). We also
 * require a non-empty name to avoid weird "" files from some mobile
 * browsers.
 */
export function isValidReceiptFile(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  if (!("size" in file) || file.size <= 0) return false;
  if (file.size > RECEIPT_MAX_BYTES) return false;
  const mime = (file as File).type ?? "";
  if (!ALLOWED_RECEIPT_MIME.has(mime)) return false;
  return true;
}

/**
 * Magic-byte validation for a receipt. The `isValidReceiptFile` check
 * looks at the declared MIME; this second pass confirms the bytes
 * actually start with the expected signature, blocking renamed .exe
 * files etc.
 */
export function isValidReceiptBytes(
  buf: Uint8Array,
  declaredMime: string
): boolean {
  if (declaredMime === "image/png") {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (declaredMime === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (declaredMime === "application/pdf") {
    return (
      buf.length >= 4 &&
      buf[0] === 0x25 &&
      buf[1] === 0x50 &&
      buf[2] === 0x44 &&
      buf[3] === 0x46
    );
  }
  return false;
}

/**
 * SHA-256 hex of a file's bytes. Used both for integrity checks and
 * to build a stable receipt id for R2 dedup.
 */
export async function computeFileHash(file: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
  const buf: ArrayBuffer = (bytes.buffer as ArrayBuffer).slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
