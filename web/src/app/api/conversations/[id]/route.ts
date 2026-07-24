import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const convo = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    include: {
      persona: { select: { id: true, name: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, role: true, content: true, mediaId: true,
          kind: true, audioPath: true, imagePath: true, createdAt: true,
        },
      },
    },
  });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation: convo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.conversation.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
