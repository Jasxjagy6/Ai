import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const credentialSchema = z.object({
  apiId: z.coerce.number().int().positive().max(2_147_483_647),
  apiHash: z.string().trim().regex(/^[a-fA-F0-9]{32}$/, "api_hash must contain 32 hexadecimal characters"),
  label: z.string().trim().min(1).max(80).default("Telegram API"),
});

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const credential = await prisma.telegramApiCredential.findUnique({
    where: { accountId: account.id },
    select: { id: true, label: true, apiId: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ credential });
}

export async function PUT(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const parsed = credentialSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid Telegram API credentials" }, { status: 400 });
    const credential = await prisma.telegramApiCredential.upsert({
      where: { accountId: account.id },
      update: { apiId: parsed.data.apiId, apiHashEncrypted: encryptTelegramData(parsed.data.apiHash.toLowerCase()), label: parsed.data.label },
      create: { accountId: account.id, apiId: parsed.data.apiId, apiHashEncrypted: encryptTelegramData(parsed.data.apiHash.toLowerCase()), label: parsed.data.label },
      select: { id: true, label: true, apiId: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ credential });
  } catch (error) {
    return validatorError(error);
  }
}

export async function DELETE() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const sessionCount = await prisma.telegramSession.count({ where: { accountId: account.id } });
  if (sessionCount) return NextResponse.json({ error: "Delete Telegram sessions before removing their API credentials" }, { status: 409 });
  await prisma.telegramApiCredential.deleteMany({ where: { accountId: account.id } });
  return NextResponse.json({ ok: true });
}
