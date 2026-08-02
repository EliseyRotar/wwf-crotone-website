import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTurn } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validateOrigin } from "@/lib/csrf";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return buf.length >= 12 &&
      buf.slice(0, 4).toString("ascii") === "RIFF" &&
      buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "application/pdf") {
    return buf.length >= 4 &&
      buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    if (!validateOrigin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!(await rateLimit(`receipt:${clientKey(req)}`, 10, 900_000))) {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const iscrizioneId = form.get("iscrizioneId") as string;

    if (!file || !iscrizioneId)
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

    if (!ALLOWED.includes(file.type))
      return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });

    if (file.size > MAX_SIZE)
      return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });

    const iscrizione = await prisma.iscrizione.findUnique({ where: { id: iscrizioneId } });
    if (!iscrizione) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    if (!canAccessTurn(session, iscrizione.turnoId)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    if (!validateMagicBytes(buf, file.type)) {
      return NextResponse.json({ ok: false, error: "invalid-content" }, { status: 400 });
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const name = `${crypto.randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);

    const filePath = `/uploads/receipts/${name}`;
    await prisma.receipt.create({
      data: { iscrizioneId, fileName: file.name, filePath, mimeType: file.type }
    });

    return NextResponse.json({ ok: true, path: filePath });
  } catch (err) {
    console.error("receipt upload error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
