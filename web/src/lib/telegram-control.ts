import { randomInt } from "crypto";
import AdmZip from "adm-zip";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData, telegramDataFingerprint } from "@/lib/telegram-crypto";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 48 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 200;
const SQLITE_HEADER = Buffer.from("SQLite format 3\0");

export class TelegramControlError extends Error {
  constructor(message: string, public status = 400, public code = "TELEGRAM_REQUEST_INVALID") {
    super(message);
  }
}

export function telegramControlError(error: unknown) {
  if (error instanceof TelegramControlError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new TelegramControlError("This Telegram session is already in your workspace", 409, "TELEGRAM_SESSION_DUPLICATE");
  }
  return null;
}

export function defaultDeviceIdentity() {
  const devices = ["Samsung SM-S928B", "Google Pixel 9", "Xiaomi 14", "OnePlus 12"];
  const versions = ["14", "15"];
  return {
    device_model: devices[randomInt(devices.length)],
    system_version: versions[randomInt(versions.length)],
    app_version: "11.4.2",
    lang_code: "en",
    system_lang_code: "en-US",
  };
}

type TelegramSafetySession = {
  label: string;
  status: string;
  isLoggedIn: boolean;
  riskScore: number;
  spamStatus: string;
  spamLimitUntil: Date | null;
  spamCheckedAt: Date | null;
  healthCooldownUntil: Date | null;
  warmupMode: string;
  warmupStartedAt: Date;
  dailyMessagesSent: number;
  dailyMessagesResetAt: Date;
};

export function telegramSessionDailyLimit(session: Pick<TelegramSafetySession, "warmupMode" | "warmupStartedAt">, now = new Date()) {
  const ageDays = Math.max(0, (now.getTime() - session.warmupStartedAt.getTime()) / 86_400_000);
  const standard = session.warmupMode === "standard";
  if (ageDays < 1) return standard ? 10 : 5;
  if (ageDays < 2) return standard ? 20 : 10;
  if (ageDays < 3) return standard ? 40 : 20;
  if (ageDays < 7) return standard ? 80 : 40;
  if (!standard && ageDays < 14) return 80;
  return null;
}

export function telegramSessionSafety(session: TelegramSafetySession, now = new Date()) {
  const resetToday = session.dailyMessagesResetAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  const dailyMessagesSent = resetToday ? session.dailyMessagesSent : 0;
  const dailyLimit = telegramSessionDailyLimit(session, now);
  let eligibilityReason: string | null = null;
  if (!session.isLoggedIn || session.status !== "active") eligibilityReason = "Session is not active";
  else if (session.spamStatus === "frozen") eligibilityReason = "Telegram marked this account frozen";
  else if (session.spamStatus === "limited") eligibilityReason = session.spamLimitUntil && session.spamLimitUntil <= now
    ? "Spam limit expired; recheck @SpamBot before sending"
    : "Account is currently limited by Telegram";
  else if (session.spamStatus !== "clean") eligibilityReason = "Run an @SpamBot check before mass messaging";
  else if (!session.spamCheckedAt || now.getTime() - session.spamCheckedAt.getTime() > 7 * 86_400_000) eligibilityReason = "Spam status is stale and must be rechecked";
  else if (session.riskScore >= 70) eligibilityReason = "Session risk score is too high";
  else if (session.healthCooldownUntil && session.healthCooldownUntil > now) eligibilityReason = `Cooling down until ${session.healthCooldownUntil.toISOString()}`;
  else if (dailyLimit != null && dailyMessagesSent >= dailyLimit) eligibilityReason = `Daily warmup limit of ${dailyLimit} messages reached`;
  return {
    massDmEligible: eligibilityReason == null,
    eligibilityReason,
    dailyLimit,
    dailyMessagesSent,
    dailyMessagesRemaining: dailyLimit == null ? null : Math.max(0, dailyLimit - dailyMessagesSent),
    warmupDay: Math.max(1, Math.floor((now.getTime() - session.warmupStartedAt.getTime()) / 86_400_000) + 1),
  };
}

export function assertTelegramSessionsEligible(sessions: TelegramSafetySession[]) {
  const blocked = sessions.map((session) => ({ session, safety: telegramSessionSafety(session) })).filter((item) => !item.safety.massDmEligible);
  if (!blocked.length) return;
  const first = blocked[0];
  throw new TelegramControlError(
    `${first.session.label}: ${first.safety.eligibilityReason}${blocked.length > 1 ? ` (${blocked.length} sessions blocked)` : ""}`,
    423,
    "NO_MASS_DM_ELIGIBLE_SESSIONS",
  );
}

