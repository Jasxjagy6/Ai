import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { sessionView } from "@/lib/telegram-control";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";
import { runChargedValidatorTask } from "@/lib/validator-credits";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  antiDetectEnabled: z.boolean().optional(),
  proxyEnabled: z.boolean().optional(),
  proxyLabel: z.string().trim().max(100).nullable().optional(),
  proxyUrl: z.string().trim().max(500).nullable().optional(),
  warmupEnabled: z.boolean().optional(),
  warmupMode: z.enum(["off", "safe", "standard"]).optional(),
});
const actionSchema = z.object({ action: z.enum(["spam_check", "warmup"]) });

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const session = await prisma.telegramSession.findFirst({
    where: { id: (await params).id, accountId: account.id },
  });
  return session
    ? NextResponse.json({ session: sessionView(session) })
    : NextResponse.json(
        { error: "Telegram session not found" },
        { status: 404 },
      );
}

export async function PATCH(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter valid session settings" },
      { status: 400 },
    );
  const id = (await params).id;
  const exists = await prisma.telegramSession.findFirst({
    where: { id, accountId: account.id },
    select: { id: true },
  });
  if (!exists)
    return NextResponse.json(
      { error: "Telegram session not found" },
      { status: 404 },
    );
  const { proxyUrl, ...data } = parsed.data;
  const session = await prisma.telegramSession.update({
    where: { id },
    data: {
      ...data,
      ...(proxyUrl !== undefined
        ? { proxyEncrypted: proxyUrl ? encryptTelegramData(proxyUrl) : null }
        : {}),
    },
  });
  return NextResponse.json({ session: sessionView(session) });
}

export async function POST(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid session action" },
      { status: 400 },
    );
  const id = (await params).id;
  const exists = await prisma.telegramSession.findFirst({
    where: { id, accountId: account.id, status: "active", isLoggedIn: true },
    select: { id: true },
  });
  if (!exists)
    return NextResponse.json(
      { error: "An active Telegram session is required" },
      { status: 409 },
    );
  const data =
    parsed.data.action === "spam_check"
      ? { spamCheckRequested: true, spamCheckClaimedAt: null }
      : { warmupRequested: true, warmupClaimedAt: null };
  const session = await runChargedValidatorTask(
    {
      accountId: account.id,
      accessKeyId: account.accessKeyId,
      taskCode:
        parsed.data.action === "spam_check" ? "spam_check" : "session_warmup",
      sessions: 1,
      description:
        parsed.data.action === "spam_check"
          ? "Run a SpamBot safety check"
          : "Queue a session warmup action",
    },
    () => prisma.telegramSession.update({ where: { id }, data }),
  );
  return NextResponse.json({ session: sessionView(session) }, { status: 202 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const deleted = await prisma.telegramSession.deleteMany({
    where: { id: (await params).id, accountId: account.id },
  });
  return deleted.count
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { error: "Telegram session not found" },
        { status: 404 },
      );
}
