import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const id = (await params).id;
  const campaign = await prisma.telegramCampaign.findFirst({ where: { id, accountId: account.id }, select: { name: true } });
  if (!campaign) return new Response("Campaign not found", { status: 404 });
  const recipients = await prisma.telegramCampaignRecipient.findMany({
    where: { campaignId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { session: { select: { label: true, username: true, phone: true } } },
  });
  const rows = [
    ["target", "username", "telegram_id", "display_name", "status", "attempts", "session", "session_username", "message_id", "sent_at", "error_code", "error_message", "replied", "replied_at", "reply_message_id", "reply_preview"],
    ...recipients.map((item) => [item.targetInput, item.username, item.telegramId, item.displayName, item.status, item.attempts, item.session?.label, item.session?.username || item.session?.phone, item.messageId, item.sentAt?.toISOString(), item.errorCode, item.errorMessage, item.replied, item.repliedAt?.toISOString(), item.replyMessageId, item.replyPreview]),
  ];
  const body = rows.map((row) => row.map(csv).join(",")).join("\r\n");
  const filename = campaign.name.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80) || "campaign";
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` } });
}
