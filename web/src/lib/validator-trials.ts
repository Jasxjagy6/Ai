import { createHash, createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const TELEGRAM_TRIAL_DAYS = 7;
export const TELEGRAM_TRIAL_CREDITS = 2500;

function trialSecret() {
  const value = process.env.VALIDATOR_TRIAL_SECRET?.trim();
  if (!value || value.length < 32)
    throw new Error("Validator trial service is not configured");
  return value;
}

function trialKey(telegramUserId: bigint) {
  const token = createHmac("sha256", trialSecret())
    .update(`signal-desk-trial:${telegramUserId}`)
    .digest("base64url");
  return `tgv_trial_${token}`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function trialView(
  trial: {
    telegramUserId: bigint;
    creditsGranted: number;
    claimedAt: Date;
    expiresAt: Date;
    account: { email: string; creditsBalance: number };
  },
  alreadyClaimed: boolean,
) {
  return {
    key: trialKey(trial.telegramUserId),
    alreadyClaimed,
    email: trial.account.email,
    creditsGranted: trial.creditsGranted,
    creditsBalance: trial.account.creditsBalance,
    claimedAt: trial.claimedAt,
    expiresAt: trial.expiresAt,
    trialDays: TELEGRAM_TRIAL_DAYS,
  };
}

export async function claimTelegramTrial(input: {
  telegramUserId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`telegram-trial:${input.telegramUserId}`}))`;
      const existing = await transaction.validatorTelegramTrial.findUnique({
        where: { telegramUserId: input.telegramUserId },
        include: {
          account: { select: { email: true, creditsBalance: true } },
        },
      });
      if (existing) {
        if (
          existing.telegramUsername !== (input.username || null) ||
          existing.telegramFirstName !== (input.firstName || null) ||
          existing.telegramLastName !== (input.lastName || null)
        ) {
          await transaction.validatorTelegramTrial.update({
            where: { id: existing.id },
            data: {
              telegramUsername: input.username || null,
              telegramFirstName: input.firstName || null,
              telegramLastName: input.lastName || null,
            },
          });
        }
        return trialView(existing, true);
      }

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + TELEGRAM_TRIAL_DAYS * 24 * 60 * 60 * 1000,
      );
      const rawKey = trialKey(input.telegramUserId);
      const email = `telegram-${input.telegramUserId}@trial.signal-desk.local`;
      const account = await transaction.validatorAccount.create({
        data: {
          email,
          currentPlanCode: "trial",
          planExpiresAt: expiresAt,
          lastCreditTopupAt: now,
          creditsBalance: TELEGRAM_TRIAL_CREDITS,
          creditsPurchased: TELEGRAM_TRIAL_CREDITS,
        },
      });
      const key = await transaction.validatorAccessKey.create({
        data: {
          accountId: account.id,
          label: "Telegram 7-day trial",
          keyHash: hash(rawKey),
          prefix: `${rawKey.slice(0, 15)}...`,
          expiresAt,
          planCode: "trial",
          validatorAccess: true,
          messagingAccess: true,
          requestLimit: null,
          sessionLimit: null,
          messageLimit: null,
        },
      });
      const trial = await transaction.validatorTelegramTrial.create({
        data: {
          telegramUserId: input.telegramUserId,
          telegramUsername: input.username || null,
          telegramFirstName: input.firstName || null,
          telegramLastName: input.lastName || null,
          accountId: account.id,
          accessKeyId: key.id,
          creditsGranted: TELEGRAM_TRIAL_CREDITS,
          expiresAt,
        },
        include: {
          account: { select: { email: true, creditsBalance: true } },
        },
      });
      await transaction.validatorCreditTransaction.create({
        data: {
          accountId: account.id,
          accessKeyId: key.id,
          amount: TELEGRAM_TRIAL_CREDITS,
          balanceAfter: TELEGRAM_TRIAL_CREDITS,
          kind: "trial_grant",
          description: "Telegram bot 7-day trial credits",
          referenceType: "telegram_trial",
          referenceId: trial.id,
          metadata: {
            telegramUserId: input.telegramUserId.toString(),
            trialDays: TELEGRAM_TRIAL_DAYS,
          } satisfies Prisma.InputJsonValue,
        },
      });
      return trialView(trial, false);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    },
  );
}
