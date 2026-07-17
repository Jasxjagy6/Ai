import { NextResponse } from "next/server";
import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MediaCategory } from "@prisma/client";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

/** Upload a media asset for a persona (multipart form). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: personaId } = await params;

  const persona = await prisma.persona.findUnique({ where: { id: personaId } });
  if (!persona) return NextResponse.json({ error: "Persona not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });

  const file = form.get("file");
  const category = String(form.get("category") ?? "CASUAL") as MediaCategory;
  const description = String(form.get("description") ?? "").slice(0, 200);

  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only jpeg/png/webp/gif allowed" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Max 8MB" }, { status: 400 });
  if (!Object.values(MediaCategory).includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  const dir = path.join(UPLOAD_DIR, personaId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const asset = await prisma.mediaAsset.create({
    data: { personaId, category, description, path: `${personaId}/${name}` },
  });
  return NextResponse.json({ asset });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: personaId } = await params;

  const assets = await prisma.mediaAsset.findMany({
    where: { personaId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ assets });
}
