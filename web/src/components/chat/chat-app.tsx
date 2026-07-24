"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LogOut, Send, Sparkles, Trash2, User, X,
  Plus, History, MessageSquare, PanelLeftClose, PanelLeft, ArrowUp,
  Mic, ImagePlus, Globe, ShieldCheck, Smile, Volume2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AriaAvatar } from "@/components/aria-avatar";
import { VoiceNote } from "@/components/chat/voice-note";
import { Onboarding } from "@/components/chat/onboarding";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mediaId?: string | null;
  kind?: string;
  audioPath?: string | null;
  imagePath?: string | null;
  hasImage?: boolean; // client-side: user attached an image this turn
};
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
type ToneOpt = { id: string; label: string; emoji: string };
type LangOpt = { code: string; label: string; native: string };

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

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
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Feature state
  const [tones, setTones] = useState<ToneOpt[]>([]);
  const [languages, setLanguages] = useState<LangOpt[]>([]);
  const [features, setFeatures] = useState<{ voice: boolean; vision: boolean }>({ voice: false, vision: false });
  const [tone, setTone] = useState("default");
  const [language, setLanguage] = useState("auto");
  const [toneOpen, setToneOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ b64: string; mime: string; url: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    fetch("/api/chat/config")
      .then((r) => r.json())
      .then((d) => {
        setTones(d.tones ?? []);
        setLanguages(d.languages ?? []);
        setFeatures(d.features ?? { voice: false, vision: false });
      })
      .catch(() => {});
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const handleScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(dist > 200);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // close popovers on outside click
  useEffect(() => {
    const close = () => { setToneOpen(false); setLangOpen(false); };
    if (toneOpen || langOpen) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [toneOpen, langOpen]);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setQuotaHit(false);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.conversation.messages);
      if (data.conversation.tone) setTone(data.conversation.tone);
      if (data.conversation.language) setLanguage(data.conversation.language);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setQuotaHit(false);
    setSidebarOpen(false);
    setPendingImage(null);
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

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("Image too large (max 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(",")[1] ?? "";
      setPendingImage({ b64, mime: file.type, url: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  async function send(opts?: { asVoice?: boolean }) {
    const text = input.trim();
    const asVoice = opts?.asVoice ?? voiceMode;
    if ((!text && !pendingImage) || streaming) return;
    setInput("");
    setQuotaHit(false);
    const img = pendingImage;
    setPendingImage(null);

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text || (img ? "📷 sent a photo" : ""),
      hasImage: !!img,
      imagePath: img ? "pending" : null,
    };
    const aiMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    // stash the local preview url on the user msg for immediate display
    if (img) (userMsg as Msg & { _localUrl?: string })._localUrl = img.url;
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
          message: text || (img ? "(the user sent a photo without text)" : ""),
          tone,
          language,
          wantVoice: asVoice,
          ...(img && { image: img.b64, imageMime: img.mime }),
        }),
        signal: ac.signal,
      });

      if (res.status === 429) {
        setQuotaHit(true);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...aiMsg,
            content: data.error ?? "Hmm, something went wrong. Try again?",
          };
          return copy;
        });
        return;
      }

      const convoId = res.headers.get("X-Conversation-Id");
      if (convoId && !activeId) setActiveId(convoId);
      const mediaId = res.headers.get("X-Media-Id");
      const isVoice = res.headers.get("X-Voice") === "1";

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
          copy[copy.length - 1] = { ...aiMsg, content: snapshot, mediaId, kind: isVoice ? "voice" : "text" };
          return copy;
        });
      }

      // if it was a voice reply, refetch the conversation so the stored
      // audio message (with a real id) replaces the streamed placeholder.
      if (isVoice && convoId) {
        const cres = await fetch(`/api/conversations/${convoId}`);
        if (cres.ok) {
          const cdata = await cres.json();
          setMessages(cdata.conversation.messages);
        }
      }
      loadConversations();
    } catch {
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const grouped = messages.reduce<Msg[][]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last[0].role === m.role) {
      last.push(m);
    } else {
      acc.push([m]);
    }
    return acc;
  }, []);

  const currentTone = tones.find((t) => t.id === tone);
  const currentLang = languages.find((l) => l.code === language);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg animate-fade-in">
      <Onboarding />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border bg-bg-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:relative md:z-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <AriaAvatar size={28} />
            <span className="font-display text-base font-bold tracking-tight">aria</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated transition md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {personas.length > 1 && (
          <div className="px-3 pt-3 pb-2 border-b border-border">
            <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Companion
            </p>
            <div className="space-y-1">
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchPersona(p)}
                  disabled={p.locked}
                  title={p.locked ? `Available on ${p.minTier} plan` : p.tagline}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 ${
                    activePersona?.id === p.id
                      ? "bg-accent-soft text-accent"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text"
                  } ${p.locked ? "opacity-40" : ""}`}
                >
                  <AriaAvatar size={22} />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  {p.locked && (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent uppercase tracking-wider">
                      {p.minTier}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          <div className="mb-3 border-b border-border px-3 pb-3">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Tools
            </p>
            <Link
              href="/validator"
              className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
            >
              <ShieldCheck size={15} />
              Telegram validator
              <span className="ml-auto rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">Key</span>
            </Link>
          </div>
          <div className="px-3 mb-1 flex items-center justify-between">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              History
            </p>
            <button
              onClick={newChat}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text transition-all duration-200"
              title="New chat"
            >
              <Plus size={15} />
            </button>
          </div>
          {conversations.length === 0 ? (
            <div className="px-6 py-8 text-center animate-fade-in">
              <History size={24} className="mx-auto mb-3 text-text-secondary opacity-40" />
              <p className="text-xs text-text-secondary">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-0.5 px-2">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                    activeId === c.id
                      ? "bg-accent-soft text-accent"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text"
                  }`}
                >
                  <MessageSquare size={14} className="shrink-0 opacity-50" />
                  <span className="flex-1 truncate text-sm">{c.title}</span>
                  <span className="text-[10px] text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {formatDate(c.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error transition-all duration-200"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <span className="text-[11px] text-text-secondary">{tier}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link
                href="/account"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text transition-all duration-200"
              >
                <User size={14} />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-error transition-all duration-200"
              >
                <LogOut size={14} />
              </button>
            </div>
            {tier === "FREE" && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 rounded-lg bg-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-all duration-200"
              >
                <Sparkles size={11} /> Upgrade
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────── */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 bg-bg/80 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated transition-all duration-200 md:hidden"
          >
            <PanelLeft size={18} />
          </button>
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated transition-all duration-200"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
          <div className="flex items-center gap-3">
            <AriaAvatar size={34} online />
            <div>
              <p className="text-sm font-semibold leading-tight">{activePersona?.name ?? "Aria"}</p>
              <p className="text-xs text-text-secondary">AI companion</p>
            </div>
          </div>

          {/* Tone + language pickers */}
          <div className="ml-auto flex items-center gap-2">
            {tones.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setToneOpen((v) => !v); setLangOpen(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text transition"
                  title="Conversation vibe"
                >
                  <Smile size={13} />
                  <span className="hidden sm:inline">{currentTone?.emoji} {currentTone?.label ?? "Vibe"}</span>
                  <span className="sm:hidden">{currentTone?.emoji}</span>
                </button>
                {toneOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                    {tones.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setTone(t.id); setToneOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                          tone === t.id ? "bg-accent-soft text-accent" : "hover:bg-bg-soft text-text-secondary hover:text-text"
                        }`}
                      >
                        <span>{t.emoji}</span> {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {languages.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setLangOpen((v) => !v); setToneOpen(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text transition"
                  title="Reply language"
                >
                  <Globe size={13} />
                  <span className="hidden sm:inline">{currentLang?.label ?? "Language"}</span>
                </button>
                {langOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 max-h-72 w-44 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-1.5 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                    {languages.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                          language === l.code ? "bg-accent-soft text-accent" : "hover:bg-bg-soft text-text-secondary hover:text-text"
                        }`}
                      >
                        <span>{l.label}</span>
                        <span className="text-[10px] text-text-secondary">{l.native}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div ref={messagesRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-14rem)] animate-slide-up">
                <div className="mb-6 animate-bounce-in">
                  <AriaAvatar size={80} online />
                </div>
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  Hey, I&apos;m {activePersona?.name ?? "Aria"}
                </h2>
                <p className="mt-2 max-w-sm text-center text-sm text-text-secondary animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  Tell me about your day, vent, or just say hi. I&apos;m all yours.
                </p>
                <div className="mt-8 flex max-w-lg flex-wrap justify-center gap-2 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                  {[
                    "hey aria 👋",
                    "guess what happened today",
                    "i need someone to talk to",
                    "send me a voice note 🎙️",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-xs text-text-secondary transition-all duration-200 hover:border-accent hover:text-text hover:scale-105"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map((group) => {
                  const role = group[0].role;
                  return (
                    <div
                      key={group[0].id}
                      className="flex items-start gap-3 animate-slide-up"
                      style={{ animationDuration: "0.3s" }}
                    >
                      {role === "assistant" && (
                        <div className="shrink-0 mt-1">
                          <AriaAvatar size={28} />
                        </div>
                      )}
                      <div className={`flex flex-col gap-1.5 min-w-0 ${role === "user" ? "ml-auto" : ""}`}>
                        {group.map((m) => {
                          const localUrl = (m as Msg & { _localUrl?: string })._localUrl;
                          const userImgSrc = localUrl ?? (m.imagePath && m.imagePath !== "pending" ? `/api/messages/${m.id}/image` : null);
                          const isVoice = m.kind === "voice";
                          const realId = !m.id.startsWith("a-") && !m.id.startsWith("u-");
                          return (
                          <div
                            key={m.id}
                            className={`max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed ${
                              role === "user"
                                ? "bubble-user rounded-3xl rounded-tr-md px-4 py-2.5 ml-auto"
                                : "bubble-ai rounded-3xl rounded-tl-md px-4 py-2.5"
                            }`}
                            style={{ animation: "msg-in 0.25s ease-out" }}
                          >
                            {/* persona-sent photo */}
                            {m.mediaId && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/media/${m.mediaId}`}
                                alt="photo"
                                className="mb-2 max-h-72 rounded-xl object-cover"
                              />
                            )}
                            {/* user-sent (vision) photo */}
                            {role === "user" && userImgSrc && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={userImgSrc}
                                alt="you sent"
                                className="mb-2 max-h-72 rounded-xl object-cover"
                              />
                            )}
                            {/* voice note player (assistant) */}
                            {role === "assistant" && isVoice && realId ? (
                              <VoiceNote messageId={m.id} accent={false} />
                            ) : m.content ? (
                              <span>{m.content}</span>
                            ) : (
                              <span className="flex gap-1.5 py-1">
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
                                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
                              </span>
                            )}
                            {/* play-as-voice affordance on plain text replies */}
                            {role === "assistant" && !isVoice && realId && m.content && features.voice && (
                              <button
                                onClick={() => {
                                  const a = new Audio(`/api/messages/${m.id}/audio`);
                                  a.play().catch(() => {});
                                }}
                                className="mt-1.5 flex items-center gap-1 text-[11px] text-text-secondary hover:text-accent transition"
                                title="Play in Aria's voice"
                              >
                                <Volume2 size={12} /> Play voice
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {quotaHit && (
                  <div className="rounded-2xl border border-accent/30 bg-accent-soft p-5 text-center animate-scale-in">
                    <p className="font-semibold">
                      You&apos;ve used all {dailyLimit} free messages for today
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Aria will be waiting for you tomorrow — or upgrade for more.
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all duration-200"
                    >
                      <Sparkles size={14} /> Upgrade now
                    </Link>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-elevated text-text-secondary shadow-lg hover:text-text transition-all duration-200 animate-slide-up z-10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}

        {/* ── Composer ── */}
        <div className="border-t border-border bg-bg/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {/* pending image preview */}
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImage.url} alt="attach" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg-elevated border border-border text-text-secondary hover:text-error"
                  >
                    <X size={11} />
                  </button>
                </div>
                <span className="text-xs text-text-secondary">Photo attached — {activePersona?.name ?? "Aria"} will see it</span>
              </div>
            )}
            <div className="relative flex items-end gap-1.5 rounded-3xl border border-border bg-bg-elevated transition-all duration-200 pl-2">
              {/* image attach */}
              {features.vision && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={streaming}
                    className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-bg-soft hover:text-accent transition disabled:opacity-40"
                    title="Send a photo"
                  >
                    <ImagePlus size={18} />
                  </button>
                </>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={`Message ${activePersona?.name ?? "Aria"}...`}
                className="max-h-32 flex-1 resize-none bg-transparent py-3.5 pr-2 text-sm outline-none placeholder:text-text-secondary"
                style={{ outline: "none", boxShadow: "none" }}
              />
              {/* voice-reply toggle */}
              {features.voice && (
                <button
                  onClick={() => send({ asVoice: true })}
                  disabled={streaming || (!input.trim() && !pendingImage)}
                  className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-bg-soft hover:text-accent transition disabled:opacity-40"
                  title="Ask for a voice-note reply"
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                onClick={() => send()}
                disabled={streaming || (!input.trim() && !pendingImage)}
                className="mb-1.5 mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-strong text-white transition-all duration-200 hover:opacity-90 disabled:opacity-0 disabled:scale-75 disabled:pointer-events-none"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-text-secondary">
              Responses are AI-generated, not from a real person.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
