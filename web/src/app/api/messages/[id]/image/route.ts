import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUpload, IMAGE_MIME } from "@/lib/uploads";

/** Serve a user-uploaded (vision) image for a message the caller owns. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const msg = await prisma.message.findFirst({
    where: { id, conversation: { userId: user.id } },
    select: { imagePath: true },
  });
  if (!msg?.imagePath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const abs = resolveUpload(msg.imagePath);
  if (!abs || !existsSync(abs)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stat = statSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": IMAGE_MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
