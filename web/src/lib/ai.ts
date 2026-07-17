import { getSetting } from "@/lib/settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Stream a chat completion from the Ollama backend.
 * Returns a ReadableStream of plain text tokens.
 */
export async function streamChat(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const [ollamaUrl, model, temperature, systemPrompt] = await Promise.all([
    getSetting("ollama_url"),
    getSetting("ai_model"),
    getSetting("temperature"),
    getSetting("system_prompt"),
  ]);

  const finalMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages.filter((m) => m.role !== "system")]
    : messages;

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      stream: true,
      options: { temperature: parseFloat(temperature) || 0.9, top_p: 0.95, repeat_penalty: 1.1 },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama error: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const token = chunk?.message?.content;
          if (token) controller.enqueue(encoder.encode(token));
        } catch {
          // partial line — ignore
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
