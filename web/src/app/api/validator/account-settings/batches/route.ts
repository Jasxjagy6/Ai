import { NextResponse } from "next/server";
import { listAccountSettingsBatches } from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

export async function GET(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const limit = Number(new URL(request.url).searchParams.get("limit")) || 20;
  return NextResponse.json({ batches: await listAccountSettingsBatches(account.id, limit) });
}
