import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiConfig, aiCredentialView, validateAiProvider } from "@/lib/ai-chatter";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const saveSchema = z.object({
  provider: z.enum(["capitalbot", "cupidbot"]),
  secret: z.string().trim().min(8).max(1000),
  modelId: z.number().int().positive().nullable().optional(),
  presetId: z.number().int().positive().nullable().optional(),
});
const updateSchema = z.object({
  provider: z.literal("capitalbot"),
  modelId: z.number().int().positive(),
  presetId: z.number().int().positive(),
});
const deleteSchema = z.object({ provider: z.enum(["capitalbot", "cupidbot"]) });

export async function PUT(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid provider credential" }, { status: 400 });
  try {
    const result = await validateAiProvider(parsed.data.provider, parsed.data.secret);
    if (!result.valid) return NextResponse.json({ error: result.error || "Provider rejected this credential" }, { status: 422 });
    const catalog = result.catalog as { models?: Array<Record<string, unknown>>; presets?: Array<Record<string, unknown>> } | null;
    const firstModel = catalog?.models?.[0];
    const firstPreset = catalog?.presets?.[0];
    const modelId = parsed.data.modelId
      ?? (Number(firstModel?.modelId || firstModel?.id || 0) || null);
    const presetId = parsed.data.presetId
      ?? (Number(firstPreset?.id || firstPreset?.presetId || 0) || null);
    const credential = await prisma.aiProviderCredential.upsert({
      where: { accountId_provider: { accountId: account.id, provider: parsed.data.provider } },
      create: {
        accountId: account.id,
        provider: parsed.data.provider,
        secretEncrypted: encryptTelegramData(parsed.data.secret),
        isValid: true,
        modelId,
        presetId,
        catalog: result.catalog || undefined,
        lastValidatedAt: new Date(),
      },
      update: {
        secretEncrypted: encryptTelegramData(parsed.data.secret),
        isValid: true,
        modelId,
        presetId,
        catalog: result.catalog || undefined,
        lastValidatedAt: new Date(),
        validationError: null,
      },
    });
    return NextResponse.json({ provider: aiCredentialView(credential) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider validation failed" }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid CapitalBot model and preset" }, { status: 400 });
  const credential = await prisma.aiProviderCredential.findUnique({
    where: { accountId_provider: { accountId: account.id, provider: "capitalbot" } },
  });
  if (!credential) return NextResponse.json({ error: "Add a CapitalBot license key first" }, { status: 404 });
  const updated = await prisma.aiProviderCredential.update({
    where: { id: credential.id },
    data: { modelId: parsed.data.modelId, presetId: parsed.data.presetId },
  });
  return NextResponse.json({ provider: aiCredentialView(updated) });
}

export async function DELETE(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid provider" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.aiProviderCredential.deleteMany({ where: { accountId: account.id, provider: parsed.data.provider } });
    const setting = await tx.aiAccountSetting.findUnique({ where: { accountId: account.id } });
    if (aiConfig(setting?.config).provider === parsed.data.provider) {
      await tx.aiAccountSetting.updateMany({ where: { accountId: account.id }, data: { enabled: false } });
      await tx.aiSessionSetting.updateMany({ where: { accountId: account.id }, data: { runtimeStatus: "stopping" } });
    }
  });
  return NextResponse.json({ ok: true });
}
