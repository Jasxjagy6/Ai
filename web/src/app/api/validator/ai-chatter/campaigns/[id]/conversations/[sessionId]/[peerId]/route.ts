import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = {
  params: Promise<{ id: string; sessionId: string; peerId: string }>;
};
const updateSchema = z.object({ enabled: z.boolean() });

async function ownedConversation(accountId: string, context: Context) {
  const { id: campaignId, sessionId, peerId: value } = await context.params;
  if (!/^-?\d+$/.test(value)) return null;
  const peerId = BigInt(value);
  const memory = await prisma.aiChatMemory.findFirst({
    where: { campaignId, sessionId, peerId, accountId },
    select: { id: true },
  });
  return memory ? { campaignId, sessionId, peerId } : null;
}

export async function GET(_request: Request, context: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const target = await ownedConversation(account.id, context);
  if (!target) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const [memory, setting, logs] = await Promise.all([
    prisma.aiChatMemory.findFirst({
      where: target,
      include: { session: { select: { label: true, username: true, phone: true } } },
    }),
    prisma.aiChatSetting.findFirst({ where: target }),
    prisma.aiResponseLog.findMany({
      where: { ...target, accountId: account.id },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        status: true,
        provider: true,
        category: true,
        incomingText: true,
        responseText: true,
        isFollowUp: true,
        didConvert: true,
        errorCode: true,
        errorMessage: true,
        incomingMsgId: true,
        outgoingMsgId: true,
        createdAt: true,
      },
    }),
  ]);
  if (!memory) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({
    conversation: {
      ...memory,
      peerId: memory.peerId.toString(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose whether AI is enabled for this chat" }, { status: 400 });
  }
  const target = await ownedConversation(account.id, context);
  if (!target) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const setting = await prisma.aiChatSetting.upsert({
    where: { campaignId_sessionId_peerId: target },
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
  await prisma.$transaction([
    prisma.aiChatJob.updateMany({
      where: { ...target, status: { in: ["pending", "processing"] } },
      data: {
        status: "cancelled",
        errorCode: "MEMORY_CLEARED",
        errorMessage: "Conversation memory cleared",
        finishedAt: new Date(),
      },
    }),
    prisma.aiChatMemory.deleteMany({ where: { accountId: account.id, ...target } }),
  ]);
  return NextResponse.json({ ok: true });
}
