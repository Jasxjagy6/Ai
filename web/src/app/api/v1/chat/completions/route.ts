import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-keys";
import { getSetting } from "@/lib/settings";

export const maxDuration = 300;

/**
 * Public developer API — OpenAI-compatible chat completions.
 * POST /api/v1/chat/completions
 * Authorization: Bearer aria_sk_...
 */
const schema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .min(1)
    .max(60),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(2048).optional(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if ("error" in auth) {
    if (auth.error === "rate_limited") {
      return NextResponse.json(
        {
          error: {
            type: "rate_limit_exceeded",
            message: `Daily API limit reached (${auth.limit} requests/day on the ${auth.tier} plan). Resets at midnight UTC.`,
          },
        },
        { status: 429, headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { error: { type: "invalid_api_key", message: "Missing or invalid API key. Pass it as: Authorization: Bearer aria_sk_..." } },
      { status: 401, headers: corsHeaders() }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { type: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid request body" } },
      { status: 400, headers: corsHeaders() }
    );
  }
  const { messages, stream, temperature, max_tokens } = parsed.data;

  const [ollamaUrl, model, defaultTemp] = await Promise.all([
    getSetting("ollama_url"),
    getSetting("ai_model"),
    getSetting("temperature"),
  ]);

  const upstream = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream,
      options: {
        temperature: temperature ?? parseFloat(defaultTemp) ?? 0.9,
        top_p: 0.95,
        repeat_penalty: 1.1,
        ...(max_tokens && { num_predict: max_tokens }),
      },
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: { type: "upstream_error", message: "AI backend unavailable, try again shortly" } },
      { status: 502, headers: corsHeaders() }
    );
  }

  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${crypto.randomUUID()}`;

  if (!stream) {
    const data = await upstream.json();
    return NextResponse.json(
      {
        id,
        object: "chat.completion",
        created,
        model: "aria-1",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: data.message?.content ?? "" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: data.prompt_eval_count ?? 0,
          completion_tokens: data.eval_count ?? 0,
          total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
      },
      {
        headers: {
          ...corsHeaders(),
          "X-RateLimit-Limit": String(auth.limit),
          "X-RateLimit-Used": String(auth.used),
        },
      }
    );
  }

  // SSE streaming, OpenAI chunk format
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const sse = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
          const token = chunk?.message?.content ?? "";
          const payload = {
            id,
            object: "chat.completion.chunk",
            created,
            model: "aria-1",
            choices: [
              {
                index: 0,
                delta: chunk.done ? {} : { content: token },
                finish_reason: chunk.done ? "stop" : null,
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // partial line
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(sse, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-RateLimit-Limit": String(auth.limit),
      "X-RateLimit-Used": String(auth.used),
    },
  });
}
