import { getSetting } from "@/lib/settings";

/* ---------------------------------------------------------------------------
 * Text-to-speech via the Piper microservice (companion/tts_server.py).
 * Returns WAV bytes that browsers play natively — no ffmpeg needed.
 * ------------------------------------------------------------------------- */

export type VoiceStyle = "casual" | "youthful" | "mature" | "flirty";

export async function isVoiceEnabled(): Promise<boolean> {
  return (await getSetting("voice_enabled")) === "true";
}

/**
 * Synthesize speech. Strips markdown/emoji that don't read well aloud.
 * Returns null if TTS is disabled or the service is unreachable (caller
 * should fall back to a plain text message).
 */
export async function synthesizeSpeech(opts: {
  text: string;
  voice?: string;
  style?: VoiceStyle;
}): Promise<Uint8Array | null> {
  if (!(await isVoiceEnabled())) return null;
  const ttsUrl = await getSetting("tts_url");
  const spoken = cleanForSpeech(opts.text);
  if (!spoken) return null;

  try {
    const res = await fetch(`${ttsUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: spoken,
        voice: opts.voice ?? "amy",
        style: opts.style ?? "casual",
      }),
      // TTS on CPU is quick, but guard against a hung service
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Emoji + markdown are noise when spoken; flatten to clean prose. */
export function cleanForSpeech(text: string): string {
  return text
    // strip emoji / pictographs
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu,
      ""
    )
    .replace(/[*_`~#>]/g, "") // markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Heuristic: did the user ask for a voice note / voice message? */
const VOICE_REQUEST =
  /\b(voice ?(note|message|memo)|say it out loud|talk to me|hear (your|you) ?voice|send (me )?(a )?(voice|audio)|voice ?msg|read it (to me|out)|can i hear you)\b/i;

export function detectVoiceRequest(text: string): boolean {
  return VOICE_REQUEST.test(text);
}
