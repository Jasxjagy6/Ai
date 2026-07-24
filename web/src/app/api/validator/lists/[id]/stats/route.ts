import { NextResponse } from "next/server";
import { listStats } from "@/lib/list-service";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json(await listStats(account.id, (await params).id));
  } catch (error) {
    return validatorError(error);
  }
}
