import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNewsletterToken } from "@/lib/newsletterToken";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * C-04: GDPR-friendly unsubscribe endpoint.
 *
 * Accepts a signed token of the form `<email>.<expiryMs>.<hmac>` and,
 * if valid, sets `unsubscribedAt = now()` for that subscriber.
 *
 * Why not just send `?email=` in the URL? Because then anyone who can
 * craft a URL could silently unsubscribe a colleague. The HMAC ensures
 * only the link we sent to that address can trigger the action.
 *
 * The frontend generates this token via `signNewsletterToken(email)` and
 * includes it in the email footer. The format is opaque and the token
 * has a 90-day expiry — sufficient for legal grace periods.
 */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`nl-unsub:${clientKey(req)}`, 10, 60_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    let token: string | null = null;
    try {
      const body = (await req.json()) as { token?: string };
      token = body?.token ?? null;
    } catch {
      // Empty / non-JSON body — fall through to invalid-token.
    }

    const email = token ? verifyNewsletterToken(token) : null;
    if (!email) {
      return NextResponse.json({ ok: false, error: "invalid-token" }, { status: 400 });
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: { unsubscribedAt: new Date(), consent: false },
      create: { email: email.toLowerCase(), consent: false, unsubscribedAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter unsubscribe error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

/**
 * GET variant — used when the user clicks the unsubscribe link directly
 * from the email (browsers prefetch GETs). Equivalent semantics: a valid
 * token marks the subscriber as unsubscribed. Returns a tiny HTML page
 * confirming the action, which is friendlier than a raw JSON response.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = token ? verifyNewsletterToken(token) : null;
    if (!email) {
      return new NextResponse(
        "<!doctype html><meta charset=utf-8><title>Link non valido</title><p>Link di disiscrizione non valido o scaduto.</p>",
        { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: { unsubscribedAt: new Date(), consent: false },
      create: { email: email.toLowerCase(), consent: false, unsubscribedAt: new Date() }
    });

    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Disiscritto</title><p>La tua email è stata rimossa dalla newsletter. Grazie.</p>",
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  } catch (err) {
    console.error("newsletter unsubscribe GET error:", err);
    return new NextResponse("Errore", { status: 500 });
  }
}
