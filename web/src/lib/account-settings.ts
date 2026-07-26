import path from "path";
import { access } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACCOUNT_SETTINGS_MEDIA_ROOT = path.resolve(
  process.env.ACCOUNT_SETTINGS_MEDIA_ROOT ||
    path.join(process.cwd(), "uploads", "account-settings"),
);

export const ACCOUNT_SETTINGS_AVATAR_ROOT = path.resolve(
  process.env.ACCOUNT_SETTINGS_AVATAR_ROOT ||
    path.join(process.cwd(), "public", "account-settings", "avatars"),
);

export class AccountSettingsError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "ACCOUNT_SETTINGS_ERROR",
  ) {
    super(message);
  }
}

export type AccountSettingsJobInput = {
  sessionId: string;
  action: "update_profile" | "remove_photos" | "set_photo" | "send_story" | "clear_history";
  position?: number;
  payload?: Prisma.InputJsonValue;
};

export type ProfileAssignmentInput = {
  sessionId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  clearUsername?: unknown;
  bio?: unknown;
  avatarId?: unknown;
  photoPath?: unknown;
};

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

function isWithin(root: string, candidate: string) {
  return candidate.startsWith(`${root}${path.sep}`);
}

export async function validateMediaToken(
  accountId: string,
  token: unknown,
  allowed: "photo" | "story" = "photo",
) {
  if (typeof token !== "string" || !token.length || token.length > 500) {
    throw new AccountSettingsError("Uploaded media is missing. Upload it again.", 400, "MEDIA_NOT_FOUND");
  }

  const normalized = token.replaceAll("\\", "/").replace(/^\/+/, "");
  let resolved: string;
  if (normalized.startsWith("avatars/")) {
    if (allowed !== "photo") {
      throw new AccountSettingsError("Bundled avatars cannot be used as story media", 400, "BAD_MEDIA_PATH");
    }
    resolved = path.resolve(ACCOUNT_SETTINGS_AVATAR_ROOT, normalized.slice("avatars/".length));
    if (!isWithin(ACCOUNT_SETTINGS_AVATAR_ROOT, resolved)) {
      throw new AccountSettingsError("Invalid avatar path", 400, "BAD_MEDIA_PATH");
    }
  } else {
    if (!normalized.startsWith(`${accountId}/`)) {
      throw new AccountSettingsError("Media does not belong to this account", 403, "MEDIA_NOT_OWNED");
    }
    resolved = path.resolve(ACCOUNT_SETTINGS_MEDIA_ROOT, normalized);
    if (!isWithin(ACCOUNT_SETTINGS_MEDIA_ROOT, resolved)) {
      throw new AccountSettingsError("Invalid media path", 400, "BAD_MEDIA_PATH");
    }
  }
  await access(resolved).catch(() => {
    throw new AccountSettingsError("Uploaded media is no longer available. Upload it again.", 400, "MEDIA_NOT_FOUND");
  });
  return normalized;
}

