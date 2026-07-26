import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const session = await prisma.telegramSession.findFirst({
    where: { id: (await params).id, accountId: account.id },
    select: { avatarData: true, avatarMime: true, profileSyncedAt: true },
  });
  if (!session?.avatarData) return new Response("Profile photo not found", { status: 404 });
  return new Response(new Uint8Array(session.avatarData), {
    headers: {
      "Content-Type": session.avatarMime || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "Last-Modified": (session.profileSyncedAt || new Date()).toUTCString(),
    },
  });
}
