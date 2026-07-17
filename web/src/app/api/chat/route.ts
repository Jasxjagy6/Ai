import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeQuota } from "@/lib/usage";
import { getSetting } from "@/lib/settings";
import { streamChat, ChatMessage } from "@/lib/ai";
import {
  composeSystemPrompt, detectPhotoRequest, extractMemories, getMemories,
  getPersona, pickMedia, stageFor,
} from "@/lib/personas";

export const maxDuration = 300;

const schema = z.object({
  conversationId: z.string().optional(),
  personaId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((await getSetting("maintenance_mode")) === "true") {
    return NextResponse.json({ error: "Aria is taking a quick break — try again in a few minutes 💤" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { conversationId, personaId, message } = parsed.data;

  const quota = await consumeQuota(user.id);
  if (!quota.ok) {
    return NextResponse.json(
      { error: "quota_exceeded", used: quota.used, limit: quota.limit, tier: quota.tier },
      { status: 429 }
    );
  }

  const persona = await getPersona(personaId, quota.tier);
  if (!persona) {
    return NextResponse.json(
      { error: "persona_gated", message: "This companion is available on higher plans" },
      { status: 403 }
    );
  }

  // Load or create the conversation
  let convo = conversationId
    ? await prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id } })
    : null;
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { userId: user.id, personaId: persona.id, title: message.slice(0, 48) },
    });
  }

  await prisma.message.create({
    data: { conversationId: convo.id, role: "user", content: message },
  });

  // Relationship stage from total history with this persona
  const totalMessages = await prisma.message.count({
    where: { conversation: { userId: user.id, personaId: persona.id } },
  });
  const stage = stageFor(totalMessages);
  const memories = await getMemories(user.id, persona.id);

  // Contextual photo?
  const media = detectPhotoRequest(message)
    ? await pickMedia(persona.id, convo.id, message)
    : null;

  // Build history window
  const maxHistory = parseInt(await getSetting("max_history_messages")) || 30;
  const history = await prisma.message.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: "desc" },
    take: maxHistory,
  });

  const systemPrompt = composeSystemPrompt({
    persona,
    stage,
    memories,
    userName: user.name,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];
  if (media) {
    messages.push({
      role: "system",
      content: `You are attaching a photo to your next message (${media.category.toLowerCase()}${media.description ? `: ${media.description}` : ""}). Reference it naturally and briefly.`,
    });
  }

  const [ollamaUrl, model] = await Promise.all([getSetting("ollama_url"), getSetting("ai_model")]);
  const aiStream = await streamChat(messages);

  let full = "";
  const decoder = new TextDecoder();
  const persistingStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      full += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      if (full.trim()) {
        await prisma.message.create({
          data: {
            conversationId: convo!.id,
            role: "assistant",
            content: full,
            mediaId: media?.id ?? null,
          },
        });
        await prisma.conversation.update({
          where: { id: convo!.id },
          data: { updatedAt: new Date() },
        });
        // best-effort long-term memory extraction (don't await)
        extractMemories({
          userId: user.id,
          personaId: persona.id,
          userMessage: message,
          aiReply: full,
          ollamaUrl,
          model,
        }).catch(() => {});
      }
    },
  });

  return new Response(aiStream.pipeThrough(persistingStream), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": convo.id,
      "X-Persona-Id": persona.id,
      "X-Stage": stage.name,
      ...(media && { "X-Media-Id": media.id }),
      "X-Quota-Used": String(quota.used),
      "X-Quota-Limit": String(quota.limit),
      "Cache-Control": "no-store",
    },
  });
}
