import { NextResponse } from "next/server";
import { listLinkFilterJobs, startLinkFilterJob } from "@/lib/link-filter";
import { ListError } from "@/lib/lists";
import { requireValidatorAccount } from "@/lib/validator-auth";
import { unauthorized, validatorError } from "@/lib/validator-api";

export async function GET(request: Request) {
  const account = await requireValidatorAccount();
  if (!account) return unauthorized();
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit")) || 30;
    return NextResponse.json({ jobs: await listLinkFilterJobs(account.id, limit) });
  } catch (error) {
    return validatorError(error);
  }
}

export async function POST(request: Request) {
  const account = await requireValidatorAccount();
  if (!account) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const sourceListId = typeof body?.sourceListId === "string" ? body.sourceListId : "";
    const resultListName = typeof body?.resultListName === "string" ? body.resultListName.trim().slice(0, 255) : "";
    const useProxies = body?.useProxies !== false;
    if (!sourceListId) throw new ListError("Select a source list", 400, "MISSING_SOURCE_LIST");
    return NextResponse.json({ job: await startLinkFilterJob(account.id, sourceListId, resultListName, useProxies, account.accessKeyId) }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
