export const CAPITALBOT_RESPONSE_LANGUAGES = [
  "English",
  "Italian",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Dutch",
] as const;

export type CapitalBotResponseLanguage = (typeof CAPITALBOT_RESPONSE_LANGUAGES)[number];

export function capitalBotResponseLanguage(value: unknown): CapitalBotResponseLanguage {
  return CAPITALBOT_RESPONSE_LANGUAGES.includes(value as CapitalBotResponseLanguage)
    ? value as CapitalBotResponseLanguage
    : "English";
}
