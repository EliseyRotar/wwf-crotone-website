import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { getAccountSession } from "@/lib/accountSession";
import {
  isValidReceiptFile,
  isValidReceiptBytes,
  advanceStatus
} from "@/lib/userFlow";
import { uploadReceipt } from "@/lib/r2Upload";
import { sendReceiptUploadedAdminNotification } from "@/lib/mail";

export const dynamic = "force-dynamic";

const TYPE_VALUES = ["deposit", "balance"] as const;
type ReceiptType = (typeof TYPE_VALUES)[number];

const typeSchema = z.enum(TYPE_VALUES);

/**
 * POST /api/iscrizione/[id]/upload-receipt
 *
 * multipart/form-data:
 *   - file: the receipt (image/jpeg | image/png | application/pdf, <10MB)
 *   - type: "deposit" | "balance"
 *
 * Response: { ok, receiptId, url, type } | { ok: false, error }
 *
 * Auth: must be the volunteer who owns this Iscrizione (session
 * cookie). Refuses service-to-service uploads — receipts are always
 * owner-uploaded in Phase 2.
 *
 * On success: persists a ReceiptUpload row, advances the Iscrizione
 * from "email_verified" to "receipt_uploaded" and notifies the admin.
 *
 * Idempotency: we don't reject duplicate uploads. The admin can
 * review the latest one in the panel; older rows stay for audit.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`upload-receipt:${clientKey(req)}`, 10, 900_000))) {
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
    const file = form.get("file");
    const typeRaw = form.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
    }
    const typeParsed = typeSchema.safeParse(typeRaw);
    if (!typeParsed.success) {
      return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
    }
    const type: ReceiptType = typeParsed.data;

    // Owner check + exists
    const iscrizione = await prisma.iscrizione.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, status: true, turnoId: true, turno: { select: { number: true } } }
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

    if (!isValidReceiptFile(file)) {
      // Distinguish too-big vs wrong-type so the UI can show the right
      // error message.
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
    }

    // Magic-byte check on the actual body — defence against renamed .exe etc.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidReceiptBytes(bytes, file.type)) {
      return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
    }

    // Reject upload if the registration is already in a terminal state.
    if (iscrizione.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "cancelled" }, { status: 409 });
    }
    if (iscrizione.status === "confirmed") {
      return NextResponse.json({ ok: false, error: "already-confirmed" }, { status: 409 });
    }

    // Upload to R2.
    let uploaded;
    try {
      // uploadReceipt expects a File; we still have `file` as a File
      // reference and the bytes are the same.
      const fakeFile = new File([bytes], file.name || "receipt", {
        type: file.type
      });
      uploaded = await uploadReceipt(fakeFile, iscrizione.id, type);
    } catch (err) {
      console.error("R2 upload failed:", err);
      return NextResponse.json({ ok: false, error: "upload-failed" }, { status: 502 });
    }

    // Persist the ReceiptUpload row. Use create() so the unique
    // cuid is generated server-side.
    const row = await prisma.receiptUpload.create({
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

    // Advance the lifecycle. From "pending" we hop straight to
    // "receipt_uploaded" (skipping email_verified) — the user might
    // have uploaded a receipt before clicking the verify link, or
    // verified off the back of the upload. Both are valid.
    let updated;
    if (iscrizione.status === "receipt_uploaded") {
      // Already there; just refetch for the response.
      updated = await prisma.iscrizione.findUnique({ where: { id: iscrizione.id } });
    } else if (iscrizione.status === "email_verified" || iscrizione.status === "pending") {
      updated = await advanceStatus(iscrizione.id, "receipt_uploaded", {
        skipNotification: false
      });
    } else {
      // For other states (e.g. waitlist) we just save the receipt and
      // do not change status.
      updated = await prisma.iscrizione.findUnique({ where: { id: iscrizione.id } });
    }

    // Best-effort admin notification (a richer one than the status-
    // change mail — includes the receipt metadata).
    void sendReceiptUploadedAdminNotification({
      id: iscrizione.id,
      firstName: iscrizione.firstName,
      lastName: iscrizione.lastName,
      email: iscrizione.email,
      turno: iscrizione.turno,
      receiptUploads: [{ type: row.type, createdAt: row.createdAt }]
    }).catch((err) =>
      console.error("[upload-receipt] admin mail failed:", err)
    );

    return NextResponse.json({
      ok: true,
      receiptId: row.id,
      url: row.url,
      type: row.type,
      iscrizioneId: iscrizione.id,
      status: updated?.status ?? iscrizione.status
    });
  } catch (err) {
    console.error("upload-receipt POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
