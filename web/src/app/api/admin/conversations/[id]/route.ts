import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Read a single conversation's full transcript for the admin monitor. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      tone: true,
      language: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
      persona: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, kind: true, mediaId: true, imagePath: true, createdAt: true },
      },
    },
  });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation: convo });
}
