"use client";

import { useDeferredValue, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  FileArchive,
  Filter,
  Loader2,
  MessageCircleMore,
  Radar,
  Search,
  Send,
  Settings,
  X,
  XCircle,
} from "lucide-react";
import { SignalSelect } from "@/components/validator/signal-select";

type Tone = "success" | "error" | "info";
type Preset = "24h" | "7d" | "30d" | "all" | "custom";
type Run = {
  id: string;
  kind: "validator" | "message_run" | "account_settings" | "ai_campaign";
  name: string;
  output: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  secondary: number;
  secondaryLabel: string;
  requests: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  creditsUsed?: number;
  sessions?: number;
  logs?: number;
};
type ReportData = {
  summary: {
    runs: number;
    active: number;
    completed: number;
    failed: number;
    succeeded: number;
    errors: number;
  };
  runs: Run[];
};

const PANEL = "rounded-2xl border border-white/[0.065] bg-[#111311]";
const ACTIVE = new Set(["pending", "running", "processing", "starting", "credit_grace"]);

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

function statusColor(status: string) {
  if (["completed", "sent", "stopped", "expired"].includes(status)) return "text-[#9cff38] border-[#9cff38]/20 bg-[#9cff38]/[0.05]";
  if (ACTIVE.has(status)) return "text-[#f7c948] border-[#f7c948]/20 bg-[#f7c948]/[0.05]";
  if (["failed", "error", "grace_expired"].includes(status)) return "text-[#ff7474] border-[#ff7474]/20 bg-[#ff7474]/[0.05]";
  return "text-[#8b9590] border-white/[0.07] bg-white/[0.025]";
}

function kindLabel(kind: Run["kind"]) {
  return kind === "validator" ? "Validation" : kind === "message_run" ? "Messaging" : kind === "account_settings" ? "Communication settings" : "AI Chatter";
}

function RunIcon({ kind }: { kind: Run["kind"] }) {
  const Icon = kind === "validator" ? Radar : kind === "message_run" ? Send : kind === "account_settings" ? Settings : Bot;
  return <Icon size={15} />;
}

function dateQuery(preset: Preset, customFrom: string, customTo: string) {
  if (preset === "all") return "";
  const to = customTo && preset === "custom" ? new Date(`${customTo}T23:59:59.999`) : new Date();
  const from = preset === "custom"
    ? new Date(`${customFrom}T00:00:00.000`)
    : new Date(to.getTime() - (preset === "24h" ? 86_400_000 : preset === "7d" ? 7 * 86_400_000 : 30 * 86_400_000));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return "";
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
}

