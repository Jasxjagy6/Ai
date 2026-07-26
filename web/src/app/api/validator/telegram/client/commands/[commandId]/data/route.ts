import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ commandId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const command = await prisma.telegramClientCommand.findFirst({
    where: { id: (await params).commandId, accountId: account.id, status: "completed" },
    select: { resultData: true, resultMime: true, resultName: true },
  });
  if (!command?.resultData || !command.resultMime) {
    return NextResponse.json({ error: "Telegram media is not available" }, { status: 404 });
  }
  const filename = (command.resultName || "telegram-media").replace(/[\r\n"]/g, "").slice(0, 200);
  return new NextResponse(new Uint8Array(command.resultData), {
    headers: {
      "Content-Type": command.resultMime,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
