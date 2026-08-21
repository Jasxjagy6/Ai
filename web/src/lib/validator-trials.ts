import { createHash, createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptValidatorAccessKey } from "@/lib/validator-auth";

export const TELEGRAM_TRIAL_DAYS = 7;

function trialSecret() {
  const value = process.env.VALIDATOR_TRIAL_SECRET?.trim();
  if (!value || value.length < 32)
    throw new Error("Validator trial service is not configured");
  return value;
}

export function telegramTrialKey(telegramUserId: bigint) {
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
    claimedAt: Date;
    expiresAt: Date;
    account: { email: string };
  },
  alreadyClaimed: boolean,
) {
  return {
    key: telegramTrialKey(trial.telegramUserId),
    alreadyClaimed,
    email: trial.account.email,
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
          account: { select: { email: true } },
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
      const rawKey = telegramTrialKey(input.telegramUserId);
      const email = `telegram-${input.telegramUserId}@trial.signal-desk.local`;
      const account = await transaction.validatorAccount.create({
        data: {
          email,
          currentPlanCode: "trial",
          planExpiresAt: expiresAt,
        },
      });
      const key = await transaction.validatorAccessKey.create({
        data: {
          accountId: account.id,
          label: "Telegram 7-day trial",
          keyHash: hash(rawKey),
          prefix: `${rawKey.slice(0, 15)}...`,
          rawKeyEncrypted: encryptValidatorAccessKey(rawKey),
          expiresAt: null,
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
          creditsGranted: 0,
          expiresAt,
        },
        include: {
          account: { select: { email: true } },
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