export function ValidatorReports({ notify }: { notify: (message: string, tone?: Tone) => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("30d");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Run | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  function query(nextPreset = preset) {
    return dateQuery(nextPreset, customFrom, customTo);
  }

  async function load(nextPreset = preset) {
    setLoading(true);
    try {
      setData(await request<ReportData>(`/api/validator/reports?${query(nextPreset)}`));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Reports failed to load", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      request<ReportData>(`/api/validator/reports?${dateQuery("30d", "", "")}`)
        .then(setData)
        .catch((error) => notify(error instanceof Error ? error.message : "Reports failed to load", "error"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function inspect(run: Run) {
    setSelected(run);
    setDetail(null);
    setDetailLoading(true);
    const endpoint = run.kind === "validator"
      ? `/api/validator/jobs/${run.id}`
      : run.kind === "message_run"
        ? `/api/validator/telegram/campaigns/${run.id}`
        : run.kind === "account_settings"
          ? `/api/validator/account-settings/batches/${run.id}`
          : `/api/validator/ai-chatter/campaigns/${run.id}`;
    try {
      setDetail(await request<Record<string, unknown>>(endpoint));
    } catch (error) {
      setDetail({ error: error instanceof Error ? error.message : "Inspection failed" });
    } finally {
      setDetailLoading(false);
    }
  }

  const visible = (data?.runs || []).filter((run) => {
    if (kind !== "all" && run.kind !== kind) return false;
    if (status === "active" && !ACTIVE.has(run.status)) return false;
    if (status === "completed" && !["completed", "stopped", "expired"].includes(run.status)) return false;
    if (status === "failed" && !["failed", "error", "grace_expired"].includes(run.status)) return false;
    return !deferredSearch || `${run.name} ${run.output} ${run.kind} ${run.status}`.toLowerCase().includes(deferredSearch);
  });
  const exportUrl = `/api/validator/reports/export?${query()}`;

  if (loading && !data) return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#9cff38]" /></div>;
  if (!data) return <div className="flex min-h-[65vh] items-center justify-center text-sm text-[#737d78]">No report data available.</div>;

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#9cff38]">Workspace intelligence</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Every run. Every result. One ledger.</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#737d78]">Validation, Telegram messaging, profile operations, and AI automation with drill-down evidence and organized exports.</p></div>
        <a href={exportUrl} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#9cff38] px-4 py-2.5 text-xs font-bold text-[#0a0d09]"><FileArchive size={14} /> Download complete ZIP</a>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["All runs", data.summary.runs, Activity], ["Active", data.summary.active, Loader2],
          ["Completed", data.summary.completed, CheckCircle2], ["Failed runs", data.summary.failed, XCircle],
          ["Successful rows", data.summary.succeeded, MessageCircleMore], ["Failed rows", data.summary.errors, XCircle],
        ].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof Activity; return <div key={String(label)} className={`${PANEL} p-4`}><MetricIcon size={14} className="text-[#9cff38]" /><p className="mt-4 font-mono text-xl font-semibold">{Number(value).toLocaleString()}</p><p className="mt-1 text-[8px] uppercase tracking-wider text-[#626c67]">{String(label)}</p></div>; })}
      </div>
      <section className={`${PANEL} mt-4 p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626c67]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports by name, type, or status" className="h-10 w-full rounded-lg border border-white/[0.065] bg-[#0b0d0c] pl-9 pr-3 text-xs outline-none placeholder:text-[#59625e] focus:border-[#9cff38]/25" /></div>
          <div className="flex min-w-0 gap-2 sm:min-w-[410px]">
            <div className="relative min-w-0 flex-1"><Filter size={12} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#626c67]" /><SignalSelect value={kind} onChange={setKind} placeholder="Report type" searchable={false} className="min-h-10 rounded-lg pl-8 text-[10px]" options={[{ value: "all", label: "All types" }, { value: "validator", label: "Validation" }, { value: "message_run", label: "Messaging" }, { value: "account_settings", label: "Communication settings" }, { value: "ai_campaign", label: "AI Chatter" }]} /></div>
            <SignalSelect value={status} onChange={setStatus} placeholder="Run status" searchable={false} className="min-h-10 !w-40 shrink-0 rounded-lg text-[10px]" options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "failed", label: "Failed" }]} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["24h", "7d", "30d", "all"] as Preset[]).map((item) => <button key={item} onClick={() => { setPreset(item); setCustomOpen(false); void load(item); }} className={`rounded-lg border px-3 py-2 text-[9px] ${preset === item ? "border-[#9cff38]/25 bg-[#9cff38]/[0.07] text-[#9cff38]" : "border-white/[0.06] text-[#737d78]"}`}>{item === "24h" ? "24 hours" : item === "7d" ? "Week" : item === "30d" ? "Month" : "All time"}</button>)}
          <button onClick={() => setCustomOpen(true)} className={`rounded-lg border px-3 py-2 text-[9px] ${preset === "custom" ? "border-[#9cff38]/25 bg-[#9cff38]/[0.07] text-[#9cff38]" : "border-white/[0.06] text-[#737d78]"}`}>Custom date</button>
          <span className="ml-auto self-center text-[9px] text-[#626c67]">{visible.length} of {data.runs.length} runs</span>
        </div>
      </section>
      <section className={`${PANEL} mt-4 overflow-hidden`}>
        <div className="hidden grid-cols-[115px_1fr_110px_90px_90px_140px_70px] border-b border-white/[0.055] px-4 py-3 text-[8px] uppercase tracking-wider text-[#626c67] lg:grid"><span>Type</span><span>Run</span><span>Status</span><span>Succeeded</span><span>Failed</span><span>Date</span><span /></div>
        <div className="divide-y divide-white/[0.045]">{visible.map((run) => <button key={`${run.kind}:${run.id}`} onClick={() => void inspect(run)} className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-white/[0.025] lg:grid-cols-[115px_1fr_110px_90px_90px_140px_70px] lg:items-center"><span className="flex items-center gap-2 text-[9px] text-[#858f8a]"><RunIcon kind={run.kind} /> {kindLabel(run.kind)}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#d0d6d3]">{run.name}</span><span className="mt-1 block truncate text-[9px] text-[#626c67]">{run.output} · {run.total.toLocaleString()} total</span></span><span className={`w-fit rounded-full border px-2 py-1 text-[8px] uppercase tracking-wider ${statusColor(run.status)}`}>{run.status.replaceAll("_", " ")}</span><span className="font-mono text-xs text-[#9cff38]">{run.succeeded.toLocaleString()}</span><span className="font-mono text-xs text-[#ff8585]">{run.failed.toLocaleString()}</span><span className="text-[9px] text-[#737d78]">{new Date(run.createdAt).toLocaleString()}</span><span className="text-[9px] font-medium text-[#9cff38]">Inspect</span></button>)}</div>
        {!visible.length && <p className="p-16 text-center text-xs text-[#626c67]">No reports match these filters.</p>}
      </section>
      {customOpen && <CustomDates from={customFrom} to={customTo} setFrom={setCustomFrom} setTo={setCustomTo} close={() => setCustomOpen(false)} apply={() => { setPreset("custom"); setCustomOpen(false); void load("custom"); }} />}
      {selected && <ReportInspection run={selected} detail={detail} loading={detailLoading} close={() => { setSelected(null); setDetail(null); }} />}
    </div>
  );
}

function CustomDates({ from, to, setFrom, setTo, close, apply }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void; close: () => void; apply: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111411] p-5"><div className="flex items-start"><div className="flex-1"><h3 className="font-semibold">Custom report range</h3><p className="mt-1 text-[9px] text-[#737d78]">Filter the ledger and complete ZIP export.</p></div><button onClick={close}><X size={15} /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-[8px] uppercase tracking-wider text-[#626c67]">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.07] bg-[#0b0d0c] p-3 text-xs outline-none" /></label><label className="text-[8px] uppercase tracking-wider text-[#626c67]">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.07] bg-[#0b0d0c] p-3 text-xs outline-none" /></label></div><button disabled={!from || !to} onClick={apply} className="mt-5 w-full rounded-lg bg-[#9cff38] py-2.5 text-xs font-bold text-[#0a0d09] disabled:opacity-40">Apply date range</button></section></div>;
}

function ReportInspection({ run, detail, loading, close }: { run: Run; detail: Record<string, unknown> | null; loading: boolean; close: () => void }) {
  const source = detail || {};
  const record = (source.job || source.campaign || source.batch || source) as Record<string, unknown>;
  const rows = (source.recipients || source.conversations || record.jobs || record.recentItems) as Array<Record<string, unknown>> | undefined;
  const primitive = Object.entries(record).filter(([key, value]) => !["secretEncrypted", "catalog", "config", "accountId"].includes(key) && (value == null || ["string", "number", "boolean"].includes(typeof value))).slice(0, 30);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"><section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111411]"><div className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/[0.055] bg-[#111411]/95 p-5 backdrop-blur"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#9cff38]/10 text-[#9cff38]"><RunIcon kind={run.kind} /></span><div className="min-w-0 flex-1"><p className="text-[8px] uppercase tracking-wider text-[#79a451]">{kindLabel(run.kind)}</p><h3 className="mt-1 truncate text-lg font-semibold">{run.name}</h3><p className="mt-1 text-[9px] text-[#626c67]">{run.output}</p></div><button onClick={close} className="rounded-lg border border-white/[0.06] p-2 text-[#737d78]"><X size={15} /></button></div>{loading ? <div className="flex min-h-80 items-center justify-center"><Loader2 size={22} className="animate-spin text-[#9cff38]" /></div> : <div className="p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Status", run.status], ["Total", run.total], ["Succeeded", run.succeeded], ["Failed", run.failed], ["Skipped", run.skipped], [run.secondaryLabel, run.secondary], ["Requests / jobs", run.requests], ["Created", new Date(run.createdAt).toLocaleString()]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3"><p className="text-[8px] uppercase tracking-wider text-[#626c67]">{String(label)}</p><p className="mt-2 break-words text-xs font-medium capitalize text-[#c7ceca]">{String(value)}</p></div>)}</div>{run.error || source.error ? <p className="mt-4 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.05] p-3 text-xs text-[#ff9292]">{String(run.error || source.error)}</p> : null}<section className="mt-5 rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-4"><h4 className="text-xs font-semibold">Complete run metadata</h4><div className="mt-3 grid gap-x-5 sm:grid-cols-2">{primitive.map(([key, value]) => <div key={key} className="flex gap-3 border-b border-white/[0.04] py-2 text-[9px]"><span className="w-32 shrink-0 capitalize text-[#626c67]">{key.replace(/([A-Z])/g, " $1")}</span><span className="break-all text-[#aeb7b2]">{String(value ?? "-")}</span></div>)}</div></section>{rows?.length ? <section className="mt-5"><div className="flex justify-between"><h4 className="text-xs font-semibold">Detailed rows</h4><span className="text-[8px] text-[#626c67]">Showing {Math.min(rows.length, 100)} rows</span></div><div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{rows.slice(0, 100).map((row, index) => <div key={String(row.id || index)} className="rounded-lg border border-white/[0.05] bg-[#0b0d0c] p-3"><div className="flex items-center gap-3"><p className="min-w-0 flex-1 truncate text-[10px] text-[#c3cbc7]">{String(row.targetInput || row.username || row.recipientName || row.sessionLabel || row.id || `Row ${index + 1}`)}</p><span className="text-[9px] capitalize text-[#9cff38]">{String(row.status || row.conversationState || "recorded").replaceAll("_", " ")}</span></div>{row.errorMessage ? <p className="mt-2 text-[9px] text-[#ff8585]">{String(row.errorMessage)}</p> : null}</div>)}</div></section> : null}</div>}</section></div>;
}
