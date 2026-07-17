import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** What the companion remembers about you — transparency feature. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const personaId = url.searchParams.get("personaId") ?? undefined;

  const memories = await prisma.userMemory.findMany({
    where: { userId: user.id, ...(personaId && { personaId }) },
    orderBy: { createdAt: "desc" },
    include: { persona: { select: { name: true } } },
  });
  return NextResponse.json({
    memories: memories.map((m) => ({
      id: m.id,
      fact: m.fact,
      persona: m.persona.name,
      createdAt: m.createdAt,
    })),
  });
}
