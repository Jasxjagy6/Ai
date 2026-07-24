import { NextResponse } from "next/server";
import { deduplicateList } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json(await deduplicateList(account.id, (await params).id));
  } catch (error) {
    return validatorError(error);
  }
}
