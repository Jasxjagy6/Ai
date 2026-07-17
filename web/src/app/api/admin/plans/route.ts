import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getPlans, savePlanOverrides, getTrialConfig } from "@/lib/plans";
import { setSetting } from "@/lib/settings";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [plans, trial] = await Promise.all([getPlans(), getTrialConfig()]);
  return NextResponse.json({ plans, trial });
}

const planSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  tagline: z.string().max(80).optional(),
  priceInr: z.number().int().min(0).max(10_000_000).optional(),
  priceUsd: z.number().int().min(0).max(100_000).optional(),
  messagesPerDay: z.number().int().min(-1).max(1_000_000).optional(),
  apiRequestsPerDay: z.number().int().min(-1).max(10_000_000).optional(),
  apiKeysAllowed: z.number().int().min(0).max(1000).optional(),
  features: z.array(z.string().max(80)).max(12).optional(),
});

const schema = z.object({
  plans: z
    .object({ FREE: planSchema.optional(), PLUS: planSchema.optional(), PRO: planSchema.optional() })
    .optional(),
  trial: z
    .object({
      days: z.number().int().min(0).max(90),
      tier: z.enum(["PLUS", "PRO"]),
    })
    .optional(),
});

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.plans) await savePlanOverrides(parsed.data.plans);
  if (parsed.data.trial) {
    await setSetting("trial_days", String(parsed.data.trial.days));
    await setSetting("trial_tier", parsed.data.trial.tier);
  }

  const [plans, trial] = await Promise.all([getPlans(), getTrialConfig()]);
  return NextResponse.json({ ok: true, plans, trial });
}
