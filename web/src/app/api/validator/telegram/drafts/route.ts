import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createTelegramDraftJob,
  listTelegramDraftJobs,
} from "@/lib/telegram-drafts";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  message: z
    .string()
    .max(4096)
    .refine((value) => value.trim().length > 0, "Enter a draft message"),
  scope: z.enum(["dms", "groups", "both"]).default("both"),
  filterWords: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  targetMode: z.enum(["all", "sessions", "lists"]),
  sessionIds: z.array(z.string().min(1)).optional(),
  sessionListIds: z.array(z.string().min(1)).optional(),
});

export async function GET(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const limit = Number(new URL(request.url).searchParams.get("limit")) || 20;
  return NextResponse.json({ jobs: await listTelegramDraftJobs(account.id, limit) });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Enter valid draft settings" },
        { status: 400 },
      );
    }
    const job = await createTelegramDraftJob(account.id, parsed.data);
    return NextResponse.json({ job, jobId: job.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
