import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  tagline: z.string().max(120).optional(),
  age: z.number().int().min(18).max(99).optional(),
  systemPrompt: z.string().min(20).max(8000).optional(),
  chatStyle: z.enum(["youthful", "mature"]).optional(),
  avatarUrl: z.string().max(300).optional(),
  minTier: z.enum(["FREE", "PLUS", "PRO"]).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.isDefault) {
    await prisma.persona.updateMany({ data: { isDefault: false } });
  }
  const persona = await prisma.persona.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ persona });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  await prisma.persona.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
