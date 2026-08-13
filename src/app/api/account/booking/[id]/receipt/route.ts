import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { sendNotification, sendReceiptUploadedAdminNotification } from "@/lib/mail";
import { SITE } from "@/config/site";
import { logAudit } from "@/lib/audit";
import { uploadReceipt } from "@/lib/r2Upload";
import { advanceStatus } from "@/lib/userFlow";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
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
  if (mimeType === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === "application/pdf") {
    return (
      buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
    );
  }
  return false;
}

/**
 * POST /api/account/booking/[id]/receipt
 *
 * Multipart form-data with fields:
 *   - file: the receipt (JPEG/PNG/PDF, max 5MB, magic-byte checked)
 *   - type: "deposit" | "balance"
 *
 * Behaviour:
 *   - Validates session, CSRF, rate limit.
 *   - Validates the booking belongs to the current volunteer.
 *   - Rejects if the chosen slot isn't currently open (e.g. trying to
 *     upload a balance receipt before the deposit is paid).
 *   - Writes the file under
 *     `public/uploads/receipts/<bookingId>/<type>/<uuid>.<ext>`.
 *   - Sets the matching `*ReceiptUrl` + `*ReceiptUploadedAt` on the
 *     Iscrizione, AND flips the `feePaid` / `balancePaid` flag to
 *     true so the public `/mio-iscrizione` page reflects the new
 *     state. We DO NOT set the *ApprovedAt column — the admin still
 *     has to verify from /admin/iscrizioni.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`acct-receipt:${clientKey(req)}`, 10, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const session = await getAccountSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") ?? "");
    if (!file) {
      return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
    }
    if (type !== "deposit" && type !== "balance") {
      return NextResponse.json({ ok: false, error: "invalid-type-slot" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });
    }

    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      include: { turno: { select: { number: true } } }
    });
    if (!iscrizione) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (
      iscrizione.id !== session.iscrizioneId &&
      iscrizione.email.toLowerCase() !== session.email.toLowerCase()
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (iscrizione.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "cancelled" }, { status: 409 });
    }

    // Slot ordering: deposit first, then balance. Refuse to upload a
    // balance receipt before the deposit is paid.
    if (type === "balance" && !iscrizione.feePaid) {
      return NextResponse.json({ ok: false, error: "deposit-required" }, { status: 409 });
    }
    if (type === "deposit" && iscrizione.feePaid) {
      return NextResponse.json({ ok: false, error: "already-paid" }, { status: 409 });
    }
    if (type === "balance" && iscrizione.balancePaid) {
      return NextResponse.json({ ok: false, error: "already-paid" }, { status: 409 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateMagicBytes(Buffer.from(bytes), file.type)) {
      return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
    }

    // Upload to R2 (Phase 2 storage). Same r2Upload helper as the
    // /api/iscrizione/[id]/upload-receipt endpoint so both volunteer
    // entry points feed the same admin panel.
    let uploaded;
    try {
      const fakeFile = new File([bytes], file.name || "receipt", { type: file.type });
      uploaded = await uploadReceipt(fakeFile, iscrizione.id, type as "deposit" | "balance");
    } catch (err) {
      console.error("R2 upload failed:", err);
      return NextResponse.json({ ok: false, error: "upload-failed" }, { status: 502 });
    }

    // Persist the ReceiptUpload row (the canonical record — the admin
    // /admin/iscrizioni panel reads from this table via R2 proxy).
    await prisma.receiptUpload.create({
      data: {
        iscrizioneId: iscrizione.id,
        type,
        objectKey: uploaded.objectKey,
        url: uploaded.url,
        originalName: uploaded.originalName,
        mimeType: uploaded.mimeType,
        byteSize: uploaded.byteSize,
        sha256: uploaded.sha256
      }
    });

    const data: Record<string, unknown> = {};
    const now = new Date();
    if (type === "deposit") {
      data.depositReceiptUrl = uploaded.url;
      data.depositReceiptUploadedAt = now;
      data.feePaid = true;
      data.feePaidDate = now;
    } else {
      data.balanceReceiptUrl = uploaded.url;
      data.balanceReceiptUploadedAt = now;
      data.balancePaid = true;
      data.balancePaidDate = now;
    }

    await prisma.iscrizione.update({ where: { id: iscrizione.id }, data });

    // Phase 2: if the user uploaded a receipt, the lifecycle status
    // should now be "receipt_uploaded" (admin will flip to confirmed).
    if (iscrizione.status === "pending" || iscrizione.status === "email_verified") {
      await advanceStatus(iscrizione.id, "receipt_uploaded", { skipNotification: false }).catch((err) =>
        console.error("[legacy-receipt] advanceStatus failed:", err)
      );
    }

    // Audit + admin notification (best-effort)
    const ip = clientKey(req);
    const ua = req.headers.get("user-agent") ?? "";
    void logAudit({
      userId: session.iscrizioneId,
      action: "receipt_upload",
      entity: "iscrizione",
      entityId: iscrizione.id,
      details: JSON.stringify({ type, objectKey: uploaded.objectKey }),
      ipAddress: ip,
      userAgent: ua
    });

    // Use the proper designed email helper so the admin gets the same
    // styled "Ricevuta caricata" email as the canonical flow. Pass the
    // objectKey of the just-uploaded file as the only receipt entry so
    // the email shows the latest file metadata.
    void sendReceiptUploadedAdminNotification({
      id: iscrizione.id,
      firstName: session.firstName,
      lastName: session.lastName,
      email: iscrizione.email,
      turno: iscrizione.turno ? { number: iscrizione.turno.number } : null,
      receiptUploads: [{ type, createdAt: new Date() }]
    }).catch((err) => console.error("[receipt] admin mail failed:", err));

    // Notification row for the admin panel
    try {
      const superadmin = await prisma.user.findFirst({
        where: { role: "superadmin", active: true, deletedAt: null },
        select: { id: true }
      });
      if (superadmin) {
        await prisma.notification.create({
          data: {
            userId: superadmin.id,
            type: "receipt_upload",
            title: `Ricevuta ${type === "deposit" ? "acconto" : "saldo"} — ${session.firstName} ${session.lastName}`,
            body: `In attesa di approvazione.`,
            link: `/admin/iscrizioni/${iscrizione.id}`
          }
        });
      }
    } catch (err) {
      console.error("[receipt] notification row failed:", err);
    }

    return NextResponse.json({ ok: true, path: uploaded.url, type });
  } catch (err) {
    console.error("receipt upload error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
