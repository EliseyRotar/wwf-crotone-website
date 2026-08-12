import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccountSession } from "@/lib/accountSession";
import { DEVICE_COOKIE_NAME, verifyDeviceCookie } from "@/lib/deviceSession";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/sessions
 *
 * List all active DeviceSession rows for the current volunteer.
 * Includes a `isCurrent` flag on the row matching the cookie's deviceHash
 * so the dashboard can highlight "this device".
 *
 * Response: { ok, sessions: [{ id, userAgent, ipAddress, lastSeenAt,
 *                            expiresAt, isCurrent }] }
 */
export async function GET() {
  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  const ua = (await headers()).get("user-agent") ?? "";
  const al = (await headers()).get("accept-language") ?? "";
  const verified = cookieVal ? verifyDeviceCookie(cookieVal, ua, al) : { ok: false as const };

  const [rows, currentRow] = await Promise.all([
    prisma.deviceSession.findMany({
      where: {
        userId: session.iscrizioneId,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastSeenAt: true,
        expiresAt: true,
        deviceHash: true
      }
    }),
    verified.ok
      ? prisma.deviceSession.findFirst({
          where: {
            userId: session.iscrizioneId,
            deviceHash: verified.deviceHash
          },
          select: { id: true }
        })
      : Promise.resolve(null)
  ]);

  const currentId = currentRow?.id ?? null;

  return NextResponse.json({
    ok: true,
    sessions: rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      lastSeenAt: r.lastSeenAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      isCurrent: currentId !== null && r.id === currentId
    })),
    currentDeviceId: currentId
  });
}

/**
 * DELETE /api/account/sessions
 *
 * Body: { sessionId?: string, allOthers?: boolean }
 *  - If `sessionId` provided: revoke just that one (cannot revoke current).
 *  - If `allOthers: true`: revoke all sessions except the current device.
 *
 * The current device (the one matching the active cookie) is never
 * revoked by this endpoint — the volunteer must explicitly log out
 * to end the current session.
 */
const schema = z.object({
  sessionId: z.string().min(1).optional(),
  allOthers: z.boolean().optional()
});

export async function DELETE(req: Request) {
  if (!(await rateLimit(`session-revoke:${clientKey(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }
  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Identify the current deviceHash so we never delete it via this endpoint
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  const ua = (await headers()).get("user-agent") ?? "";
  const al = (await headers()).get("accept-language") ?? "";
  const verified = cookieVal ? verifyDeviceCookie(cookieVal, ua, al) : { ok: false as const };
  const currentDeviceHash = verified.ok ? verified.deviceHash : null;

  let deleted: number;
  if (parsed.data.allOthers) {
    // Find which rows are NOT the current device, then delete them
    const all = await prisma.deviceSession.findMany({
      where: { userId: session.iscrizioneId, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true }
    });
    const current = await prisma.deviceSession.findFirst({
      where: { userId: session.iscrizioneId, deviceHash: currentDeviceHash ?? "__none__" }
    });
    const toDelete = all.filter((r) => r.id !== current?.id).map((r) => r.id);
    const res = await prisma.deviceSession.deleteMany({ where: { id: { in: toDelete } } });
    deleted = res.count;
    void logAudit({
      userId: session.iscrizioneId,
      action: "session_revoke_all_others",
      entity: "iscrizione",
      entityId: session.iscrizioneId,
      details: JSON.stringify({ count: deleted })
    });
  } else if (parsed.data.sessionId) {
    // Refuse to revoke the current device via sessionId
    const target = await prisma.deviceSession.findUnique({
      where: { id: parsed.data.sessionId }
    });
    if (!target || target.userId !== session.iscrizioneId) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    if (currentDeviceHash && target.deviceHash === currentDeviceHash) {
      return NextResponse.json(
        { ok: false, error: "cannot-revoke-current" },
        { status: 400 }
      );
    }
    await prisma.deviceSession.delete({ where: { id: target.id } });
    deleted = 1;
    void logAudit({
      userId: session.iscrizioneId,
      action: "session_revoke_one",
      entity: "iscrizione",
      entityId: session.iscrizioneId,
      details: JSON.stringify({ sessionId: target.id })
    });
  } else {
    return NextResponse.json({ ok: false, error: "missing-target" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, revoked: deleted });
}