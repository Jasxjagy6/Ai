import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { claimTelegramTrial } from "@/lib/validator-trials";

const schema = z.object({
  telegramUserId: z.string().regex(/^\d{1,20}$/),
  username: z.string().trim().max(100).nullable().optional(),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
});

function authorized(request: Request) {
  const configured = process.env.VALIDATOR_TRIAL_SECRET?.trim() || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = Buffer.from(createHash("sha256").update(configured).digest("hex"));
  const actual = Buffer.from(createHash("sha256").update(supplied).digest("hex"));
  return (
    configured.length >= 32 &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid Telegram user" }, { status: 400 });
  try {
    const telegramUserId = BigInt(parsed.data.telegramUserId);
    if (telegramUserId <= 0)
      return NextResponse.json({ error: "Invalid Telegram user" }, { status: 400 });
    return NextResponse.json(
      await claimTelegramTrial({
        telegramUserId,
        username: parsed.data.username,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      }),
    );
  } catch (error) {
    console.error("Telegram trial claim failed", error);
    return NextResponse.json(
      { error: "Unable to issue the trial right now" },
      { status: 500 },
    );
  }
}
