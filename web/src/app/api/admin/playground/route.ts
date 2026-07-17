import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { streamChat, ChatMessage } from "@/lib/ai";
import { composeSystemPrompt, stageFor } from "@/lib/personas";

export const maxDuration = 300;

/**
 * Admin playground: test a persona draft (or an existing persona's prompt)
 * against arbitrary conversation state WITHOUT touching user data.
 * Simulates any relationship stage and injected memories.
 */
const schema = z.object({
  systemPrompt: z.string().min(20).max(8000),
  name: z.string().min(1).max(40).default("Aria"),
  chatStyle: z.enum(["youthful", "mature"]).default("youthful"),
  stageMessages: z.number().int().min(0).max(10000).default(0),
  memories: z.array(z.string().max(120)).max(20).default([]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { systemPrompt, name, chatStyle, stageMessages, memories, messages } = parsed.data;

  const stage = stageFor(stageMessages);
  const system = composeSystemPrompt({
    persona: { name, systemPrompt, chatStyle },
    stage,
    memories,
    userName: "Playground User",
  });

  const chatMessages: ChatMessage[] = [
    { role: "system", content: system },
    ...messages,
  ];

  const stream = await streamChat(chatMessages);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Stage": stage.name,
      "Cache-Control": "no-store",
    },
  });
}
