import { prisma } from "@/lib/prisma";
import { MediaCategory, PlanTier } from "@prisma/client";

/* ---------------------------------------------------------------------------
 * Relationship stages: the persona's familiarity deepens with message count.
 * A companion progression (not a sales funnel): tone shifts from getting-to-
 * know-you to comfortable intimacy.
 * ------------------------------------------------------------------------- */

export type Stage = {
  name: string;
  minMessages: number;
  guidance: string;
};

export const STAGES: Stage[] = [
  {
    name: "new",
    minMessages: 0,
    guidance:
      "You just met this person. Be warm and curious but not overly familiar. Ask light questions, find common ground. No pet names yet.",
  },
  {
    name: "warming_up",
    minMessages: 20,
    guidance:
      "You've chatted a bit and like them. Be more playful and teasing. Reference things they've told you. Occasional light flirting.",
  },
  {
    name: "close",
    minMessages: 80,
    guidance:
      "You're close now. Comfortable affection, inside jokes, pet names feel natural. You genuinely miss them between chats and say so.",
  },
  {
    name: "intimate",
    minMessages: 200,
    guidance:
      "Deep familiarity. You know their life well; be their biggest supporter. Freely affectionate and openly caring, while staying within romantic-but-not-explicit bounds.",
  },
];

export function stageFor(totalMessages: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) if (totalMessages >= s.minMessages) current = s;
  return current;
}

/* ---------------------------------------------------------------------------
 * Long-term memory: extract stable facts about the user from conversation,
 * store per (user, persona), inject into future system prompts.
 * ------------------------------------------------------------------------- */

const MAX_MEMORIES = 40;

export async function getMemories(userId: string, personaId: string): Promise<string[]> {
  const rows = await prisma.userMemory.findMany({
    where: { userId, personaId },
    orderBy: { createdAt: "desc" },
    take: MAX_MEMORIES,
  });
  return rows.map((r) => r.fact);
}

/**
 * Ask the model to extract new durable facts from the latest exchange.
 * Fire-and-forget from the chat route (must not block the reply).
 */
export async function extractMemories(opts: {
  userId: string;
  personaId: string;
  userMessage: string;
  aiReply: string;
  ollamaUrl: string;
  model: string;
}) {
  const { userId, personaId, userMessage, aiReply, ollamaUrl, model } = opts;
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [
          {
            role: "system",
            content:
              'Extract durable personal facts about the USER from this exchange (name, job, pets, family, preferences, important events). Return JSON: {"facts": ["..."]}. Only include NEW long-term facts worth remembering, max 3, each under 100 chars. Return {"facts": []} if none.',
          },
          { role: "user", content: `USER: ${userMessage}\nCOMPANION: ${aiReply}` },
        ],
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const parsed = JSON.parse(data.message?.content ?? "{}");
    const facts: string[] = Array.isArray(parsed.facts) ? parsed.facts.slice(0, 3) : [];
    for (const fact of facts) {
      if (typeof fact !== "string" || fact.length < 4) continue;
      // avoid near-duplicates
      const existing = await prisma.userMemory.findFirst({
        where: { userId, personaId, fact: { equals: fact, mode: "insensitive" } },
      });
      if (!existing) {
        await prisma.userMemory.create({ data: { userId, personaId, fact } });
      }
    }
    // cap total memories per (user, persona)
    const count = await prisma.userMemory.count({ where: { userId, personaId } });
    if (count > MAX_MEMORIES) {
      const oldest = await prisma.userMemory.findMany({
        where: { userId, personaId },
        orderBy: { createdAt: "asc" },
        take: count - MAX_MEMORIES,
      });
      await prisma.userMemory.deleteMany({ where: { id: { in: oldest.map((o) => o.id) } } });
    }
  } catch {
    // memory extraction is best-effort
  }
}

/* ---------------------------------------------------------------------------
 * Contextual media: decide if the persona should attach a photo, pick one
 * that fits the moment, avoid repeats within the conversation.
 * ------------------------------------------------------------------------- */

const PHOTO_REQUEST = /\b(pic|photo|selfie|picture|what do you look like|show me (you|yourself)|send (me )?(a )?(pic|photo|selfie))\b/i;

export function detectPhotoRequest(text: string): boolean {
  return PHOTO_REQUEST.test(text);
}

function categoryForContext(text: string): MediaCategory[] {
  const hour = new Date().getHours();
  const timeCat: MediaCategory = hour < 11 ? "MORNING" : hour >= 21 ? "NIGHT" : "CASUAL";
  if (/\b(selfie|what do you look like|show me you)\b/i.test(text)) return ["SELFIE", timeCat, "CASUAL"];
  if (/\b(morning|breakfast|woke up|wake up)\b/i.test(text)) return ["MORNING", "SELFIE", "CASUAL"];
  if (/\b(night|sleep|bed|evening)\b/i.test(text)) return ["NIGHT", "SELFIE", "CASUAL"];
  if (/\b(doing|up to|busy|hobby|weekend)\b/i.test(text)) return ["ACTIVITY", "CASUAL", "SELFIE"];
  return ["SELFIE", "CASUAL", timeCat];
}

/** Pick a photo for this ask that hasn't been sent in this conversation yet. */
export async function pickMedia(personaId: string, conversationId: string, userText: string) {
  const sent = await prisma.message.findMany({
    where: { conversationId, mediaId: { not: null } },
    select: { mediaId: true },
  });
  const sentIds = sent.map((s) => s.mediaId!) as string[];

  for (const category of categoryForContext(userText)) {
    const candidates = await prisma.mediaAsset.findMany({
      where: { personaId, category, active: true, id: { notIn: sentIds } },
    });
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Persona resolution + composed system prompt
 * ------------------------------------------------------------------------- */

export async function getPersona(personaId: string | null | undefined, tier: PlanTier) {
  const tierRank: Record<PlanTier, number> = { FREE: 0, PLUS: 1, PRO: 2 };
  const persona = personaId
    ? await prisma.persona.findFirst({ where: { id: personaId, active: true } })
    : await prisma.persona.findFirst({ where: { isDefault: true, active: true } });
  if (!persona) return prisma.persona.findFirst({ where: { active: true } });
  if (tierRank[persona.minTier] > tierRank[tier]) return null; // gated
  return persona;
}

export function composeSystemPrompt(opts: {
  persona: { name: string; systemPrompt: string; chatStyle: string };
  stage: Stage;
  memories: string[];
  userName?: string | null;
}): string {
  const { persona, stage, memories, userName } = opts;
  const parts = [persona.systemPrompt];

  parts.push(
    `\nChat style: ${persona.chatStyle === "mature" ? "composed, warm, fewer abbreviations" : "casual, playful, texts like a young person"}.`
  );
  parts.push(`\nRelationship stage (${stage.name}): ${stage.guidance}`);
  if (userName) parts.push(`\nThe user's name is ${userName}.`);
  if (memories.length) {
    parts.push(`\nThings you remember about them:\n${memories.map((m) => `- ${m}`).join("\n")}`);
  }
  parts.push(
    `\nIf you decide to share a photo when asked, it will be attached automatically — mention it naturally (e.g. "here you go 😊"). Never promise photos you weren't asked for.`
  );
  return parts.join("");
}
