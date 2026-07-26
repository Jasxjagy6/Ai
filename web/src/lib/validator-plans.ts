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
  aiChatAccess: boolean;
  aiCampaignLimit: number | null;
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

function fullAccessFeatures(credits: number) {
  return [
    `${credits.toLocaleString()} workspace credits`,
    "Every Signal Desk feature",
    "Unlimited Telegram fleet size",
    "Validator, messaging, schedules, reports, account tools, and AI Chatter",
    "Operations use credits only when they run",
  ];
}

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
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(2500),
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
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: true,
      features: fullAccessFeatures(10000),
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
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(30000),
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
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(120000),
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
        {
          ...DEFAULT_VALIDATOR_PLANS[code],
          ...(overrides[code] || {}),
          code,
          validatorAccess: true,
          messagingAccess: true,
          aiChatAccess: true,
          aiCampaignLimit: null,
          sessionLimit: null,
          features: fullAccessFeatures(
            overrides[code]?.creditsIncluded ??
              DEFAULT_VALIDATOR_PLANS[code].creditsIncluded,
          ),
        },
      ]),
    ) as Record<ValidatorPlanCode, ValidatorPlan>;
  } catch {
    return DEFAULT_VALIDATOR_PLANS;
  }
}

export async function saveValidatorPlans(
  plans: Record<ValidatorPlanCode, ValidatorPlan>,
) {
  await setSetting(
    "validator_plans_v2_json",
    JSON.stringify(
      Object.fromEntries(
        VALIDATOR_PLAN_CODES.map((code) => [
          code,
          {
            ...plans[code],
            validatorAccess: true,
            messagingAccess: true,
            aiChatAccess: true,
            aiCampaignLimit: null,
            sessionLimit: null,
            features: fullAccessFeatures(plans[code].creditsIncluded),
          },
        ]),
      ),
    ),
  );
}
