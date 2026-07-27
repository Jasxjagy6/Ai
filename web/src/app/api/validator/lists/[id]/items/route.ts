import { NextResponse } from "next/server";
import { addItems, getItems, removeItems } from "@/lib/list-service";
import { ListError } from "@/lib/lists";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";
import { runChargedValidatorTask } from "@/lib/validator-credits";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json(
      await getItems(
        account.id,
        (await params).id,
        new URL(request.url).searchParams,
      ),
    );
  } catch (error) {
    return validatorError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.items) || !body.items.length)
      throw new ListError("Supply at least one item", 400, "NO_ITEMS");
    if (body.items.length > 10000)
      throw new ListError(
        "Add at most 10,000 items per request",
        400,
        "TOO_MANY_ITEMS",
      );
    const id = (await params).id;
    return NextResponse.json(
      await runChargedValidatorTask(
        {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          taskCode: "list_add_items",
          items: body.items.length,
          description: `Add ${body.items.length.toLocaleString()} list rows`,
        },
        () => addItems(account.id, id, body.items),
      ),
    );
  } catch (error) {
    return validatorError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const itemIds = Array.isArray(body?.itemIds)
      ? body.itemIds.filter(
          (id: unknown): id is string => typeof id === "string",
        )
      : [];
    if (!itemIds.length)
      throw new ListError("Select at least one item", 400, "NO_ITEM_IDS");
    return NextResponse.json(
      await removeItems(account.id, (await params).id, itemIds),
    );
  } catch (error) {
    return validatorError(error);
  }
}
