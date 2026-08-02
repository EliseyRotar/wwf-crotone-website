import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, posts: [] });
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_url,permalink,caption,media_type&limit=6&access_token=${token}`
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, posts: [] });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, posts: data.data ?? [] });
  } catch {
    return NextResponse.json({ ok: false, posts: [] });
  }
}
