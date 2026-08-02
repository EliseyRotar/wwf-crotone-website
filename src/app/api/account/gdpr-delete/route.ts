import { NextResponse } from "next/server";
import { z } from "zod";
import { SITE } from "@/config/site";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { getAccountSession } from "@/lib/accountSession";
import { sendNotification } from "@/lib/mail";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().min(1).max(2000),
  confirmEmail: z.string().email().max(200),
  locale: z.enum(["it", "en"]).default("it")
});

/**
 * POST /api/account/gdpr-delete
 *
 * Body: { reason, confirmEmail, locale }
 *
 * Validates that the volunteer is currently logged in (24h account
 * cookie or 30-day device cookie) and that `confirmEmail` matches the
 * email we have on file — this prevents a casual visitor with a
 * borrowed session from wiping data, and stops scripted abuse even
 * if a cookie leaks.
 *
 * On success:
 *   - Emails the site admin a request-for-deletion notice including
 *     the volunteer's name, email, the reason, and request context.
 *   - Writes an audit-log row (action="gdpr_delete_request").
 *   - Returns `{ ok: true }`. We do NOT actually delete or anonymise
 *     data here — the admin handles erasure manually (with the
 *     required legal verification), per the spec.
 */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`gdpr:${clientKey(req)}`, 5, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const session = await getAccountSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const { reason, confirmEmail } = parsed.data;

    if (confirmEmail.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "email-mismatch" }, { status: 400 });
    }

    const ip = clientKey(req);
    const ua = req.headers.get("user-agent") ?? "";
    const isIt = parsed.data.locale === "it";

    // Build the admin email
    const subject = isIt
      ? `Richiesta cancellazione dati — ${session.firstName} ${session.lastName}`
      : `Data deletion request — ${session.firstName} ${session.lastName}`;

    const text = isIt
      ? `Il volontario ${session.firstName} ${session.lastName} (${session.email}) ha richiesto la cancellazione dei propri dati personali tramite l'area personale.

Motivazione:
${reason}

ID Iscrizione: ${session.iscrizioneId}
IP richiesta: ${ip}
User-Agent: ${ua}

Procedere con la cancellazione manualmente dopo aver verificato l'identità del richiedente.`
      : `Volunteer ${session.firstName} ${session.lastName} (${session.email}) has requested erasure of their personal data via the personal area.

Reason:
${reason}

Iscrizione ID: ${session.iscrizioneId}
Request IP: ${ip}
User-Agent: ${ua}

Proceed with the deletion manually after verifying the requester's identity.`;

    // Best-effort admin notification
    void sendNotification({
      to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
      subject,
      text
    }).catch((err) => {
      console.error("[gdpr-delete] admin mail failed:", err);
    });

    // Audit log — fail silently, never block the user-visible response
    void logAudit({
      userId: session.iscrizioneId,
      action: "gdpr_delete_request",
      entity: "iscrizione",
      entityId: session.iscrizioneId,
      details: JSON.stringify({ reason: reason.slice(0, 500) }),
      ipAddress: ip,
      userAgent: ua
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("gdpr-delete error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
