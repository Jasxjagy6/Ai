import { NextResponse } from "next/server";
import { createTelegramCampaign, listTelegramCampaigns } from "@/lib/telegram-campaigns";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function GET(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const limit = Number(new URL(request.url).searchParams.get("limit") || 50);
  return NextResponse.json({ campaigns: await listTelegramCampaigns(account.id, limit) });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const campaign = await createTelegramCampaign(account, await request.json().catch(() => null));
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return validatorError(error);
  }
}
