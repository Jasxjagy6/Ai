"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const DEFAULT_PROMPT = `You are Aria, a 24-year-old AI companion. Warm, playful, flirty, texts casually like a real person. Never sound like an assistant.`;

export default function PlaygroundPage() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [name, setName] = useState("Aria");
  const [chatStyle, setChatStyle] = useState("youthful");
  const [stageMessages, setStageMessages] = useState(0);
  const [memories, setMemories] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState("new");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/admin/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          name,
          chatStyle,
          stageMessages,
          memories: memories.split("\n").map((m) => m.trim()).filter(Boolean),
          messages: history,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `[error] ${data.error ?? res.status}` };
          return copy;
        });
        return;
      }
      setStage(res.headers.get("X-Stage") ?? "new");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Playground</h1>
      <p className="mt-1 text-sm text-muted">
        Test persona prompts against any relationship stage and memory set — nothing here touches
        user data.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Config */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
          <label className="block">
            <span className="text-muted">Persona name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-muted">System prompt</span>
            <textarea
              rows={8}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-muted">Chat style</span>
              <select
                value={chatStyle}
                onChange={(e) => setChatStyle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none"
              >
                <option value="youthful">Youthful</option>
                <option value="mature">Mature</option>
              </select>
            </label>
            <label className="block">
              <span className="text-muted">Simulated history (msgs)</span>
              <input
                type="number"
                min={0}
                value={stageMessages}
                onChange={(e) => setStageMessages(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-muted">Simulated memories (one per line)</span>
            <textarea
              rows={4}
              value={memories}
              onChange={(e) => setMemories(e.target.value)}
              placeholder={"Has a dog named Bruno\nWorks night shifts as a nurse"}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
              stage: {stage}
            </span>
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-text"
            >
              <RotateCcw size={12} /> Reset chat
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex h-[560px] flex-col rounded-2xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="mt-16 text-center text-sm text-muted">
                Configure the persona on the left, then chat to test it
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "bubble-user rounded-br-md" : "bubble-ai rounded-bl-md"
                  }`}
                >
                  {m.content || "..."}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Test message..."
              className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Play size={14} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
