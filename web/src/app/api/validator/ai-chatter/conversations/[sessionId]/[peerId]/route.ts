import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ sessionId: string; peerId: string }> };
const updateSchema = z.object({ enabled: z.boolean() });

async function ownedConversation(accountId: string, context: Context) {
  const { sessionId, peerId: value } = await context.params;
  if (!/^-?\d+$/.test(value)) return null;
  const peerId = BigInt(value);
  const session = await prisma.telegramSession.findFirst({ where: { id: sessionId, accountId }, select: { id: true } });
  return session ? { sessionId, peerId } : null;
}

export async function GET(_request: Request, context: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const target = await ownedConversation(account.id, context);
  if (!target) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const [memory, setting, logs] = await Promise.all([
    prisma.aiChatMemory.findUnique({
      where: { sessionId_peerId: target },
      include: { session: { select: { label: true, username: true, phone: true } } },
    }),
    prisma.aiChatSetting.findUnique({ where: { sessionId_peerId: target } }),
    prisma.aiResponseLog.findMany({
      where: { sessionId: target.sessionId, peerId: target.peerId, accountId: account.id },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true, status: true, provider: true, category: true, incomingText: true, responseText: true,
        isFollowUp: true, didConvert: true, errorCode: true, errorMessage: true, incomingMsgId: true,
        outgoingMsgId: true, createdAt: true,
      },
    }),
  ]);
  if (!memory) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({
    conversation: {
      ...memory,
      peerId: memory.peerId.toString(),
      messages: memory.messages,
      setting: setting ? { enabled: setting.enabled, config: setting.config } : null,
    },
    logs: logs.map((log) => ({
      ...log,
      incomingMsgId: log.incomingMsgId?.toString() || null,
      outgoingMsgId: log.outgoingMsgId?.toString() || null,
    })),
  });
}

export async function PATCH(request: Request, context: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose whether AI is enabled for this chat" }, { status: 400 });
  const target = await ownedConversation(account.id, context);
  if (!target) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const setting = await prisma.aiChatSetting.upsert({
    where: { sessionId_peerId: target },
    create: { accountId: account.id, ...target, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  });
  return NextResponse.json({ setting: { enabled: setting.enabled, config: setting.config } });
}

export async function DELETE(_request: Request, context: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const target = await ownedConversation(account.id, context);
  if (!target) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  await prisma.aiChatMemory.deleteMany({ where: { accountId: account.id, ...target } });
  return NextResponse.json({ ok: true });
}
