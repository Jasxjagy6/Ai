import { NextResponse } from "next/server";
import {
  AccountSettingsError,
  queueAccountSettingsBatch,
  validateMediaToken,
} from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as { assignments?: unknown } | null;
    if (!Array.isArray(body?.assignments) || !body.assignments.length) {
      throw new AccountSettingsError("Add at least one photo assignment", 400, "NO_ASSIGNMENTS");
    }
    if (body.assignments.length > 500) {
      throw new AccountSettingsError("Add at most 500 photo assignments", 400, "TOO_MANY_ASSIGNMENTS");
    }

    const jobs: Array<{ sessionId: string; action: "set_photo"; position: number; payload: { photoPath: string; assignmentIndex: number } }> = [];
    for (let assignmentIndex = 0; assignmentIndex < body.assignments.length; assignmentIndex++) {
      const assignment = body.assignments[assignmentIndex] as Record<string, unknown>;
      const photoPath = await validateMediaToken(account.id, assignment?.photoPath);
      const sessionIds = Array.isArray(assignment?.sessionIds)
        ? [...new Set(assignment.sessionIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
        : [];
      if (!sessionIds.length) {
        throw new AccountSettingsError(`Photo assignment ${assignmentIndex + 1} has no sessions`, 400, "NO_SESSIONS");
      }
      for (const sessionId of sessionIds) {
        jobs.push({
          sessionId,
          action: "set_photo",
          position: jobs.length,
          payload: { photoPath, assignmentIndex },
        });
      }
    }
    if (jobs.length > 1000) throw new AccountSettingsError("Queue at most 1,000 photo operations", 400, "TOO_MANY_JOBS");
    const owned = await prisma.telegramSession.count({
      where: { accountId: account.id, id: { in: [...new Set(jobs.map((job) => job.sessionId))] } },
    });
    if (owned !== new Set(jobs.map((job) => job.sessionId)).size) {
      throw new AccountSettingsError("One or more sessions were not found", 404, "SESSION_NOT_FOUND");
    }
    const batch = await queueAccountSettingsBatch(account.id, "photo_assignments", jobs, {
      totalAssignments: body.assignments.length,
    });
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
