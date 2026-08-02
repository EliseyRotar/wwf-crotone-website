import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";
import { generateMagicLink, buildMagicLinkUrl } from "@/lib/magicLink";
import { sendMagicLink } from "@/lib/mail";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  locale: z.enum(["it", "en"]).default("it")
});

/**
 * POST /api/account/magic-link
 *
 * Body: { email, locale }
 * Response (always): { ok: true, sentTo: <email> }
 *
 * Behaviour:
 *   - Validates the email format.
 *   - Rate-limits at 5 requests/hour/IP.
 *   - Validates the origin to keep this a same-origin POST.
 *   - Generates a magic link and emails it. We do NOT branch on
 *     "user found / not found" in the response — the same
 *     `{ ok: true }` is returned in both cases to prevent account
 *     enumeration via timing or response shape.
 */
export async function POST(req: Request) {
  try {
    // 5 per hour per IP — generous for retries, restrictive for spray.
    if (!(await rateLimit(`ml:${clientKey(req)}`, 5, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }
    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const { email, locale } = parsed.data;

    // generateMagicLink returns null when no Iscrizione matches. We
    // intentionally do not differentiate that in the response.
    const result = await generateMagicLink(email);

    // Only attempt the email send if a matching Iscrizione exists.
    // When result is null, we fall through and still return the
    // generic "ok" so attackers can't enumerate accounts.
    if (result) {
      const url = buildMagicLinkUrl(result.rawToken, locale);
      // Best-effort: never bubble failures to the caller. We log
      // server-side but the public response stays uniform.
      void sendMagicLink({ to: email.toLowerCase(), url, locale }).catch((err) => {
        console.error("[magic-link] mail send failed:", err);
      });
    }

    return NextResponse.json({ ok: true, sentTo: email.toLowerCase() });
  } catch (err) {
    console.error("magic-link POST error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
