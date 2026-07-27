import { NextResponse } from "next/server";
import { mergeLists } from "@/lib/list-service";
import { ListError } from "@/lib/lists";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";
import { prisma } from "@/lib/prisma";
import { runChargedValidatorTask } from "@/lib/validator-credits";

export async function POST(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const listIds: string[] = Array.isArray(body?.listIds)
      ? body.listIds.filter(
          (id: unknown): id is string => typeof id === "string",
        )
      : [];
    const name =
      typeof body?.name === "string" ? body.name.trim().slice(0, 255) : "";
    if (!name)
      throw new ListError(
        "Merged-list name is required",
        400,
        "MISSING_LIST_NAME",
      );
    const aggregate = await prisma.contactList.aggregate({
      where: { id: { in: [...new Set(listIds)] }, accountId: account.id },
      _sum: { itemsCount: true },
    });
    return NextResponse.json(
      await runChargedValidatorTask(
        {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          taskCode: "list_merge",
          items: aggregate._sum?.itemsCount || 0,
          description: `Merge ${listIds.length.toLocaleString()} lists`,
        },
        () => mergeLists(account.id, listIds, name),
      ),
      { status: 201 },
    );
  } catch (error) {
    return validatorError(error);
  }
}
