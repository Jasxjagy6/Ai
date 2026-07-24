import { NextResponse } from "next/server";
import { getLinkFilterJob } from "@/lib/link-filter";
import { requireValidatorAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireValidatorAccount();
  if (!account) return unauthorized();
  try {
    return NextResponse.json({ job: await getLinkFilterJob(account.id, (await params).id) });
  } catch (error) {
    return validatorError(error);
  }
}
