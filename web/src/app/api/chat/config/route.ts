import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { TONES } from "@/lib/tone";
import { LANGUAGES } from "@/lib/language";
import { getSetting } from "@/lib/settings";

/** Chat UI config: available tones, languages, and which features are on. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [voiceEnabled, visionEnabled] = await Promise.all([
    getSetting("voice_enabled"),
    getSetting("vision_enabled"),
  ]);

  return NextResponse.json({
    tones: TONES.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji })),
    languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label, native: l.native })),
    features: {
      voice: voiceEnabled === "true",
      vision: visionEnabled === "true",
    },
  });
}
