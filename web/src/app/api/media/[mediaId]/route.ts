import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Serve a persona media file to a signed-in user.
 * Only serves media that was actually sent to this user in one of their
 * conversations (or to admins) — the vault itself is not browsable.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { mediaId } = await params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role !== "ADMIN") {
    const wasSentToUser = await prisma.message.findFirst({
      where: { mediaId, conversation: { userId: user.id } },
      select: { id: true },
    });
    if (!wasSentToUser) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, asset.path);
  // path.join with a DB value — guard traversal
  if (!filePath.startsWith(UPLOAD_DIR) || !existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
