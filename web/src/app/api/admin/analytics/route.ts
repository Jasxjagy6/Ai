import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Analytics: 14-day message volume, tone/language/persona breakdowns, and
 * feature usage (voice notes, vision) — the operator dashboard from CapitalAI's
 * "detailed statistics", adapted for the companion product.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    dailyUsage,
    toneRows,
    langRows,
    personaRows,
    voiceCount,
    visionCount,
    totalMessages,
    totalConvos,
  ] = await Promise.all([
    prisma.usageLog.groupBy({
      by: ["day"],
      _sum: { messages: true },
      where: { day: { gte: since } },
      orderBy: { day: "asc" },
    }),
    prisma.conversation.groupBy({ by: ["tone"], _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ["language"], _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ["personaId"], _count: { _all: true } }),
    prisma.message.count({ where: { kind: "voice" } }),
    prisma.message.count({ where: { imagePath: { not: null } } }),
    prisma.message.count(),
    prisma.conversation.count(),
  ]);

  // resolve persona names
  const personas = await prisma.persona.findMany({ select: { id: true, name: true } });
  const personaName = new Map(personas.map((p) => [p.id, p.name]));

  return NextResponse.json({
    daily: dailyUsage.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      messages: d._sum.messages ?? 0,
    })),
    tones: toneRows.map((t) => ({ tone: t.tone, count: t._count._all })).sort((a, b) => b.count - a.count),
    languages: langRows.map((l) => ({ language: l.language, count: l._count._all })).sort((a, b) => b.count - a.count),
    personas: personaRows
      .map((p) => ({ persona: p.personaId ? personaName.get(p.personaId) ?? "—" : "—", count: p._count._all }))
      .sort((a, b) => b.count - a.count),
    features: { voiceNotes: voiceCount, visionPhotos: visionCount },
    totals: { messages: totalMessages, conversations: totalConvos },
  });
}
