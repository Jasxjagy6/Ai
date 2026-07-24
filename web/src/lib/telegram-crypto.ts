import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function encryptionKey() {
  const source = process.env.TELEGRAM_DATA_KEY || process.env.VALIDATOR_KEY_SECRET || process.env.AUTH_SECRET;
  if (!source || source.length < 24) throw new Error("TELEGRAM_DATA_KEY must be configured with at least 24 characters");
  return createHash("sha256").update(`signal-desk-telegram:${source}`).digest();
}

export function encryptTelegramData(value: string | Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function decryptTelegramData(value: string) {
  const [version, ivValue, encryptedValue, tagValue] = value.split(".");
  if (version !== "v1" || !ivValue || !encryptedValue || !tagValue) throw new Error("Invalid encrypted Telegram data");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
}

export function telegramDataFingerprint(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
