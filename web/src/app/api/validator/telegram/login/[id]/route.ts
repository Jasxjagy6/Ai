import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };
const submitSchema = z.union([
  z.object({ action: z.literal("code"), code: z.string().trim().regex(/^\d{3,8}$/) }),
  z.object({ action: z.literal("password"), password: z.string().min(1).max(256) }),
]);

function flowView(flow: { id: string; phone: string; label: string; status: string; errorCode: string | null; errorMessage: string | null; sessionId: string | null; expiresAt: Date; createdAt: Date; updatedAt: Date }) {
  return {
    id: flow.id,
    phone: flow.phone,
    label: flow.label,
    status: flow.status,
    errorCode: flow.errorCode,
    errorMessage: flow.errorMessage,
    sessionId: flow.sessionId,
    expiresAt: flow.expiresAt,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const flow = await prisma.telegramLoginFlow.findFirst({ where: { id: (await params).id, accountId: account.id } });
  return flow ? NextResponse.json({ flow: flowView(flow) }) : NextResponse.json({ error: "Telegram login not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid Telegram code or 2FA password" }, { status: 400 });
  const id = (await params).id;
  const flow = await prisma.telegramLoginFlow.findFirst({ where: { id, accountId: account.id } });
  if (!flow) return NextResponse.json({ error: "Telegram login not found" }, { status: 404 });
  if (flow.expiresAt <= new Date()) return NextResponse.json({ error: "This login attempt expired. Start again." }, { status: 410 });
  if (parsed.data.action === "code" && flow.status !== "awaiting_code") return NextResponse.json({ error: "This login is not waiting for a code" }, { status: 409 });
  if (parsed.data.action === "password" && flow.status !== "awaiting_password") return NextResponse.json({ error: "This login is not waiting for a 2FA password" }, { status: 409 });
  const updated = await prisma.telegramLoginFlow.update({
    where: { id },
    data: parsed.data.action === "code"
      ? { codeEncrypted: encryptTelegramData(parsed.data.code), status: "queued_sign_in", errorCode: null, errorMessage: null }
      : { passwordEncrypted: encryptTelegramData(parsed.data.password), status: "queued_password", errorCode: null, errorMessage: null },
  });
  return NextResponse.json({ flow: flowView(updated) }, { status: 202 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const flow = await prisma.telegramLoginFlow.findFirst({ where: { id: (await params).id, accountId: account.id }, select: { id: true, status: true } });
  if (!flow) return NextResponse.json({ error: "Telegram login not found" }, { status: 404 });
  await prisma.telegramLoginFlow.update({ where: { id: flow.id }, data: { status: "cancelled", codeEncrypted: null, passwordEncrypted: null, phoneCodeHashEncrypted: null, sessionDataEncrypted: null } });
  return NextResponse.json({ ok: true });
}
