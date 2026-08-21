"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleStop,
  FilePenLine,
  Filter,
  Layers3,
  Loader2,
  MessageCircle,
  RefreshCw,
  Smartphone,
  Users,
  XCircle,
} from "lucide-react";

const PANEL = "border border-white/[0.065] bg-[#111311]";
const FIELD =
  "w-full rounded-xl border border-white/[0.075] bg-[#0b0d0c] px-3.5 py-2.5 text-sm text-[#f3f6f2] outline-none transition placeholder:text-[#59625e] focus:border-[#9cff38]/45 focus:ring-2 focus:ring-[#9cff38]/10 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-4 py-2.5 text-sm font-bold text-[#0a0d09] transition hover:bg-[#b4ff66] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

type Session = {
  id: string;
  label: string;
  phone: string | null;
  username: string | null;
  status: string;
  isLoggedIn: boolean;
  spamStatus: string;
};

type SessionList = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    sessionId: string;
    session: Pick<Session, "id" | "label" | "phone" | "username" | "status" | "isLoggedIn">;
  }>;
};

type DraftJob = {
  id: string;
  name: string;
  message: string;
  scope: "dms" | "groups" | "both";
  filterWords: string[];
  historyDepth: number;
  status: string;
  totalSessions: number;
  processedSessions: number;
  completedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  totalChats: number;
  processedChats: number;
  draftedChats: number;
  filteredChats: number;
  failedChats: number;
  cancelRequested: boolean;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastProgressAt: string;
};

type DraftSessionJob = {
  id: string;
  sessionId: string | null;
  sessionLabel: string;
  status: string;
  totalChats: number;
  processedChats: number;
  draftedChats: number;
  filteredChats: number;
  failedChats: number;
  currentChatTitle: string | null;
  errorMessage: string | null;
};

