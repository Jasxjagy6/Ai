import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { importTelegramSessions, sessionView } from "@/lib/telegram-control";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("spam_check"),
    sessionIds: z.array(z.string().min(1)).min(1).max(500),
  }),
  z.object({
    action: z.literal("warmup"),
    sessionIds: z.array(z.string().min(1)).min(1).max(500),
  }),
  z.object({
    action: z.literal("warmup_mode"),
    sessionIds: z.array(z.string().min(1)).min(1).max(500),
    warmupMode: z.enum(["off", "safe", "standard"]),
  }),
]);

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const sessions = await prisma.telegramSession.findMany({
    where: { accountId: account.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ sessions: sessions.map(sessionView) });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 25 * 1024 * 1024)
      return NextResponse.json(
        { error: "Upload exceeds the 25 MB request limit" },
        { status: 413 },
      );
    const form = await request.formData();
    const files = form
      .getAll("sessions")
      .filter((value): value is File => value instanceof File);
    const results = await importTelegramSessions(account, files);
    return NextResponse.json(
      { results, imported: results.filter((result) => result.ok).length },
      { status: 201 },
    );
  } catch (error) {
    return validatorError(error);
  }
}

export async function PATCH(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = bulkActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose valid sessions and a bulk action" },
      { status: 400 },
    );
  const data = parsed.data;
  const sessionIds = [...new Set(data.sessionIds)];
  const where = { id: { in: sessionIds }, accountId: account.id };
  const result =
    data.action === "warmup_mode"
      ? await prisma.telegramSession.updateMany({
          where,
          data: {
            warmupMode: data.warmupMode,
            warmupEnabled: data.warmupMode !== "off",
          },
        })
      : await prisma.telegramSession.updateMany({
          where: {
            ...where,
            status: "active",
            isLoggedIn: true,
            ...(data.action === "warmup" ? { warmupEnabled: true } : {}),
          },
          data:
            data.action === "spam_check"
              ? { spamCheckRequested: true, spamCheckClaimedAt: null }
              : { warmupRequested: true, warmupClaimedAt: null },
        });
  return NextResponse.json(
    { updated: result.count, skipped: sessionIds.length - result.count },
    { status: 202 },
  );
}
