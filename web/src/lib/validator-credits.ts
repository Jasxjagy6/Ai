import { Prisma } from "@prisma/client";
import { getSetting, setSetting } from "@/lib/settings";
import { ListError } from "@/lib/lists";
import { prisma } from "@/lib/prisma";

export const VALIDATOR_TASK_CODES = [
  "list_import",
  "list_add_items",
  "list_merge",
  "list_normalize",
  "list_deduplicate",
  "list_normalize_all",
  "validator_run",
  "session_import",
  "telegram_login",
  "spam_check",
  "session_warmup",
  "campaign_send",
  "schedule_create",
  "ai_chat_send",
] as const;

export type ValidatorTaskCode = (typeof VALIDATOR_TASK_CODES)[number];
export type CreditPrice = {
  label: string;
  baseCost: number;
  itemCost: number;
  itemUnit: number;
  sessionCost: number;
  enabled: boolean;
};
export type CreditPack = {
  code: string;
  name: string;
  credits: number;
  priceUsdCents: number;
  enabled: boolean;
  featured: boolean;
};
export type ValidatorCreditSettings = {
  creditsPerUsd: number;
  affiliateRateBps: number;
  tasks: Record<ValidatorTaskCode, CreditPrice>;
  topups: CreditPack[];
};

export const DEFAULT_CREDIT_SETTINGS: ValidatorCreditSettings = {
  creditsPerUsd: 100,
  affiliateRateBps: 1000,
  tasks: {
    list_import: {
      label: "Import list",
      baseCost: 2,
      itemCost: 1,
      itemUnit: 100,
      sessionCost: 0,
      enabled: true,
    },
    list_add_items: {
      label: "Add list items",
      baseCost: 1,
      itemCost: 1,
      itemUnit: 100,
      sessionCost: 0,
      enabled: true,
    },
    list_merge: {
      label: "Merge lists",
      baseCost: 2,
      itemCost: 1,
      itemUnit: 250,
      sessionCost: 0,
      enabled: true,
    },
    list_normalize: {
      label: "Normalize list",
      baseCost: 1,
      itemCost: 1,
      itemUnit: 500,
      sessionCost: 0,
      enabled: true,
    },
    list_deduplicate: {
      label: "Deduplicate list",
      baseCost: 1,
      itemCost: 1,
      itemUnit: 500,
      sessionCost: 0,
      enabled: true,
    },
    list_normalize_all: {
      label: "Normalize all lists",
      baseCost: 3,
      itemCost: 1,
      itemUnit: 500,
      sessionCost: 0,
      enabled: true,
    },
    validator_run: {
      label: "Username validation",
      baseCost: 5,
      itemCost: 1,
      itemUnit: 1,
      sessionCost: 0,
      enabled: true,
    },
    session_import: {
      label: "Import Telegram sessions",
      baseCost: 3,
      itemCost: 5,
      itemUnit: 1,
      sessionCost: 0,
      enabled: true,
    },
    telegram_login: {
      label: "Connect Telegram account",
      baseCost: 15,
      itemCost: 0,
      itemUnit: 1,
      sessionCost: 0,
      enabled: true,
    },
    spam_check: {
      label: "SpamBot safety check",
      baseCost: 2,
      itemCost: 0,
      itemUnit: 1,
      sessionCost: 2,
      enabled: true,
    },
    session_warmup: {
      label: "Warmup action",
      baseCost: 2,
      itemCost: 0,
      itemUnit: 1,
      sessionCost: 2,
      enabled: true,
    },
    campaign_send: {
      label: "Telegram message attempts",
      baseCost: 5,
      itemCost: 2,
      itemUnit: 1,
      sessionCost: 1,
      enabled: true,
    },
    schedule_create: {
      label: "Create recurring schedule",
      baseCost: 5,
      itemCost: 1,
      itemUnit: 10,
      sessionCost: 1,
      enabled: true,
    },
    ai_chat_send: {
      label: "AI message sent",
      baseCost: 5,
      itemCost: 0,
      itemUnit: 1,
      sessionCost: 0,
      enabled: true,
    },
  },
  topups: [
    {
      code: "boost_1k",
      name: "Quick boost",
      credits: 1000,
      priceUsdCents: 1000,
      enabled: true,
      featured: false,
    },
    {
      code: "boost_5k",
      name: "Operator pack",
      credits: 5500,
      priceUsdCents: 5000,
      enabled: true,
      featured: true,
    },
    {
      code: "boost_15k",
      name: "Scale pack",
      credits: 17500,
      priceUsdCents: 15000,
      enabled: true,
      featured: false,
    },
    {
      code: "boost_50k",
      name: "Fleet reserve",
      credits: 60000,
      priceUsdCents: 50000,
      enabled: true,
      featured: false,
    },
  ],
};

