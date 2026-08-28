import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ReceiptActionSchema = z
  .object({
    receiptId: z.string().min(1).max(64),
    action: z.enum(["approve", "reject"]),
    reason: z.string().max(500).optional()
  })
  .strict();

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
    }

    const parsed = ReceiptActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { receiptId, action, reason } = parsed.data;

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
          rejectionReason: isApprove ? null : (reason ?? "").slice(0, 500) || null
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
