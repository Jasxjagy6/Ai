import { getSetting } from "@/lib/settings";

/* ---------------------------------------------------------------------------
 * Vision: when the user sends a photo, a small vision model (moondream, served
 * by Ollama) describes it. That description is injected into the companion's
 * context so she can react naturally to what she was "shown" — without the
 * chat model itself needing to be multimodal.
 * ------------------------------------------------------------------------- */

export async function isVisionEnabled(): Promise<boolean> {
  return (await getSetting("vision_enabled")) === "true";
}

/**
 * Describe an image (base64, no data-URI prefix) for the companion's context.
 * Returns a short natural-language caption, or null on failure/disabled.
 */
export async function describeImage(base64: string): Promise<string | null> {
  if (!(await isVisionEnabled())) return null;
  const [ollamaUrl, model] = await Promise.all([
    getSetting("ollama_url"),
    getSetting("vision_model"),
  ]);

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt:
          "You are the eyes of a chat companion. Describe what's in this image in 1-2 warm, natural sentences, as if a friend just texted it to you. Note people, mood, setting, and anything notable. Do not start with 'The image shows'.",
        images: [base64],
        stream: false,
        options: { temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(60_000), // vision on CPU is slower
    });
    if (!res.ok) return null;
    const data = await res.json();
    const caption = (data.response ?? "").trim();
    return caption || null;
  } catch {
    return null;
  }
}
