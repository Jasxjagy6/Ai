import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUpload, saveUpload } from "@/lib/uploads";
import { synthesizeSpeech } from "@/lib/tts";
import { toneFor } from "@/lib/tone";

/**
 * Serve a message's voice note as audio/wav.
 * - If the message already has a stored audioPath, stream it.
 * - Otherwise (any assistant text message), synthesize on demand, cache it on
 *   the message, and stream it — this powers a "play as voice" button on every
 *   reply, not just auto voice-notes.
 * Only the owner of the conversation may access it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const msg = await prisma.message.findFirst({
    where: { id, conversation: { userId: user.id } },
    include: { conversation: { include: { persona: { select: { voice: true } } } } },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.role !== "assistant") return NextResponse.json({ error: "Not audio" }, { status: 400 });

  let audioPath = msg.audioPath;

  if (!audioPath) {
    // synthesize on demand
    const wav = await synthesizeSpeech({
      text: msg.content,
      voice: msg.conversation.persona?.voice ?? "amy",
      style: toneFor(msg.conversation.tone).voiceStyle,
    });
    if (!wav) return NextResponse.json({ error: "Voice unavailable" }, { status: 503 });
    try {
      audioPath = await saveUpload(`voice/${msg.conversationId}`, wav, "wav");
      await prisma.message.update({ where: { id: msg.id }, data: { audioPath, kind: "voice" } });
    } catch {
      // couldn't persist — still stream the bytes we have
      return new Response(new Uint8Array(wav), {
        headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" },
      });
    }
  }

  const abs = resolveUpload(audioPath);
  if (!abs || !existsSync(abs)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stat = statSync(abs);
  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
