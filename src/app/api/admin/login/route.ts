import { NextResponse } from "next/server";
import { authenticate, signSession, setSessionCookie } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { validateOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ipKey = clientKey(req);
    if (!(await rateLimit(`login:${ipKey}`, 10, 900_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const user = await authenticate(String(email), String(password));
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
