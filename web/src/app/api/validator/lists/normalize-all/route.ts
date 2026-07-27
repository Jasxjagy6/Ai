import { NextResponse } from "next/server";
import { normalizeAll } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";
import { prisma } from "@/lib/prisma";
import { runChargedValidatorTask } from "@/lib/validator-credits";

export async function POST() {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const aggregate = await prisma.contactList.aggregate({
      where: { accountId: account.id },
      _sum: { itemsCount: true },
    });
    return NextResponse.json(
      await runChargedValidatorTask(
        {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          taskCode: "list_normalize_all",
          items: aggregate._sum.itemsCount || 0,
          description: "Normalize every list",
        },
        () => normalizeAll(account.id),
      ),
    );
  } catch (error) {
    return validatorError(error);
  }
}
