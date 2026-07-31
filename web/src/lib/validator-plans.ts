import { getSetting, setSetting } from "@/lib/settings";

export type ValidatorPlanCode = "week" | "month" | "six_months" | "year";

export type ValidatorPlan = {
  code: ValidatorPlanCode;
  name: string;
  tagline: string;
  priceUsdCents: number;
  durationDays: number;
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
  "week",
  "month",
  "six_months",
  "year",
];

function fullAccessFeatures() {
  return [
    "Every Signal Desk feature",
    "Unlimited Telegram fleet size",
    "Validator, messaging, schedules, reports, account tools, and AI Chatter",
    "Unlimited usage while your subscription is active",
  ];
}

export const DEFAULT_VALIDATOR_PLANS: Record<ValidatorPlanCode, ValidatorPlan> =
  {
    week: {
      code: "week",
      name: "1 Week",
      tagline: "Full access for a focused week of Telegram operations",
      priceUsdCents: 799,
      durationDays: 7,
      validatorAccess: true,
      messagingAccess: true,
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(),
    },
    month: {
      code: "month",
      name: "1 Month",
      tagline: "A complete month for continuous fleet operations",
      priceUsdCents: 2499,
      durationDays: 30,
      validatorAccess: true,
      messagingAccess: true,
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: true,
      features: fullAccessFeatures(),
    },
    six_months: {
      code: "six_months",
      name: "6 Months",
      tagline: "Long-term access with a built-in multi-month discount",
      priceUsdCents: 11999,
      durationDays: 180,
      validatorAccess: true,
      messagingAccess: true,
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(),
    },
    year: {
      code: "year",
      name: "1 Year",
      tagline: "The best annual value for permanent operators",
      priceUsdCents: 19999,
      durationDays: 365,
      validatorAccess: true,
      messagingAccess: true,
      aiChatAccess: true,
      aiCampaignLimit: null,
      sessionLimit: null,
      enabled: true,
      featured: false,
      features: fullAccessFeatures(),
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
          durationDays: DEFAULT_VALIDATOR_PLANS[code].durationDays,
          features: fullAccessFeatures(),
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
            durationDays: DEFAULT_VALIDATOR_PLANS[code].durationDays,
            features: fullAccessFeatures(),
          },
        ]),
      ),
    ),
  );
}
