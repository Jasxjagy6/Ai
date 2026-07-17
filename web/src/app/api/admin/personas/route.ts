import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const personas = await prisma.persona.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { media: true, conversations: true, memories: true } } },
  });
  return NextResponse.json({ personas });
}

const createSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,32}$/),
  name: z.string().min(1).max(40),
  tagline: z.string().max(120).optional().default(""),
  age: z.number().int().min(18).max(99).optional().default(24),
  systemPrompt: z.string().min(20).max(8000),
  chatStyle: z.enum(["youthful", "mature"]).optional().default("youthful"),
  avatarUrl: z.string().max(300).optional(),
  minTier: z.enum(["FREE", "PLUS", "PRO"]).optional().default("FREE"),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.isDefault) {
    await prisma.persona.updateMany({ data: { isDefault: false } });
  }
  const persona = await prisma.persona.create({ data });
  return NextResponse.json({ persona });
}
