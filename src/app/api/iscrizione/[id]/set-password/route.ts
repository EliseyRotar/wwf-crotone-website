import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getAccountSession } from "@/lib/accountSession";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(8).max(200)
});

/**
 * POST /api/iscrizione/[id]/set-password
 *
 * Sets a password on the volunteer's Iscrizione row. After this, the
 * user can sign in via the password form in addition to the
 * magic-link flow. We bcrypt with cost 12 (matches the admin auth).
 *
 * Auth: the volunteer must be signed in (own session). They can only
 * set a password on their own Iscrizione.
 *
 * The route is intentionally one-way-ish: we don't expose a "change
 * password" endpoint separately because the only path in Phase 2 is
 * "set once" from the panel. If the user already has a password we
 * overwrite it — they could always trigger a magic-link if they
 * forgot it.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await rateLimit(`setpw:${clientKey(req)}`, 10, 3600_000))) {
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
    if (id !== session.iscrizioneId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const updated = await prisma.iscrizione.update({
      where: { id },
      data: { passwordHash, passwordSetAt: new Date() },
      select: { id: true, passwordSetAt: true }
    });

    return NextResponse.json({
      ok: true,
      iscrizioneId: updated.id,
      passwordSetAt: updated.passwordSetAt
    });
  } catch (err) {
    console.error("set-password POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