export function sessionView(session: {
  id: string;
  label: string;
  phone: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileBio: string | null;
  avatarMime: string | null;
  isPremium: boolean;
  isVerified: boolean;
  isRestricted: boolean;
  profileSyncedAt: Date | null;
  profileSyncRequested: boolean;
  telegramUserId: bigint | null;
  sessionFormat: string;
  sourceFilename: string | null;
  status: string;
  isLoggedIn: boolean;
  hasTwoFactor: boolean;
  antiDetectEnabled: boolean;
  deviceIdentity: Prisma.JsonValue | null;
  proxyLabel: string | null;
  proxyEnabled: boolean;
  riskScore: number;
  spamStatus: string;
  spamLimitUntil: Date | null;
  spamCheckedAt: Date | null;
  spamStatusMessage: string | null;
  spamCheckRequested: boolean;
  healthCooldownUntil: Date | null;
  consecutiveFloodWaits: number;
  lastFloodSeconds: number;
  lastFloodAt: Date | null;
  consecutiveSendFailures: number;
  warmupEnabled: boolean;
  warmupMode: string;
  warmupStartedAt: Date;
  warmupCompletedAt: Date | null;
  lastWarmupAt: Date | null;
  warmupActions: number;
  warmupRequested: boolean;
  dailyMessagesSent: number;
  dailyMessagesResetAt: Date;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  messagesSent: number;
  repliesReceived: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    label: session.label,
    phone: session.phone,
    username: session.username,
    firstName: session.firstName,
    lastName: session.lastName,
    profileBio: session.profileBio,
    avatarUrl: session.avatarMime
      ? `/api/validator/telegram/sessions/${session.id}/avatar?v=${session.profileSyncedAt?.getTime() || session.updatedAt.getTime()}`
      : null,
    avatarMime: session.avatarMime,
    isPremium: session.isPremium,
    isVerified: session.isVerified,
    isRestricted: session.isRestricted,
    profileSyncedAt: session.profileSyncedAt,
    profileSyncRequested: session.profileSyncRequested,
    telegramUserId: session.telegramUserId?.toString() || null,
    sessionFormat: session.sessionFormat,
    sourceFilename: session.sourceFilename,
    status: session.status,
    isLoggedIn: session.isLoggedIn,
    hasTwoFactor: session.hasTwoFactor,
    antiDetectEnabled: session.antiDetectEnabled,
    deviceIdentity: session.deviceIdentity,
    proxyLabel: session.proxyLabel,
    proxyEnabled: session.proxyEnabled,
    riskScore: session.riskScore,
    spamStatus: session.spamStatus,
    spamLimitUntil: session.spamLimitUntil,
    spamCheckedAt: session.spamCheckedAt,
    spamStatusMessage: session.spamStatusMessage,
    spamCheckRequested: session.spamCheckRequested,
    healthCooldownUntil: session.healthCooldownUntil,
    consecutiveFloodWaits: session.consecutiveFloodWaits,
    lastFloodSeconds: session.lastFloodSeconds,
    lastFloodAt: session.lastFloodAt,
    consecutiveSendFailures: session.consecutiveSendFailures,
    warmupEnabled: session.warmupEnabled,
    warmupMode: session.warmupMode,
    warmupStartedAt: session.warmupStartedAt,
    warmupCompletedAt: session.warmupCompletedAt,
    lastWarmupAt: session.lastWarmupAt,
    warmupActions: session.warmupActions,
    warmupRequested: session.warmupRequested,
    ...telegramSessionSafety(session),
    lastErrorCode: session.lastErrorCode,
    lastErrorMessage: session.lastErrorMessage,
    lastLoginAt: session.lastLoginAt,
    lastActiveAt: session.lastActiveAt,
    messagesSent: session.messagesSent,
    repliesReceived: session.repliesReceived,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

type ImportCandidate = { name: string; data: Buffer };

function extractStringSessions(name: string, data: Buffer): ImportCandidate[] {
  let parsed: unknown;
  const text = data.toString("utf8").trim();
  if (!text) return [];
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  }
  let values: unknown[] = [];
  if (typeof parsed === "string") values = [parsed];
  else if (Array.isArray(parsed)) values = parsed;
  else if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    const value = object.session_string ?? object.sessionString ?? object.session ?? object.data ?? object.sessions;
    values = Array.isArray(value) ? value : [value];
  }
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length >= 100)
    .map((value, index) => ({ name: values.length > 1 ? `${name}-${index + 1}` : name, data: Buffer.from(value.trim(), "utf8") }));
}

