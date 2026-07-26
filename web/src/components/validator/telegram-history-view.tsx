"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  Loader2,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

const PANEL = "border border-white/[0.065] bg-[#111311]";
const FIELD = "w-full rounded-xl border border-white/10 bg-[#071111] px-3.5 py-2.5 text-sm text-[#eef7ed] outline-none transition placeholder:text-[#61706d] focus:border-[#b8ff4b]/60 focus:ring-2 focus:ring-[#b8ff4b]/10";
const SECONDARY = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-[#b8c5c1] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

type Tone = "success" | "error" | "info";
type Session = {
  id: string;
  label: string;
  username: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  isLoggedIn: boolean;
  spamStatus: string;
};
type SessionList = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{ sessionId: string }>;
};
type HistoryResult = {
  stage?: string;
  total?: number;
  processed?: number;
  succeeded?: number;
  failed?: number;
  cleared?: number;
  left?: number;
  deleted?: number;
  blocked?: number;
  currentTitle?: string | null;
  results?: Array<{
    chatId: string;
    title: string;
    type: string;
    ok: boolean;
    action: string | null;
    error?: string;
  }>;
};
type HistoryJob = {
  id: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  result: HistoryResult | null;
  session: { id: string; label: string; phone: string | null; username: string | null };
};
type HistoryBatch = {
  id: string;
  kind: string;
  status: string;
  totalCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  cancelRequested: boolean;
  metadata: { revoke?: boolean; source?: string } | null;
  createdAt: string;
  finishedAt: string | null;
  jobs?: HistoryJob[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function sessionName(session: Session) {
  return [session.firstName, session.lastName].filter(Boolean).join(" ") || session.label;
}

export function TelegramHistoryView({
  notify,
  initialSessionIds = [],
  compact = false,
  onStarted,
}: {
  notify: (message: string, tone?: Tone) => void;
  initialSessionIds?: string[];
  compact?: boolean;
  onStarted?: (batch: HistoryBatch) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lists, setLists] = useState<SessionList[]>([]);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [mode, setMode] = useState<"sessions" | "lists">("sessions");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSessionIds);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [revoke, setRevoke] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [activeBatchId, setActiveBatchId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [detail, setDetail] = useState<HistoryBatch | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [sessionData, listData, batchData] = await Promise.all([
      request<{ sessions: Session[] }>("/api/validator/telegram/sessions"),
      request<{ lists: SessionList[] }>("/api/validator/telegram/session-lists"),
      request<{ batches: HistoryBatch[] }>("/api/validator/account-settings/batches?limit=50"),
    ]);
    setSessions(sessionData.sessions || []);
    setLists(listData.lists || []);
    setHistory((batchData.batches || []).filter((batch) => batch.kind === "clear_history"));
    setSelectedIds((current) => current.filter((id) => sessionData.sessions.some((session) => session.id === id)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => notify(error instanceof Error ? error.message : "History tools failed to load", "error")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeBatchId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const data = await request<{ batch: HistoryBatch }>(`/api/validator/account-settings/batches/${activeBatchId}`);
        if (stopped) return;
        setDetail((current) => current?.id === data.batch.id ? data.batch : current);
        setHistory((current) => [data.batch, ...current.filter((batch) => batch.id !== data.batch.id)].slice(0, 50));
        if (TERMINAL.has(data.batch.status)) {
          setActiveBatchId("");
          notify(`History deletion finished: ${data.batch.succeededCount} accounts completed, ${data.batch.failedCount} failed.`, data.batch.failedCount ? "error" : "success");
        }
      } catch {
        // Keep polling through temporary transport errors.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeBatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSessions = sessions.filter((session) => session.status === "active" && session.isLoggedIn);
  const visibleSessions = activeSessions.filter((session) => `${sessionName(session)} ${session.username || ""} ${session.phone || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const listSessionCount = new Set(lists.filter((list) => selectedListIds.includes(list.id)).flatMap((list) => list.members.map((member) => member.sessionId))).size;
  const targetCount = mode === "sessions" ? selectedIds.length : listSessionCount;

  async function start() {
    if (!targetCount || busy) return;
    setBusy("start");
    try {
      const data = await request<{ batch: HistoryBatch; batchId: string }>("/api/validator/account-settings/clear-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "sessions" ? { sessionIds: selectedIds } : { sessionListIds: selectedListIds }),
          revoke,
          concurrency: 8,
        }),
      });
      setHistory((current) => [data.batch, ...current.filter((batch) => batch.id !== data.batch.id)]);
      setActiveBatchId(data.batchId);
      setExpandedId(data.batchId);
      setDetail(data.batch);
      setConfirming(false);
      onStarted?.(data.batch);
      notify(`History deletion queued for ${data.batch.totalCount} account${data.batch.totalCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to queue history deletion", "error");
    } finally {
      setBusy("");
    }
  }

  async function toggleDetails(batch: HistoryBatch) {
    if (expandedId === batch.id) {
      setExpandedId("");
      return;
    }
    setExpandedId(batch.id);
    try {
      const data = await request<{ batch: HistoryBatch }>(`/api/validator/account-settings/batches/${batch.id}`);
      setDetail(data.batch);
      if (!TERMINAL.has(data.batch.status)) setActiveBatchId(data.batch.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load job details", "error");
    }
  }

  async function cancel(batch: HistoryBatch) {
    try {
      const data = await request<{ batch: HistoryBatch }>(`/api/validator/account-settings/batches/${batch.id}`, { method: "DELETE" });
      setActiveBatchId(data.batch.id);
      notify("Cancellation requested. In-flight Telegram calls may finish first.", "info");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Cancellation failed", "error");
    }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 size={22} className="animate-spin text-[#b8ff4b]" /></div>;

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact && (
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#ff8585]"><span className="h-px w-7 bg-current" /> Telegram hygiene</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Delete chat history.<br /><span className="text-[#71807c]">Across entire fleets, in seconds.</span></h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71807c]">Hydrogram scans each account once, processes dialogs in bounded parallel chunks, and records durable account-level progress.</p>
        </div>
      )}

      <section className={`${PANEL} overflow-hidden rounded-[24px]`}>
        <div className="border-b border-white/[0.07] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7474]/10 text-[#ff8585]"><Trash2 size={17} /></span>
            <div><h3 className="text-sm font-semibold">New history deletion</h3><p className="mt-1 text-[10px] leading-4 text-[#60706b]">Choose accounts directly or combine multiple saved session lists. Duplicate members run once.</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#071111] p-1">
            <button type="button" onClick={() => setMode("sessions")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === "sessions" ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "text-[#71807c]"}`}><Users size={13} /> Sessions</button>
            <button type="button" onClick={() => setMode("lists")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === "lists" ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "text-[#71807c]"}`}><Layers3 size={13} /> Session lists</button>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_340px]">
          <div>
            {mode === "sessions" ? (
              <>
                <div className="relative"><Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search active accounts" className={`${FIELD} pl-9`} /></div>
                <div className="mt-3 flex items-center gap-3 text-[10px]"><span className="text-[#60706b]">{selectedIds.length} selected</span><button type="button" onClick={() => setSelectedIds(visibleSessions.map((session) => session.id))} className="text-[#b8ff4b]">Select visible</button><button type="button" onClick={() => setSelectedIds([])} className="ml-auto text-[#71807c]">Clear</button></div>
                <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                  {visibleSessions.map((session) => { const selected = selectedIds.includes(session.id); return <button key={session.id} type="button" onClick={() => setSelectedIds((current) => selected ? current.filter((id) => id !== session.id) : [...current, session.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#b8ff4b]/30 bg-[#b8ff4b]/[0.07]" : "border-white/[0.06] bg-[#071111] hover:border-white/15"}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-[#b8ff4b] bg-[#b8ff4b] text-[#07100d]" : "border-white/15"}`}>{selected && <Check size={11} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{sessionName(session)}</span><span className="block truncate text-[9px] text-[#60706b]">{session.username ? `@${session.username}` : session.phone || session.label}</span></span><span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase ${session.spamStatus === "frozen" ? "border-red-500/20 text-red-300" : session.spamStatus === "limited" ? "border-amber-500/20 text-amber-300" : "border-white/10 text-[#71807c]"}`}>{session.spamStatus}</span></button>; })}
                  {!visibleSessions.length && <p className="py-10 text-center text-xs text-[#60706b]">No active sessions match.</p>}
                </div>
              </>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {lists.map((list) => { const selected = selectedListIds.includes(list.id); return <button key={list.id} type="button" onClick={() => setSelectedListIds((current) => selected ? current.filter((id) => id !== list.id) : [...current, list.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#b8ff4b]/30 bg-[#b8ff4b]/[0.07]" : "border-white/[0.06] bg-[#071111] hover:border-white/15"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#b8ff4b] text-[#07100d]" : "bg-white/[0.04] text-[#71807c]"}`}>{selected ? <Check size={13} /> : <Layers3 size={13} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{list.name}</span><span className="block text-[9px] text-[#60706b]">{list.members.length} member{list.members.length === 1 ? "" : "s"}</span></span></button>; })}
                {!lists.length && <p className="py-10 text-center text-xs text-[#60706b]">No session lists saved yet.</p>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button type="button" onClick={() => setRevoke(false)} className={`w-full rounded-2xl border p-4 text-left transition ${!revoke ? "border-[#65e6ff]/25 bg-[#65e6ff]/[0.06]" : "border-white/[0.07] bg-[#071111]"}`}><span className="flex items-center gap-2 text-xs font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${!revoke ? "border-[#65e6ff] bg-[#65e6ff] text-[#07100d]" : "border-white/20"}`}>{!revoke && <Check size={10} />}</span>Delete for me</span><span className="mt-2 block text-[9px] leading-4 text-[#60706b]">Clears private chats only from these accounts. Groups and channels are left after clearing.</span></button>
            <button type="button" onClick={() => setRevoke(true)} className={`w-full rounded-2xl border p-4 text-left transition ${revoke ? "border-[#ff7474]/30 bg-[#ff7474]/[0.07]" : "border-white/[0.07] bg-[#071111]"}`}><span className="flex items-center gap-2 text-xs font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${revoke ? "border-[#ff8585] bg-[#ff8585] text-[#210707]" : "border-white/20"}`}>{revoke && <Check size={10} />}</span>Delete for both sides</span><span className="mt-2 block text-[9px] leading-4 text-[#60706b]">Requests revoke where Telegram permits it and deletes owned groups/channels; otherwise it safely falls back to leaving.</span></button>
            <div className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[#60706b]">Unique targets</p><p className="mt-1 text-2xl font-semibold">{targetCount}</p></div>
            {!confirming ? <button type="button" disabled={!targetCount || !!activeBatchId} onClick={() => setConfirming(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff8585] px-4 py-3 text-xs font-bold text-[#210707] transition hover:bg-[#ffa3a3] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={14} /> Delete history</button> : <div className="rounded-2xl border border-[#ff7474]/25 bg-[#ff7474]/[0.06] p-3"><p className="flex gap-2 text-[10px] leading-4 text-[#ffb0b0]"><AlertTriangle size={13} className="mt-0.5 shrink-0" />This cannot be undone. Start the durable job?</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirming(false)} className={SECONDARY}>Cancel</button><button type="button" onClick={() => void start()} disabled={busy === "start"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff8585] px-3 py-2.5 text-xs font-bold text-[#210707]">{busy === "start" ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />} Confirm</button></div></div>}
          </div>
        </div>
      </section>

      <section className={`${PANEL} rounded-[24px] p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Clock3 size={15} className="text-[#65e6ff]" /><h3 className="text-sm font-semibold">Deletion history</h3></div><p className="mt-1 text-[10px] text-[#60706b]">Durable account progress and bounded per-chat logs.</p></div><span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[8px] uppercase tracking-wider text-[#60706b]">{history.length} jobs</span></div>
        <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {history.map((batch) => {
            const expanded = expandedId === batch.id;
            const currentDetail = detail?.id === batch.id ? detail : null;
            const firstRunning = currentDetail?.jobs?.find((job) => job.status === "processing");
            const result = firstRunning?.result;
            const progress = batch.totalCount ? Math.round((batch.processedCount / batch.totalCount) * 100) : 0;
            return <article key={batch.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071111]"><button type="button" onClick={() => void toggleDetails(batch)} className="flex w-full items-center gap-3 p-3 text-left sm:p-4"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${batch.status === "completed" ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : batch.status === "failed" ? "bg-red-500/10 text-red-300" : "bg-[#65e6ff]/10 text-[#65e6ff]"}`}>{TERMINAL.has(batch.status) ? batch.failedCount ? <XCircle size={15} /> : <CheckCircle2 size={15} /> : <Loader2 size={15} className="animate-spin" />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-xs font-semibold">{batch.metadata?.revoke ? "Both-sides deletion" : "Delete for me"}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase text-[#71807c]">{batch.status}</span></span><span className="mt-1 block truncate text-[9px] text-[#60706b]">{batch.processedCount}/{batch.totalCount} accounts · {batch.succeededCount} completed · {batch.failedCount} failed · {new Date(batch.createdAt).toLocaleString()}</span>{result?.currentTitle && <span className="mt-1 block truncate text-[9px] text-[#65e6ff]">Clearing {result.currentTitle} · {result.processed || 0}/{result.total || 0} chats</span>}</span>{!TERMINAL.has(batch.status) && <button type="button" onClick={(event) => { event.stopPropagation(); void cancel(batch); }} disabled={batch.cancelRequested} className="rounded-lg border border-red-500/20 p-2 text-red-300"><Ban size={13} /></button>}{expanded ? <ChevronUp size={14} className="text-[#60706b]" /> : <ChevronDown size={14} className="text-[#60706b]" />}</button><div className="h-1 bg-white/[0.04]"><div className="h-full bg-gradient-to-r from-[#65e6ff] to-[#b8ff4b] transition-[width]" style={{ width: `${progress}%` }} /></div>{expanded && <div className="border-t border-white/[0.06] p-3">{!currentDetail ? <Loader2 size={14} className="animate-spin text-[#65e6ff]" /> : <div className="max-h-72 space-y-2 overflow-y-auto">{currentDetail.jobs?.map((job) => <div key={job.id} className="rounded-xl border border-white/[0.06] bg-[#0b0d0c] p-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${job.status === "completed" ? "bg-[#b8ff4b]" : job.status === "failed" ? "bg-red-400" : job.status === "processing" ? "animate-pulse bg-[#65e6ff]" : "bg-[#60706b]"}`} /><p className="min-w-0 flex-1 truncate text-xs font-semibold">{job.session.label}</p><span className="text-[8px] uppercase text-[#60706b]">{job.status}</span></div>{job.result && <p className="mt-2 text-[9px] text-[#71807c]">{job.result.processed || 0}/{job.result.total || 0} chats · {job.result.cleared || 0} cleared · {job.result.left || 0} left · {job.result.deleted || 0} deleted · {job.result.failed || 0} failed</p>}{job.errorMessage && <p className="mt-2 text-[9px] text-red-300">{job.errorMessage}</p>}{job.result?.results?.length ? <div className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-white/[0.05] pt-2">{job.result.results.slice(0, 30).map((entry) => <p key={`${entry.chatId}:${entry.action}`} className={`truncate text-[8px] ${entry.ok ? "text-[#60706b]" : "text-red-300"}`}>{entry.ok ? "✓" : "×"} {entry.title} · {entry.action || entry.error || "failed"}</p>)}</div> : null}</div>)}</div>}</div>}</article>;
          })}
          {!history.length && <p className="py-12 text-center text-xs text-[#60706b]">No history deletion jobs yet.</p>}
        </div>
      </section>
    </div>
  );
}
