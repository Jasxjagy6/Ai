import { NextResponse } from "next/server";
import { normalizeList } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";
import { prisma } from "@/lib/prisma";
import { runChargedValidatorTask } from "@/lib/validator-credits";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const id = (await params).id;
    const list = await prisma.contactList.findFirst({
      where: { id, accountId: account.id },
    });
    if (!list)
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    return NextResponse.json(
      await runChargedValidatorTask(
        {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          taskCode: "list_normalize",
          items: list.itemsCount,
          description: `Normalize ${list.itemsCount.toLocaleString()} rows`,
        },
        () => normalizeList(account.id, id),
      ),
    );
  } catch (error) {
    return validatorError(error);
  }
}
