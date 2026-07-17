import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  banned: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  tier: z.enum(["FREE", "PLUS", "PRO"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { banned, role, tier } = parsed.data;

  if (id === admin.id && (banned === true || role === "USER")) {
    return NextResponse.json({ error: "You cannot demote or ban yourself" }, { status: 400 });
  }

  if (banned !== undefined || role !== undefined) {
    await prisma.user.update({
      where: { id },
      data: { ...(banned !== undefined && { banned }), ...(role !== undefined && { role }) },
    });
  }

  if (tier !== undefined) {
    const periodEnd = tier === "FREE" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.subscription.upsert({
      where: { userId: id },
      update: { tier, status: "ACTIVE", currentPeriodEnd: periodEnd },
      create: { userId: id, tier, status: "ACTIVE", currentPeriodEnd: periodEnd },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === admin.id) return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
