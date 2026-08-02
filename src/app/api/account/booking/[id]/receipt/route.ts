import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sendNotification } from "@/lib/mail";
import { SITE } from "@/config/site";
import { logAudit } from "@/lib/audit";

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
      where: { id, deletedAt: null }
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

    const buf = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buf, file.type)) {
      return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const filename = `${crypto.randomUUID()}.${ext}`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "receipts",
      iscrizione.id,
      type
    );
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buf);
    const publicPath = `/uploads/receipts/${iscrizione.id}/${type}/${filename}`;

    const data: Record<string, unknown> = {};
    const now = new Date();
    if (type === "deposit") {
      data.depositReceiptUrl = publicPath;
      data.depositReceiptUploadedAt = now;
      data.feePaid = true;
      data.feePaidDate = now;
    } else {
      data.balanceReceiptUrl = publicPath;
      data.balanceReceiptUploadedAt = now;
      data.balancePaid = true;
      data.balancePaidDate = now;
    }

    await prisma.iscrizione.update({ where: { id: iscrizione.id }, data });
    // Also create a row in the legacy `Receipt` table so the admin
    // list of receipts stays in sync with the new columns.
    await prisma.receipt.create({
      data: {
        iscrizioneId: iscrizione.id,
        fileName: file.name,
        filePath: publicPath,
        mimeType: file.type
      }
    });

    // Audit + admin notification (best-effort)
    const ip = clientKey(req);
    const ua = req.headers.get("user-agent") ?? "";
    void logAudit({
      userId: session.iscrizioneId,
      action: "receipt_upload",
      entity: "iscrizione",
      entityId: iscrizione.id,
      details: JSON.stringify({ type, filePath: publicPath }),
      ipAddress: ip,
      userAgent: ua
    });

    const subject = `[Volontario] Ricevuta ${type === "deposit" ? "acconto" : "saldo"} — ${session.firstName} ${session.lastName}`;
    const text = `Il volontario ${session.firstName} ${session.lastName} (${iscrizione.email}) ha caricato la ricevuta del ${type === "deposit" ? "acconto di €100" : "saldo"}.

In attesa di approvazione.
ID Iscrizione: ${iscrizione.id}
File: ${publicPath}

Vedi: /admin/iscrizioni/${iscrizione.id}`;

    void sendNotification({
      to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
      subject,
      text
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

    return NextResponse.json({ ok: true, path: publicPath, type });
  } catch (err) {
    console.error("receipt upload error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
