import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  revoked: z.boolean().optional(),
  validatorAccess: z.boolean().optional(),
  messagingAccess: z.boolean().optional(),
  requestLimit: z.number().int().positive().max(100_000_000).nullable().optional(),
  sessionLimit: z.number().int().positive().max(10_000).nullable().optional(),
  messageLimit: z.number().int().positive().max(100_000_000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const current = await prisma.validatorAccessKey.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  const validatorAccess = parsed.data.validatorAccess ?? current.validatorAccess;
  const messagingAccess = parsed.data.messagingAccess ?? current.messagingAccess;
  if (!validatorAccess && !messagingAccess) return NextResponse.json({ error: "Enable validator or messaging access" }, { status: 400 });
  const key = await prisma.validatorAccessKey.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  if (parsed.data.revoked) await prisma.validatorSession.deleteMany({ where: { accessKeyId: key.id } });
  return NextResponse.json({ ok: true, id: key.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const key = await prisma.validatorAccessKey.findUnique({ where: { id } });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  await prisma.$transaction([
    prisma.validatorSession.deleteMany({ where: { accessKeyId: key.id } }),
    prisma.validatorAccessKey.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
