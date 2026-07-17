import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { PlanTier } from "@prisma/client";

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getUserTier(userId: string): Promise<PlanTier> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status !== "ACTIVE") return "FREE";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return "FREE";
  return sub.tier;
}

/**
 * Check and consume one message of today's quota.
 * Returns { ok, used, limit } — callers should 429 when !ok.
 */
export async function consumeQuota(userId: string) {
  const tier = await getUserTier(userId);
  const limit = (await getPlan(tier)).messagesPerDay;
  const day = todayUtc();

  const row = await prisma.usageLog.upsert({
    where: { userId_day: { userId, day } },
    update: { messages: { increment: 1 } },
    create: { userId, day, messages: 1 },
  });

  if (limit !== -1 && row.messages > limit) {
    // roll back the increment so retries don't inflate
    await prisma.usageLog.update({
      where: { userId_day: { userId, day } },
      data: { messages: { decrement: 1 } },
    });
    return { ok: false as const, used: row.messages - 1, limit, tier };
  }
  return { ok: true as const, used: row.messages, limit, tier };
}
