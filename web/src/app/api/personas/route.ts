import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/usage";

/** List active personas visible to the current user (with tier gating info). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getUserTier(user.id);
  const tierRank: Record<string, number> = { FREE: 0, PLUS: 1, PRO: 2 };

  const personas = await prisma.persona.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      age: true,
      avatarUrl: true,
      chatStyle: true,
      minTier: true,
      isDefault: true,
    },
  });

  return NextResponse.json({
    personas: personas.map((p) => ({
      ...p,
      locked: tierRank[p.minTier] > tierRank[tier],
    })),
    tier,
  });
}
