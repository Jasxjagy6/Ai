import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TelegramClientView } from "@/components/validator/telegram-client-view";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";

export const metadata: Metadata = {
  title: "Telegram Client | Signal Desk",
  description: "Operate one Telegram account in an isolated Signal Desk window.",
};

export default async function TelegramClientPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const account = await requireMessagingAccount();
  if (!account) redirect("/workspace");
  const sessionId = (await params).sessionId;
  const session = await prisma.telegramSession.findFirst({
    where: { id: sessionId, accountId: account.id },
    select: {
      id: true,
      label: true,
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
      status: true,
      isLoggedIn: true,
      isPremium: true,
      isVerified: true,
      spamStatus: true,
      avatarMime: true,
      profileSyncedAt: true,
      updatedAt: true,
    },
  });
  if (!session) redirect("/workspace");
  return (
    <TelegramClientView
      session={{
        ...session,
        avatarUrl: session.avatarMime
          ? `/api/validator/telegram/sessions/${session.id}/avatar?v=${session.profileSyncedAt?.getTime() || session.updatedAt.getTime()}`
          : null,
      }}
    />
  );
}
