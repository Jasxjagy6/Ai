import { NextResponse } from "next/server";
import { mergeLists } from "@/lib/list-service";
import { ListError } from "@/lib/lists";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const listIds = Array.isArray(body?.listIds) ? body.listIds.filter((id: unknown): id is string => typeof id === "string") : [];
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 255) : "";
    if (!name) throw new ListError("Merged-list name is required", 400, "MISSING_LIST_NAME");
    return NextResponse.json(await mergeLists(account.id, listIds, name), { status: 201 });
  } catch (error) {
    return validatorError(error);
  }
}