export async function resolveAccountSettingsTargets(
  accountId: string,
  input: { sessionIds?: unknown; sessionListId?: unknown; sessionListIds?: unknown },
) {
  const requestedListIds = [
    ...(Array.isArray(input.sessionListIds)
      ? input.sessionListIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []),
    ...(typeof input.sessionListId === "string" && input.sessionListId ? [input.sessionListId] : []),
  ];
  const listIds = [...new Set(requestedListIds)];
  if (listIds.length) {
    if (listIds.length > 100) throw new AccountSettingsError("Select at most 100 session lists", 400, "TOO_MANY_SESSION_LISTS");
    const lists = await prisma.telegramSessionList.findMany({
      where: { id: { in: listIds }, accountId },
      include: {
        members: {
          orderBy: { position: "asc" },
          include: { session: true },
        },
      },
    });
    if (lists.length !== listIds.length) throw new AccountSettingsError("One or more session lists were not found", 404, "SESSION_LIST_NOT_FOUND");
    const byId = new Map(lists.map((list) => [list.id, list]));
    const sessions = [];
    const seen = new Set<string>();
    for (const id of listIds) {
      for (const member of byId.get(id)!.members) {
        if (seen.has(member.sessionId)) continue;
        seen.add(member.sessionId);
        sessions.push(member.session);
      }
    }
    if (!sessions.length) throw new AccountSettingsError("The selected session lists are empty", 400, "EMPTY_SESSION_LIST");
    if (sessions.length > 1000) throw new AccountSettingsError("The selected lists contain more than 1,000 unique sessions", 400, "TOO_MANY_SESSIONS");
    return sessions;
  }

  const sessionIds = Array.isArray(input.sessionIds)
    ? [...new Set(input.sessionIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (!sessionIds.length) throw new AccountSettingsError("Select at least one session", 400, "NO_SESSIONS");
  if (sessionIds.length > 500) throw new AccountSettingsError("Select at most 500 sessions", 400, "TOO_MANY_SESSIONS");

  const sessions = await prisma.telegramSession.findMany({
    where: { accountId, id: { in: sessionIds } },
  });
  if (sessions.length !== sessionIds.length) {
    throw new AccountSettingsError("One or more sessions were not found", 404, "SESSION_NOT_FOUND");
  }
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return sessionIds.map((id) => byId.get(id)!);
}

export async function queueAccountSettingsBatch(
  accountId: string,
  kind: string,
  jobs: AccountSettingsJobInput[],
  metadata?: Prisma.InputJsonValue,
) {
  if (!jobs.length) throw new AccountSettingsError("No account-settings jobs were supplied", 400, "NO_JOBS");
  if (jobs.length > 1000) throw new AccountSettingsError("Queue at most 1,000 operations at once", 400, "TOO_MANY_JOBS");

  const uniqueSessionIds = [...new Set(jobs.map((job) => job.sessionId))];
  const sessions = await prisma.telegramSession.findMany({
    where: { accountId, id: { in: uniqueSessionIds } },
    select: { id: true, status: true, isLoggedIn: true },
  });
  if (sessions.length !== uniqueSessionIds.length) {
    throw new AccountSettingsError("One or more sessions were not found", 404, "SESSION_NOT_FOUND");
  }
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const skippedCount = jobs.filter((job) => {
    const session = sessionById.get(job.sessionId)!;
    return session.status !== "active" || !session.isLoggedIn;
  }).length;
  const pendingCount = jobs.length - skippedCount;

  const batch = await prisma.$transaction(async (transaction) => {
    const created = await transaction.telegramAccountSettingsBatch.create({
      data: {
        accountId,
        kind,
        status: pendingCount ? "pending" : "completed",
        totalCount: jobs.length,
        processedCount: skippedCount,
        skippedCount,
        metadata,
        finishedAt: pendingCount ? null : new Date(),
      },
    });
    await transaction.telegramAccountSettingsJob.createMany({
      data: jobs.map((job, position) => {
        const session = sessionById.get(job.sessionId)!;
        const skipped = session.status !== "active" || !session.isLoggedIn;
        return {
          batchId: created.id,
          accountId,
          sessionId: job.sessionId,
          action: job.action,
          status: skipped ? "skipped" : "pending",
          position: job.position ?? position,
          payload: job.payload,
          result: skipped ? { skipReason: "not_connected" } : undefined,
          errorCode: skipped ? "NOT_CONNECTED" : null,
          errorMessage: skipped ? "Session is not active or logged in" : null,
          finishedAt: skipped ? new Date() : null,
        };
      }),
    });
    return created;
  });
  return getAccountSettingsBatch(accountId, batch.id);
}

export async function queueProfileAssignments(
  accountId: string,
  kind: string,
  values: unknown,
  metadata?: Prisma.InputJsonValue,
) {
  if (!Array.isArray(values) || !values.length) {
    throw new AccountSettingsError("Add at least one profile assignment", 400, "NO_ASSIGNMENTS");
  }
  if (values.length > 500) {
    throw new AccountSettingsError("Apply profiles to at most 500 sessions at once", 400, "TOO_MANY_ASSIGNMENTS");
  }

  const assignments = values as ProfileAssignmentInput[];
  const sessionIds = assignments.map((assignment) => {
    if (typeof assignment?.sessionId !== "string" || !assignment.sessionId) {
      throw new AccountSettingsError("Every assignment requires a session", 400, "INVALID_SESSION_ID");
    }
    return assignment.sessionId;
  });
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw new AccountSettingsError("Each session can appear only once in a profile batch", 400, "DUPLICATE_SESSION");
  }

  const jobs: AccountSettingsJobInput[] = [];
  for (let position = 0; position < assignments.length; position++) {
    const assignment = assignments[position];
    const has = (field: keyof ProfileAssignmentInput) => Object.prototype.hasOwnProperty.call(assignment, field);
    const firstName = has("firstName") && typeof assignment.firstName === "string"
      ? assignment.firstName.trim()
      : undefined;
    const lastName = has("lastName") && typeof assignment.lastName === "string"
      ? assignment.lastName.trim()
      : undefined;
    const username = has("username") && typeof assignment.username === "string"
      ? assignment.username.trim().replace(/^@/, "")
      : undefined;
    const bio = has("bio") && typeof assignment.bio === "string"
      ? assignment.bio.trim()
      : undefined;
    const clearUsername = assignment.clearUsername === true;
    if (has("firstName") && !firstName) {
      throw new AccountSettingsError(`Assignment ${position + 1} has an empty first name`, 400, "FIRST_NAME_REQUIRED");
    }
    if ((firstName?.length || 0) > 64 || (lastName?.length || 0) > 64) {
      throw new AccountSettingsError(`Assignment ${position + 1} has a name longer than 64 characters`, 400, "NAME_TOO_LONG");
    }
    if (has("username") && !clearUsername && !USERNAME_RE.test(username || "")) {
      throw new AccountSettingsError(`Assignment ${position + 1} has an invalid Telegram username`, 400, "INVALID_USERNAME");
    }
    if ((bio?.length || 0) > 70) {
      throw new AccountSettingsError(`Assignment ${position + 1} has a bio longer than 70 characters`, 400, "BIO_TOO_LONG");
    }

    let profilePhotoPath: string | undefined;
    if (typeof assignment.avatarId === "string" && assignment.avatarId) {
      if (!/^avatar[\w-]+\.(?:jpe?g|png|webp)$/i.test(assignment.avatarId)) {
        throw new AccountSettingsError(`Assignment ${position + 1} has an invalid avatar`, 400, "INVALID_AVATAR");
      }
      profilePhotoPath = await validateMediaToken(accountId, `avatars/${assignment.avatarId}`);
    } else if (typeof assignment.photoPath === "string" && assignment.photoPath) {
      profilePhotoPath = await validateMediaToken(accountId, assignment.photoPath);
    }

    const updateFlags = {
      firstName: firstName !== undefined,
      lastName: lastName !== undefined,
      username: username !== undefined || clearUsername,
      bio: bio !== undefined,
      profilePhoto: profilePhotoPath !== undefined,
    };
    if (!Object.values(updateFlags).some(Boolean)) {
      throw new AccountSettingsError(`Assignment ${position + 1} has no profile fields`, 400, "EMPTY_ASSIGNMENT");
    }
    jobs.push({
      sessionId: sessionIds[position],
      action: "update_profile",
      position,
      payload: {
        firstName: firstName || "",
        lastName: lastName || "",
        username: clearUsername ? "" : username || "",
        bio: bio || "",
        profilePhotoPath,
        updateFlags,
        fieldModes: {
          firstName: "set",
          lastName: "set",
          username: clearUsername ? "remove" : "set",
          bio: "set",
          profilePhoto: "set",
        },
      },
    });
  }
  return queueAccountSettingsBatch(accountId, kind, jobs, metadata);
}

const batchInclude = {
  jobs: {
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
    include: {
      session: {
        select: { id: true, label: true, phone: true, username: true },
      },
    },
  },
};

export async function getAccountSettingsBatch(accountId: string, id: string) {
  const batch = await prisma.telegramAccountSettingsBatch.findFirst({
    where: { id, accountId },
    include: batchInclude,
  });
  if (!batch) throw new AccountSettingsError("Account-settings batch not found", 404, "BATCH_NOT_FOUND");
  return batch;
}

export async function listAccountSettingsBatches(accountId: string, limit = 20) {
  return prisma.telegramAccountSettingsBatch.findMany({
    where: { accountId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(100, limit)),
  });
}

export async function cancelAccountSettingsBatch(accountId: string, id: string) {
  const batch = await prisma.telegramAccountSettingsBatch.findFirst({ where: { id, accountId } });
  if (!batch) throw new AccountSettingsError("Account-settings batch not found", 404, "BATCH_NOT_FOUND");
  if (["completed", "failed", "cancelled"].includes(batch.status)) {
    throw new AccountSettingsError(`Cannot cancel a ${batch.status} batch`, 409, "BATCH_NOT_CANCELABLE");
  }
  await prisma.telegramAccountSettingsBatch.update({
    where: { id },
    data: { cancelRequested: true },
  });
  return getAccountSettingsBatch(accountId, id);
}

export function accountSettingsError(error: unknown) {
  if (error instanceof AccountSettingsError) {
    return { message: error.message, status: error.status, code: error.code };
  }
  return {
    message: error instanceof Error ? error.message : "Account settings request failed",
    status: 500,
    code: "ACCOUNT_SETTINGS_ERROR",
  };
}
