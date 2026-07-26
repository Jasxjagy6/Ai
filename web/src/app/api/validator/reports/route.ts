import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized } from "@/lib/validator-api";

function rangeFrom(request: Request) {
  const url = new URL(request.url);
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const createdAt: Prisma.DateTimeFilter = {};
  if (fromValue) createdAt.gte = new Date(fromValue);
  if (toValue) createdAt.lte = new Date(toValue);
  return fromValue || toValue ? createdAt : undefined;
}

export async function GET(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  const createdAt = rangeFrom(request);
  const where = { accountId: account.id, ...(createdAt ? { createdAt } : {}) };
  const [validation, messaging, accountOperations, aiCampaigns] = await Promise.all([
    prisma.linkFilterJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true, status: true, sourceListName: true, resultListName: true,
        totalCount: true, validCount: true, invalidCount: true, failedCount: true,
        skippedCount: true, totalRequests: true, createdAt: true, startedAt: true,
        finishedAt: true, errorMessage: true,
      },
    }),
    prisma.telegramCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true, name: true, status: true, targetType: true, mode: true,
        totalCount: true, sentCount: true, failedCount: true, skippedCount: true,
        repliedCount: true, sessionCount: true, createdAt: true, startedAt: true,
        finishedAt: true, errorMessage: true,
      },
    }),
    prisma.telegramAccountSettingsBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true, kind: true, status: true, totalCount: true, succeededCount: true,
        failedCount: true, skippedCount: true, createdAt: true, startedAt: true,
        finishedAt: true, errorMessage: true,
      },
    }),
    prisma.aiCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true, name: true, provider: true, status: true, durationMode: true,
        messagesReceived: true, messagesSent: true, failedCount: true, creditsUsed: true,
        createdAt: true, startedAt: true, stoppedAt: true, lastError: true,
        _count: { select: { sessions: true, memories: true, jobs: true, responseLogs: true } },
      },
    }),
  ]);

  const runs = [
    ...validation.map((run) => ({
      id: run.id, kind: "validator", name: run.sourceListName, output: run.resultListName,
      status: run.status, total: run.totalCount, succeeded: run.validCount,
      failed: run.failedCount, skipped: run.skippedCount, secondary: run.invalidCount,
      secondaryLabel: "invalid", requests: run.totalRequests, createdAt: run.createdAt,
      startedAt: run.startedAt, finishedAt: run.finishedAt, error: run.errorMessage,
    })),
    ...messaging.map((run) => ({
      id: run.id, kind: "message_run", name: run.name, output: `${run.targetType} / ${run.mode}`,
      status: run.status, total: run.totalCount, succeeded: run.sentCount,
      failed: run.failedCount, skipped: run.skippedCount, secondary: run.repliedCount,
      secondaryLabel: "replies", requests: run.sessionCount, createdAt: run.createdAt,
      startedAt: run.startedAt, finishedAt: run.finishedAt, error: run.errorMessage,
    })),
    ...accountOperations.map((run) => ({
      id: run.id, kind: "account_settings", name: run.kind.replaceAll("_", " "), output: "Telegram profiles",
      status: run.status, total: run.totalCount, succeeded: run.succeededCount,
      failed: run.failedCount, skipped: run.skippedCount, secondary: 0,
      secondaryLabel: "other", requests: run.totalCount, createdAt: run.createdAt,
      startedAt: run.startedAt, finishedAt: run.finishedAt, error: run.errorMessage,
    })),
    ...aiCampaigns.map((run) => ({
      id: run.id, kind: "ai_campaign", name: run.name, output: `${run.provider} / ${run.durationMode.replaceAll("_", " ")}`,
      status: run.status, total: run.messagesReceived, succeeded: run.messagesSent,
      failed: run.failedCount, skipped: 0, secondary: run._count.memories,
      secondaryLabel: "conversations", requests: run._count.jobs, createdAt: run.createdAt,
      startedAt: run.startedAt, finishedAt: run.stoppedAt, error: run.lastError,
      creditsUsed: run.creditsUsed, sessions: run._count.sessions, logs: run._count.responseLogs,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const summary = {
    runs: runs.length,
    active: runs.filter((run) => ["pending", "running", "processing", "starting", "credit_grace"].includes(run.status)).length,
    completed: runs.filter((run) => ["completed", "stopped", "expired"].includes(run.status)).length,
    failed: runs.filter((run) => ["failed", "error", "grace_expired"].includes(run.status)).length,
    succeeded: runs.reduce((sum, run) => sum + run.succeeded, 0),
    errors: runs.reduce((sum, run) => sum + run.failed, 0),
  };
  return NextResponse.json({ summary, runs });
}
