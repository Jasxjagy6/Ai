import { NextResponse } from "next/server";
import {
  queueTelegramClientCommand,
  telegramClientCommandSchema,
  telegramClientError,
} from "@/lib/telegram-client";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = telegramClientCommandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Enter a valid Telegram client command" },
      { status: 400 },
    );
  }
  try {
    const command = await queueTelegramClientCommand(account.id, (await params).id, parsed.data);
    return NextResponse.json({ command }, { status: 202 });
  } catch (error) {
    const known = telegramClientError(error);
    return NextResponse.json({ error: known.message, code: known.code }, { status: known.status });
  }
}
