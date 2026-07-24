/* ---------------------------------------------------------------------------
 * Multi-language replies. The model (Hermes-3 based) is multilingual; we just
 * instruct it to answer in the chosen language. "auto" = mirror whatever
 * language the user writes in.
 * ------------------------------------------------------------------------- */

export type Language = { code: string; label: string; native: string };

export const LANGUAGES: Language[] = [
  { code: "auto", label: "Auto", native: "Auto-detect" },
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ru", label: "Russian", native: "Русский" },
];

const LANG_MAP = new Map(LANGUAGES.map((l) => [l.code, l]));

export function isLanguage(code: string | null | undefined): code is string {
  return !!code && LANG_MAP.has(code);
}

export function languageFor(code: string | null | undefined): Language {
  return (code && LANG_MAP.get(code)) || LANGUAGES[0];
}

/** System-prompt instruction for the chosen language ("" for auto). */
export function languageGuidance(code: string | null | undefined): string {
  const lang = languageFor(code);
  if (lang.code === "auto") {
    return "\nAlways reply in the same language the user is writing in.";
  }
  return `\nAlways reply in ${lang.label} (${lang.native}), regardless of the language the user writes in, unless they explicitly ask you to switch.`;
}
