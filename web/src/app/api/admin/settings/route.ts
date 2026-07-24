import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";

const ALLOWED_KEYS = [
  "ai_model",
  "ollama_url",
  "system_prompt",
  "temperature",
  "max_history_messages",
  "maintenance_mode",
  "voice_enabled",
  "voice_auto_reply",
  "tts_url",
  "vision_enabled",
  "vision_model",
] as const;

const schema = z.record(z.enum(ALLOWED_KEYS), z.string().max(8000));

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  for (const [key, value] of Object.entries(parsed.data)) {
    await setSetting(key, value as string);
  }
  return NextResponse.json({ ok: true, settings: await getSettings() });
}
