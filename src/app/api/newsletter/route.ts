import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  // C-04: refuse to insert a record unless the user actually ticked the box
  // — we check the value AND require it to have come in this call (presence
  // is enforced by z.boolean(), strict equality below).
  consent: z.literal(true),
  locale: z.enum(["it", "en"]).default("it")
});

export async function POST(req: Request) {
  try {
    // Rate limit: 5 per hour per IP
    if (!(await rateLimit(`nl:${clientKey(req)}`, 5, 3600_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const { email, consent, locale } = parsed.data;

    // C-04: stamp consent timestamp, IP and UA for GDPR proof.
    // We never store the raw IP for longer than necessary — only on the
    // consent event itself, not on every read. We truncate UA to 256 chars.
    const consentIp = clientKey(req);
    const consentUa = (req.headers.get("user-agent") ?? "").slice(0, 256);
    const consentedAt = new Date();

    await prisma.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: {
        consent,
        locale,
        consentIp,
        consentUa,
        consentedAt,
        // Re-subscribing clears any prior unsubscribe.
        unsubscribedAt: null
      },
      create: {
        email: email.toLowerCase(),
        consent,
        locale,
        consentIp,
        consentUa,
        consentedAt
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
