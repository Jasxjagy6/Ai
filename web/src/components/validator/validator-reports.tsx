"use client";

import { useDeferredValue, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Filter,
  Loader2,
  MessageCircleMore,
  Radar,
  RefreshCw,
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
type MessagingCampaign = {
  id: string;
  name: string;
  targetType: string;
  mode: string;
  message: string;
  parseMode: string;
  status: string;
  totalCount: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  repliedCount: number;
  sessionCount: number;
  trackReplies: boolean;
  replyWindowHours: number;
  replyTrackingStatus: string;
  replyTrackingUntil: string | null;
  replyTrackingLastScanAt: string | null;
  currentTarget: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastProgressAt: string;
  scheduleId: string | null;
  schedule: { id: string; name: string; intervalMinutes: number } | null;
  configuration: Record<string, unknown> | null;
  progressPct: number;
};
type MessagingRecipient = {
  id: string;
  sessionId: string | null;
  targetInput: string;
  username: string | null;
  telegramId: string | null;
  phone: string | null;
  displayName: string | null;
  status: string;
  attempts: number;
  messageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  replied: boolean;
  repliedAt: string | null;
  replyMessageId: string | null;
  replyPreview: string | null;
  lastCheckedAt: string | null;
  session: {
    label: string;
    username: string | null;
    phone: string | null;
  } | null;
};
type MessagingSession = {
  sessionId: string;
  assignedCount: number;
  recipientCount: number;
  attemptCount: number;
  sentCount: number;
  failedCount: number;
  repliedCount: number;
  status: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  session: { label: string; username: string | null; phone: string | null };
};
type MessagingDetail = {
  campaign: MessagingCampaign;
  recipients: MessagingRecipient[];
  sessions: MessagingSession[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const PANEL = "rounded-2xl border border-white/[0.065] bg-[#111311]";
const ACTIVE = new Set([
  "pending",
  "running",
  "processing",
  "starting",
  "subscription_paused",
  "paused_subscription",
]);

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

function statusColor(status: string) {
  if (["completed", "sent", "stopped", "expired"].includes(status))
    return "text-[#9cff38] border-[#9cff38]/20 bg-[#9cff38]/[0.05]";
  if (ACTIVE.has(status))
    return "text-[#f7c948] border-[#f7c948]/20 bg-[#f7c948]/[0.05]";
  if (["failed", "error"].includes(status))
    return "text-[#ff7474] border-[#ff7474]/20 bg-[#ff7474]/[0.05]";
  return "text-[#8b9590] border-white/[0.07] bg-white/[0.025]";
}

function kindLabel(kind: Run["kind"]) {
  return kind === "validator"
    ? "Validation"
    : kind === "message_run"
      ? "Messaging"
      : kind === "account_settings"
        ? "Communication settings"
        : "AI Chatter";
}

function RunIcon({ kind }: { kind: Run["kind"] }) {
  const Icon =
    kind === "validator"
      ? Radar
      : kind === "message_run"
        ? Send
        : kind === "account_settings"
          ? Settings
          : Bot;
  return <Icon size={15} />;
}

function dateQuery(preset: Preset, customFrom: string, customTo: string) {
  if (preset === "all") return "";
  const to =
    customTo && preset === "custom"
      ? new Date(`${customTo}T23:59:59.999`)
      : new Date();
  const from =
    preset === "custom"
      ? new Date(`${customFrom}T00:00:00.000`)
      : new Date(
          to.getTime() -
            (preset === "24h"
              ? 86_400_000
              : preset === "7d"
                ? 7 * 86_400_000
                : 30 * 86_400_000),
        );
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()))
    return "";
  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  }).toString();
}

