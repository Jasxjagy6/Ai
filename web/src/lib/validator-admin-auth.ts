import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "validator_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function configuredKey() {
  return process.env.VALIDATOR_ADMIN_KEY?.trim() || "";
}

function signature(expires: string) {
  return createHmac("sha256", configuredKey())
    .update(`validator-admin:${expires}`)
    .digest("hex");
}

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function secureCookie() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-proto") === "https";
}

export async function createValidatorAdminSession(key: string) {
  const expected = configuredKey();
  if (!expected || !equal(key, expected)) return false;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const expires = String(expiresAt);
  (await cookies()).set(COOKIE_NAME, `${expires}.${signature(expires)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: await secureCookie(),
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return true;
}

export async function requireValidatorAdmin() {
  const value = (await cookies()).get(COOKIE_NAME)?.value || "";
  const [expires, actual] = value.split(".");
  if (!expires || !actual || Number(expires) <= Math.floor(Date.now() / 1000))
    return false;
  const expected = signature(expires);
  return !!configuredKey() && equal(actual, expected);
}

export async function clearValidatorAdminSession() {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: await secureCookie(),
    path: "/",
    maxAge: 0,
  });
}