export async function getValidatorCreditSettings() {
  try {
    const raw = await getSetting("validator_credit_settings_json");
    if (!raw) return DEFAULT_CREDIT_SETTINGS;
    const value = JSON.parse(raw) as Partial<ValidatorCreditSettings>;
    return {
      ...DEFAULT_CREDIT_SETTINGS,
      ...value,
      tasks: Object.fromEntries(
        VALIDATOR_TASK_CODES.map((code) => [
          code,
          {
            ...DEFAULT_CREDIT_SETTINGS.tasks[code],
            ...(value.tasks?.[code] || {}),
          },
        ]),
      ) as Record<ValidatorTaskCode, CreditPrice>,
      topups: Array.isArray(value.topups)
        ? value.topups
        : DEFAULT_CREDIT_SETTINGS.topups,
    };
  } catch {
    return DEFAULT_CREDIT_SETTINGS;
  }
}

export async function saveValidatorCreditSettings(
  settings: ValidatorCreditSettings,
) {
  await setSetting("validator_credit_settings_json", JSON.stringify(settings));
}

export function calculateCreditCost(
  price: CreditPrice,
  input: { items?: number; sessions?: number } = {},
) {
  if (!price.enabled) return 0;
  const items = Math.max(0, Math.floor(input.items || 0));
  const sessions = Math.max(0, Math.floor(input.sessions || 0));
  return (
    price.baseCost +
    (items
      ? Math.ceil(items / Math.max(1, price.itemUnit)) * price.itemCost
      : 0) +
    sessions * price.sessionCost
  );
}

export async function quoteValidatorTask(
  taskCode: ValidatorTaskCode,
  input: { items?: number; sessions?: number } = {},
) {
  const settings = await getValidatorCreditSettings();
  const price = settings.tasks[taskCode];
  return {
    taskCode,
    price,
    credits: 0,
  };
}

type Transaction = Prisma.TransactionClient;

export async function debitValidatorCredits(
  transaction: Transaction,
  input: {
    accountId: string;
    accessKeyId?: string | null;
    credits: number;
    taskCode: ValidatorTaskCode;
    description: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const access = await transaction.validatorAccount.findUnique({
    where: { id: input.accountId },
    select: {
      active: true,
      planExpiresAt: true,
    },
  });
  if (
    !access?.active ||
    !access.planExpiresAt ||
    access.planExpiresAt <= new Date()
  ) {
    throw new ListError(
      "Your subscription has expired. Renew it to continue using Signal Desk.",
      402,
      "SUBSCRIPTION_REQUIRED",
    );
  }
  return null;
}

export async function chargeValidatorTask(input: {
  accountId: string;
  accessKeyId?: string | null;
  taskCode: ValidatorTaskCode;
  items?: number;
  sessions?: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const quote = await quoteValidatorTask(input.taskCode, input);
  await prisma.$transaction((transaction) =>
    debitValidatorCredits(transaction, {
      ...input,
      credits: quote.credits,
      description: input.description || quote.price.label,
    }),
  );
  return quote;
}

export async function runChargedValidatorTask<T>(
  input: {
    accountId: string;
    accessKeyId?: string | null;
    taskCode: ValidatorTaskCode;
    items?: number;
    sessions?: number;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  },
  operation: () => Promise<T>,
) {
  const quote = await quoteValidatorTask(input.taskCode, input);
  await prisma.$transaction((transaction) =>
    debitValidatorCredits(transaction, {
      ...input,
      credits: quote.credits,
      description: input.description || quote.price.label,
      referenceType: "operation",
    }),
  );
  return operation();
}

export async function refundValidatorCredits(
  transaction: Transaction,
  input: {
    accountId: string;
    accessKeyId?: string | null;
    credits: number;
    taskCode?: ValidatorTaskCode;
    description: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return null;
}
