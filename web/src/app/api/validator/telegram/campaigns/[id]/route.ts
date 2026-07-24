import { NextResponse } from "next/server";
import { cancelTelegramCampaign, getTelegramCampaign } from "@/lib/telegram-campaigns";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    return NextResponse.json(await getTelegramCampaign(account.id, (await params).id));
  } catch (error) {
    return validatorError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    return NextResponse.json({ campaign: await cancelTelegramCampaign(account.id, (await params).id) });
  } catch (error) {
    return validatorError(error);
  }
}
