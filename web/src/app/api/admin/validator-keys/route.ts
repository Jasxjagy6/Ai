import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createValidatorAccessKey } from "@/lib/validator-auth";

const createSchema = z.object({
  email: z.string().email().max(254),
  label: z.string().trim().min(1).max(80).default("Primary key"),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  validatorAccess: z.boolean().default(true),
  messagingAccess: z.boolean().default(false),
  requestLimit: z.number().int().positive().max(100_000_000).nullable().default(null),
  sessionLimit: z.number().int().positive().max(10_000).nullable().default(null),
  messageLimit: z.number().int().positive().max(100_000_000).nullable().default(null),
}).refine((value) => value.validatorAccess || value.messagingAccess, {
  message: "Enable validator or messaging access",
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const accounts = await prisma.validatorAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      keys: { orderBy: { createdAt: "desc" } },
      _count: { select: { lists: true, jobs: true, telegramSessions: true, telegramCampaigns: true } },
    },
  });
  return NextResponse.json({ accounts: accounts.map((account) => ({
    id: account.id,
    email: account.email,
    active: account.active,
    createdAt: account.createdAt,
    listsCount: account._count.lists,
    jobsCount: account._count.jobs,
    telegramSessionsCount: account._count.telegramSessions,
    telegramCampaignsCount: account._count.telegramCampaigns,
    keys: account.keys.map((key) => ({
      id: key.id,
      label: key.label,
      prefix: key.prefix,
      revoked: key.revoked,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      validatorAccess: key.validatorAccess,
      messagingAccess: key.messagingAccess,
      requestLimit: key.requestLimit,
      requestsUsed: key.requestsUsed,
      sessionLimit: key.sessionLimit,
      messageLimit: key.messageLimit,
      messagesUsed: key.messagesUsed,
    })),
  })) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid key settings" }, { status: 400 });
  const { raw, keyHash, prefix } = createValidatorAccessKey();
  const email = parsed.data.email.toLowerCase();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const account = await prisma.validatorAccount.upsert({
    where: { email },
    update: { active: true },
    create: { email },
  });
  const key = await prisma.validatorAccessKey.create({
    data: {
      accountId: account.id,
      createdById: admin.id,
      label: parsed.data.label,
      keyHash,
      prefix,
      expiresAt,
      validatorAccess: parsed.data.validatorAccess,
      messagingAccess: parsed.data.messagingAccess,
      requestLimit: parsed.data.requestLimit,
      sessionLimit: parsed.data.sessionLimit,
      messageLimit: parsed.data.messageLimit,
    },
  });
  return NextResponse.json({
    key: raw,
    record: {
      id: key.id,
      label: key.label,
      prefix: key.prefix,
      expiresAt: key.expiresAt,
      validatorAccess: key.validatorAccess,
      messagingAccess: key.messagingAccess,
      requestLimit: key.requestLimit,
      sessionLimit: key.sessionLimit,
      messageLimit: key.messageLimit,
      createdAt: key.createdAt,
    },
    account: { id: account.id, email: account.email },
  }, { status: 201 });
}
