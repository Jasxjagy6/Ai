import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { importTelegramSessions, sessionView } from "@/lib/telegram-control";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";
import { runChargedValidatorTask } from "@/lib/validator-credits";

const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["login", "logout", "delete", "profile_sync"]),
    sessionIds: z.array(z.string().min(1)).min(1).max(500),
  }),
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
    omit: { sessionDataEncrypted: true, proxyEncrypted: true, avatarData: true },
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
    const results = await runChargedValidatorTask(
      {
        accountId: account.id,
        accessKeyId: account.accessKeyId,
        taskCode: "session_import",
        items: files.length,
        description: `Import ${files.length.toLocaleString()} Telegram session files`,
      },
      () => importTelegramSessions(account, files),
    );
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
  if (data.action === "delete") {
    const result = await prisma.telegramSession.deleteMany({ where });
    return NextResponse.json(
      { updated: result.count, skipped: sessionIds.length - result.count },
      { status: 202 },
    );
  }
  const operation = async () =>
    data.action === "login"
      ? await prisma.telegramSession.updateMany({
          where: { ...where, isLoggedIn: false },
          data: {
            status: "queued_validation",
            lastErrorCode: null,
            lastErrorMessage: null,
            profileSyncRequested: true,
            profileSyncClaimedAt: null,
          },
        })
      : data.action === "logout"
        ? await prisma.telegramSession.updateMany({
            where: { ...where, isLoggedIn: true },
            data: { status: "inactive", isLoggedIn: false },
          })
        : data.action === "profile_sync"
          ? await prisma.telegramSession.updateMany({
              where: { ...where, status: "active", isLoggedIn: true },
              data: { profileSyncRequested: true, profileSyncClaimedAt: null },
            })
          : data.action === "warmup_mode"
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
  const chargeable = data.action === "spam_check" || data.action === "warmup";
  const result =
    !chargeable
      ? await operation()
      : await runChargedValidatorTask(
          {
            accountId: account.id,
            accessKeyId: account.accessKeyId,
            taskCode:
              data.action === "spam_check" ? "spam_check" : "session_warmup",
            sessions: sessionIds.length,
            description:
              data.action === "spam_check"
                ? `Run ${sessionIds.length} SpamBot checks`
                : `Queue warmup for ${sessionIds.length} sessions`,
          },
          operation,
        );
  return NextResponse.json(
    { updated: result.count, skipped: sessionIds.length - result.count },
    { status: 202 },
  );
}
