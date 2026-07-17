import { PlanTier } from "@prisma/client";
import { getSetting, setSetting } from "@/lib/settings";

export type Plan = {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** INR paise for Razorpay, USD cents for Stripe */
  priceInr: number;
  priceUsd: number;
  messagesPerDay: number; // -1 = unlimited
  apiRequestsPerDay: number; // developer API quota, -1 = unlimited
  apiKeysAllowed: number;
  features: string[];
};

export const DEFAULT_PLANS: Record<PlanTier, Plan> = {
  FREE: {
    tier: "FREE",
    name: "Free",
    tagline: "Get to know Aria",
    priceInr: 0,
    priceUsd: 0,
    messagesPerDay: 20,
    apiRequestsPerDay: 50,
    apiKeysAllowed: 1,
    features: [
      "20 messages / day",
      "Standard reply speed",
      "7-day chat history",
      "API: 50 requests / day",
    ],
  },
  PLUS: {
    tier: "PLUS",
    name: "Plus",
    tagline: "For the regulars",
    priceInr: 39900,
    priceUsd: 799,
    messagesPerDay: 300,
    apiRequestsPerDay: 2000,
    apiKeysAllowed: 3,
    features: [
      "300 messages / day",
      "Priority reply speed",
      "Unlimited chat history",
      "All companions incl. Maya",
      "API: 2,000 requests / day",
    ],
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    tagline: "The full experience",
    priceInr: 79900,
    priceUsd: 1499,
    messagesPerDay: -1,
    apiRequestsPerDay: 10000,
    apiKeysAllowed: 10,
    features: [
      "Unlimited messages",
      "Fastest replies",
      "All companions incl. Zoe",
      "Long-term memory",
      "API: 10,000 requests / day",
      "Early access to new features",
    ],
  },
};

const TIERS: PlanTier[] = ["FREE", "PLUS", "PRO"];

/** Plans with admin overrides from the DB merged over the defaults. */
export async function getPlans(): Promise<Record<PlanTier, Plan>> {
  try {
    const raw = await getSetting("plans_json");
    if (!raw) return DEFAULT_PLANS;
    const overrides = JSON.parse(raw) as Partial<Record<PlanTier, Partial<Plan>>>;
    const merged = {} as Record<PlanTier, Plan>;
    for (const tier of TIERS) {
      merged[tier] = { ...DEFAULT_PLANS[tier], ...(overrides[tier] ?? {}), tier };
    }
    return merged;
  } catch {
    return DEFAULT_PLANS;
  }
}

export async function getPlan(tier: PlanTier): Promise<Plan> {
  return (await getPlans())[tier];
}

export async function savePlanOverrides(overrides: Partial<Record<PlanTier, Partial<Plan>>>) {
  await setSetting("plans_json", JSON.stringify(overrides));
}

/** Free-trial config (admin-set): new signups get `tier` for `days` days. */
export async function getTrialConfig(): Promise<{ days: number; tier: PlanTier }> {
  const days = parseInt(await getSetting("trial_days")) || 0;
  const rawTier = await getSetting("trial_tier");
  const tier: PlanTier = rawTier === "PRO" ? "PRO" : "PLUS";
  return { days, tier };
}
