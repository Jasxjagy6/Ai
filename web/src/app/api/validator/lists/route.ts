import { NextResponse } from "next/server";
import { listLists } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function GET(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    const data = await listLists(account.id, new URL(request.url).searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return validatorError(error);
  }
}
