import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

async function isSecure() {
  const h = await headers();
  const proto = String(h.get("x-forwarded-proto") || h.get(":scheme") || "");
  return proto === "https";
}

const COOKIE_NAME = "validator_session";
const SESSION_DAYS = Math.max(1, Number(process.env.VALIDATOR_SESSION_DAYS || 3650));

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createValidatorAccessKey() {
  const raw = `tgv_${randomBytes(30).toString("base64url")}`;
  return { raw, keyHash: hash(raw), prefix: `${raw.slice(0, 15)}...` };
}

function accountView(account: { id: string; email: string }, key: {
  id: string;
  requestLimit: number | null;
  requestsUsed: number;
  planCode: string | null;
  expiresAt: Date | null;
  validatorAccess: boolean;
  messagingAccess: boolean;
  sessionLimit: number | null;
  messageLimit: number | null;
  messagesUsed: number;
} | null) {
  return {
    id: account.id,
    email: account.email,
    accessKeyId: key?.id || null,
    planCode: key?.planCode || null,
    requestLimit: key?.requestLimit ?? null,
    requestsUsed: key?.requestsUsed || 0,
    requestsRemaining: key?.requestLimit == null ? null : Math.max(0, key.requestLimit - key.requestsUsed),
    accessExpiresAt: key?.expiresAt || null,
    validatorAccess: key?.validatorAccess ?? true,
    messagingAccess: key?.messagingAccess ?? false,
    sessionLimit: key?.sessionLimit ?? null,
    messageLimit: key?.messageLimit ?? null,
    messagesUsed: key?.messagesUsed || 0,
    messagesRemaining: key?.messageLimit == null ? null : Math.max(0, key.messageLimit - key.messagesUsed),
  };
}

export async function createValidatorSessionForAccount(accountId: string, accessKeyId: string | null, keyExpiresAt: Date | null) {
  const account = await prisma.validatorAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.active) return null;
  const token = randomBytes(32).toString("base64url");
  const maximum = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = keyExpiresAt && keyExpiresAt < maximum ? keyExpiresAt : maximum;
  await prisma.validatorSession.create({ data: { accountId, accessKeyId, tokenHash: hash(token), expiresAt } });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecure(),
    path: "/",
    expires: expiresAt,
  });
  const key = accessKeyId ? await prisma.validatorAccessKey.findUnique({ where: { id: accessKeyId } }) : null;
  return accountView(account, key);
}

export async function createValidatorSession(rawKey: string) {
  const now = new Date();
  const key = await prisma.validatorAccessKey.findUnique({
    where: { keyHash: hash(rawKey.trim()) },
    include: { account: true },
  });
  if (!key || key.revoked || !key.account.active || (key.expiresAt && key.expiresAt <= now)) return null;

  await prisma.validatorAccessKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });
  return createValidatorSessionForAccount(key.accountId, key.id, key.expiresAt);
}

export async function requireSignalDeskAccount() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.validatorSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { account: true, accessKey: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.account.active) return null;
  if (session.accessKey && (session.accessKey.revoked || (session.accessKey.expiresAt && session.accessKey.expiresAt <= new Date()))) {
    await prisma.validatorSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > 15 * 60 * 1000) {
    void prisma.validatorSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return accountView(session.account, session.accessKey);
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
  if (token) await prisma.validatorSession.deleteMany({ where: { tokenHash: hash(token) } });
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: await isSecure(), path: "/", maxAge: 0 });
}
