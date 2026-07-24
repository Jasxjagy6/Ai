import { NextResponse } from "next/server";
import { normalizeAll } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function POST() {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json(await normalizeAll(account.id));
  } catch (error) {
    return validatorError(error);
  }
}
