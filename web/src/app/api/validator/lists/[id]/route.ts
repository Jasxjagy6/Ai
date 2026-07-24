import { NextResponse } from "next/server";
import { deleteList, getList, renameList } from "@/lib/list-service";
import { ListError } from "@/lib/lists";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json({ list: await getList(account.id, (await params).id) });
  } catch (error) {
    return validatorError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 255) : "";
    if (!name) throw new ListError("List name is required", 400, "MISSING_LIST_NAME");
    return NextResponse.json({ list: await renameList(account.id, (await params).id, name) });
  } catch (error) {
    return validatorError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json(await deleteList(account.id, (await params).id));
  } catch (error) {
    return validatorError(error);
  }
}
