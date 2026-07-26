import { NextResponse } from "next/server";
import { queueProfileAssignments } from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as { assignments?: unknown } | null;
    const batch = await queueProfileAssignments(
      account.id,
      "randomize",
      body?.assignments,
      { source: "randomize" },
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