type DraftResult = {
  id: string;
  chatId: string;
  chatTitle: string;
  chatUsername: string | null;
  chatType: string;
  status: "drafted" | "filtered" | "failed";
  matchedFilter: string | null;
  inspectedMessages: number;
  errorCode: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

type DraftJobDetail = DraftJob & {
  sessions: DraftSessionJob[];
  results: DraftResult[];
};

type Props = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

function relativeTime(value: string | null) {
  if (!value) return "not started";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString();
}

function statusClass(status: string) {
  if (status === "completed" || status === "drafted") return "border-[#9cff38]/20 bg-[#9cff38]/[0.07] text-[#b8ff79]";
  if (status === "failed") return "border-[#ff8585]/20 bg-[#ff8585]/[0.06] text-[#ff9c9c]";
  if (["filtered", "skipped", "cancelled", "paused_subscription"].includes(status)) return "border-[#f4ca64]/20 bg-[#f4ca64]/[0.06] text-[#f4ca64]";
  return "border-[#65e6ff]/20 bg-[#65e6ff]/[0.06] text-[#86ebff]";
}

export function TelegramDraftsView({ notify }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lists, setLists] = useState<SessionList[]>([]);
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [detail, setDetail] = useState<DraftJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<"dms" | "groups" | "both">("both");
  const [targetMode, setTargetMode] = useState<"all" | "sessions" | "lists">("all");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [filterText, setFilterText] = useState("price");

  async function loadBase() {
    const [sessionData, listData, jobData] = await Promise.all([
      request<{ sessions: Session[] }>("/api/validator/telegram/sessions"),
      request<{ lists: SessionList[] }>("/api/validator/telegram/session-lists"),
      request<{ jobs: DraftJob[] }>("/api/validator/telegram/drafts?limit=25"),
    ]);
    setSessions(sessionData.sessions || []);
    setLists(listData.lists || []);
    setJobs(jobData.jobs || []);
    return jobData.jobs || [];
  }

  async function loadDetail(id: string) {
    const data = await request<{ job: DraftJobDetail }>(`/api/validator/telegram/drafts/${id}`);
    setDetail(data.job);
    return data.job;
  }

  async function refresh() {
    const nextJobs = await loadBase();
    const id = activeJobId || nextJobs[0]?.id;
    if (id) {
      if (!activeJobId) setActiveJobId(id);
      await loadDetail(id);
    } else {
      setDetail(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh()
        .catch((error) => notify(error instanceof Error ? error.message : "Unable to load drafts", "error"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = jobs.some((job) => ["pending", "running", "paused_subscription"].includes(job.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => refresh().catch(() => undefined), 1500);
    return () => window.clearInterval(timer);
  }, [hasActive, activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleSessions = sessions.filter(
    (session) => session.status === "active" && session.isLoggedIn && session.spamStatus !== "frozen",
  );
  const eligibleSessionIds = new Set(eligibleSessions.map((session) => session.id));
  const selectedListSessionCount = new Set(
    lists
      .filter((list) => selectedListIds.includes(list.id))
      .flatMap((list) => list.members.map((member) => member.sessionId))
      .filter((sessionId) => eligibleSessionIds.has(sessionId)),
  ).size;
  const targetCount =
    targetMode === "all"
      ? eligibleSessions.length
      : targetMode === "sessions"
        ? selectedSessionIds.length
        : selectedListSessionCount;
  const filterWords = [...new Set(
    filterText
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const data = await request<{ job: DraftJobDetail }>("/api/validator/telegram/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          scope,
          filterWords,
          targetMode,
          sessionIds: targetMode === "sessions" ? selectedSessionIds : undefined,
          sessionListIds: targetMode === "lists" ? selectedListIds : undefined,
        }),
      });
      setName("");
      setMessage("");
      setActiveJobId(data.job.id);
      setDetail(data.job);
      await loadBase();
      notify(`Draft job queued across ${formatNumber(data.job.totalSessions)} account${data.job.totalSessions === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to queue draft job", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!detail) return;
    setCancelling(true);
    try {
      const data = await request<{ job: DraftJobDetail }>(`/api/validator/telegram/drafts/${detail.id}`, {
        method: "DELETE",
      });
      setDetail(data.job);
      await loadBase();
      notify("Draft job cancellation requested.", "info");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to cancel draft job", "error");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#9cff38]" />
      </div>
    );
  }

  const progress = detail
    ? detail.totalChats > 0
      ? Math.min(100, Math.round((detail.processedChats / detail.totalChats) * 100))
      : detail.totalSessions > 0
        ? Math.round((detail.processedSessions / detail.totalSessions) * 100)
        : 0
    : 0;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.025em]">Place drafts without sending</h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#71807c]">
            Signal Desk scans each selected account&apos;s eligible chats, checks the latest 10 messages,
            skips configured phrases, and writes the text to Telegram&apos;s draft field. No message is sent.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-[#071111] px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-wider text-[#60706b]">Eligible now</p>
            <p className="font-mono text-lg text-[#65e6ff]">{formatNumber(eligibleSessions.length)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#071111] px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-wider text-[#60706b]">Recent jobs</p>
            <p className="font-mono text-lg text-[#d8b7ff]">{formatNumber(jobs.length)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <form onSubmit={submit} className={`${PANEL} rounded-[28px] p-5 sm:p-7`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Job name</span>
              <input
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Price follow-up drafts"
                className={`${FIELD} mt-2`}
              />
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Chat scope</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className={`${FIELD} mt-2`}>
                <option value="both">DMs and groups</option>
                <option value="dms">DMs only</option>
                <option value="groups">Groups only</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Draft message</span>
            <textarea
              required
              rows={7}
              maxLength={4096}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write the message that should appear in each chat's Telegram composer..."
              className={`${FIELD} mt-2 resize-y`}
            />
            <span className="mt-1 block text-right font-mono text-[9px] text-[#53615d]">{message.length} / 4096</span>
          </label>

          <label className="mt-4 block">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              <Filter size={12} /> Ignore phrases
              <span className="font-normal normal-case tracking-normal text-[#53615d]">comma or one per line</span>
            </span>
            <textarea
              rows={3}
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder={"price\npayment already sent"}
              className={`${FIELD} mt-2 font-mono`}
            />
            <p className="mt-1 text-[10px] text-[#60706b]">
              Case-insensitive substring matching across up to the latest 10 message texts or captions.
              {filterWords.length ? ` ${filterWords.length} active phrase${filterWords.length === 1 ? "" : "s"}.` : " No filters: every in-scope chat is drafted."}
            </p>
          </label>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Account source</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([
                ["all", "All eligible", "Every active non-frozen account", Layers3],
                ["sessions", "Pick accounts", "Choose accounts individually", Smartphone],
                ["lists", "Session Lists", "Union one or more named lists", Users],
              ] as const).map(([id, label, description, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTargetMode(id)}
                  className={`rounded-xl border p-3 text-left transition ${targetMode === id ? "border-[#65e6ff]/30 bg-[#65e6ff]/[0.06]" : "border-white/[0.07] bg-[#071111] hover:border-white/15"}`}
                >
                  <Icon size={15} className={targetMode === id ? "text-[#65e6ff]" : "text-[#60706b]"} />
                  <span className="mt-2 block text-xs font-medium">{label}</span>
                  <span className="mt-1 block text-[9px] leading-4 text-[#60706b]">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {targetMode === "sessions" && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-[#6d7b77]">Accounts</p>
                <div className="flex gap-3 text-[10px]">
                  <button type="button" onClick={() => setSelectedSessionIds(eligibleSessions.map((session) => session.id))} className="text-[#65e6ff]">Select eligible</button>
                  <button type="button" onClick={() => setSelectedSessionIds([])} className="text-[#81908c]">Clear</button>
                </div>
              </div>
              <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {sessions.map((session) => {
                  const eligible = session.status === "active" && session.isLoggedIn && session.spamStatus !== "frozen";
                  const selected = selectedSessionIds.includes(session.id);
                  return (
                    <label key={session.id} className={`flex items-center gap-3 rounded-xl border p-3 ${!eligible ? "cursor-not-allowed border-[#f4ca64]/15 opacity-50" : selected ? "cursor-pointer border-[#65e6ff]/30 bg-[#65e6ff]/[0.05]" : "cursor-pointer border-white/[0.07] bg-[#071111]"}`}>
                      <input
                        type="checkbox"
                        disabled={!eligible}
                        checked={selected}
                        onChange={() => setSelectedSessionIds((current) => current.includes(session.id) ? current.filter((id) => id !== session.id) : [...current, session.id])}
                        className="accent-[#65e6ff]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{session.label}</span>
                        <span className="block truncate text-[9px] text-[#60706b]">
                          {!eligible ? (session.spamStatus === "frozen" ? "Frozen" : "Not connected") : session.username ? `@${session.username}` : session.phone}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {targetMode === "lists" && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-[#6d7b77]">Session Lists</p>
              <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {lists.map((list) => {
                  const selected = selectedListIds.includes(list.id);
                  return (
                    <label key={list.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected ? "border-[#d8b7ff]/30 bg-[#d8b7ff]/[0.05]" : "border-white/[0.07] bg-[#071111]"}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSelectedListIds((current) => current.includes(list.id) ? current.filter((id) => id !== list.id) : [...current, list.id])}
                        className="accent-[#d8b7ff]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{list.name}</span>
                        <span className="block truncate text-[9px] text-[#60706b]">{list.members.length} account{list.members.length === 1 ? "" : "s"}</span>
                      </span>
                    </label>
                  );
                })}
                {!lists.length && <p className="text-xs text-[#71807c]">No Session Lists exist yet.</p>}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#071111] p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-mono text-lg text-white">{formatNumber(targetCount)} account{targetCount === 1 ? "" : "s"}</p>
              <p className="text-[10px] text-[#60706b]">No campaign quotas, message pacing, or send counters are used. Frozen and disconnected accounts are skipped.</p>
            </div>
            <button disabled={submitting || !name.trim() || !message.trim() || !targetCount} className={PRIMARY}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <FilePenLine size={15} />}
              {submitting ? "Queueing..." : "Place drafts"}
            </button>
          </div>
        </form>

        <aside className={`${PANEL} rounded-[28px] p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Run monitor</p>
              <h4 className="mt-1 truncate font-semibold">{detail?.name || "No draft job yet"}</h4>
            </div>
            <button type="button" onClick={() => refresh().catch((error) => notify(error.message, "error"))} className="rounded-lg border border-white/[0.07] p-2 text-[#71807c] transition hover:text-white" title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>

          {detail ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${statusClass(detail.status)}`}>{detail.status}</span>
                <span className="text-[10px] text-[#60706b]">updated {relativeTime(detail.lastProgressAt)}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#65e6ff] to-[#9cff38] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-right font-mono text-[9px] text-[#60706b]">{progress}%</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Drafted", detail.draftedChats, "text-[#9cff38]"],
                  ["Filtered", detail.filteredChats, "text-[#f4ca64]"],
                  ["Failed chats", detail.failedChats, "text-[#ff8585]"],
                  ["Sessions", `${detail.processedSessions}/${detail.totalSessions}`, "text-[#65e6ff]"],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-xl border border-white/[0.06] bg-[#071111] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[#60706b]">{label}</p>
                    <p className={`mt-1 font-mono text-lg ${color}`}>{typeof value === "number" ? formatNumber(value) : value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#071111] p-3">
                <p className="text-[9px] uppercase tracking-wider text-[#60706b]">Chat progress</p>
                <p className="mt-1 font-mono text-sm text-white">{formatNumber(detail.processedChats)} / {formatNumber(detail.totalChats || detail.processedChats)}</p>
                <p className="mt-1 line-clamp-2 text-[10px] text-[#71807c]">{detail.message}</p>
              </div>
              {["pending", "running", "paused_subscription"].includes(detail.status) && (
                <button type="button" onClick={cancel} disabled={cancelling || detail.cancelRequested} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff8585]/20 bg-[#ff8585]/[0.05] px-3 py-2.5 text-xs font-medium text-[#ff9c9c] disabled:opacity-50">
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : <CircleStop size={14} />}
                  {detail.cancelRequested ? "Cancellation requested" : "Cancel safely"}
                </button>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] p-7 text-center text-xs text-[#60706b]">
              Queue a job to see durable progress here.
            </div>
          )}
        </aside>
      </div>

      {detail && (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-[#65e6ff]" />
              <h4 className="text-sm font-semibold">Account progress</h4>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {detail.sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-white/[0.06] bg-[#071111] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-medium">{session.sessionLabel}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${statusClass(session.status)}`}>{session.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#71807c]">
                    <span className="text-[#9cff38]">{session.draftedChats} drafted</span>
                    <span className="text-[#f4ca64]">{session.filteredChats} filtered</span>
                    <span className="text-[#ff8585]">{session.failedChats} failed</span>
                    <span>{session.processedChats}/{session.totalChats || session.processedChats} chats</span>
                  </div>
                  {session.currentChatTitle && <p className="mt-1 truncate text-[9px] text-[#60706b]">Now: {session.currentChatTitle}</p>}
                  {session.errorMessage && <p className="mt-1 line-clamp-2 text-[9px] text-[#ff9c9c]">{session.errorMessage}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-[#d8b7ff]" />
              <h4 className="text-sm font-semibold">Latest chat outcomes</h4>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {detail.results.map((result) => (
                <div key={result.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#071111] p-3">
                  {result.status === "drafted" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#9cff38]" /> : result.status === "filtered" ? <Filter size={14} className="mt-0.5 shrink-0 text-[#f4ca64]" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-[#ff8585]" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium">{result.chatTitle}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${statusClass(result.status)}`}>{result.status}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-[#60706b]">
                      {result.chatUsername ? `@${result.chatUsername} · ` : ""}{result.chatType} · {result.inspectedMessages} messages checked
                    </p>
                    {result.matchedFilter && <p className="mt-1 text-[9px] text-[#f4ca64]">Matched: “{result.matchedFilter}”</p>}
                    {result.errorMessage && <p className="mt-1 line-clamp-2 text-[9px] text-[#ff9c9c]">{result.errorMessage}</p>}
                  </div>
                </div>
              ))}
              {!detail.results.length && <p className="py-8 text-center text-xs text-[#60706b]">Chat results appear after account scans begin.</p>}
            </div>
          </section>
        </div>
      )}

      <section className={`${PANEL} rounded-[24px] p-5`}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Draft job history</h4>
          <span className="text-[9px] uppercase tracking-wider text-[#60706b]">Newest first</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => {
                setActiveJobId(job.id);
                loadDetail(job.id).catch((error) => notify(error.message, "error"));
              }}
              className={`rounded-xl border p-3 text-left transition ${activeJobId === job.id ? "border-[#d8b7ff]/30 bg-[#d8b7ff]/[0.05]" : "border-white/[0.06] bg-[#071111] hover:border-white/15"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium">{job.name}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${statusClass(job.status)}`}>{job.status}</span>
              </div>
              <p className="mt-2 truncate text-[9px] text-[#71807c]">{job.message}</p>
              <p className="mt-2 text-[9px] text-[#60706b]">{job.draftedChats} drafted · {job.filteredChats} filtered · {job.totalSessions} accounts · {relativeTime(job.createdAt)}</p>
            </button>
          ))}
          {!jobs.length && <p className="text-xs text-[#60706b]">No draft jobs yet.</p>}
        </div>
      </section>
    </div>
  );
}
