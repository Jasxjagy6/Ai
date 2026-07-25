import { getSetting, setSetting } from "@/lib/settings";

export type ValidatorPlanCode = "basic" | "pro" | "vip" | "enterprise";

export type ValidatorPlan = {
  code: ValidatorPlanCode;
  name: string;
  tagline: string;
  priceUsdCents: number;
  durationDays: number | null;
  creditsIncluded: number;
  validatorAccess: boolean;
  messagingAccess: boolean;
  sessionLimit: number | null;
  enabled: boolean;
  featured: boolean;
  features: string[];
};

export const VALIDATOR_PLAN_CODES: ValidatorPlanCode[] = [
  "basic",
  "pro",
  "vip",
  "enterprise",
];

export const DEFAULT_VALIDATOR_PLANS: Record<ValidatorPlanCode, ValidatorPlan> =
  {
    basic: {
      code: "basic",
      name: "Basic",
      tagline: "A clean starting point for focused Telegram operations",
      priceUsdCents: 1900,
      durationDays: 30,
      creditsIncluded: 2500,
      validatorAccess: true,
      messagingAccess: true,
      sessionLimit: 5,
      enabled: true,
      featured: false,
      features: [
        "2,500 workspace credits",
        "5 Telegram sessions",
        "Validator and messaging tools",
      ],
    },
    pro: {
      code: "pro",
      name: "Pro",
      tagline: "Higher throughput for teams running every week",
      priceUsdCents: 4900,
      durationDays: 30,
      creditsIncluded: 10000,
      validatorAccess: true,
      messagingAccess: true,
      sessionLimit: 15,
      enabled: true,
      featured: true,
      features: [
        "10,000 workspace credits",
        "15 Telegram sessions",
        "Schedules, reports, and affiliates",
      ],
    },
    vip: {
      code: "vip",
      name: "VIP",
      tagline: "Serious capacity with room for multiple fleets",
      priceUsdCents: 9900,
      durationDays: 30,
      creditsIncluded: 30000,
      validatorAccess: true,
      messagingAccess: true,
      sessionLimit: 40,
      enabled: true,
      featured: false,
      features: [
        "30,000 workspace credits",
        "40 Telegram sessions",
        "Priority operating capacity",
      ],
    },
    enterprise: {
      code: "enterprise",
      name: "Enterprise",
      tagline: "Maximum scale for durable, multi-fleet operations",
      priceUsdCents: 29900,
      durationDays: 30,
      creditsIncluded: 120000,
      validatorAccess: true,
      messagingAccess: true,
      sessionLimit: 150,
      enabled: true,
      featured: false,
      features: [
        "120,000 workspace credits",
        "150 Telegram sessions",
        "Enterprise-scale throughput",
      ],
    },
  };

export async function getValidatorPlans() {
  try {
    const raw = await getSetting("validator_plans_v2_json");
    if (!raw) return DEFAULT_VALIDATOR_PLANS;
    const overrides = JSON.parse(raw) as Partial<
      Record<ValidatorPlanCode, Partial<ValidatorPlan>>
    >;
    return Object.fromEntries(
      VALIDATOR_PLAN_CODES.map((code) => [
        code,
        { ...DEFAULT_VALIDATOR_PLANS[code], ...(overrides[code] || {}), code },
      ]),
    ) as Record<ValidatorPlanCode, ValidatorPlan>;
  } catch {
    return DEFAULT_VALIDATOR_PLANS;
  }
}

export async function saveValidatorPlans(
  plans: Record<ValidatorPlanCode, ValidatorPlan>,
) {
  await setSetting("validator_plans_v2_json", JSON.stringify(plans));
}
