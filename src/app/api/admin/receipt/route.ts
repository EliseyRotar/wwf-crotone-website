import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const iscrizioneId = form.get("iscrizioneId") as string;

    if (!file || !iscrizioneId)
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

    if (!ALLOWED.includes(file.type))
      return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 400 });

    if (file.size > MAX_SIZE)
      return NextResponse.json({ ok: false, error: "too-big" }, { status: 400 });

    // Verify iscrizione exists
    const iscrizione = await prisma.iscrizione.findUnique({ where: { id: iscrizioneId } });
    if (!iscrizione) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type] || "bin";
    const name = `${crypto.randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
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