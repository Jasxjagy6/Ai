import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  sessionIds: z.array(z.string().min(1)).max(500).default([]),
});

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const lists = await prisma.telegramSessionList.findMany({
    where: { accountId: account.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { members: { orderBy: { position: "asc" }, include: { session: { select: { id: true, label: true, username: true, phone: true, status: true, isLoggedIn: true } } } } },
  });
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid fleet settings" }, { status: 400 });
  const sessionIds = [...new Set(parsed.data.sessionIds)];
  const count = await prisma.telegramSession.count({ where: { id: { in: sessionIds }, accountId: account.id } });
  if (count !== sessionIds.length) return NextResponse.json({ error: "One or more Telegram sessions were not found" }, { status: 400 });
  const list = await prisma.telegramSessionList.create({
    data: {
      accountId: account.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      members: { create: sessionIds.map((sessionId, position) => ({ sessionId, position })) },
    },
    include: { members: { orderBy: { position: "asc" }, include: { session: { select: { id: true, label: true, username: true, phone: true, status: true, isLoggedIn: true } } } } },
  }).catch(() => null);
  return list ? NextResponse.json({ list }, { status: 201 }) : NextResponse.json({ error: "A fleet with this name already exists" }, { status: 409 });
}