export function ValidatorReports({
  notify,
}: {
  notify: (message: string, tone?: Tone) => void;
}) {
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
      setData(
        await request<ReportData>(
          `/api/validator/reports?${query(nextPreset)}`,
        ),
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Reports failed to load",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      request<ReportData>(`/api/validator/reports?${dateQuery("30d", "", "")}`)
        .then(setData)
        .catch((error) =>
          notify(
            error instanceof Error ? error.message : "Reports failed to load",
            "error",
          ),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function inspect(run: Run) {
    setSelected(run);
    setDetail(null);
    setDetailLoading(true);
    const endpoint =
      run.kind === "validator"
        ? `/api/validator/jobs/${run.id}`
        : run.kind === "message_run"
          ? `/api/validator/telegram/campaigns/${run.id}`
          : run.kind === "account_settings"
            ? `/api/validator/account-settings/batches/${run.id}`
            : `/api/validator/ai-chatter/campaigns/${run.id}`;
    try {
      setDetail(await request<Record<string, unknown>>(endpoint));
    } catch (error) {
      setDetail({
        error: error instanceof Error ? error.message : "Inspection failed",
      });
    } finally {
      setDetailLoading(false);
    }
  }

  const visible = (data?.runs || []).filter((run) => {
    if (kind !== "all" && run.kind !== kind) return false;
    if (status === "active" && !ACTIVE.has(run.status)) return false;
    if (
      status === "completed" &&
      !["completed", "stopped", "expired"].includes(run.status)
    )
      return false;
    if (
      status === "failed" &&
      !["failed", "error"].includes(run.status)
    )
      return false;
    return (
      !deferredSearch ||
      `${run.name} ${run.output} ${run.kind} ${run.status}`
        .toLowerCase()
        .includes(deferredSearch)
    );
  });
  const exportUrl = `/api/validator/reports/export?${query()}`;

  if (loading && !data)
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#9cff38]" />
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-[65vh] items-center justify-center text-sm text-[#737d78]">
        No report data available.
      </div>
    );

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#9cff38]">
            Workspace intelligence
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Every run. Every result. One ledger.
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#737d78]">
            Validation, Telegram messaging, profile operations, and AI
            automation with drill-down evidence and organized exports.
          </p>
        </div>
        <a
          href={exportUrl}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#9cff38] px-4 py-2.5 text-xs font-bold text-[#0a0d09]"
        >
          <FileArchive size={14} /> Download complete ZIP
        </a>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["All runs", data.summary.runs, Activity],
          ["Active", data.summary.active, Loader2],
          ["Completed", data.summary.completed, CheckCircle2],
          ["Failed runs", data.summary.failed, XCircle],
          ["Successful rows", data.summary.succeeded, MessageCircleMore],
          ["Failed rows", data.summary.errors, XCircle],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Activity;
          return (
            <div key={String(label)} className={`${PANEL} p-4`}>
              <MetricIcon size={14} className="text-[#9cff38]" />
              <p className="mt-4 font-mono text-xl font-semibold">
                {Number(value).toLocaleString()}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-wider text-[#626c67]">
                {String(label)}
              </p>
            </div>
          );
        })}
      </div>
      <section className={`${PANEL} mt-4 p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626c67]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports by name, type, or status"
              className="h-10 w-full rounded-lg border border-white/[0.065] bg-[#0b0d0c] pl-9 pr-3 text-xs outline-none placeholder:text-[#59625e] focus:border-[#9cff38]/25"
            />
          </div>
          <div className="flex min-w-0 gap-2 sm:min-w-[410px]">
            <div className="relative min-w-0 flex-1">
              <Filter
                size={12}
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#626c67]"
              />
              <SignalSelect
                value={kind}
                onChange={setKind}
                placeholder="Report type"
                searchable={false}
                className="min-h-10 rounded-lg pl-8 text-[10px]"
                options={[
                  { value: "all", label: "All types" },
                  { value: "validator", label: "Validation" },
                  { value: "message_run", label: "Messaging" },
                  {
                    value: "account_settings",
                    label: "Communication settings",
                  },
                  { value: "ai_campaign", label: "AI Chatter" },
                ]}
              />
            </div>
            <SignalSelect
              value={status}
              onChange={setStatus}
              placeholder="Run status"
              searchable={false}
              className="min-h-10 !w-40 shrink-0 rounded-lg text-[10px]"
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "failed", label: "Failed" },
              ]}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["24h", "7d", "30d", "all"] as Preset[]).map((item) => (
            <button
              key={item}
              onClick={() => {
                setPreset(item);
                setCustomOpen(false);
                void load(item);
              }}
              className={`rounded-lg border px-3 py-2 text-[9px] ${preset === item ? "border-[#9cff38]/25 bg-[#9cff38]/[0.07] text-[#9cff38]" : "border-white/[0.06] text-[#737d78]"}`}
            >
              {item === "24h"
                ? "24 hours"
                : item === "7d"
                  ? "Week"
                  : item === "30d"
                    ? "Month"
                    : "All time"}
            </button>
          ))}
          <button
            onClick={() => setCustomOpen(true)}
            className={`rounded-lg border px-3 py-2 text-[9px] ${preset === "custom" ? "border-[#9cff38]/25 bg-[#9cff38]/[0.07] text-[#9cff38]" : "border-white/[0.06] text-[#737d78]"}`}
          >
            Custom date
          </button>
          <span className="ml-auto self-center text-[9px] text-[#626c67]">
            {visible.length} of {data.runs.length} runs
          </span>
        </div>
      </section>
      <section className={`${PANEL} mt-4 overflow-hidden`}>
        <div className="hidden grid-cols-[115px_1fr_110px_90px_90px_140px_70px] border-b border-white/[0.055] px-4 py-3 text-[8px] uppercase tracking-wider text-[#626c67] lg:grid">
          <span>Type</span>
          <span>Run</span>
          <span>Status</span>
          <span>Succeeded</span>
          <span>Failed</span>
          <span>Date</span>
          <span />
        </div>
        <div className="divide-y divide-white/[0.045]">
          {visible.map((run) => (
            <button
              key={`${run.kind}:${run.id}`}
              onClick={() => void inspect(run)}
              className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-white/[0.025] lg:grid-cols-[115px_1fr_110px_90px_90px_140px_70px] lg:items-center"
            >
              <span className="flex items-center gap-2 text-[9px] text-[#858f8a]">
                <RunIcon kind={run.kind} /> {kindLabel(run.kind)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#d0d6d3]">
                  {run.name}
                </span>
                <span className="mt-1 block truncate text-[9px] text-[#626c67]">
                  {run.output} · {run.total.toLocaleString()} total
                </span>
              </span>
              <span
                className={`w-fit rounded-full border px-2 py-1 text-[8px] uppercase tracking-wider ${statusColor(run.status)}`}
              >
                {run.status.replaceAll("_", " ")}
              </span>
              <span className="font-mono text-xs text-[#9cff38]">
                {run.succeeded.toLocaleString()}
              </span>
              <span className="font-mono text-xs text-[#ff8585]">
                {run.failed.toLocaleString()}
              </span>
              <span className="text-[9px] text-[#737d78]">
                {new Date(run.createdAt).toLocaleString()}
              </span>
              <span className="text-[9px] font-medium text-[#9cff38]">
                Inspect
              </span>
            </button>
          ))}
        </div>
        {!visible.length && (
          <p className="p-16 text-center text-xs text-[#626c67]">
            No reports match these filters.
          </p>
        )}
      </section>
      {customOpen && (
        <CustomDates
          from={customFrom}
          to={customTo}
          setFrom={setCustomFrom}
          setTo={setCustomTo}
          close={() => setCustomOpen(false)}
          apply={() => {
            setPreset("custom");
            setCustomOpen(false);
            void load("custom");
          }}
        />
      )}
      {selected && (
        <ReportInspection
          run={selected}
          detail={detail}
          loading={detailLoading}
          close={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

function CustomDates({
  from,
  to,
  setFrom,
  setTo,
  close,
  apply,
}: {
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  close: () => void;
  apply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111411] p-5">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="font-semibold">Custom report range</h3>
            <p className="mt-1 text-[9px] text-[#737d78]">
              Filter the ledger and complete ZIP export.
            </p>
          </div>
          <button onClick={close}>
            <X size={15} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-[8px] uppercase tracking-wider text-[#626c67]">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/[0.07] bg-[#0b0d0c] p-3 text-xs outline-none"
            />
          </label>
          <label className="text-[8px] uppercase tracking-wider text-[#626c67]">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/[0.07] bg-[#0b0d0c] p-3 text-xs outline-none"
            />
          </label>
        </div>
        <button
          disabled={!from || !to}
          onClick={apply}
          className="mt-5 w-full rounded-lg bg-[#9cff38] py-2.5 text-xs font-bold text-[#0a0d09] disabled:opacity-40"
        >
          Apply date range
        </button>
      </section>
    </div>
  );
}

function MessagingInspection({
  run,
  initial,
  close,
}: {
  run: Run;
  initial: Record<string, unknown> | null;
  close: () => void;
}) {
  const [detail, setDetail] = useState<MessagingDetail | null>(
    initial as MessagingDetail | null,
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reply, setReply] = useState("all");
  const [sessionId, setSessionId] = useState("all");
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const params = new URLSearchParams({ page: String(page), pageSize: "100" });
  if (deferredSearch) params.set("search", deferredSearch);
  if (status !== "all") params.set("status", status);
  if (reply !== "all") params.set("reply", reply);
  if (sessionId !== "all") params.set("sessionId", sessionId);
  const detailUrl = `/api/validator/telegram/campaigns/${run.id}?${params}`;

  async function load(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      setDetail(await request<MessagingDetail>(detailUrl));
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Messaging report failed to load",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 250);
    return () => window.clearTimeout(timer);
  }, [detailUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const live =
    detail &&
    (["pending", "running"].includes(detail.campaign.status) ||
      detail.campaign.replyTrackingStatus === "tracking");
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void load(true), 2500);
    return () => window.clearInterval(timer);
  }, [detailUrl, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const campaign = detail?.campaign;
  const configuration = campaign?.configuration || {};
  const sessionOptions = [
    { value: "all", label: "All sending accounts" },
    ...(detail?.sessions || []).map((item) => ({
      value: item.sessionId,
      label: item.session.label,
    })),
  ];
  const pageStart = detail?.pagination.total
    ? (detail.pagination.page - 1) * detail.pagination.pageSize + 1
    : 0;
  const pageEnd = detail
    ? Math.min(
        detail.pagination.total,
        detail.pagination.page * detail.pagination.pageSize,
      )
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-5">
      <section className="flex max-h-[96vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111411]">
        <header className="flex shrink-0 items-start gap-3 border-b border-white/[0.055] bg-[#111411]/95 p-4 backdrop-blur sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#9cff38]/10 text-[#9cff38]">
            <Send size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#9cff38]">
              Messaging evidence ledger
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold">
              {campaign?.name || run.name}
            </h3>
            <p className="mt-1 text-[9px] text-[#737d78]">
              Every delivery attempt, sending account, Telegram message ID,
              failure, and tracked reply.
            </p>
          </div>
          <a
            href={`/api/validator/telegram/campaigns/${run.id}/export`}
            className="hidden items-center gap-2 rounded-lg border border-[#9cff38]/20 bg-[#9cff38]/[0.06] px-3 py-2 text-[9px] font-semibold text-[#9cff38] sm:flex"
          >
            <Download size={13} /> CSV
          </a>
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="rounded-lg border border-white/[0.06] p-2 text-[#737d78] disabled:opacity-40"
            title="Refresh messaging report"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={close}
            className="rounded-lg border border-white/[0.06] p-2 text-[#737d78]"
          >
            <X size={15} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {loading && !detail ? (
            <div className="flex min-h-80 items-center justify-center">
              <Loader2 size={22} className="animate-spin text-[#9cff38]" />
            </div>
          ) : campaign && detail ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                {[
                  ["Status", campaign.status],
                  ["Attempts", campaign.totalCount],
                  ["Sent", campaign.sentCount],
                  ["Failed", campaign.failedCount],
                  ["Replies", campaign.repliedCount],
                  ["Progress", `${campaign.progressPct}%`],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3"
                  >
                    <p className="text-[8px] uppercase tracking-wider text-[#626c67]">
                      {String(label)}
                    </p>
                    <p
                      className={`mt-2 break-words font-mono text-sm font-semibold ${label === "Sent" ? "text-[#9cff38]" : label === "Failed" ? "text-[#ff8585]" : label === "Replies" ? "text-[#65e6ff]" : "text-[#d0d6d3]"}`}
                    >
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
              {campaign.errorMessage || error ? (
                <p className="mt-3 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.05] p-3 text-xs text-[#ff9292]">
                  {campaign.errorMessage || error}
                </p>
              ) : null}
              <section className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_.7fr]">
                <div className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[8px] uppercase ${statusColor(campaign.status)}`}
                    >
                      {campaign.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-[#8b9590]">
                      {campaign.targetType} / {campaign.mode}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-[#8b9590]">
                      {campaign.schedule
                        ? `Scheduled every ${campaign.schedule.intervalMinutes}m`
                        : "Immediate"}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[#c7ceca]">
                    {campaign.message}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-4 text-[9px] leading-5 text-[#8b9590]">
                  <p>
                    <span className="text-[#626c67]">Format:</span>{" "}
                    {campaign.parseMode}
                  </p>
                  <p>
                    <span className="text-[#626c67]">Pacing:</span>{" "}
                    {String(configuration.pacingMode || "auto")} /{" "}
                    {String(configuration.minDelaySeconds ?? 3)}-
                    {String(configuration.maxDelaySeconds ?? 8)}s delay
                  </p>
                  <p>
                    <span className="text-[#626c67]">Reply tracking:</span>{" "}
                    {campaign.replyTrackingStatus}
                    {campaign.replyTrackingUntil
                      ? ` until ${new Date(campaign.replyTrackingUntil).toLocaleString()}`
                      : ""}
                  </p>
                  <p>
                    <span className="text-[#626c67]">Last reply scan:</span>{" "}
                    {campaign.replyTrackingLastScanAt
                      ? new Date(
                          campaign.replyTrackingLastScanAt,
                        ).toLocaleString()
                      : "Not scanned"}
                  </p>
                  <p>
                    <span className="text-[#626c67]">Created:</span>{" "}
                    {new Date(campaign.createdAt).toLocaleString()}
                  </p>
                </div>
              </section>
              <section className="mt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Sending accounts</h4>
                  <p className="text-[8px] uppercase tracking-wider text-[#626c67]">
                    Confirmed durable totals
                  </p>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {detail.sessions.map((item) => (
                    <article
                      key={item.sessionId}
                      className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {item.session.label}
                          </p>
                          <p className="mt-1 truncate font-mono text-[9px] text-[#626c67]">
                            {item.session.username
                              ? `@${item.session.username}`
                              : item.session.phone || item.sessionId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[8px] uppercase ${statusColor(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                        <SessionMetric
                          label="Planned"
                          value={item.assignedCount}
                        />
                        <SessionMetric
                          label="Final rows"
                          value={item.recipientCount}
                        />
                        <SessionMetric
                          label="Sent"
                          value={item.sentCount}
                          tone="success"
                        />
                        <SessionMetric
                          label="Final fail"
                          value={item.failedCount}
                          tone="error"
                        />
                        <SessionMetric
                          label="Replies"
                          value={item.repliedCount}
                          tone="reply"
                        />
                      </div>
                      {item.lastErrorMessage && (
                        <p className="mt-2 text-[9px] leading-4 text-[#ff8585]">
                          {item.lastErrorCode || "SESSION_ERROR"}:{" "}
                          {item.lastErrorMessage}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              <section className="mt-4 overflow-hidden rounded-xl border border-white/[0.055] bg-[#0b0d0c]">
                <div className="border-b border-white/[0.055] p-3">
                  <div className="flex flex-col gap-2 xl:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#626c67]"
                      />
                      <input
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(1);
                        }}
                        placeholder="Search recipient, Telegram ID, message ID, or error"
                        className="h-10 w-full rounded-lg border border-white/[0.065] bg-[#111311] pl-9 pr-3 text-xs outline-none focus:border-[#9cff38]/25"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:w-[650px]">
                      <SignalSelect
                        value={sessionId}
                        onChange={(value) => {
                          setSessionId(value);
                          setPage(1);
                        }}
                        placeholder="Sending account"
                        options={sessionOptions}
                        className="min-h-10 rounded-lg text-[10px]"
                      />
                      <SignalSelect
                        value={status}
                        onChange={(value) => {
                          setStatus(value);
                          setPage(1);
                        }}
                        placeholder="Delivery status"
                        searchable={false}
                        options={[
                          { value: "all", label: "All deliveries" },
                          { value: "pending", label: "Pending" },
                          { value: "sent", label: "Sent" },
                          { value: "failed", label: "Failed" },
                          { value: "skipped", label: "Skipped" },
                        ]}
                        className="min-h-10 rounded-lg text-[10px]"
                      />
                      <SignalSelect
                        value={reply}
                        onChange={(value) => {
                          setReply(value);
                          setPage(1);
                        }}
                        placeholder="Reply status"
                        searchable={false}
                        options={[
                          { value: "all", label: "All reply states" },
                          { value: "replied", label: "Replied" },
                          { value: "no_reply", label: "Sent, no reply" },
                        ]}
                        className="min-h-10 rounded-lg text-[10px]"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-wider text-[#626c67]">
                    <span>
                      {detail.pagination.total.toLocaleString()} matching rows
                    </span>
                    <a
                      href={`/api/validator/telegram/campaigns/${run.id}/export`}
                      className="text-[#9cff38] sm:hidden"
                    >
                      Download complete CSV
                    </a>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.05] md:hidden">
                  {detail.recipients.map((recipient) => (
                    <RecipientCard key={recipient.id} recipient={recipient} />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1320px] text-left">
                    <thead>
                      <tr className="border-b border-white/[0.055] text-[8px] uppercase tracking-wider text-[#626c67]">
                        <th className="px-4 py-3">Recipient</th>
                        <th className="px-3 py-3">Sending account</th>
                        <th className="px-3 py-3">Delivery</th>
                        <th className="px-3 py-3">Telegram evidence</th>
                        <th className="px-3 py-3">Reply tracking</th>
                        <th className="px-4 py-3">Error / reply preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.045]">
                      {detail.recipients.map((recipient) => (
                        <RecipientRow
                          key={recipient.id}
                          recipient={recipient}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {!detail.recipients.length && (
                  <p className="p-12 text-center text-xs text-[#626c67]">
                    No recipient rows match these filters.
                  </p>
                )}
                <footer className="flex items-center justify-between border-t border-white/[0.055] p-3 text-[9px] text-[#737d78]">
                  <span>
                    {pageStart.toLocaleString()}-{pageEnd.toLocaleString()} of{" "}
                    {detail.pagination.total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      disabled={detail.pagination.page <= 1}
                      className="rounded-lg border border-white/[0.07] p-2 disabled:opacity-30"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span>
                      Page {detail.pagination.page} /{" "}
                      {detail.pagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((value) =>
                          Math.min(detail.pagination.totalPages, value + 1),
                        )
                      }
                      disabled={
                        detail.pagination.page >= detail.pagination.totalPages
                      }
                      className="rounded-lg border border-white/[0.07] p-2 disabled:opacity-30"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </footer>
              </section>
            </>
          ) : (
            <p className="p-16 text-center text-xs text-[#ff8585]">
              {error || "Messaging report unavailable"}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SessionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "error" | "reply";
}) {
  return (
    <div>
      <p
        className={`font-mono text-xs font-semibold ${tone === "success" ? "text-[#9cff38]" : tone === "error" ? "text-[#ff8585]" : tone === "reply" ? "text-[#65e6ff]" : "text-[#c7ceca]"}`}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[7px] uppercase text-[#59625e]">{label}</p>
    </div>
  );
}

function recipientIdentity(recipient: MessagingRecipient) {
  return (
    recipient.displayName ||
    (recipient.username
      ? `@${recipient.username}`
      : recipient.telegramId || recipient.phone || recipient.targetInput)
  );
}

function RecipientCard({ recipient }: { recipient: MessagingRecipient }) {
  return (
    <article className="p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {recipientIdentity(recipient)}
          </p>
          <p className="mt-1 break-all font-mono text-[9px] text-[#626c67]">
            {recipient.targetInput}
            {recipient.telegramId ? ` / ID ${recipient.telegramId}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[8px] uppercase ${statusColor(recipient.status)}`}
        >
          {recipient.status}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <dt className="text-[#59625e]">Sending account</dt>
          <dd className="mt-1 text-[#9ba39f]">
            {recipient.session?.label || "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-[#59625e]">Attempts</dt>
          <dd className="mt-1 font-mono text-[#9ba39f]">
            {recipient.attempts}
          </dd>
        </div>
        <div>
          <dt className="text-[#59625e]">Message ID / sent</dt>
          <dd className="mt-1 font-mono text-[#9ba39f]">
            {recipient.messageId || "-"}
            <br />
            {recipient.sentAt
              ? new Date(recipient.sentAt).toLocaleString()
              : "Not sent"}
          </dd>
        </div>
        <div>
          <dt className="text-[#59625e]">Reply</dt>
          <dd
            className={
              recipient.replied ? "mt-1 text-[#65e6ff]" : "mt-1 text-[#737d78]"
            }
          >
            {recipient.replied
              ? `ID ${recipient.replyMessageId || "-"}`
              : "No reply"}
            <br />
            {recipient.repliedAt
              ? new Date(recipient.repliedAt).toLocaleString()
              : recipient.lastCheckedAt
                ? `Checked ${new Date(recipient.lastCheckedAt).toLocaleString()}`
                : "Not checked"}
          </dd>
        </div>
      </dl>
      {recipient.errorMessage && (
        <p className="mt-3 text-[9px] leading-4 text-[#ff8585]">
          {recipient.errorCode || "DELIVERY_ERROR"}: {recipient.errorMessage}
        </p>
      )}
      {recipient.replyPreview && (
        <p className="mt-3 rounded-lg bg-[#65e6ff]/[0.05] p-2 text-[9px] leading-4 text-[#aeefff]">
          {recipient.replyPreview}
        </p>
      )}
    </article>
  );
}

function RecipientRow({ recipient }: { recipient: MessagingRecipient }) {
  return (
    <tr className="align-top text-[10px]">
      <td className="px-4 py-3">
        <p
          className="max-w-[220px] truncate text-xs font-medium text-[#d0d6d3]"
          title={recipientIdentity(recipient)}
        >
          {recipientIdentity(recipient)}
        </p>
        <p className="mt-1 max-w-[220px] break-all font-mono text-[9px] text-[#626c67]">
          {recipient.targetInput}
        </p>
        <p className="mt-1 font-mono text-[8px] text-[#59625e]">
          Telegram ID {recipient.telegramId || "unresolved"}
        </p>
      </td>
      <td className="px-3 py-3">
        <p className="max-w-[180px] truncate text-[#c7ceca]">
          {recipient.session?.label || "Unassigned"}
        </p>
        <p className="mt-1 font-mono text-[8px] text-[#626c67]">
          {recipient.session?.username
            ? `@${recipient.session.username}`
            : recipient.session?.phone || recipient.sessionId || "-"}
        </p>
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full border px-2 py-1 text-[8px] uppercase ${statusColor(recipient.status)}`}
        >
          {recipient.status}
        </span>
        <p className="mt-2 font-mono text-[8px] text-[#626c67]">
          {recipient.attempts} attempt{recipient.attempts === 1 ? "" : "s"}
        </p>
      </td>
      <td className="px-3 py-3">
        <p className="font-mono text-[#c7ceca]">
          Message {recipient.messageId || "-"}
        </p>
        <p className="mt-1 text-[8px] text-[#626c67]">
          {recipient.sentAt
            ? new Date(recipient.sentAt).toLocaleString()
            : "Not sent"}
        </p>
      </td>
      <td className="px-3 py-3">
        {recipient.replied ? (
          <>
            <p className="font-medium text-[#65e6ff]">
              Replied / ID {recipient.replyMessageId || "-"}
            </p>
            <p className="mt-1 text-[8px] text-[#626c67]">
              {recipient.repliedAt
                ? new Date(recipient.repliedAt).toLocaleString()
                : "Time unavailable"}
            </p>
          </>
        ) : (
          <>
            <p className="text-[#737d78]">No reply recorded</p>
            <p className="mt-1 text-[8px] text-[#59625e]">
              {recipient.lastCheckedAt
                ? `Checked ${new Date(recipient.lastCheckedAt).toLocaleString()}`
                : "Not checked yet"}
            </p>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <p
          className={`max-w-[300px] whitespace-pre-wrap break-words leading-4 ${recipient.errorMessage ? "text-[#ff8585]" : recipient.replyPreview ? "text-[#aeefff]" : "text-[#59625e]"}`}
        >
          {recipient.errorMessage
            ? `${recipient.errorCode || "DELIVERY_ERROR"}: ${recipient.errorMessage}`
            : recipient.replyPreview || "-"}
        </p>
      </td>
    </tr>
  );
}

function ReportInspection({
  run,
  detail,
  loading,
  close,
}: {
  run: Run;
  detail: Record<string, unknown> | null;
  loading: boolean;
  close: () => void;
}) {
  if (run.kind === "message_run" && (!loading || detail))
    return <MessagingInspection run={run} initial={detail} close={close} />;
  const source = detail || {};
  const record = (source.job ||
    source.campaign ||
    source.batch ||
    source) as Record<string, unknown>;
  const rows = (source.recipients ||
    source.conversations ||
    record.jobs ||
    record.recentItems) as Array<Record<string, unknown>> | undefined;
  const primitive = Object.entries(record)
    .filter(
      ([key, value]) =>
        !["secretEncrypted", "catalog", "config", "accountId"].includes(key) &&
        (value == null ||
          ["string", "number", "boolean"].includes(typeof value)),
    )
    .slice(0, 30);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111411]">
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/[0.055] bg-[#111411]/95 p-5 backdrop-blur">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#9cff38]/10 text-[#9cff38]">
            <RunIcon kind={run.kind} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] uppercase tracking-wider text-[#79a451]">
              {kindLabel(run.kind)}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold">{run.name}</h3>
            <p className="mt-1 text-[9px] text-[#626c67]">{run.output}</p>
          </div>
          <button
            onClick={close}
            className="rounded-lg border border-white/[0.06] p-2 text-[#737d78]"
          >
            <X size={15} />
          </button>
        </div>
        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 size={22} className="animate-spin text-[#9cff38]" />
          </div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Status", run.status],
                ["Total", run.total],
                ["Succeeded", run.succeeded],
                ["Failed", run.failed],
                ["Skipped", run.skipped],
                [run.secondaryLabel, run.secondary],
                ["Requests / jobs", run.requests],
                ["Created", new Date(run.createdAt).toLocaleString()],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3"
                >
                  <p className="text-[8px] uppercase tracking-wider text-[#626c67]">
                    {String(label)}
                  </p>
                  <p className="mt-2 break-words text-xs font-medium capitalize text-[#c7ceca]">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
            {run.error || source.error ? (
              <p className="mt-4 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.05] p-3 text-xs text-[#ff9292]">
                {String(run.error || source.error)}
              </p>
            ) : null}
            <section className="mt-5 rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-4">
              <h4 className="text-xs font-semibold">Complete run metadata</h4>
              <div className="mt-3 grid gap-x-5 sm:grid-cols-2">
                {primitive.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex gap-3 border-b border-white/[0.04] py-2 text-[9px]"
                  >
                    <span className="w-32 shrink-0 capitalize text-[#626c67]">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span className="break-all text-[#aeb7b2]">
                      {String(value ?? "-")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            {rows?.length ? (
              <section className="mt-5">
                <div className="flex justify-between">
                  <h4 className="text-xs font-semibold">Detailed rows</h4>
                  <span className="text-[8px] text-[#626c67]">
                    Showing {Math.min(rows.length, 100)} rows
                  </span>
                </div>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                  {rows.slice(0, 100).map((row, index) => (
                    <div
                      key={String(row.id || index)}
                      className="rounded-lg border border-white/[0.05] bg-[#0b0d0c] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-[10px] text-[#c3cbc7]">
                          {String(
                            row.targetInput ||
                              row.username ||
                              row.recipientName ||
                              row.sessionLabel ||
                              row.id ||
                              `Row ${index + 1}`,
                          )}
                        </p>
                        <span className="text-[9px] capitalize text-[#9cff38]">
                          {String(
                            row.status || row.conversationState || "recorded",
                          ).replaceAll("_", " ")}
                        </span>
                      </div>
                      {row.errorMessage ? (
                        <p className="mt-2 text-[9px] text-[#ff8585]">
                          {String(row.errorMessage)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
