import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { fetchReceipt } from "@/lib/r2Upload";

export const dynamic = "force-dynamic";

/**
 * GET /api/iscrizione/[id]/receipt/[receiptId]
 *
 * Streams a receipt file from R2 to an authenticated admin browser.
 * Never serves unauthenticated — both because the receipt may contain
 * PII (the volunteer's name on the bonifico) and because R2
 * credentials must not be exposed to the client.
 *
 * Response: the file bytes with the original Content-Type, OR a JSON
 * { ok: false, error } on auth/not-found failures.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!(await rateLimit(`receipt-stream:${clientKey(req)}`, 60, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const { id, receiptId } = await ctx.params;
    if (!id || !receiptId) {
      return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
    }

    const receipt = await prisma.receiptUpload.findFirst({
      where: { id: receiptId, iscrizioneId: id },
      select: {
        id: true,
        iscrizioneId: true,
        objectKey: true,
        mimeType: true,
        originalName: true,
        iscrizione: { select: { turnoId: true } }
      }
    });
    if (!receipt) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    // Per-turn access check for managers. Superadmins always pass.
    if (!canAccessTurn(session, receipt.iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    let obj;
    try {
      obj = await fetchReceipt(receipt.objectKey);
    } catch (err) {
      console.error("R2 fetch failed:", err);
      return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
    }
    if (!obj) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    // Build a safe Content-Disposition with the original filename.
    const safeName = (receipt.originalName || "receipt").replace(/[^\w.\-]+/g, "_");
    return new NextResponse(obj.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": receipt.mimeType || obj.contentType || "application/octet-stream",
        "content-length": String(obj.size),
        "content-disposition": `inline; filename="${safeName}"`,
        // Receipts are not user-specific cached assets.
        "cache-control": "private, max-age=0, no-store"
      }
    });
  } catch (err) {
    console.error("receipt stream GET error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
