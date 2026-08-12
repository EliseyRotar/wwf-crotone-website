import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/iscrizioni/receipt
 *
 * Approve or reject a receipt uploaded by a volunteer (Phase 2).
 * Body: { receiptId: string, action: "approve" | "reject", reason?: string }
 *
 * On "approve": stamps approvedAt + approvedBy on the ReceiptUpload row.
 * If this is the deposit receipt AND feePaid is not yet set, also sets
 * feePaid=true + feePaidDate + depositReceiptApprovedAt on the Iscrizione.
 * Same for balance.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`admin-receipt:${clientKey(req)}`, 30, 60000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const { receiptId, action, reason } = await req.json();
    if (!receiptId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const receipt = await prisma.receiptUpload.findUnique({
      where: { id: receiptId },
      include: { iscrizione: { select: { id: true, turnoId: true } } }
    });
    if (!receipt) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    if (!canAccessTurn(session, receipt.iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const now = new Date();
    const isApprove = action === "approve";

    await prisma.$transaction(async (tx) => {
      await tx.receiptUpload.update({
        where: { id: receiptId },
        data: {
          approvedAt: isApprove ? now : null,
          approvedBy: isApprove ? session.id : null,
          rejectionReason: isApprove ? null : String(reason ?? "").slice(0, 500) || null
        }
      });

      if (isApprove) {
        const iscrizioneUpdate: Record<string, unknown> = { managedBy: session.id };
        if (receipt.type === "deposit") {
          iscrizioneUpdate.feePaid = true;
          iscrizioneUpdate.feePaidDate = now;
          iscrizioneUpdate.depositReceiptApprovedAt = now;
        } else if (receipt.type === "balance") {
          iscrizioneUpdate.balancePaid = true;
          iscrizioneUpdate.balancePaidDate = now;
          iscrizioneUpdate.balanceReceiptApprovedAt = now;
        }
        await tx.iscrizione.update({
          where: { id: receipt.iscrizione.id },
          data: iscrizioneUpdate
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: isApprove ? "receipt_approve" : "receipt_reject",
      entity: "receipt_upload",
      entityId: receiptId,
      details: JSON.stringify({ type: receipt.type, reason: reason ?? null })
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("receipt PATCH error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}