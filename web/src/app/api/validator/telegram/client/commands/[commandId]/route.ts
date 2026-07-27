import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ commandId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const command = await prisma.telegramClientCommand.findFirst({
    where: { id: (await params).commandId, accountId: account.id },
    omit: { payload: true, resultData: true },
  });
  if (!command) return NextResponse.json({ error: "Telegram client command not found" }, { status: 404 });
  return NextResponse.json({
    command: {
      ...command,
      hasData: command.status === "completed" && !!command.resultMime,
      dataUrl: command.status === "completed" && command.resultMime
        ? `/api/validator/telegram/client/commands/${command.id}/data`
        : null,
    },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const command = await prisma.telegramClientCommand.findFirst({
    where: { id: (await params).commandId, accountId: account.id },
    select: { id: true, status: true },
  });
  if (!command) return NextResponse.json({ error: "Telegram client command not found" }, { status: 404 });
  if (command.status === "pending") {
    await prisma.telegramClientCommand.update({
      where: { id: command.id },
      data: { status: "cancelled", errorCode: "CANCELLED", errorMessage: "Cancelled by user", finishedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
