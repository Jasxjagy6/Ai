import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai-chatter";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  enabled: z.boolean(),
  catchup: z.boolean().optional().default(true),
  provider: z.enum(["capitalbot", "cupidbot"]).optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid AI session settings" }, { status: 400 });
  const id = (await params).id;
  const session = await prisma.telegramSession.findFirst({ where: { id, accountId: account.id } });
  if (!session) return NextResponse.json({ error: "Telegram session not found" }, { status: 404 });
  if (parsed.data.enabled && (!session.isLoggedIn || session.status !== "active" || session.spamStatus === "frozen")) {
    return NextResponse.json({ error: "AI Chatter requires an active, non-frozen Telegram session" }, { status: 409 });
  }
  const accountSetting = await prisma.aiAccountSetting.findUnique({ where: { accountId: account.id } });
  const config = aiConfig({ ...aiConfig(accountSetting?.config), ...(parsed.data.provider ? { provider: parsed.data.provider } : {}) });
  if (parsed.data.enabled) {
    const credential = await prisma.aiProviderCredential.findUnique({
      where: { accountId_provider: { accountId: account.id, provider: config.provider } },
    });
    if (!credential?.isValid) return NextResponse.json({ error: `Add and validate ${config.provider} first` }, { status: 409 });
  }
  const setting = await prisma.aiSessionSetting.upsert({
    where: { sessionId: id },
    create: {
      accountId: account.id, sessionId: id, enabled: parsed.data.enabled,
      config: parsed.data.provider ? { provider: parsed.data.provider } : undefined,
      runtimeStatus: parsed.data.enabled ? "starting" : "stopped",
      catchupRequested: parsed.data.enabled && parsed.data.catchup,
    },
    update: {
      enabled: parsed.data.enabled,
      ...(parsed.data.provider ? { config: { provider: parsed.data.provider } } : {}),
      runtimeStatus: parsed.data.enabled ? "starting" : "stopping",
      catchupRequested: parsed.data.enabled && parsed.data.catchup,
      catchupClaimedAt: null,
      lastError: null,
    },
  });
  return NextResponse.json({ setting });
}
