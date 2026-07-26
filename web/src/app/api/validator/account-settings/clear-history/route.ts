import { NextResponse } from "next/server";
import {
  AccountSettingsError,
  queueAccountSettingsBatch,
  resolveAccountSettingsTargets,
} from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new AccountSettingsError("Invalid history deletion request", 400, "INVALID_REQUEST");
    const sessions = await resolveAccountSettingsTargets(account.id, body);
    const revoke = body.revoke === true;
    const concurrency = Math.max(1, Math.min(16, Number(body.concurrency) || 8));
    const batch = await queueAccountSettingsBatch(
      account.id,
      "clear_history",
      sessions.map((session, position) => ({
        sessionId: session.id,
        action: "clear_history" as const,
        position,
        payload: { revoke, concurrency },
      })),
      {
        revoke,
        concurrency,
        source: Array.isArray(body.sessionListIds) && body.sessionListIds.length
          ? "session_lists"
          : "sessions",
        sessionListIds: Array.isArray(body.sessionListIds) ? body.sessionListIds : undefined,
      },
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
