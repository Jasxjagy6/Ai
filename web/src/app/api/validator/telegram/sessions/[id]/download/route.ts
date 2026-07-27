import { prisma } from "@/lib/prisma";
import { decryptTelegramData } from "@/lib/telegram-crypto";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

function filename(value: string, extension: string) {
  const base = value.replace(/\.(session|sqlite|db|json|txt)$/i, "").replace(/[^A-Za-z0-9+_.-]/g, "_").slice(0, 100);
  return `${base || "telegram-session"}.${extension}`;
}

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const session = await prisma.telegramSession.findFirst({
    where: { id: (await params).id, accountId: account.id },
    select: { label: true, phone: true, sourceFilename: true, sessionFormat: true, sessionDataEncrypted: true },
  });
  if (!session) return new Response("Telegram session not found", { status: 404 });
  const data = decryptTelegramData(session.sessionDataEncrypted);
  const sqlite = session.sessionFormat === "sqlite";
  const extension = sqlite ? "session" : "txt";
  const downloadName = filename(session.phone || session.sourceFilename || session.label, extension);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": sqlite ? "application/x-sqlite3" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
