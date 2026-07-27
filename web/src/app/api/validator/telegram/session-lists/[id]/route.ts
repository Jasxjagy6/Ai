import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  sessionIds: z.array(z.string().min(1)).max(500),
});

export async function PUT(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid Session List settings" }, { status: 400 });
  const id = (await params).id;
  const exists = await prisma.telegramSessionList.findFirst({ where: { id, accountId: account.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Session List not found" }, { status: 404 });
  const sessionIds = [...new Set(parsed.data.sessionIds)];
  const count = await prisma.telegramSession.count({ where: { id: { in: sessionIds }, accountId: account.id } });
  if (count !== sessionIds.length) return NextResponse.json({ error: "One or more Telegram sessions were not found" }, { status: 400 });
  const list = await prisma.$transaction(async (transaction) => {
    await transaction.telegramSessionListMember.deleteMany({ where: { listId: id } });
    return transaction.telegramSessionList.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description || null, members: { create: sessionIds.map((sessionId, position) => ({ sessionId, position })) } },
      include: { members: { orderBy: { position: "asc" }, include: { session: { select: { id: true, label: true, username: true, phone: true, status: true, isLoggedIn: true } } } } },
    });
  }).catch(() => null);
  return list ? NextResponse.json({ list }) : NextResponse.json({ error: "A Session List with this name already exists" }, { status: 409 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const deleted = await prisma.telegramSessionList.deleteMany({ where: { id: (await params).id, accountId: account.id } });
  return deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Session List not found" }, { status: 404 });
}
