import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ status: z.enum(["active", "paused"]).optional(), nextRunAt: z.coerce.date().optional() });

export async function PATCH(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ error: "Invalid schedule update" }, { status: 400 });
  const id = (await params).id;
  const exists = await prisma.telegramMessageSchedule.findFirst({ where: { id, accountId: account.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  return NextResponse.json({ schedule: await prisma.telegramMessageSchedule.update({ where: { id }, data: parsed.data }) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const deleted = await prisma.telegramMessageSchedule.deleteMany({ where: { id: (await params).id, accountId: account.id } });
  return deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Schedule not found" }, { status: 404 });
}
