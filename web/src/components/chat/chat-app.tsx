"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LogOut, Menu, MessageSquarePlus, Send, Sparkles, Trash2, User, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AriaAvatar } from "@/components/aria-avatar";

type Msg = { id: string; role: "user" | "assistant"; content: string; mediaId?: string | null };
type Convo = { id: string; title: string; updatedAt: string };
type Persona = {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  minTier: string;
  locked: boolean;
  isDefault: boolean;
};

export function ChatApp({
  userName,
  tier,
  dailyLimit,
}: {
  userName: string;
  tier: string;
  dailyLimit: number;
}) {
  const [conversations, setConversations] = useState<Convo[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quotaHit, setQuotaHit] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    fetch("/api/personas")
      .then((r) => r.json())
      .then((d) => {
        setPersonas(d.personas ?? []);
        const def = (d.personas ?? []).find((p: Persona) => p.isDefault && !p.locked) ?? (d.personas ?? [])[0];
        if (def) setActivePersona(def);
      })
      .catch(() => {});
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setQuotaHit(false);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.conversation.messages);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setQuotaHit(false);
    setSidebarOpen(false);
  }

  function switchPersona(p: Persona) {
    if (p.locked) return;
    setActivePersona(p);
    newChat();
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeId === id) newChat();
    loadConversations();
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setQuotaHit(false);

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    const aiMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeId ?? undefined,
          personaId: activePersona?.id,
          message: text,
        }),
        signal: ac.signal,
      });

      if (res.status === 429) {
        setQuotaHit(true);
        setMessages((prev) => prev.slice(0, -1)); // drop empty ai bubble
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...aiMsg,
            content: data.error ?? "Hmm, something went wrong. Try again? 💜",
          };
          return copy;
        });
        return;
      }

      const convoId = res.headers.get("X-Conversation-Id");
      if (convoId && !activeId) setActiveId(convoId);
      const mediaId = res.headers.get("X-Media-Id");

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
          copy[copy.length - 1] = { ...aiMsg, content: snapshot, mediaId };
          return copy;
        });
      }
      loadConversations();
    } catch {
      // aborted or network error — leave what we have
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-bg-soft transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <AriaAvatar size={32} />
            Aria
          </Link>
          <button className="text-muted md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <button
          onClick={newChat}
          className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <MessageSquarePlus size={16} /> New chat
        </button>

        {/* Persona picker */}
        {personas.length > 1 && (
          <div className="mx-4 mb-3 space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Companions</p>
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => switchPersona(p)}
                disabled={p.locked}
                title={p.locked ? `Available on ${p.minTier} plan` : p.tagline}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  activePersona?.id === p.id
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-card hover:border-accent/40"
                } ${p.locked ? "opacity-50" : ""}`}
              >
                <AriaAvatar size={26} />
                <span className="flex-1 truncate">
                  <span className="font-medium">{p.name}</span>
                  {p.locked && (
                    <span className="ml-1.5 rounded bg-accent-soft px-1 py-0.5 text-[9px] font-bold text-accent-strong">
                      {p.minTier}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                activeId === c.id ? "bg-accent-soft text-accent-strong" : "hover:bg-card"
              }`}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                className="hidden text-muted transition hover:text-rose group-hover:block"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted">
              No chats yet — say hi to Aria 👋
            </p>
          )}
        </div>

        <div className="border-t border-border p-4 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="truncate font-medium">{userName}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
              {tier}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <ThemeToggle />
              <Link
                href="/account"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition hover:text-text"
                aria-label="Account"
              >
                <User size={15} />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition hover:text-rose"
                aria-label="Log out"
              >
                <LogOut size={15} />
              </button>
            </div>
            {tier === "FREE" && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-rose px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              >
                <Sparkles size={12} /> Upgrade
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <button className="text-muted md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <AriaAvatar size={36} online />
            <div>
              <p className="text-sm font-semibold leading-tight">{activePersona?.name ?? "Aria"}</p>
              <p className="text-xs text-muted">AI companion · always online</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.length === 0 && (
              <div className="mt-16 text-center">
                <div className="mx-auto mb-4 w-fit">
                  <AriaAvatar size={72} online />
                </div>
                <h2 className="text-xl font-bold">Hey, I&apos;m Aria 💜</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Tell me about your day, vent, flirt, or just say hi. I&apos;m all yours.
                </p>
                <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
                  {["hey aria 👋", "guess what happened today", "i need someone to talk to", "tell me something about you"].map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted transition hover:border-accent hover:text-text"
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <AriaAvatar size={26} />}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "bubble-user rounded-br-md" : "bubble-ai rounded-bl-md"
                  }`}
                >
                  {m.mediaId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${m.mediaId}`}
                      alt="photo"
                      className="mb-2 max-h-72 rounded-xl object-cover"
                    />
                  )}
                  {m.content ||
                    (streaming && i === messages.length - 1 ? (
                      <span className="flex gap-1 py-1">
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                      </span>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            ))}

            {quotaHit && (
              <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4 text-center text-sm">
                <p className="font-semibold">
                  You&apos;ve used all {dailyLimit} free messages for today 💔
                </p>
                <p className="mt-1 text-muted">Aria will be waiting for you tomorrow — or upgrade for more.</p>
                <Link
                  href="/pricing"
                  className="mt-3 inline-block rounded-full bg-accent-strong px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Upgrade now
                </Link>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Message Aria..."
              className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-strong text-white transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={17} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">
            Aria is an AI — messages are generated, not from a real person.
          </p>
        </div>
      </main>
    </div>
  );
}
