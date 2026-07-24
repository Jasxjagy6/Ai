import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

export async function GET(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || undefined;
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const logs = await prisma.telegramBehaviorLog.findMany({
    where: { accountId: account.id, ...(sessionId ? { sessionId } : {}) },
    orderBy: [{ performedAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { session: { select: { label: true, username: true, phone: true } } },
  });
  return NextResponse.json({ logs });
}
