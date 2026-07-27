import { NextResponse } from "next/server";
import { AccountSettingsError, queueProfileAssignments } from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as { listId?: unknown; assignments?: unknown } | null;
    if (!body || typeof body.listId !== "string" || !body.listId) {
      throw new AccountSettingsError("Choose a profile list", 400, "PROFILE_LIST_REQUIRED");
    }
    const list = await prisma.contactList.findFirst({
      where: { id: body.listId, accountId: account.id, type: "profile" },
      select: { id: true, name: true },
    });
    if (!list) throw new AccountSettingsError("Profile list not found", 404, "PROFILE_LIST_NOT_FOUND");
    const batch = await queueProfileAssignments(
      account.id,
      "profile_list",
      body.assignments,
      { listId: list.id, listName: list.name },
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
