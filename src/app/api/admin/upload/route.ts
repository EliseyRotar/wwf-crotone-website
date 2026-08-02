import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4"
};

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!validateOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`upload:${clientKey(req)}`, 30, 900_000))) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "no-file" }, { status: 400 });

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const sig = buf;
  let ok = false;
  if (ext === "png" && sig.length >= 4) {
    ok = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  } else if (ext === "jpg" && sig.length >= 2) {
    ok = sig[0] === 0xff && sig[1] === 0xd8;
  } else if (ext === "gif" && sig.length >= 4) {
    ok = sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46;
  } else if (ext === "webp" && sig.length >= 4) {
    ok = sig.slice(0, 4).toString("ascii") === "RIFF";
  } else if (ext === "mp4" && sig.length >= 8) {
    ok = sig.slice(4, 8).toString("hex") === "66747970";
  }
  if (!ok) {
    return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
  }

  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "gallery");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);

  return NextResponse.json({ ok: true, path: `/uploads/gallery/${name}` });
}
