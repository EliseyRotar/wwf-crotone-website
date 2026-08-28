import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const ipKey = clientKey(req);
    if (!(await rateLimit(`login:${ipKey}`, 10, 900_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await authenticate(email, password);
    if (!user) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
    }
    const token = await signSession(user);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
