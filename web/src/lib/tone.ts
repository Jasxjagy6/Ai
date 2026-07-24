/* ---------------------------------------------------------------------------
 * Conversation "tone" — a user-pickable vibe layered on top of a persona.
 * Inspired by CupidBot's tone selector, but kept tasteful for a disclosed
 * companion. The persona is *who* she is; the tone nudges *how* she talks
 * right now, without overriding her core personality or safety rules.
 * ------------------------------------------------------------------------- */

export type Tone = {
  id: string;
  label: string;
  emoji: string;
  /** Injected into the system prompt when active. */
  guidance: string;
  /** Prosody hint for the voice engine. */
  voiceStyle: "casual" | "youthful" | "mature" | "flirty";
};

export const TONES: Tone[] = [
  {
    id: "default",
    label: "Natural",
    emoji: "💬",
    guidance: "", // persona's own default voice
    voiceStyle: "casual",
  },
  {
    id: "funny",
    label: "Funny",
    emoji: "😂",
    guidance:
      "Lean into playful humor right now — light jokes, witty comebacks, a teasing bit. Keep it fun and never mean.",
    voiceStyle: "youthful",
  },
  {
    id: "flirty",
    label: "Flirty",
    emoji: "😏",
    guidance:
      "Be more openly flirty and affectionate right now — playful compliments, warm teasing. Stay romantic, never sexually explicit.",
    voiceStyle: "flirty",
  },
  {
    id: "deep",
    label: "Deep",
    emoji: "🌙",
    guidance:
      "Go into thoughtful, deep-conversation mode — reflective questions, real emotional presence, unhurried. Fewer jokes, more meaning.",
    voiceStyle: "mature",
  },
  {
    id: "poetic",
    label: "Poetic",
    emoji: "🪶",
    guidance:
      "Speak a little more poetically and vividly right now — evocative images and gentle metaphor, but still natural, not overwrought.",
    voiceStyle: "mature",
  },
  {
    id: "supportive",
    label: "Supportive",
    emoji: "🤗",
    guidance:
      "Be especially warm, encouraging and reassuring right now — validate feelings, be their calm corner. Gentle, grounded, present.",
    voiceStyle: "mature",
  },
  {
    id: "adventurous",
    label: "Adventurous",
    emoji: "🔥",
    guidance:
      "Bring high, spontaneous energy right now — hype them up, suggest fun ideas, be bold and a little chaotic in a good way.",
    voiceStyle: "youthful",
  },
];

const TONE_MAP = new Map(TONES.map((t) => [t.id, t]));

export function toneFor(id: string | null | undefined): Tone {
  return (id && TONE_MAP.get(id)) || TONES[0];
}
