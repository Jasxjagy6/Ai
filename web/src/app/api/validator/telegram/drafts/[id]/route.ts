import { NextResponse } from "next/server";
import {
  cancelTelegramDraftJob,
  getTelegramDraftJob,
} from "@/lib/telegram-drafts";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    return NextResponse.json({
      job: await getTelegramDraftJob(account.id, (await params).id),
    });
  } catch (error) {
    return validatorError(error);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    return NextResponse.json({
      job: await cancelTelegramDraftJob(account.id, (await params).id),
    });
  } catch (error) {
    return validatorError(error);
  }
}
