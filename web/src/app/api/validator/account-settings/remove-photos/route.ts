import { NextResponse } from "next/server";
import {
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
    const sessions = await resolveAccountSettingsTargets(account.id, body || {});
    const batch = await queueAccountSettingsBatch(
      account.id,
      "remove_photos",
      sessions.map((session, position) => ({
        sessionId: session.id,
        action: "remove_photos" as const,
        position,
        payload: {},
      })),
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