function expandFile(file: File): Promise<ImportCandidate[]> {
  return file.arrayBuffer().then((raw) => {
    if (file.size > MAX_UPLOAD_BYTES) throw new TelegramControlError(`${file.name} exceeds the 12 MB upload limit`, 413, "TELEGRAM_SESSION_TOO_LARGE");
    const data = Buffer.from(raw);
    const extension = file.name.toLowerCase().split(".").pop() || "";
    if (extension === "zip") {
      const zip = new AdmZip(data);
      const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
      if (entries.length > MAX_ARCHIVE_ENTRIES) throw new TelegramControlError("Archive contains too many files", 413, "TELEGRAM_ARCHIVE_TOO_LARGE");
      let total = 0;
      const candidates: ImportCandidate[] = [];
      for (const entry of entries) {
        const entryExtension = entry.entryName.toLowerCase().split(".").pop() || "";
        if (!["session", "sqlite", "db", "json", "txt"].includes(entryExtension)) continue;
        if (entry.header.size > MAX_UPLOAD_BYTES || total + entry.header.size > MAX_ARCHIVE_BYTES) {
          throw new TelegramControlError("Decompressed archive exceeds the upload limit", 413, "TELEGRAM_ARCHIVE_TOO_LARGE");
        }
        const entryData = entry.getData();
        total += entryData.length;
        if (entryData.length > MAX_UPLOAD_BYTES || total > MAX_ARCHIVE_BYTES) {
          throw new TelegramControlError("Decompressed archive exceeds the upload limit", 413, "TELEGRAM_ARCHIVE_TOO_LARGE");
        }
        if (["json", "txt"].includes(entryExtension)) candidates.push(...extractStringSessions(entry.entryName, entryData));
        else candidates.push({ name: entry.entryName, data: entryData });
      }
      return candidates;
    }
    if (["json", "txt"].includes(extension)) return extractStringSessions(file.name, data);
    if (["session", "sqlite", "db"].includes(extension)) return [{ name: file.name, data }];
    throw new TelegramControlError(`Unsupported session file: ${file.name}`, 400, "TELEGRAM_SESSION_TYPE_UNSUPPORTED");
  });
}

function detectFormat(data: Buffer) {
  if (data.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)) return "sqlite";
  const value = data.toString("utf8").trim();
  if (!/^[A-Za-z0-9_+/=-]+$/.test(value) || value.length < 100 || value.length > 4096) {
    throw new TelegramControlError("Session data is not a supported SQLite or string session", 400, "TELEGRAM_SESSION_INVALID");
  }
  return value.startsWith("1") ? "telethon_or_gramjs_string" : "hydrogram_string";
}

export async function importTelegramSessions(account: {
  id: string;
  sessionLimit: number | null;
}, files: File[]) {
  if (!files.length) throw new TelegramControlError("Select at least one session file", 400, "TELEGRAM_SESSION_REQUIRED");
  if (files.length > 20) throw new TelegramControlError("Upload no more than 20 files at once", 413, "TELEGRAM_SESSION_BATCH_TOO_LARGE");
  const credential = await prisma.telegramApiCredential.findUnique({ where: { accountId: account.id } });
  if (!credential) throw new TelegramControlError("Add your Telegram api_id and api_hash before importing sessions", 409, "TELEGRAM_CREDENTIALS_REQUIRED");
  const candidates: ImportCandidate[] = [];
  const results: Array<{
    ok: boolean;
    filename: string;
    error?: string;
    code?: string;
    session?: ReturnType<typeof sessionView>;
  }> = [];
  for (const file of files) {
    try {
      const expanded = await expandFile(file);
      if (!expanded.length)
        throw new TelegramControlError(
          "No supported sessions were found in this file",
          400,
          "TELEGRAM_SESSION_EMPTY",
        );
      candidates.push(...expanded);
    } catch (error) {
      const known = telegramControlError(error);
      if (!known) throw error;
      results.push({
        ok: false,
        filename: file.name.slice(0, 255),
        error: known.message,
        code: known.code,
      });
    }
  }
  if (!candidates.length) return results;
  const currentCount = await prisma.telegramSession.count({ where: { accountId: account.id } });
  if (account.sessionLimit != null && currentCount + candidates.length > account.sessionLimit) {
    throw new TelegramControlError(`Your plan allows ${account.sessionLimit} Telegram sessions`, 403, "TELEGRAM_SESSION_LIMIT_EXCEEDED");
  }
  for (const candidate of candidates) {
    const filename = candidate.name.split(/[\\/]/).pop() || "Imported session";
    try {
      const format = detectFormat(candidate.data);
      const normalized =
        format === "sqlite"
          ? candidate.data
          : Buffer.from(candidate.data.toString("utf8").trim(), "utf8");
      const label =
        filename
          .replace(/\.(session|sqlite|db|json|txt)$/i, "")
          .slice(0, 100) || "Imported session";
      const session = await prisma.telegramSession.create({
        data: {
          accountId: account.id,
          credentialId: credential.id,
          label,
          sessionDataEncrypted: encryptTelegramData(normalized),
          sessionFingerprint: telegramDataFingerprint(normalized),
          sessionFormat: format,
          sourceFilename: filename.slice(0, 255),
          status: "queued_validation",
          deviceIdentity: defaultDeviceIdentity(),
        },
      });
      results.push({ ok: true, filename, session: sessionView(session) });
    } catch (error) {
      const known = telegramControlError(error);
      if (!known) throw error;
      results.push({ ok: false, filename, error: known.message, code: known.code });
    }
  }
  return results;
}
