import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class TelegramDraftError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "TELEGRAM_DRAFT_ERROR",
  ) {
    super(message);
  }
}

export type CreateTelegramDraftInput = {
  name: string;
  message: string;
  scope: "dms" | "groups" | "both";
  filterWords: string[];
  targetMode: "all" | "sessions" | "lists";
  sessionIds?: string[];
  sessionListIds?: string[];
};

function sessionSkipReason(session: {
  status: string;
  isLoggedIn: boolean;
  spamStatus: string;
}) {
  if (session.spamStatus === "frozen") return "frozen";
  if (session.status !== "active" || !session.isLoggedIn) return "not_connected";
  return null;
}

async function resolveDraftSessions(
  accountId: string,
  input: CreateTelegramDraftInput,
) {
  if (input.targetMode === "all") {
    const sessions = await prisma.telegramSession.findMany({
      where: {
        accountId,
        status: "active",
        isLoggedIn: true,
        spamStatus: { not: "frozen" },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!sessions.length) {
      throw new TelegramDraftError(
        "No active, non-frozen Telegram sessions are available",
        400,
        "NO_ELIGIBLE_SESSIONS",
      );
    }
    return sessions;
  }

  let requestedIds: string[];
  if (input.targetMode === "lists") {
    const listIds = [...new Set(input.sessionListIds || [])];
    if (!listIds.length) {
      throw new TelegramDraftError(
        "Select at least one Session List",
        400,
        "NO_SESSION_LISTS",
      );
    }
    const lists = await prisma.telegramSessionList.findMany({
      where: { accountId, id: { in: listIds } },
      include: {
        members: {
          orderBy: { position: "asc" },
          include: { session: true },
        },
      },
    });
    if (lists.length !== listIds.length) {
      throw new TelegramDraftError(
        "One or more Session Lists were not found",
        404,
        "SESSION_LIST_NOT_FOUND",
      );
    }
    const byId = new Map(lists.map((list) => [list.id, list]));
    requestedIds = [];
    const seen = new Set<string>();
    for (const listId of listIds) {
      for (const member of byId.get(listId)!.members) {
        if (seen.has(member.sessionId)) continue;
        seen.add(member.sessionId);
        requestedIds.push(member.sessionId);
      }
    }
    if (!requestedIds.length) {
      throw new TelegramDraftError(
        "The selected Session Lists are empty",
        400,
        "EMPTY_SESSION_LISTS",
      );
    }
  } else {
    requestedIds = [...new Set(input.sessionIds || [])];
    if (!requestedIds.length) {
      throw new TelegramDraftError(
        "Select at least one Telegram session",
        400,
        "NO_SESSIONS",
      );
    }
  }

  const sessions = await prisma.telegramSession.findMany({
    where: { accountId, id: { in: requestedIds } },
  });
  if (sessions.length !== requestedIds.length) {
    throw new TelegramDraftError(
      "One or more Telegram sessions were not found",
      404,
      "SESSION_NOT_FOUND",
    );
  }
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return requestedIds.map((id) => byId.get(id)!);
}

function draftResultView<T extends { chatId: bigint }>(result: T) {
  return { ...result, chatId: result.chatId.toString() };
}

export async function createTelegramDraftJob(
  accountId: string,
  input: CreateTelegramDraftInput,
) {
  const sessions = await resolveDraftSessions(accountId, input);
  const eligibleCount = sessions.filter((session) => !sessionSkipReason(session)).length;
  if (!eligibleCount) {
    throw new TelegramDraftError(
      "The selected sessions are disconnected or frozen",
      400,
      "NO_ELIGIBLE_SESSIONS",
    );
  }

  const filterWords: string[] = [];
  const seenFilters = new Set<string>();
  for (const value of input.filterWords) {
    const word = value.trim();
    const normalized = word.toLocaleLowerCase();
    if (!word || seenFilters.has(normalized)) continue;
    seenFilters.add(normalized);
    filterWords.push(word);
  }
  const metadata = {
    targetMode: input.targetMode,
    sessionListIds: input.targetMode === "lists" ? input.sessionListIds || [] : [],
  } as Prisma.InputJsonValue;
  const now = new Date();
  const job = await prisma.$transaction(async (transaction) => {
    const skippedSessions = sessions.filter((session) => sessionSkipReason(session)).length;
    const created = await transaction.telegramDraftJob.create({
      data: {
        accountId,
        name: input.name,
        message: input.message,
        scope: input.scope,
        filterWords,
        historyDepth: 10,
        status: "pending",
        totalSessions: sessions.length,
        processedSessions: skippedSessions,
        skippedSessions,
        metadata,
      },
    });
    await transaction.telegramDraftSessionJob.createMany({
      data: sessions.map((session, position) => {
        const skipReason = sessionSkipReason(session);
        return {
          draftJobId: created.id,
          sessionId: session.id,
          sessionLabel: session.label,
          status: skipReason ? "skipped" : "pending",
          position,
          result: skipReason ? { skipReason } : undefined,
          errorCode: skipReason ? skipReason.toUpperCase() : null,
          errorMessage:
            skipReason === "frozen"
              ? "Telegram marked this session frozen"
              : skipReason
                ? "Session is not active and logged in"
                : null,
          finishedAt: skipReason ? now : null,
        };
      }),
    });
    return created;
  });
  return getTelegramDraftJob(accountId, job.id);
}

export async function listTelegramDraftJobs(accountId: string, limit = 20) {
  return prisma.telegramDraftJob.findMany({
    where: { accountId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(100, limit)),
  });
}

export async function getTelegramDraftJob(accountId: string, id: string) {
  const job = await prisma.telegramDraftJob.findFirst({
    where: { id, accountId },
    include: {
      sessions: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
      results: {
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100,
      },
    },
  });
  if (!job) {
    throw new TelegramDraftError("Draft job not found", 404, "DRAFT_JOB_NOT_FOUND");
  }
  return {
    ...job,
    results: job.results.map(draftResultView),
  };
}

export async function cancelTelegramDraftJob(accountId: string, id: string) {
  const job = await prisma.telegramDraftJob.findFirst({ where: { id, accountId } });
  if (!job) {
    throw new TelegramDraftError("Draft job not found", 404, "DRAFT_JOB_NOT_FOUND");
  }
  if (["completed", "failed", "cancelled"].includes(job.status)) {
    throw new TelegramDraftError(
      `Cannot cancel a ${job.status} draft job`,
      409,
      "DRAFT_JOB_NOT_CANCELABLE",
    );
  }
  await prisma.telegramDraftJob.update({
    where: { id },
    data: { cancelRequested: true, lastProgressAt: new Date() },
  });
  return getTelegramDraftJob(accountId, id);
}
