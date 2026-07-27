import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

async function isSecure() {
  const h = await headers();
  const proto = String(h.get("x-forwarded-proto") || h.get(":scheme") || "");
  return proto === "https";
}

const COOKIE_NAME = "validator_session";
const SESSION_DAYS = Math.max(
  1,
  Number(process.env.VALIDATOR_SESSION_DAYS || 3650),
);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createValidatorAccessKey() {
  const raw = `tgv_${randomBytes(30).toString("base64url")}`;
  return { raw, keyHash: hash(raw), prefix: `${raw.slice(0, 15)}...` };
}

export async function ensureValidatorReferralCode(accountId: string) {
  const account = await prisma.validatorAccount.findUnique({
    where: { id: accountId },
    select: { referralCode: true },
  });
  if (account?.referralCode) return account.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(6)
      .toString("base64url")
      .replace(/[-_]/g, "")
      .slice(0, 10)
      .toUpperCase();
    const updated = await prisma.validatorAccount
      .update({ where: { id: accountId }, data: { referralCode: code } })
      .catch(() => null);
    if (updated) return code;
  }
  throw new Error("Unable to create referral code");
}

type AccountRecord = {
  id: string;
  email: string;
  creditsBalance: number;
  creditsPurchased: number;
  creditsSpent: number;
  currentPlanCode: string | null;
  planExpiresAt: Date | null;
  lastCreditTopupAt: Date | null;
  referralCode: string | null;
};

async function accountView(
  account: AccountRecord,
  key: {
    id: string;
    prefix: string;
    requestLimit: number | null;
    requestsUsed: number;
    planCode: string | null;
    expiresAt: Date | null;
    validatorAccess: boolean;
    messagingAccess: boolean;
    sessionLimit: number | null;
    messageLimit: number | null;
    messagesUsed: number;
  } | null,
) {
  const planCode = account.currentPlanCode || key?.planCode || null;
  const expiresAt = account.planExpiresAt || key?.expiresAt || null;
  const expired = !!expiresAt && expiresAt <= new Date();
  const reactivated =
    !!account.lastCreditTopupAt &&
    (!expiresAt || account.lastCreditTopupAt > expiresAt);
  return {
    id: account.id,
    email: account.email,
    accessKeyId: key?.id || null,
    accessKeyPrefix: key?.prefix || null,
    planCode,
    requestLimit: null,
    requestsUsed: key?.requestsUsed || 0,
    requestsRemaining: null,
    accessExpiresAt: expiresAt,
    accessExpired: expired,
    creditsActive: account.creditsBalance > 0 && (!expired || reactivated),
    creditsBalance: account.creditsBalance,
    creditsPurchased: account.creditsPurchased,
    creditsSpent: account.creditsSpent,
    referralCode: account.referralCode,
    validatorAccess: true,
    messagingAccess: true,
    aiChatAccess: true,
    aiCampaignLimit: null,
    sessionLimit: null,
    messageLimit: null,
    messagesUsed: key?.messagesUsed || 0,
    messagesRemaining: null,
  };
}

export async function createValidatorSessionForAccount(
  accountId: string,
  accessKeyId: string | null,
) {
  const account = await prisma.validatorAccount.findUnique({
    where: { id: accountId },
  });
  if (!account || !account.active) return null;
  await ensureValidatorReferralCode(account.id);
  const token = randomBytes(32).toString("base64url");
  const key = accessKeyId
    ? await prisma.validatorAccessKey.findUnique({ where: { id: accessKeyId } })
    : null;
  if (key?.expiresAt && key.expiresAt <= new Date()) return null;
  const normalExpiry = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  const expiresAt =
    key?.expiresAt && key.expiresAt < normalExpiry ? key.expiresAt : normalExpiry;
  await prisma.validatorSession.create({
    data: { accountId, accessKeyId, tokenHash: hash(token), expiresAt },
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecure(),
    path: "/",
    expires: expiresAt,
  });
  const freshAccount = await prisma.validatorAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  return accountView(freshAccount, key);
}

export async function createValidatorSession(rawKey: string) {
  const now = new Date();
  const key = await prisma.validatorAccessKey.findUnique({
    where: { keyHash: hash(rawKey.trim()) },
    include: { account: true },
  });
  if (
    !key ||
    key.revoked ||
    !key.account.active ||
    (key.expiresAt && key.expiresAt <= now)
  )
    return null;
  await prisma.validatorAccessKey.update({
    where: { id: key.id },
    data: { lastUsedAt: now },
  });
  return createValidatorSessionForAccount(key.accountId, key.id);
}

export async function requireSignalDeskAccount() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.validatorSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { account: true, accessKey: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.account.active)
    return null;
  if (
    session.accessKey?.revoked ||
    (session.accessKey?.expiresAt && session.accessKey.expiresAt <= new Date())
  ) {
    await prisma.validatorSession
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > 15 * 60 * 1000) {
    void prisma.validatorSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
  if (!session.account.referralCode)
    await ensureValidatorReferralCode(session.account.id);
  const account = await prisma.validatorAccount.findUniqueOrThrow({
    where: { id: session.account.id },
  });
  return accountView(account, session.accessKey);
}

export async function requireValidatorAccount() {
  const account = await requireSignalDeskAccount();
  return account?.validatorAccess ? account : null;
}

export async function requireMessagingAccount() {
  const account = await requireSignalDeskAccount();
  return account?.messagingAccess ? account : null;
}

export async function clearValidatorSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token)
    await prisma.validatorSession.deleteMany({
      where: { tokenHash: hash(token) },
    });
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecure(),
    path: "/",
    maxAge: 0,
  });
}
