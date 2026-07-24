import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidatorPlans, saveValidatorPlans, VALIDATOR_PLAN_CODES } from "@/lib/validator-plans";

const planSchema = z.object({
  code: z.enum(["trial", "month", "year", "lifetime", "messaging_month", "messaging_year", "messaging_lifetime"]),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(140),
  priceUsdCents: z.number().int().min(0).max(10_000_000),
  durationDays: z.number().int().min(1).max(36500).nullable(),
  requestLimit: z.number().int().min(1).max(100_000_000).nullable(),
  validatorAccess: z.boolean(),
  messagingAccess: z.boolean(),
  sessionLimit: z.number().int().min(1).max(10_000).nullable(),
  messageLimit: z.number().int().min(1).max(100_000_000).nullable(),
  enabled: z.boolean(),
  featured: z.boolean(),
  features: z.array(z.string().trim().min(1).max(120)).max(12),
});

const schema = z.object({ plans: z.record(z.enum(["trial", "month", "year", "lifetime", "messaging_month", "messaging_year", "messaging_lifetime"]), planSchema) });

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [plans, purchases] = await Promise.all([
    getValidatorPlans(),
    prisma.validatorPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, email: true, planName: true, planCode: true, amountUsdCents: true,
        status: true, providerTrackId: true, paidAt: true, claimedAt: true, createdAt: true,
      },
    }),
  ]);
  return NextResponse.json({ plans, purchases });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid plans" }, { status: 400 });
  const plans = parsed.data.plans;
  if (plans.trial.priceUsdCents !== 0) return NextResponse.json({ error: "The free trial price must remain zero" }, { status: 400 });
  for (const code of VALIDATOR_PLAN_CODES) {
    if (plans[code].code !== code) return NextResponse.json({ error: `Invalid ${code} plan code` }, { status: 400 });
    if (!plans[code].validatorAccess && !plans[code].messagingAccess) return NextResponse.json({ error: `${code} must enable at least one product` }, { status: 400 });
  }
  await saveValidatorPlans(plans);
  return NextResponse.json({ ok: true, plans: await getValidatorPlans() });
}
