import { Prisma } from "@prisma/client";
import { capitalBotResponseLanguage } from "@/lib/ai-chatter-languages";

export const AI_DEFAULT_CONFIG = {
  provider: "capitalbot",
  replyDelayMs: 3000,
  replyDelayJitterMs: 2000,
  memoryMessageLimit: 100,
  capitalbot: {
    modelId: 43,
    presetId: 88,
    platform: "Telegram",
    conversationSource: "Telegram",
    detectLanguage: false,
    language: "English",
  },
  cupidbot: {
    app: "telegram",
    isAPI: true,
    brand: "cupidbotofm",
    isOF: true,
    chatStyle: "youth",
    responseLanguage: "en",
  },
};

export type AiProvider = "capitalbot" | "cupidbot";

export function aiConfig(value: Prisma.JsonValue | null | undefined) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const capitalbot = input.capitalbot && typeof input.capitalbot === "object" && !Array.isArray(input.capitalbot)
    ? input.capitalbot as Record<string, unknown>
    : {};
  const cupidbot = input.cupidbot && typeof input.cupidbot === "object" && !Array.isArray(input.cupidbot)
    ? input.cupidbot as Record<string, unknown>
    : {};
  return {
    ...AI_DEFAULT_CONFIG,
    ...input,
    provider: input.provider === "cupidbot" ? "cupidbot" : "capitalbot",
    replyDelayMs: Math.max(0, Math.min(60_000, Number(input.replyDelayMs ?? 3000))),
    replyDelayJitterMs: Math.max(0, Math.min(60_000, Number(input.replyDelayJitterMs ?? 2000))),
    memoryMessageLimit: Math.max(10, Math.min(200, Number(input.memoryMessageLimit ?? 100))),
    capitalbot: {
      ...AI_DEFAULT_CONFIG.capitalbot,
      ...capitalbot,
      detectLanguage: false,
      language: capitalBotResponseLanguage(capitalbot.language),
    },
    cupidbot: { ...AI_DEFAULT_CONFIG.cupidbot, ...cupidbot },
  };
}

function validationError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return String(record.message || record.error || fallback);
  }
  return fallback;
}

export async function validateAiProvider(provider: AiProvider, secret: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    if (provider === "capitalbot") {
      const response = await fetch(
        process.env.CAPITALBOT_MODELS_ENDPOINT || "https://api.capitalbot.ai/getModelsAndPresets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licensekey: secret }),
          signal: controller.signal,
          cache: "no-store",
        },
      );
      const data = await response.json().catch(() => null) as {
        success?: boolean;
        data?: { models?: Array<Record<string, string | number | boolean | null>>; presets?: Array<Record<string, string | number | boolean | null>> };
      } | null;
      if (!response.ok || !data?.success) {
        return { valid: false, catalog: null, error: validationError(data, "CapitalBot rejected this license key") };
      }
      return {
        valid: true,
        catalog: { models: data.data?.models || [], presets: data.data?.presets || [] },
        error: null,
      };
    }

    const response = await fetch(
      process.env.CUPIDBOT_ENDPOINT_URL || "https://chat-api.cupidbotofm.ai/api/generateChatResponse",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        cache: "no-store",
        body: JSON.stringify({
          accessToken: secret,
          version: "0.19.0",
          manifestVersion: "0.19.0",
          isAPI: true,
          app: "telegram",
          brand: "cupidbotofm",
          product: "ofm-tg",
          isOF: true,
          isFemale: true,
          accountID: "validation",
          platformSource: "telegram",
          responseLanguageCode: "en",
          responseLanguage: "english",
          isFollowUp: false,
          settingDayInfo: "Waiting for a reply",
          settingNightInfo: "Winding down",
          name: "Test Model",
          age: 25,
          userInfo: "You are a friendly test model",
          city: "New York",
          ctaInfo: "Page subscription details will be provided later",
          chooseRandomCTA: false,
          useDefaultSettings: true,
          showAdvancedSettings: false,
          ctaData: [{ platform: "onlyfans", cta: "check my link" }],
          chatStyle: "youth",
          recipient: { id: "0", name: "Test User", username: "", bio: "", location: "" },
          messages: [{ id: "1", timestamp: Math.floor(Date.now() / 1000), msg: "hi", isIncoming: true, medias: [] }],
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      return { valid: false, catalog: null, error: validationError(data, "CupidBot rejected this access token") };
    }
    return { valid: true, catalog: null, error: null };
  } finally {
    clearTimeout(timer);
  }
}

export function aiCredentialView(credential: {
  provider: string;
  isValid: boolean;
  modelId: number | null;
  presetId: number | null;
  catalog: Prisma.JsonValue | null;
  lastValidatedAt: Date | null;
  validationError: string | null;
  updatedAt: Date;
}) {
  return {
    provider: credential.provider,
    configured: true,
    isValid: credential.isValid,
    modelId: credential.modelId,
    presetId: credential.presetId,
    catalog: credential.catalog,
    lastValidatedAt: credential.lastValidatedAt,
    validationError: credential.validationError,
    updatedAt: credential.updatedAt,
  };
}
