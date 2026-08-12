import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { fetchReceipt } from "@/lib/r2Upload";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/iscrizioni/receipt/[receiptId]
 *
 * Stream a receipt file from R2 to the authenticated admin browser.
 * We never expose the raw R2 URL — this proxy checks session + turno
 * access and proxies the bytes through.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ receiptId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { receiptId } = await ctx.params;
    if (!receiptId) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

    const receipt = await prisma.receiptUpload.findUnique({
      where: { id: receiptId },
      select: { objectKey: true, mimeType: true, iscrizione: { select: { turnoId: true } } }
    });
    if (!receipt) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    if (!canAccessTurn(session, receipt.iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const file = await fetchReceipt(receipt.objectKey);
    if (!file) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    return new NextResponse(Buffer.from(file.body), {
      status: 200,
      headers: {
        "content-type": receipt.mimeType || file.contentType,
        "content-length": String(file.size),
        "cache-control": "private, max-age=60"
      }
    });
  } catch (err) {
    console.error("receipt proxy error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}