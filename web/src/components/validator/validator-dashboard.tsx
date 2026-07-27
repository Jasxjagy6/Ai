"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageCircleMore,
  MoreVertical,
  X,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type Destination =
  | "lists"
  | "history"
  | "sessions"
  | "ai-chatter"
  | "messaging"
  | "reports";

type StatsData = {
  range: { preset: string; from: string; to: string };
  totalJobs: number;
  totalValid: number;
  totalInvalid: number;
  totalFailed: number;
  totalProcessed: number;
  totalRequests: number;
  successRate: number;
  completedRuns: number;
  byStatus: Record<string, number>;
  lists: { total: number; totalItems: number; byType: Record<string, number> };
  credits: {
    balance: number;
    purchased: number;
    spent: number;
    usagePercent: number;
    daily: Array<{ date: string; credits: number }>;
  };
  sessions: {
    total: number;
    active: number;
    inactive: number;
    clean: number;
    messagesSent: number;
    repliesReceived: number;
  };
  messaging: {
    runs: number;
    sent: number;
    failed: number;
    replied: number;
    targets: number;
    successRate: number;
    byStatus: Record<string, number>;
    daily: Array<{ date: string; runs: number; sent: number; failed: number; replied: number }>;
  };
  recentActivity: Array<{
    id: string;
    kind: "validator" | "message_run" | "account_settings" | "ai_campaign";
    name: string;
    status: string;
    succeeded: number;
    failed: number;
    total: number;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

const CARD = "rounded-xl border border-white/[0.065] bg-[#111311]";

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

function nameFromEmail(email: string) {
  const name = email.split("@")[0] || "operator";
  return name.length > 18 ? `${name.slice(0, 18)}...` : name;
}

function compactDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusColor(status: string) {
  if (["completed", "sent", "active"].includes(status)) return "#9cff38";
  if (["pending", "running", "processing", "starting"].includes(status)) return "#f7c948";
  if (["failed", "error", "cancelled"].includes(status)) return "#ff5d66";
  return "#83908b";
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  trend?: string;
}) {
  return (
    <article className={`${CARD} flex min-h-[96px] items-center gap-4 p-4 sm:p-5`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#172116] text-[#a8ff45] shadow-[inset_0_0_0_1px_rgba(168,255,69,.09)]">
        <Icon size={20} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[#7f8985]">{label}</p>
        <p className="mt-1 truncate font-mono text-xl font-semibold tracking-[-0.03em] text-[#f3f6f2] sm:text-[22px]">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[9px] text-[#69736f]">
          <span className="truncate">{sub}</span>
          {trend && <span className="shrink-0 text-[#98e85a]">{trend}</span>}
        </div>
      </div>
    </article>
  );
}

function CreditChart({ data, from, to, rangeLabel }: { data: StatsData["credits"]; from: string; to: string; rangeLabel: string }) {
  const start = new Date(from);
  const end = new Date(to);
  const totalDays = Math.max(1, Math.min(60, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1));
  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date,
      credits: data.daily.find((item) => item.date === key)?.credits || 0,
    };
  });
  const max = Math.max(1, ...days.map((day) => day.credits));
  const points = days
    .map((day, index) => {
      const x = (index / Math.max(1, days.length - 1)) * 100;
      const y = 88 - (day.credits / max) * 70;
      return `${x},${y}`;
    })
    .join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((position) => days[Math.round((days.length - 1) * position)]);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - data.usagePercent / 100);

  return (
    <section className={`${CARD} min-w-0 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Credit Usage</h3>
        <span className="rounded-lg border border-white/[0.06] bg-[#151815] px-3 py-2 text-[9px] text-[#8a948f]">{rangeLabel}</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-[#79837f]">Credits used</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{data.spent.toLocaleString()}</p>
          <p className="mt-1 text-[9px] text-[#69736f]">of {data.purchased.toLocaleString()}</p>
        </div>
        <div className="relative h-[92px] w-[92px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#2a2e2b" strokeWidth="7" />
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#8ee83c" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold">{data.usagePercent}%</span>
        </div>
      </div>
      <div className="mt-4 h-[115px] sm:h-[135px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="creditUsageFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9cff38" stopOpacity=".19" />
              <stop offset="1" stopColor="#9cff38" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,100 ${points} 100,100`} fill="url(#creditUsageFill)" />
          <polyline points={points} fill="none" stroke="#8ee83c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {days.map((day, index) => {
            if (!day.credits) return null;
            const x = (index / Math.max(1, days.length - 1)) * 100;
            const y = 88 - (day.credits / max) * 70;
            return <circle key={day.date.toISOString()} cx={x} cy={y} r="1.15" fill="#9cff38" stroke="#121512" strokeWidth=".7" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      </div>
      <div className="flex justify-between text-[8px] text-[#59635f]">
        {ticks.map((tick) => <span key={tick.date.toISOString()}>{tick.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>)}
      </div>
    </section>
  );
}

function RecentRuns({
  runs,
  openHistory,
  inspect,
}: {
  runs: StatsData["recentActivity"];
  openHistory: () => void;
  inspect: (run: StatsData["recentActivity"][number]) => void;
}) {
  return (
    <section className={`${CARD} min-w-0 overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold">Recent Runs</h3>
        <button onClick={openHistory} className="rounded-lg border border-white/[0.06] bg-[#151815] px-3 py-2 text-[9px] text-[#a5aeaa] transition hover:text-white">View all</button>
      </div>
      <div className="hidden grid-cols-[105px_1fr_145px_110px_20px] border-b border-white/[0.05] px-5 py-3 text-[9px] text-[#6f7975] sm:grid">
        <span>Status</span><span>Name</span><span>Time</span><span>Users / DMs</span><span />
      </div>
      <div className="divide-y divide-white/[0.05]">
        {runs.slice(0, 5).map((run) => (
          <button key={`${run.kind}:${run.id}`} onClick={() => inspect(run)} className="grid w-full gap-2 px-4 py-3 text-left text-[10px] transition hover:bg-white/[0.025] sm:grid-cols-[105px_1fr_145px_110px_20px] sm:items-center sm:px-5">
            <span className="flex items-center gap-2 capitalize" style={{ color: statusColor(run.status) }}>
              <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor(run.status) }} />
              {run.status.replaceAll("_", " ")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[#c9cfcc]">{run.name}</p>
              <p className="mt-1 text-[8px] uppercase tracking-wider text-[#58625e] sm:hidden">{run.kind.replaceAll("_", " ")}</p>
            </div>
            <span className="text-[#727c78]">{compactDate(run.createdAt)}</span>
            <span className="text-[#aeb6b2]">{run.total ? `${run.total.toLocaleString()} ${run.kind === "message_run" ? "DMs" : run.kind === "validator" ? "users" : "accounts"}` : "-"}</span>
            <MoreVertical size={13} className="hidden text-[#606a66] sm:block" />
            <span className="text-[9px] font-medium text-[#9cff38] sm:hidden">Inspect run</span>
          </button>
        ))}
        {!runs.length && <p className="p-10 text-center text-[10px] text-[#5f6965]">No runs recorded yet.</p>}
      </div>
    </section>
  );
}

export function ValidatorDashboard({
  account,
  onNavigate,
}: {
  account: { email: string; creditsBalance: number };
  onNavigate: (destination: Destination) => void;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "custom">("30d");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [inspection, setInspection] = useState<{ run: StatsData["recentActivity"][number]; detail: Record<string, unknown> | null } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  function statsUrl(nextRange = range) {
    const query = new URLSearchParams({ range: nextRange });
    if (nextRange === "custom") {
      query.set("from", customFrom);
      query.set("to", customTo);
    }
    return `/api/validator/stats?${query}`;
  }

  function load(nextRange = range) {
    setLoading(true);
    return request<StatsData>(statsUrl(nextRange))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      request<StatsData>("/api/validator/stats?range=30d")
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function inspectRun(run: StatsData["recentActivity"][number]) {
    setInspection({ run, detail: null });
    setInspectLoading(true);
    const endpoint = run.kind === "validator"
      ? `/api/validator/jobs/${run.id}`
      : run.kind === "message_run"
        ? `/api/validator/telegram/campaigns/${run.id}`
        : run.kind === "account_settings"
          ? `/api/validator/account-settings/batches/${run.id}`
          : `/api/validator/ai-chatter/campaigns/${run.id}`;
    try {
      const result = await request<Record<string, unknown>>(endpoint);
      setInspection({ run, detail: result });
    } catch (error) {
      setInspection({ run, detail: { error: error instanceof Error ? error.message : "Run inspection failed" } });
    } finally {
      setInspectLoading(false);
    }
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#9cff38]" /></div>;
  if (!data) return <div className="flex min-h-[65vh] items-center justify-center text-sm text-[#707a76]">Could not load dashboard</div>;

  const quickActions: Array<{ label: string; destination: Destination; icon: React.ElementType }> = [
    { label: "Lists & Validation", destination: "lists", icon: ShieldCheck },
    { label: "Telegram Sessions", destination: "sessions", icon: Smartphone },
    { label: "AI Chatter", destination: "ai-chatter", icon: MessageCircleMore },
    { label: "Messaging", destination: "messaging", icon: Send },
    { label: "Reports", destination: "reports", icon: ListChecks },
  ];
  const messageTrend = data.messaging.sent ? `${data.messaging.successRate}% delivered` : undefined;
  const rangeLabel = range === "24h" ? "Last 24 hours" : range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Custom range";

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#f1f4f0] sm:text-2xl">Welcome back, {nameFromEmail(account.email)} <span className="text-lg">&#128075;</span></h2>
          <p className="mt-1 text-[11px] text-[#747e7a]">Here&apos;s what&apos;s happening with your workspace today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/[0.07] bg-[#111311] p-1">
            {(["24h", "7d", "30d"] as const).map((preset) => (
              <button key={preset} onClick={() => { setRange(preset); setCustomOpen(false); void load(preset); }} className={`rounded-md px-2.5 py-1.5 text-[9px] transition ${range === preset ? "bg-[#9cff38] font-semibold text-[#0a0d09]" : "text-[#818b86] hover:text-white"}`}>{preset === "24h" ? "24 hours" : preset === "7d" ? "Week" : "Month"}</button>
            ))}
            <button onClick={() => setCustomOpen(true)} className={`rounded-md px-2.5 py-1.5 text-[9px] transition ${range === "custom" ? "bg-[#9cff38] font-semibold text-[#0a0d09]" : "text-[#818b86] hover:text-white"}`}>Custom</button>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-lg border border-white/[0.07] bg-[#111311] px-3 py-2.5 text-[10px] text-[#b5bcb9]">
            <CalendarDays size={13} /> {new Date(data.range.to).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Credits" value={account.creditsBalance} sub="Available credits" icon={Coins} />
        <SummaryCard label="DMs Sent" value={data.sessions.messagesSent} sub="Across your accounts" icon={Send} trend={messageTrend} />
        <SummaryCard label="Runs Completed" value={data.completedRuns} sub="All workspace runs" icon={CheckCircle2} trend={`${data.successRate}% valid`} />
        <SummaryCard label="Active Workspaces" value={data.lists.total} sub={`${data.lists.totalItems.toLocaleString()} imported rows`} icon={LayoutDashboard} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <RecentRuns runs={data.recentActivity} openHistory={() => onNavigate("history")} inspect={inspectRun} />
        <CreditChart data={data.credits} from={data.range.from} to={data.range.to} rangeLabel={rangeLabel} />
      </div>

      <section className={`${CARD} mt-4 p-4 sm:p-5`}>
        <h3 className="text-sm font-semibold">Quick Actions</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {quickActions.map(({ label, destination, icon: Icon }) => (
            <button key={destination} onClick={() => onNavigate(destination)} className="group flex min-h-[72px] items-center gap-3 rounded-lg border border-white/[0.055] bg-[#121512] px-3 text-left transition hover:border-[#9cff38]/20 hover:bg-[#151a14]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#192218] text-[#9cff38]"><Icon size={17} /></span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-[#c2c9c5]">{label}</span>
              <ArrowRight size={13} className="shrink-0 text-[#68736e] transition group-hover:translate-x-0.5 group-hover:text-[#9cff38]" />
            </button>
          ))}
        </div>
      </section>
      <p className="py-5 text-center text-[9px] text-[#4e5753]">&copy; {new Date().getFullYear()} Signal Desk. All rights reserved.</p>
      {customOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111411] p-5 shadow-2xl">
            <div className="flex items-start gap-3"><div className="flex-1"><h3 className="font-semibold">Custom dashboard range</h3><p className="mt-1 text-[10px] text-[#747e79]">Every dashboard metric and run row will use this period.</p></div><button onClick={() => setCustomOpen(false)} className="p-1 text-[#747e79]"><X size={15} /></button></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-[9px] uppercase tracking-wider text-[#747e79]">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#0b0d0c] px-3 py-2.5 text-xs text-white outline-none" /></label><label className="text-[9px] uppercase tracking-wider text-[#747e79]">To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#0b0d0c] px-3 py-2.5 text-xs text-white outline-none" /></label></div>
            <button disabled={!customFrom || !customTo} onClick={() => { setRange("custom"); setCustomOpen(false); void load("custom"); }} className="mt-5 w-full rounded-lg bg-[#9cff38] py-2.5 text-xs font-bold text-[#0a0d09] disabled:opacity-40">Apply date range</button>
          </section>
        </div>
      )}
      {inspection && (
        <RunInspection inspection={inspection} loading={inspectLoading} close={() => setInspection(null)} />
      )}
    </div>
  );
}

function RunInspection({ inspection, loading, close }: { inspection: { run: StatsData["recentActivity"][number]; detail: Record<string, unknown> | null }; loading: boolean; close: () => void }) {
  const source = inspection.detail || {};
  const detail = (source.job || source.campaign || source.batch || source) as Record<string, unknown>;
  const metrics = [
    ["Status", detail.status || inspection.run.status],
    ["Total", detail.totalCount ?? inspection.run.total],
    ["Succeeded", detail.validCount ?? detail.sentCount ?? detail.succeededCount ?? detail.messagesSent ?? inspection.run.succeeded],
    ["Failed", detail.failedCount ?? inspection.run.failed],
    ["Created", detail.createdAt ? new Date(String(detail.createdAt)).toLocaleString() : compactDate(inspection.run.createdAt)],
    ["Finished", detail.finishedAt || detail.stoppedAt ? new Date(String(detail.finishedAt || detail.stoppedAt)).toLocaleString() : "Not finished"],
  ];
  const rows = (source.recipients || source.conversations || detail.jobs || detail.recentItems) as Array<Record<string, unknown>> | undefined;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111411] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/[0.06] bg-[#111411]/95 p-5 backdrop-blur"><div className="flex-1"><p className="text-[8px] uppercase tracking-[0.16em] text-[#9cff38]">{inspection.run.kind.replaceAll("_", " ")} inspection</p><h3 className="mt-1 text-lg font-semibold">{inspection.run.name}</h3></div><button onClick={close} className="rounded-lg border border-white/[0.07] p-2 text-[#747e79] hover:text-white"><X size={15} /></button></div>
        {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 size={22} className="animate-spin text-[#9cff38]" /></div> : (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{metrics.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/[0.06] bg-[#0b0d0c] p-3"><p className="text-[8px] uppercase tracking-wider text-[#626c67]">{String(label)}</p><p className="mt-2 break-words text-xs font-medium capitalize text-[#d0d6d3]">{String(value ?? "-")}</p></div>)}</div>
            {detail.errorMessage || source.error ? <p className="mt-4 rounded-xl border border-[#ff5d66]/20 bg-[#ff5d66]/[0.06] p-3 text-xs text-[#ff8f95]">{String(detail.errorMessage || source.error)}</p> : null}
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0b0d0c] p-4"><h4 className="text-xs font-semibold">Run details</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(detail).filter(([key, value]) => value == null || ["string", "number", "boolean"].includes(typeof value) && !["id", "accountId", "secretEncrypted"].includes(key)).slice(0, 20).map(([key, value]) => <div key={key} className="flex gap-3 border-b border-white/[0.04] py-2 text-[10px]"><span className="w-36 shrink-0 capitalize text-[#626c67]">{key.replace(/([A-Z])/g, " $1")}</span><span className="min-w-0 break-all text-[#aeb7b2]">{String(value ?? "-")}</span></div>)}</div></div>
            {rows?.length ? <div className="mt-5"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold">Result rows</h4><span className="text-[9px] text-[#626c67]">First {Math.min(rows.length, 20)} shown</span></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{rows.slice(0, 20).map((row, index) => <div key={String(row.id || index)} className="rounded-lg border border-white/[0.05] bg-[#0b0d0c] p-3 text-[10px]"><div className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-[#c4ccc8]">{String(row.targetInput || row.username || row.recipientName || row.sessionLabel || row.id || `Row ${index + 1}`)}</span><span className="capitalize text-[#9cff38]">{String(row.status || row.conversationState || "recorded").replaceAll("_", " ")}</span></div>{row.errorMessage ? <p className="mt-2 text-[#ff838a]">{String(row.errorMessage)}</p> : null}</div>)}</div></div> : null}
          </div>
        )}
      </section>
    </div>
  );
}
