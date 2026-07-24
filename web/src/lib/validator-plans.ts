import { getSetting, setSetting } from "@/lib/settings";

export type ValidatorPlanCode = "trial" | "month" | "year" | "lifetime" | "messaging_month" | "messaging_year" | "messaging_lifetime";

export type ValidatorPlan = {
  code: ValidatorPlanCode;
  name: string;
  tagline: string;
  priceUsdCents: number;
  durationDays: number | null;
  requestLimit: number | null;
  validatorAccess: boolean;
  messagingAccess: boolean;
  sessionLimit: number | null;
  messageLimit: number | null;
  enabled: boolean;
  featured: boolean;
  features: string[];
};

export const VALIDATOR_PLAN_CODES: ValidatorPlanCode[] = ["trial", "month", "year", "lifetime", "messaging_month", "messaging_year", "messaging_lifetime"];

export const DEFAULT_VALIDATOR_PLANS: Record<ValidatorPlanCode, ValidatorPlan> = {
  trial: {
    code: "trial",
    name: "Free trial",
    tagline: "Test the signal before you commit",
    priceUsdCents: 0,
    durationDays: 7,
    requestLimit: 100,
    validatorAccess: true,
    messagingAccess: false,
    sessionLimit: null,
    messageLimit: null,
    enabled: true,
    featured: false,
    features: ["100 username checks", "7 days of access", "CSV, JSON, and TXT exports"],
  },
  month: {
    code: "month",
    name: "30 days",
    tagline: "For focused validation campaigns",
    priceUsdCents: 1900,
    durationDays: 30,
    requestLimit: null,
    validatorAccess: true,
    messagingAccess: false,
    sessionLimit: null,
    messageLimit: null,
    enabled: true,
    featured: true,
    features: ["Unlimited username checks", "30 days of access", "Proxy and direct-IP modes"],
  },
  year: {
    code: "year",
    name: "1 year",
    tagline: "Always-on access for operators",
    priceUsdCents: 14900,
    durationDays: 365,
    requestLimit: null,
    validatorAccess: true,
    messagingAccess: false,
    sessionLimit: null,
    messageLimit: null,
    enabled: true,
    featured: false,
    features: ["Unlimited username checks", "365 days of access", "Durable run history"],
  },
  lifetime: {
    code: "lifetime",
    name: "Lifetime",
    tagline: "One payment, permanent access",
    priceUsdCents: 29900,
    durationDays: null,
    requestLimit: null,
    validatorAccess: true,
    messagingAccess: false,
    sessionLimit: null,
    messageLimit: null,
    enabled: true,
    featured: false,
    features: ["Unlimited username checks", "No access expiry", "All validator features"],
  },
  messaging_month: {
    code: "messaging_month",
    name: "Messaging 30 days",
    tagline: "A focused Telegram outreach fleet",
    priceUsdCents: 4900,
    durationDays: 30,
    requestLimit: null,
    validatorAccess: false,
    messagingAccess: true,
    sessionLimit: 10,
    messageLimit: 10000,
    enabled: true,
    featured: true,
    features: ["10 Telegram sessions", "10,000 DM attempts", "24-hour reply reports"],
  },
  messaging_year: {
    code: "messaging_year",
    name: "Messaging 1 year",
    tagline: "Durable delivery for active operators",
    priceUsdCents: 39900,
    durationDays: 365,
    requestLimit: null,
    validatorAccess: false,
    messagingAccess: true,
    sessionLimit: 25,
    messageLimit: 150000,
    enabled: true,
    featured: false,
    features: ["25 Telegram sessions", "150,000 DM attempts", "Campaign schedules and exports"],
  },
  messaging_lifetime: {
    code: "messaging_lifetime",
    name: "Messaging lifetime",
    tagline: "Permanent access with a lifetime allowance",
    priceUsdCents: 79900,
    durationDays: null,
    requestLimit: null,
    validatorAccess: false,
    messagingAccess: true,
    sessionLimit: 50,
    messageLimit: 500000,
    enabled: true,
    featured: false,
    features: ["50 Telegram sessions", "500,000 lifetime DM attempts", "No access expiry"],
  },
};

export async function getValidatorPlans() {
  try {
    const raw = await getSetting("validator_plans_json");
    if (!raw) return DEFAULT_VALIDATOR_PLANS;
    const overrides = JSON.parse(raw) as Partial<Record<ValidatorPlanCode, Partial<ValidatorPlan>>>;
    return Object.fromEntries(VALIDATOR_PLAN_CODES.map((code) => [
      code,
      { ...DEFAULT_VALIDATOR_PLANS[code], ...(overrides[code] || {}), code },
    ])) as Record<ValidatorPlanCode, ValidatorPlan>;
  } catch {
    return DEFAULT_VALIDATOR_PLANS;
  }
}

export async function saveValidatorPlans(plans: Record<ValidatorPlanCode, ValidatorPlan>) {
  await setSetting("validator_plans_json", JSON.stringify(plans));
}
