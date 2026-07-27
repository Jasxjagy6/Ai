import { NextResponse } from "next/server";
import {
  accountSettingsAvatars,
  RANDOM_BIOS,
  RANDOM_FIRST_NAMES,
  RANDOM_LAST_NAMES,
} from "@/lib/account-settings-data";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  return NextResponse.json({
    firstNames: RANDOM_FIRST_NAMES,
    lastNames: RANDOM_LAST_NAMES,
    bios: RANDOM_BIOS,
    avatars: await accountSettingsAvatars(),
  });
}
