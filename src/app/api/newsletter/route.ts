import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  consent: z.boolean().refine((v) => v === true, { message: "consent required" }),
  locale: z.enum(["it", "en"]).default("it")
});

export async function POST(req: Request) {
  try {
    // Rate limit: 5 per hour per IP
    if (!rateLimit(`nl:${clientKey(req)}`, 5, 3600_000)) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const { email, consent, locale } = parsed.data;

    await prisma.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: { consent, locale },
      create: { email: email.toLowerCase(), consent, locale }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}