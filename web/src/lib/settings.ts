import { prisma } from "@/lib/prisma";

/**
 * Runtime settings stored in DB, editable from the admin panel.
 * Falls back to env / hardcoded defaults when unset.
 */
const DEFAULTS: Record<string, string> = {
  ai_model: process.env.AI_MODEL ?? "aria",
  ollama_url: process.env.OLLAMA_URL ?? "http://localhost:11434",
  system_prompt: "", // empty = use the Modelfile's baked-in system prompt
  temperature: "0.9",
  max_history_messages: "30",
  maintenance_mode: "false",
  plans_json: "",
  trial_days: "0",
  trial_tier: "PLUS",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
