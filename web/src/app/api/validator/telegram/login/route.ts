import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { defaultDeviceIdentity, TelegramControlError } from "@/lib/telegram-control";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const loginSchema = z.object({
  phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid international phone number"),
  label: z.string().trim().min(1).max(100),
  proxyUrl: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const flows = await prisma.telegramLoginFlow.findMany({
    where: { accountId: account.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      phone: true,
      label: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      sessionId: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ flows });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid login details" }, { status: 400 });
    const credential = await prisma.telegramApiCredential.findUnique({ where: { accountId: account.id } });
    if (!credential) throw new TelegramControlError("Add your Telegram api_id and api_hash before logging in", 409, "TELEGRAM_CREDENTIALS_REQUIRED");
    const sessionCount = await prisma.telegramSession.count({ where: { accountId: account.id } });
    const pendingCount = await prisma.telegramLoginFlow.count({ where: { accountId: account.id, status: { in: ["queued_send_code", "sending_code", "awaiting_code", "queued_sign_in", "signing_in", "awaiting_password", "queued_password"] } } });
    if (account.sessionLimit != null && sessionCount + pendingCount >= account.sessionLimit) {
      throw new TelegramControlError(`Your plan allows ${account.sessionLimit} Telegram sessions`, 403, "TELEGRAM_SESSION_LIMIT_EXCEEDED");
    }
    const flow = await prisma.telegramLoginFlow.create({
      data: {
        accountId: account.id,
        accessKeyId: account.accessKeyId,
        credentialId: credential.id,
        phone: parsed.data.phone.startsWith("+") ? parsed.data.phone : `+${parsed.data.phone}`,
        label: parsed.data.label,
        status: "queued_send_code",
        deviceIdentity: defaultDeviceIdentity(),
        proxyEncrypted: parsed.data.proxyUrl ? encryptTelegramData(parsed.data.proxyUrl) : null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return NextResponse.json({ flow: { id: flow.id, phone: flow.phone, label: flow.label, status: flow.status, expiresAt: flow.expiresAt } }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
