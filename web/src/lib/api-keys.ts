import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { getUserTier } from "@/lib/usage";

/** Generate a new API key. Returns the plaintext key ONCE — only the hash is stored. */
export async function createApiKey(userId: string, name: string) {
  const tier = await getUserTier(userId);
  const allowed = (await getPlan(tier)).apiKeysAllowed;
  const count = await prisma.apiKey.count({ where: { userId, revoked: false } });
  if (count >= allowed) {
    return { error: `Your plan allows ${allowed} active API key${allowed === 1 ? "" : "s"}. Upgrade or revoke an existing key.` };
  }

  const raw = `aria_sk_${crypto.randomBytes(24).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const key = await prisma.apiKey.create({
    data: { userId, name, keyHash, prefix: raw.slice(0, 16) + "..." },
  });
  return { key: raw, id: key.id };
}

/** Resolve a Bearer token to its owner; consumes one request of today's API quota. */
export async function authenticateApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return { error: "missing_key" as const };
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith("aria_sk_")) return { error: "invalid_key" as const };

  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, banned: true } } },
  });
  if (!key || key.revoked || key.user.banned) return { error: "invalid_key" as const };

  // quota
  const tier = await getUserTier(key.userId);
  const limit = (await getPlan(tier)).apiRequestsPerDay;
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const usage = await prisma.apiUsage.upsert({
    where: { apiKeyId_day: { apiKeyId: key.id, day } },
    update: { requests: { increment: 1 } },
    create: { apiKeyId: key.id, day, requests: 1 },
  });

  if (limit !== -1 && usage.requests > limit) {
    await prisma.apiUsage.update({
      where: { apiKeyId_day: { apiKeyId: key.id, day } },
      data: { requests: { decrement: 1 } },
    });
    return { error: "rate_limited" as const, limit, used: usage.requests - 1, tier };
  }

  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { key, userId: key.userId, tier, used: usage.requests, limit };
}
