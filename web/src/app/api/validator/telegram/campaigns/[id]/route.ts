import { NextResponse } from "next/server";
import { cancelTelegramCampaign, getTelegramCampaign } from "@/lib/telegram-campaigns";
import { requireMessagingAccount, requireSignalDeskAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return messagingUnauthorized();
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await getTelegramCampaign(account.id, (await params).id, {
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 100),
        search: url.searchParams.get("search") || undefined,
        status: url.searchParams.get("status") || undefined,
        reply: url.searchParams.get("reply") || undefined,
        sessionId: url.searchParams.get("sessionId") || undefined,
      }),
    );
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
