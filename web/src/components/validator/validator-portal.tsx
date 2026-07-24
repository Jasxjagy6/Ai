"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  CloudUpload,
  Database,
  Download,
  FileJson,
  FileText,
  Fingerprint,
  Gauge,
  GitMerge,
  Globe,
  History,
  KeyRound,
  Layers3,
  ListFilter,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Wand2,
  X,
  XCircle,
} from "lucide-react";

type Account = {
  id: string;
  email: string;
  accessKeyId: string | null;
  planCode: string | null;
  requestLimit: number | null;
  requestsUsed: number;
  requestsRemaining: number | null;
  accessExpiresAt: string | null;
  validatorAccess: boolean;
  messagingAccess: boolean;
  sessionLimit: number | null;
  messageLimit: number | null;
  messagesUsed: number;
  messagesRemaining: number | null;
};
type View =
  "validate" | "lists" | "history" | "sessions" | "messaging" | "reports";
type ContactList = {
  id: string;
  name: string;
  type: string;
  itemsCount: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};
type ListItem = {
  id: string;
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  accessHash: string | null;
  bio: string | null;
  addedAt: string;
};
type JobItem = {
  id: string;
  username: string;
  status: string;
  displayName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};
type Job = {
  id: string;
  status: string;
  sourceListId: string | null;
  sourceListName: string;
  resultListId: string | null;
  resultListName: string;
  sourceItemsCount: number;
  totalCount: number;
  processedCount: number;
  validCount: number;
  invalidCount: number;
  failedCount: number;
  skippedCount: number;
  ignoredCount: number;
  duplicateCount: number;
  handledCount: number;
  progressPct: number;
  currentPass: number;
  maxPasses: number;
  passProcessedCount: number;
  passTotalCount: number;
  passProgressPct: number;
  totalRequests: number;
  timedOut: boolean;
  currentUsername: string | null;
  cancelRequested: boolean;
  useProxies: boolean;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastProgressAt: string | null;
  recentItems?: JobItem[];
};
type Stats = {
  totalItems: number;
  uniqueUsers: number;
  withUsername: number;
  withPhone: number;
  withFirstName: number;
  usernamePercentage: number;
  phonePercentage: number;
};
type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};
type TelegramCredential = {
  id: string;
  label: string;
  apiId: number;
  createdAt: string;
  updatedAt: string;
};
type TelegramSession = {
  id: string;
  label: string;
  phone: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  telegramUserId: string | null;
  sessionFormat: string;
  sourceFilename: string | null;
  status: string;
  isLoggedIn: boolean;
  hasTwoFactor: boolean;
  antiDetectEnabled: boolean;
  proxyLabel: string | null;
  proxyEnabled: boolean;
  riskScore: number;
  spamStatus: string;
  spamLimitUntil: string | null;
  spamCheckedAt: string | null;
  spamStatusMessage: string | null;
  spamCheckRequested: boolean;
  healthCooldownUntil: string | null;
  consecutiveFloodWaits: number;
  lastFloodSeconds: number;
  lastFloodAt: string | null;
  consecutiveSendFailures: number;
  warmupEnabled: boolean;
  warmupMode: string;
  warmupStartedAt: string;
  warmupCompletedAt: string | null;
  lastWarmupAt: string | null;
  warmupActions: number;
  warmupRequested: boolean;
  massDmEligible: boolean;
  eligibilityReason: string | null;
  dailyLimit: number | null;
  dailyMessagesSent: number;
  dailyMessagesRemaining: number | null;
  warmupDay: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  messagesSent: number;
  repliesReceived: number;
  createdAt: string;
  updatedAt: string;
};
type TelegramBehaviorLog = {
  id: string;
  sessionId: string | null;
  campaignId: string | null;
  action: string;
  target: string | null;
  succeeded: boolean;
  severity: string;
  errorCode: string | null;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
  performedAt: string;
  session: {
    label: string;
    username: string | null;
    phone: string | null;
  } | null;
};
type TelegramLoginFlow = {
  id: string;
  phone: string;
  label: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  sessionId: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};
type TelegramCampaign = {
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
  cancelRequested: boolean;
  currentTarget: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastProgressAt: string;
  progressPct: number;
};
type TelegramCampaignRecipient = {
  id: string;
  sessionId: string | null;
  targetInput: string;
  username: string | null;
  telegramId: string | null;
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
};
type TelegramSessionList = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    sessionId: string;
    session: Pick<
      TelegramSession,
      "id" | "label" | "username" | "phone" | "status" | "isLoggedIn"
    >;
  }>;
};
type TelegramMessageSchedule = {
  id: string;
  name: string;
  targetType: string;
  mode: string;
  status: string;
  intervalMinutes: number;
  runCount: number;
  nextRunAt: string;
  lastRunAt: string | null;
};

const ACTIVE = new Set(["pending", "running"]);
const PANEL = "border border-white/[0.08] bg-[#0b1717]";
const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#071111] px-3.5 py-2.5 text-sm text-[#eef7ed] outline-none transition placeholder:text-[#61706d] focus:border-[#b8ff4b]/60 focus:ring-2 focus:ring-[#b8ff4b]/10 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d] transition hover:bg-[#ceff82] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 text-sm font-medium text-[#b8c5c1] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40";

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "never";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`relative flex ${small ? "h-8 w-8" : "h-10 w-10"} items-center justify-center overflow-hidden rounded-xl border border-[#b8ff4b]/30 bg-[#b8ff4b]/10`}
    >
      <Radar size={small ? 17 : 21} className="text-[#b8ff4b]" />
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b8ff4b] shadow-[0_0_10px_#b8ff4b]" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-[#f4ca64]/25 bg-[#f4ca64]/10 text-[#f4ca64]",
    running: "border-[#65e6ff]/25 bg-[#65e6ff]/10 text-[#65e6ff]",
    completed: "border-[#b8ff4b]/25 bg-[#b8ff4b]/10 text-[#b8ff4b]",
    cancelled: "border-white/10 bg-white/5 text-[#889692]",
    failed: "border-[#ff7474]/25 bg-[#ff7474]/10 text-[#ff8d8d]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${styles[status] || styles.cancelled}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "animate-pulse bg-current" : "bg-current"}`}
      />
      {status}
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  color = "text-[#eef7ed]",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#091313] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`font-mono text-2xl font-semibold tracking-tight ${color}`}
          >
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#65736f]">
            {label}
          </p>
        </div>
        <Icon size={16} className={color} />
      </div>
    </div>
  );
}

function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const modals = document.querySelectorAll("[data-signal-desk-modal]");
      if (modals.item(modals.length - 1) === modalRef.current) onClose();
    };
    window.addEventListener("keydown", close);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={modalRef}
      data-signal-desk-modal
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020706]/80 p-3 backdrop-blur-md validator-fade-in sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        className={`validator-modal-in max-h-[92dvh] w-full ${wide ? "max-w-5xl" : "max-w-xl"} overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1717] shadow-[0_30px_100px_rgba(0,0,0,.65)]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-[#f2faef]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-[#81908c]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#7d8b87] transition hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(92dvh-75px)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      description={description}
      onClose={busy ? () => undefined : onClose}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} disabled={busy} className={SECONDARY}>
          Keep it
        </button>
        <button
          onClick={() => void onConfirm()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ff7474]/25 bg-[#ff7474]/10 px-4 py-2.5 text-sm font-bold text-[#ff9b9b] transition hover:bg-[#ff7474]/15 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function AccessGate({ onUnlock }: { onUnlock: (account: Account) => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ account: Account }>("/api/validator/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      onUnlock(data.account);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Access denied");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed]">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(184,255,75,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(184,255,75,.045)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute -left-40 top-[-15%] h-[550px] w-[550px] rounded-full bg-[#b8ff4b]/[0.06] blur-[120px]" />
      <div className="absolute -right-40 bottom-[-20%] h-[600px] w-[600px] rounded-full bg-[#40d6c2]/[0.07] blur-[140px]" />
      <div className="relative mx-auto grid min-h-dvh max-w-7xl lg:grid-cols-[1.2fr_.8fr]">
        <section className="hidden border-r border-white/[0.07] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
          <Link href="/" className="flex w-fit items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold tracking-wide">SIGNAL DESK</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#65736f]">
                by Aria Labs
              </p>
            </div>
          </Link>
          <div className="max-w-xl">
            <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]">
              <span className="h-px w-10 bg-[#b8ff4b]" /> Telegram intelligence
              workspace
            </div>
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-[-0.045em] xl:text-6xl">
              Clean lists.
              <br />
              <span className="text-[#81908c]">Find the signal.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#81908c]">
              A focused workspace for high-volume Telegram username checks.
              Import raw data, inspect every row, watch confirmations land live,
              and export only what matters.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {[
                { value: "200K", label: "rows per run" },
                { value: "LIVE", label: "result stream" },
                { value: "0", label: "sessions needed" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-l border-[#b8ff4b]/30 pl-4"
                >
                  <p className="font-mono text-xl font-semibold text-[#b8ff4b]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#65736f]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#52605c]">
            Sessionless public t.me checks · Isolated operator workspaces
          </p>
        </section>
        <section className="flex min-h-dvh items-center justify-center p-5 sm:p-10">
          <div className="w-full max-w-md validator-reveal">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <LogoMark />
              <div>
                <p className="text-sm font-semibold tracking-wide">
                  SIGNAL DESK
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#65736f]">
                  Telegram validator
                </p>
              </div>
            </div>
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/10 text-[#b8ff4b]">
              <LockKeyhole size={21} />
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">
              Enter your workspace
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#81908c]">
              Use the access key issued to your email by an administrator. Your
              key unlocks an isolated list and validation workspace.
            </p>
            <form onSubmit={submit} className="mt-8">
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#71807c]">
                Access key
              </label>
              <div className="relative mt-2">
                <KeyRound
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#60706b]"
                />
                <input
                  autoFocus
                  required
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  type={show ? "text" : "password"}
                  placeholder="tgv_..."
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1717] py-3.5 pl-11 pr-16 font-mono text-sm text-white outline-none transition placeholder:text-[#45534f] focus:border-[#b8ff4b]/50 focus:ring-4 focus:ring-[#b8ff4b]/[0.06]"
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#71807c] hover:text-white"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] p-3 text-sm text-[#ff9b9b]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              <button
                disabled={loading || !key.trim()}
                className={`${PRIMARY} mt-4 w-full py-3.5`}
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Fingerprint size={17} />
                )}
                {loading ? "Verifying access..." : "Unlock Signal Desk"}
                <ArrowRight size={16} className="ml-auto" />
              </button>
            </form>
            <div className="mt-7 flex items-center gap-3 text-xs text-[#56645f]">
              <span className="h-px flex-1 bg-white/[0.07]" /> Keys are hashed
              at rest <span className="h-px flex-1 bg-white/[0.07]" />
            </div>
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-[#71807c]">
              No key?
              <Link
                href="/validator/buy"
                className="font-semibold text-[#b8ff4b] transition hover:text-[#ceff82]"
              >
                Buy one <ArrowRight size={13} className="inline" />
              </Link>
            </div>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-[#71807c] transition hover:text-white"
            >
              <ArrowLeft size={13} /> Return to Aria
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ValidatorPortal({
  initialAccount,
}: {
  initialAccount: Account | null;
}) {
  const [account, setAccount] = useState(initialAccount);
  if (!account) return <AccessGate onUnlock={setAccount} />;
  return (
    <Workspace
      account={account}
      onAccountChanged={setAccount}
      onLock={() => setAccount(null)}
    />
  );
}

function Workspace({
  account,
  onAccountChanged,
  onLock,
}: {
  account: Account;
  onAccountChanged: (account: Account) => void;
  onLock: () => void;
}) {
  const [view, setView] = useState<View>(
    account.validatorAccess ? "validate" : "messaging",
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loaded = useRef(false);

  function notify(message: string, tone: Toast["tone"] = "info") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4200,
    );
  }

  async function loadLists() {
    const data = await api<{ lists: ContactList[] }>(
      "/api/validator/lists?limit=100&sort=createdAt&order=desc",
    );
    setLists(data.lists || []);
    return data.lists || [];
  }

  async function loadJobs() {
    const data = await api<{ jobs: Job[] }>("/api/validator/jobs?limit=50");
    setJobs(data.jobs || []);
    const running = data.jobs.find((job) => ACTIVE.has(job.status));
    if (
      running &&
      (!activeJob ||
        activeJob.id === running.id ||
        !ACTIVE.has(activeJob.status))
    ) {
      const detail = await api<{ job: Job }>(
        `/api/validator/jobs/${running.id}`,
      );
      setActiveJob(detail.job);
    }
    return data.jobs || [];
  }

  async function refreshAccount() {
    const data = await api<{ account: Account }>("/api/validator/auth");
    onAccountChanged(data.account);
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const timer = window.setTimeout(() => {
      const initial = Promise.all([
        account.validatorAccess || account.messagingAccess
          ? loadLists()
          : Promise.resolve([]),
        account.validatorAccess ? loadJobs() : Promise.resolve([]),
      ]);
      initial
        .catch((error) => notify(error.message, "error"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeJob || !ACTIVE.has(activeJob.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const data = await api<{ job: Job }>(
          `/api/validator/jobs/${activeJob.id}`,
        );
        setActiveJob(data.job);
        setJobs((current) =>
          current.map((job) => (job.id === data.job.id ? data.job : job)),
        );
        if (!ACTIVE.has(data.job.status)) {
          void loadLists();
          void loadJobs();
          notify(
            data.job.status === "completed"
              ? `Run complete: ${formatNumber(data.job.validCount)} valid usernames confirmed.`
              : `Run ${data.job.status}.`,
            data.job.status === "completed" ? "success" : "info",
          );
        }
      } catch {
        // A transient poll failure leaves the last good snapshot visible.
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, activeJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    await fetch("/api/validator/auth", { method: "DELETE" });
    onLock();
  }

  const navigation = [
    {
      id: "validate" as const,
      label: "Validator",
      sub: account.validatorAccess
        ? "Launch and monitor"
        : "Access not enabled",
      icon: Radar,
      disabled: !account.validatorAccess,
    },
    {
      id: "lists" as const,
      label: "Lists",
      sub: `${formatNumber(lists.length)} workspaces`,
      icon: Layers3,
      disabled: !account.validatorAccess && !account.messagingAccess,
    },
    {
      id: "history" as const,
      label: "Run history",
      sub: account.validatorAccess
        ? `${formatNumber(jobs.length)} saved runs`
        : "Access not enabled",
      icon: History,
      disabled: !account.validatorAccess,
    },
    {
      id: "sessions" as const,
      label: "Telegram sessions",
      sub: account.messagingAccess
        ? "Accounts and API access"
        : "Messaging access required",
      icon: Smartphone,
      disabled: !account.messagingAccess,
    },
    {
      id: "messaging" as const,
      label: "Messaging",
      sub: account.messagingAccess
        ? `${account.messagesRemaining == null ? "Unlimited" : formatNumber(account.messagesRemaining)} DMs left`
        : "Messaging access required",
      icon: Send,
      disabled: !account.messagingAccess,
    },
    {
      id: "reports" as const,
      label: "Reports",
      sub: account.messagingAccess
        ? "Delivery and replies"
        : "Messaging access required",
      icon: FileText,
      disabled: !account.messagingAccess,
    },
  ];

  const sidebar = (
    <>
      <div className="flex h-[72px] items-center gap-3 border-b border-white/[0.07] px-5">
        <LogoMark small />
        <div>
          <p className="text-sm font-semibold tracking-[0.08em] text-white">
            SIGNAL DESK
          </p>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#5f6e69]">
            Telegram validator
          </p>
        </div>
        <button
          onClick={() => setMobileNav(false)}
          className="ml-auto text-[#70807b] lg:hidden"
        >
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5">
        <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#53615d]">
          Workspace
        </p>
        {navigation.map((item, index) => (
          <button
            key={item.id}
            disabled={item.disabled}
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={() => {
              setView(item.id);
              setMobileNav(false);
            }}
            className={`validator-nav-in group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition duration-300 disabled:cursor-not-allowed disabled:opacity-35 ${view === item.id ? "bg-[#b8ff4b]/10 text-[#dfffaa]" : "text-[#7d8d88] hover:translate-x-1 hover:bg-white/[0.04] hover:text-white"}`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition duration-300 ${view === item.id ? "border-[#b8ff4b]/20 bg-[#b8ff4b]/10 text-[#b8ff4b]" : "border-white/[0.07] bg-white/[0.025] group-hover:rotate-3 group-hover:border-white/15"}`}
            >
              <item.icon size={16} />
            </span>
            <span>
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-0.5 block text-[10px] text-[#53615d]">
                {item.sub}
              </span>
            </span>
            {view === item.id && (
              <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-[#b8ff4b] shadow-[0_0_8px_#b8ff4b]" />
            )}
            {item.disabled && <LockKeyhole size={12} className="ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/[0.07] p-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#40d6c2]/10 text-[#6cebd9]">
              <KeyRound size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#d9e3df]">
                {account.email}
              </p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[#56645f]">
                Key workspace
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#071111] px-2.5 py-2 text-[9px] uppercase tracking-[0.12em] text-[#5c6b66]">
            <span className="text-[#8c9a95]">
              {account.planCode
                ? account.planCode.replaceAll("_", " ")
                : "Admin access"}
            </span>
            <span className="float-right font-mono text-[#b8ff4b]">
              {account.requestsRemaining == null
                ? "Unlimited"
                : `${formatNumber(account.requestsRemaining)} left`}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] py-2 text-[10px] font-semibold text-[#72817c] transition hover:text-white"
            >
              <ArrowLeft size={11} /> Aria
            </Link>
            <button
              onClick={logout}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] py-2 text-[10px] font-semibold text-[#72817c] transition hover:border-[#ff7474]/20 hover:text-[#ff8d8d]"
            >
              <LogOut size={11} /> Lock
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed] [font-feature-settings:'ss01']">
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-white/[0.07] bg-[#07100f] lg:flex">
        {sidebar}
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 validator-fade-in lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNav(false)}
          />
          <aside className="validator-drawer-in absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-white/10 bg-[#07100f]">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center border-b border-white/[0.07] bg-[#070f0e]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileNav(true)}
            className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-[#81908c] lg:hidden"
          >
            <Menu size={17} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5c6b66]">
              Signal Desk / {view}
            </p>
            <h1 className="mt-0.5 text-base font-semibold">
              {navigation.find((item) => item.id === view)?.label}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {activeJob && ACTIVE.has(activeJob.status) && (
              <button
                onClick={() => setView("validate")}
                className="hidden items-center gap-2 rounded-full border border-[#65e6ff]/20 bg-[#65e6ff]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#65e6ff] sm:flex"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#65e6ff]" />
                Run live · {activeJob.passProgressPct}%
              </button>
            )}
            {account.validatorAccess && (
              <button
                onClick={() =>
                  Promise.all([loadLists(), loadJobs()]).catch((error) =>
                    notify(error.message, "error"),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-[#71807c] transition hover:bg-white/5 hover:text-white"
                title="Refresh"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div key={view} className="validator-view-in min-h-full">
            {loading ? (
              <div className="flex min-h-full items-center justify-center">
                <div className="text-center">
                  <Loader2
                    size={24}
                    className="mx-auto animate-spin text-[#b8ff4b]"
                  />
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#61706c]">
                    Loading workspace
                  </p>
                </div>
              </div>
            ) : view === "validate" ? (
              <ValidateView
                lists={lists}
                jobs={jobs}
                activeJob={activeJob}
                setActiveJob={setActiveJob}
                onListsChanged={loadLists}
                onJobsChanged={loadJobs}
                onUsageChanged={refreshAccount}
                notify={notify}
                openLists={() => setView("lists")}
              />
            ) : view === "lists" ? (
              <ListsView lists={lists} refresh={loadLists} notify={notify} />
            ) : view === "history" ? (
              <HistoryView
                jobs={jobs}
                refresh={loadJobs}
                setActiveJob={(job) => {
                  setActiveJob(job);
                  setView("validate");
                }}
                notify={notify}
              />
            ) : view === "sessions" ? (
              <TelegramSessionsView account={account} notify={notify} />
            ) : view === "messaging" ? (
              <MessagingView
                account={account}
                lists={lists}
                notify={notify}
                openReports={() => setView("reports")}
                onUsageChanged={refreshAccount}
              />
            ) : (
              <ReportsView notify={notify} />
            )}
          </div>
        </main>
      </div>
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl ${toast.tone === "success" ? "border-[#b8ff4b]/20 bg-[#12200f]/95 text-[#dfffaa]" : toast.tone === "error" ? "border-[#ff7474]/20 bg-[#211010]/95 text-[#ffaaaa]" : "border-[#65e6ff]/20 bg-[#0d1d20]/95 text-[#a8f1ff]"}`}
          >
            {toast.tone === "success" ? (
              <CheckCircle2 size={17} />
            ) : toast.tone === "error" ? (
              <AlertCircle size={17} />
            ) : (
              <Activity size={17} />
            )}
            <p className="flex-1 text-sm leading-5">{toast.message}</p>
            <button
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id),
                )
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidateView({
  lists,
  jobs,
  activeJob,
  setActiveJob,
  onListsChanged,
  onJobsChanged,
  onUsageChanged,
  notify,
  openLists,
}: {
  lists: ContactList[];
  jobs: Job[];
  activeJob: Job | null;
  setActiveJob: (job: Job | null) => void;
  onListsChanged: () => Promise<ContactList[]>;
  onJobsChanged: () => Promise<Job[]>;
  onUsageChanged: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  openLists: () => void;
}) {
  const eligible = lists.filter(
    (list) => list.type !== "profile" && list.source !== "link_filter",
  );
  const [sourceId, setSourceId] = useState(eligible[0]?.id || "");
  const [resultName, setResultName] = useState(
    eligible[0] ? `${eligible[0].name} - Valid Usernames` : "",
  );
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [useProxies, setUseProxies] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const hasActive = !!activeJob && ACTIVE.has(activeJob.status);
  const effectiveSourceId = sourceId || eligible[0]?.id || "";
  const selected = eligible.find((list) => list.id === effectiveSourceId);
  const effectiveResultName =
    resultName || (selected ? `${selected.name} - Valid Usernames` : "");

  async function start() {
    if (!effectiveSourceId) return;
    setStarting(true);
    try {
      const data = await api<{ job: Job }>("/api/validator/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceListId: effectiveSourceId,
          resultListName: effectiveResultName,
          useProxies,
        }),
      });
      setActiveJob(data.job);
      void onJobsChanged();
      void onListsChanged();
      void onUsageChanged();
      notify(
        `Run queued with ${formatNumber(data.job.totalCount)} unique usernames.`,
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to start run",
        "error",
      );
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!activeJob) return;
    setCancelling(true);
    try {
      const data = await api<{ job: Job }>(
        `/api/validator/jobs/${activeJob.id}/cancel`,
        { method: "POST" },
      );
      setActiveJob(data.job);
      notify(
        "Safe stop requested. Confirmed usernames will stay available.",
        "info",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to stop run",
        "error",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (activeJob) {
    const progress = hasActive
      ? activeJob.passProgressPct
      : activeJob.progressPct;
    const remaining = Math.max(
      0,
      activeJob.totalCount - activeJob.processedCount - activeJob.skippedCount,
    );
    return (
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                Validation run
              </h2>
              <StatusPill status={activeJob.status} />
            </div>
            <p className="mt-2 text-sm text-[#74837e]">
              {activeJob.sourceListName}{" "}
              <span className="mx-1 text-[#45534f]">/</span>{" "}
              {activeJob.resultListName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeJob.resultListId &&
              ["csv", "json", "txt"].map((format) => (
                <a
                  key={format}
                  href={`/api/validator/lists/${activeJob.resultListId}/export?format=${format}`}
                  className={SECONDARY}
                >
                  <Download size={14} />
                  {format.toUpperCase()}
                </a>
              ))}
            {hasActive && (
              <button
                onClick={cancel}
                disabled={cancelling || activeJob.cancelRequested}
                className="inline-flex items-center gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] px-3.5 py-2.5 text-sm font-semibold text-[#ff9292] transition hover:bg-[#ff7474]/10 disabled:opacity-40"
              >
                {cancelling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CircleStop size={14} />
                )}
                {activeJob.cancelRequested ? "Stop requested" : "Stop safely"}
              </button>
            )}
            <button
              onClick={() => setActiveJob(null)}
              disabled={hasActive}
              className={SECONDARY}
            >
              <Plus size={14} />
              New run
            </button>
          </div>
        </div>

        <section
          className={`${PANEL} relative mt-6 overflow-hidden rounded-[28px] p-5 sm:p-7`}
        >
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#b8ff4b]/[0.035] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#b8ff4b ${progress * 3.6}deg, rgba(255,255,255,.06) 0deg)`,
              }}
            >
              <div className="flex h-[94px] w-[94px] flex-col items-center justify-center rounded-full bg-[#0b1717]">
                <span className="font-mono text-2xl font-semibold text-white">
                  {progress}%
                </span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-[#60706b]">
                  complete
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">
                  {hasActive
                    ? `Pass ${activeJob.currentPass || 1} in progress`
                    : activeJob.status === "completed"
                      ? "Run complete"
                      : `Run ${activeJob.status}`}
                </p>
                {activeJob.timedOut && (
                  <span className="rounded-full bg-[#f4ca64]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#f4ca64]">
                    Time budget reached
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#71807c]">
                {hasActive
                  ? `${formatNumber(activeJob.passProcessedCount)} of ${formatNumber(activeJob.passTotalCount)} requests checked`
                  : `${formatNumber(activeJob.handledCount)} unique usernames handled`}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#40d6c2] to-[#b8ff4b] transition-[width] duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              {hasActive && activeJob.currentUsername && (
                <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-[#65e6ff]/15 bg-[#65e6ff]/[0.05] px-3 py-2 text-xs text-[#9defff]">
                  <Loader2 size={13} className="shrink-0 animate-spin" />
                  <span className="text-[#71807c]">Checking</span>
                  <span className="truncate font-mono">
                    @{activeJob.currentUsername}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-7 gap-y-3 border-t border-white/[0.07] pt-5 text-xs lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <div>
                <p className="font-mono text-lg text-white">
                  {formatNumber(activeJob.totalRequests)}
                </p>
                <p className="text-[#60706b]">requests</p>
              </div>
              <div>
                <p className="font-mono text-lg text-white">
                  {formatNumber(remaining)}
                </p>
                <p className="text-[#60706b]">remaining</p>
              </div>
              <div>
                <p className="font-mono text-lg text-white">
                  {formatNumber(activeJob.ignoredCount)}
                </p>
                <p className="text-[#60706b]">ignored</p>
              </div>
              <div>
                <p className="font-mono text-lg text-white">
                  {formatNumber(activeJob.duplicateCount)}
                </p>
                <p className="text-[#60706b]">duplicates</p>
              </div>
            </div>
          </div>
          {activeJob.errorMessage && (
            <div className="relative mt-5 flex gap-2 rounded-xl border border-[#f4ca64]/20 bg-[#f4ca64]/[0.06] p-3 text-sm text-[#f4ca64]">
              <AlertCircle size={16} className="shrink-0" />
              {activeJob.errorMessage}
            </div>
          )}
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Confirmed valid"
            value={activeJob.validCount}
            icon={UserCheck}
            color="text-[#b8ff4b]"
          />
          <Metric
            label="Not found"
            value={activeJob.invalidCount}
            icon={XCircle}
            color="text-[#ff8585]"
          />
          <Metric
            label="Request errors"
            value={activeJob.failedCount}
            icon={AlertCircle}
            color="text-[#f4ca64]"
          />
          <Metric
            label="Source rows"
            value={activeJob.sourceItemsCount}
            icon={Database}
            color="text-[#84eaff]"
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className={`${PANEL} overflow-hidden rounded-[24px]`}>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Live result stream</h3>
                <p className="mt-0.5 text-[11px] text-[#60706b]">
                  Newest checks update every 1.5 seconds
                </p>
              </div>
              {hasActive && (
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#65e6ff]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  Live
                </span>
              )}
            </div>
            <div className="min-h-64 divide-y divide-white/[0.055]">
              {activeJob.recentItems?.length ? (
                activeJob.recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.status === "valid" ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : item.status === "invalid" ? "bg-[#ff7474]/10 text-[#ff8585]" : "bg-[#f4ca64]/10 text-[#f4ca64]"}`}
                    >
                      {item.status === "valid" ? (
                        <Check size={14} />
                      ) : item.status === "invalid" ? (
                        <X size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-[#dce7e3]">
                        @{item.username}
                      </p>
                      <p className="truncate text-[10px] text-[#586762]">
                        {item.displayName ||
                          item.errorCode ||
                          "Public t.me check"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${item.status === "valid" ? "text-[#b8ff4b]" : item.status === "invalid" ? "text-[#ff8585]" : "text-[#f4ca64]"}`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <Radar size={28} className="text-[#40504b]" />
                  <p className="mt-3 text-sm text-[#6a7974]">
                    Results will appear here as they are checked.
                  </p>
                </div>
              )}
            </div>
          </section>
          <aside className={`${PANEL} rounded-[24px] p-5`}>
            <h3 className="text-sm font-semibold">Run details</h3>
            <dl className="mt-5 space-y-4 text-xs">
              {[
                ["Run ID", activeJob.id.slice(-10)],
                ["Created", relativeTime(activeJob.createdAt)],
                ["Started", relativeTime(activeJob.startedAt)],
                ["Last heartbeat", relativeTime(activeJob.lastProgressAt)],
                [
                  "Proxies",
                  activeJob.useProxies !== false
                    ? "Up to 3 public proxies"
                    : "Direct VPS IP",
                ],
                ["Method", "Public t.me preview"],
                ["Telegram sessions", "None"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-white/[0.055] pb-3 last:border-0"
                >
                  <dt className="text-[#62716c]">{label}</dt>
                  <dd className="max-w-[180px] text-right font-medium text-[#c9d5d1]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl border border-[#40d6c2]/15 bg-[#40d6c2]/[0.05] p-3 text-[11px] leading-5 text-[#74bdb2]">
              <ShieldCheck size={14} className="mb-2" />
              Checks use public Telegram web previews. No account sessions, DMs,
              contact imports, or group actions are used.
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <section>
          <div className="mb-7">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#b8ff4b]">
              <span className="h-px w-7 bg-[#b8ff4b]" />
              New validation run
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Turn raw handles into
              <br />
              <span className="text-[#71807c]">a verified signal.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71807c]">
              Choose an imported username list. Signal Desk checks public t.me
              previews in a durable background run and writes confirmed profiles
              into a clean result list.
            </p>
          </div>
          <div className={`${PANEL} rounded-[28px] p-5 sm:p-7`}>
            {eligible.length ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
                    01 / Source list
                  </span>
                  <div className="relative mt-2">
                    <Database
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#60706b]"
                    />
                    <select
                      value={effectiveSourceId}
                      onChange={(event) => {
                        setSourceId(event.target.value);
                        const list = eligible.find(
                          (item) => item.id === event.target.value,
                        );
                        if (list)
                          setResultName(`${list.name} - Valid Usernames`);
                      }}
                      className={`${FIELD} appearance-none pl-11 pr-10`}
                    >
                      <option value="">Choose an imported list</option>
                      {eligible.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} · {formatNumber(list.itemsCount)} rows
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#60706b]"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
                    02 / Result list name
                  </span>
                  <input
                    value={effectiveResultName}
                    onChange={(event) => setResultName(event.target.value)}
                    maxLength={255}
                    placeholder="Confirmed Telegram usernames"
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <div className="rounded-xl border border-[#f4ca64]/15 bg-[#f4ca64]/[0.045] px-3.5 py-3 text-[11px] leading-5 text-[#b9a66f]">
                  <ListFilter
                    size={14}
                    className="mr-2 inline text-[#f4ca64]"
                  />
                  Hard filter: only 5-32 character usernames starting with a
                  letter and using letters, digits, or underscores are checked.
                  IDs, phone numbers, spaced names, and punctuation are ignored
                  before requests begin.
                </div>
                <div className="grid gap-3 rounded-2xl border border-white/[0.07] bg-[#071111] p-4 sm:grid-cols-3">
                  {[
                    {
                      icon: ShieldCheck,
                      title: "Sessionless",
                      body: "No Telegram accounts used",
                    },
                    {
                      icon: Activity,
                      title: "Live progress",
                      body: "Saved every few seconds",
                    },
                    {
                      icon: CloudUpload,
                      title: "Durable output",
                      body: "Export while it runs",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-2.5">
                      <item.icon
                        size={15}
                        className="mt-0.5 shrink-0 text-[#40d6c2]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#cdd8d4]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#5c6b66]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#071111] p-3.5">
                  <span className="flex items-center gap-2.5">
                    <Globe size={15} className="text-[#6d7b77]" />
                    <span>
                      <span className="block text-sm font-medium text-[#cdd8d4]">
                        Use proxies
                      </span>
                      <span className="block text-[10px] text-[#5c6b66]">
                        Route checks through public proxies
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useProxies}
                    onClick={() => setUseProxies((value) => !value)}
                    className={`relative h-6 w-11 rounded-full transition ${useProxies ? "bg-[#b8ff4b]" : "bg-white/10"}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[#07100d] transition ${useProxies ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </label>
                <button
                  onClick={start}
                  disabled={
                    starting ||
                    !effectiveSourceId ||
                    !effectiveResultName.trim()
                  }
                  className={`${PRIMARY} w-full py-3.5`}
                >
                  {starting ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Radar size={17} />
                  )}
                  {starting
                    ? "Building durable run..."
                    : `Start checking ${formatNumber(selected?.itemsCount || 0)} rows`}
                  <ArrowRight size={16} className="ml-auto" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.07] text-[#b8ff4b]">
                  <Upload size={23} />
                </div>
                <h3 className="mt-5 text-lg font-semibold">
                  Import your first username list
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#71807c]">
                  Upload CSV, JSON, or TXT. Headers are detected automatically,
                  Telegram links are normalized, and duplicate handles are
                  removed before validation.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => setUploadOpen(true)}
                    className={PRIMARY}
                  >
                    <CloudUpload size={15} />
                    Import list
                  </button>
                  <button onClick={openLists} className={SECONDARY}>
                    <Layers3 size={15} />
                    Open Lists
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-4 xl:pt-16">
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#60706b]">
                  Workspace pulse
                </p>
                <p className="mt-1 text-lg font-semibold">Ready for signal</p>
              </div>
              <Gauge size={21} className="text-[#b8ff4b]" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Metric
                label="Lists"
                value={lists.length}
                icon={Layers3}
                color="text-[#84eaff]"
              />
              <Metric
                label="Saved runs"
                value={jobs.length}
                icon={History}
                color="text-[#d8b7ff]"
              />
            </div>
          </div>
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#b8ff4b]" />
              <h3 className="text-sm font-semibold">Before you launch</h3>
            </div>
            <ol className="mt-4 space-y-4">
              {[
                "Use lists with public usernames or t.me links.",
                "Normalize mixed or legacy files from the Lists tool.",
                "Keep this page open for live results, or return later.",
              ].map((text, index) => (
                <li
                  key={text}
                  className="flex gap-3 text-xs leading-5 text-[#71807c]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.05] font-mono text-[9px] text-[#b8ff4b]">
                    {index + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </div>
          {jobs[0] && (
            <button
              onClick={async () => {
                const data = await api<{ job: Job }>(
                  `/api/validator/jobs/${jobs[0].id}`,
                );
                setActiveJob(data.job);
              }}
              className={`${PANEL} flex w-full items-center gap-3 rounded-[24px] p-4 text-left transition hover:border-white/15`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-[#81908c]">
                <History size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-[#5d6b67]">
                  Last run
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium">
                  {jobs[0].sourceListName}
                </span>
              </span>
              <StatusPill status={jobs[0].status} />
            </button>
          )}
        </aside>
      </div>
      {uploadOpen && (
        <ImportModal
          onClose={() => setUploadOpen(false)}
          onImported={async (message) => {
            setUploadOpen(false);
            await onListsChanged();
            notify(message, "success");
          }}
        />
      )}
    </div>
  );
}

function TelegramSessionsView({
  account,
  notify,
}: {
  account: Account;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [credential, setCredential] = useState<TelegramCredential | null>(null);
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<TelegramBehaviorLog[]>([]);
  const [flow, setFlow] = useState<TelegramLoginFlow | null>(null);
  const [fleets, setFleets] = useState<TelegramSessionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [challenge, setChallenge] = useState("");
  const [fleetName, setFleetName] = useState("");
  const [fleetSessionIds, setFleetSessionIds] = useState<string[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkWarmupMode, setBulkWarmupMode] = useState("safe");
  const [deleteSession, setDeleteSession] = useState<TelegramSession | null>(
    null,
  );

  async function load() {
    const [credentialData, sessionData, loginData, fleetData, behaviorData] =
      await Promise.all([
        api<{ credential: TelegramCredential | null }>(
          "/api/validator/telegram/credentials",
        ),
        api<{ sessions: TelegramSession[] }>(
          "/api/validator/telegram/sessions",
        ),
        api<{ flows: TelegramLoginFlow[] }>("/api/validator/telegram/login"),
        api<{ lists: TelegramSessionList[] }>(
          "/api/validator/telegram/session-lists",
        ),
        api<{ logs: TelegramBehaviorLog[] }>(
          "/api/validator/telegram/behavior?limit=30",
        ),
      ]);
    setCredential(credentialData.credential);
    setApiId(
      credentialData.credential ? String(credentialData.credential.apiId) : "",
    );
    setSessions(sessionData.sessions || []);
    setFleets(fleetData.lists || []);
    setBehaviorLogs(behaviorData.logs || []);
    setSelectedSessionIds((current) =>
      current.filter((id) =>
        sessionData.sessions.some((session) => session.id === id),
      ),
    );
    setFleetSessionIds((current) =>
      current.length
        ? current.filter((id) =>
            sessionData.sessions.some((session) => session.id === id),
          )
        : sessionData.sessions
            .filter(
              (session) => session.isLoggedIn && session.status === "active",
            )
            .map((session) => session.id),
    );
    const pending = (loginData.flows || []).find(
      (item) =>
        !["completed", "failed", "expired", "cancelled"].includes(item.status),
    );
    setFlow(pending || loginData.flows?.[0] || null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load()
        .catch((error) => notify(error.message, "error"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      !flow ||
      [
        "completed",
        "failed",
        "expired",
        "cancelled",
        "awaiting_code",
        "awaiting_password",
      ].includes(flow.status)
    )
      return;
    const timer = window.setInterval(async () => {
      try {
        const data = await api<{ flow: TelegramLoginFlow }>(
          `/api/validator/telegram/login/${flow.id}`,
        );
        setFlow(data.flow);
        if (data.flow.status === "completed") {
          const sessionData = await api<{ sessions: TelegramSession[] }>(
            "/api/validator/telegram/sessions",
          );
          setSessions(sessionData.sessions || []);
          notify("Telegram account connected.", "success");
        }
      } catch {
        // Keep the last durable state visible through transient polling failures.
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [flow?.id, flow?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCredential(event: React.FormEvent) {
    event.preventDefault();
    setBusy("credential");
    try {
      const data = await api<{ credential: TelegramCredential }>(
        "/api/validator/telegram/credentials",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiId: Number(apiId),
            apiHash,
            label: "Telegram API",
          }),
        },
      );
      setCredential(data.credential);
      setApiHash("");
      notify("Telegram API credentials encrypted and saved.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to save credentials",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function uploadSessions() {
    if (!files.length) return;
    setBusy("upload");
    const form = new FormData();
    files.forEach((file) => form.append("sessions", file));
    try {
      const data = await api<{
        imported: number;
        results: Array<{ ok: boolean; error?: string }>;
      }>("/api/validator/telegram/sessions", { method: "POST", body: form });
      setFiles([]);
      await load();
      const failed = data.results.filter((result) => !result.ok).length;
      notify(
        `Queued ${data.imported} session${data.imported === 1 ? "" : "s"} for validation${failed ? `; ${failed} skipped` : ""}.`,
        data.imported ? "success" : "error",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Session import failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function beginLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy("login");
    try {
      const data = await api<{ flow: TelegramLoginFlow }>(
        "/api/validator/telegram/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            label: label || phone,
            proxyUrl: proxyUrl || null,
          }),
        },
      );
      setFlow(data.flow);
      setChallenge("");
      notify("Telegram code request queued.", "info");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to start Telegram login",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function submitChallenge() {
    if (!flow || !challenge) return;
    const action = flow.status === "awaiting_password" ? "password" : "code";
    setBusy("challenge");
    try {
      const data = await api<{ flow: TelegramLoginFlow }>(
        `/api/validator/telegram/login/${flow.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "password"
              ? { action, password: challenge }
              : { action, code: challenge },
          ),
        },
      );
      setFlow(data.flow);
      setChallenge("");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Telegram login failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  function removeSession(session: TelegramSession) {
    setDeleteSession(session);
  }

  async function performRemoveSession(session: TelegramSession) {
    setBusy(session.id);
    try {
      await api(`/api/validator/telegram/sessions/${session.id}`, {
        method: "DELETE",
      });
      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      );
      setSelectedSessionIds((current) =>
        current.filter((id) => id !== session.id),
      );
      setDeleteSession(null);
      notify("Telegram session deleted.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to delete session",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function runBulkAction(
    action: "spam_check" | "warmup" | "warmup_mode",
  ) {
    if (!selectedSessionIds.length) return;
    setBusy(`bulk:${action}`);
    try {
      const result = await api<{ updated: number; skipped: number }>(
        "/api/validator/telegram/sessions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            sessionIds: selectedSessionIds,
            ...(action === "warmup_mode" ? { warmupMode: bulkWarmupMode } : {}),
          }),
        },
      );
      await load();
      notify(
        `${formatNumber(result.updated)} session${result.updated === 1 ? "" : "s"} updated${result.skipped ? `; ${result.skipped} skipped` : ""}.`,
        result.updated ? "success" : "info",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Bulk session action failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function runSessionAction(
    session: TelegramSession,
    action: "spam_check" | "warmup",
  ) {
    setBusy(`${action}:${session.id}`);
    try {
      await api(`/api/validator/telegram/sessions/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
      notify(
        action === "spam_check"
          ? "@SpamBot check queued."
          : "Warmup action queued.",
        "info",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to queue session action",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function setWarmupMode(session: TelegramSession, warmupMode: string) {
    setBusy(`settings:${session.id}`);
    try {
      const data = await api<{ session: TelegramSession }>(
        `/api/validator/telegram/sessions/${session.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warmupMode,
            warmupEnabled: warmupMode !== "off",
          }),
        },
      );
      setSessions((current) =>
        current.map((item) => (item.id === session.id ? data.session : item)),
      );
      notify("Warmup policy updated.", "success");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to update warmup policy",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function createFleet() {
    if (!fleetName.trim() || !fleetSessionIds.length) return;
    setBusy("fleet");
    try {
      await api("/api/validator/telegram/session-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fleetName, sessionIds: fleetSessionIds }),
      });
      setFleetName("");
      await load();
      notify("Session fleet saved.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to save fleet",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function removeFleet(fleet: TelegramSessionList) {
    setBusy(fleet.id);
    try {
      await api(`/api/validator/telegram/session-lists/${fleet.id}`, {
        method: "DELETE",
      });
      setFleets((current) => current.filter((item) => item.id !== fleet.id));
      notify("Session fleet deleted.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to delete fleet",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#b8ff4b]" />
      </div>
    );
  const flowWaiting =
    flow?.status === "awaiting_code" || flow?.status === "awaiting_password";

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className={`${PANEL} mb-5 rounded-[24px] p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-sm font-semibold">Bulk account controls</h3>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Select accounts once, then run SpamBot, warmup, or policy actions
              together.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button
              onClick={() =>
                setSelectedSessionIds(sessions.map((session) => session.id))
              }
              className={SECONDARY}
            >
              Select all
            </button>
            <button
              onClick={() =>
                setSelectedSessionIds(
                  sessions
                    .filter((session) => session.massDmEligible)
                    .map((session) => session.id),
                )
              }
              className={SECONDARY}
            >
              Select eligible
            </button>
            <button
              onClick={() => setSelectedSessionIds([])}
              disabled={!selectedSessionIds.length}
              className={SECONDARY}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {sessions.map((session) => (
            <label
              key={session.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selectedSessionIds.includes(session.id) ? "border-[#b8ff4b]/30 bg-[#b8ff4b]/[0.06]" : "border-white/[0.07] bg-[#071111]"}`}
            >
              <input
                type="checkbox"
                checked={selectedSessionIds.includes(session.id)}
                onChange={() =>
                  setSelectedSessionIds((current) =>
                    current.includes(session.id)
                      ? current.filter((id) => id !== session.id)
                      : [...current, session.id],
                  )
                }
                className="accent-[#b8ff4b]"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {session.label}
                </span>
                <span className="block truncate text-[9px] text-[#60706b]">
                  {session.username
                    ? `@${session.username}`
                    : session.phone || session.status}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#65e6ff]">
            <span className="h-px w-7 bg-current" />
            MTProto account vault
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Sessions, sealed and ready.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71807c]">
            API credentials, session material, login codes, 2FA passwords, and
            proxies are encrypted before PostgreSQL storage. Telegram
            connections run only in the dedicated Hydrogram worker.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b1717] px-4 py-3 text-xs text-[#71807c]">
          <span className="block font-mono text-xl text-[#eef7ed]">
            {sessions.length} / {account.sessionLimit ?? "unlimited"}
          </span>
          session allowance
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <form
            onSubmit={saveCredential}
            className={`${PANEL} rounded-[24px] p-5`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
                <KeyRound size={17} />
              </span>
              <div>
                <h3 className="text-sm font-semibold">
                  Telegram API credentials
                </h3>
                <p className="text-[10px] text-[#60706b]">
                  Required from my.telegram.org
                </p>
              </div>
            </div>
            <label className="mt-5 block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              API ID
              <input
                type="number"
                min={1}
                required
                value={apiId}
                onChange={(event) => setApiId(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </label>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              API hash
              <input
                type="password"
                required
                value={apiHash}
                onChange={(event) => setApiHash(event.target.value)}
                placeholder={
                  credential
                    ? "Enter a new hash to rotate"
                    : "32-character api_hash"
                }
                className={`${FIELD} mt-2 font-mono`}
              />
            </label>
            <button
              disabled={busy === "credential" || !apiId || !apiHash}
              className={`${PRIMARY} mt-4 w-full`}
            >
              {busy === "credential" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} />
              )}
              {credential ? "Rotate credentials" : "Encrypt and save"}
            </button>
            {credential && (
              <p className="mt-3 text-[10px] text-[#60706b]">
                Saved {relativeTime(credential.updatedAt)}. The API hash is
                never returned.
              </p>
            )}
          </form>

          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <Upload size={15} className="text-[#65e6ff]" />
              <h3 className="text-sm font-semibold">Import sessions</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#71807c]">
              Hydrogram strings, Pyrogram/Hydrogram SQLite, Telethon SQLite,
              JSON, TXT, or bounded ZIP archives.
            </p>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-white/10 bg-[#071111] p-5 text-center transition hover:border-[#65e6ff]/30">
              <input
                multiple
                type="file"
                accept=".session,.sqlite,.db,.json,.txt,.zip"
                className="hidden"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files || []))
                }
              />
              <CloudUpload size={22} className="text-[#65e6ff]" />
              <span className="mt-2 text-xs font-medium">
                {files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                  : "Choose session files"}
              </span>
            </label>
            <button
              onClick={uploadSessions}
              disabled={!credential || !files.length || busy === "upload"}
              className={`${SECONDARY} mt-3 w-full`}
            >
              {busy === "upload" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              Queue validation
            </button>
          </div>
        </aside>

        <section className="space-y-5">
          <div className={`${PANEL} rounded-[24px] p-5 sm:p-6`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b7ff]/10 text-[#d8b7ff]">
                <Smartphone size={17} />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Connect by phone</h3>
                <p className="text-[10px] text-[#60706b]">
                  Durable code and 2FA login
                </p>
              </div>
              {flow && <StatusPill status={flow.status} />}
            </div>
            {flowWaiting ? (
              <div className="mt-5 rounded-2xl border border-[#d8b7ff]/20 bg-[#d8b7ff]/[0.05] p-4">
                <p className="text-sm font-medium">
                  {flow.status === "awaiting_password"
                    ? "Two-step verification required"
                    : `Code sent to ${flow.phone}`}
                </p>
                <p className="mt-1 text-xs text-[#71807c]">
                  {flow.status === "awaiting_password"
                    ? "Enter the Telegram 2FA password. It is encrypted immediately and deleted after this attempt."
                    : "Enter the confirmation code from Telegram."}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    autoFocus
                    type={
                      flow.status === "awaiting_password" ? "password" : "text"
                    }
                    value={challenge}
                    onChange={(event) => setChallenge(event.target.value)}
                    className={FIELD}
                    placeholder={
                      flow.status === "awaiting_password"
                        ? "2FA password"
                        : "Confirmation code"
                    }
                  />
                  <button
                    onClick={submitChallenge}
                    disabled={!challenge || busy === "challenge"}
                    className={PRIMARY}
                  >
                    {busy === "challenge" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ArrowRight size={14} />
                    )}
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={beginLogin}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                  Phone number
                  <input
                    required
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+15551234567"
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                  Session label
                  <input
                    required
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Sales account 1"
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77] sm:col-span-2">
                  Proxy URL{" "}
                  <span className="font-normal normal-case tracking-normal text-[#53615d]">
                    optional
                  </span>
                  <input
                    value={proxyUrl}
                    onChange={(event) => setProxyUrl(event.target.value)}
                    placeholder="socks5://user:pass@host:port"
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <button
                  disabled={
                    !credential ||
                    busy === "login" ||
                    !!(
                      flow &&
                      !["completed", "failed", "expired", "cancelled"].includes(
                        flow.status,
                      )
                    )
                  }
                  className={`${PRIMARY} sm:col-span-2`}
                >
                  {busy === "login" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send Telegram code
                </button>
              </form>
            )}
            {flow?.errorMessage && (
              <div className="mt-4 flex gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-3 text-xs text-[#ff9b9b]">
                <AlertCircle size={14} className="shrink-0" />
                {flow.errorMessage}
              </div>
            )}
          </div>

          <div className={`${PANEL} overflow-hidden rounded-[24px]`}>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Account inventory</h3>
                <p className="text-[10px] text-[#60706b]">
                  Validation state updates through the Hydrogram worker
                </p>
              </div>
              <button
                onClick={() =>
                  load().catch((error) => notify(error.message, "error"))
                }
                className={SECONDARY}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
            <div className="divide-y divide-white/[0.055]">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${session.isLoggedIn ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : session.status === "error" ? "bg-[#ff7474]/10 text-[#ff8585]" : "bg-[#65e6ff]/10 text-[#65e6ff]"}`}
                  >
                    {session.status === "validating" ||
                    session.status === "queued_validation" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Smartphone size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {session.label}
                      </p>
                      <StatusPill status={session.status} />
                    </div>
                    <p className="mt-1 truncate text-[10px] text-[#60706b]">
                      {session.username
                        ? `@${session.username}`
                        : session.phone ||
                          session.sourceFilename ||
                          session.sessionFormat}{" "}
                      ·{" "}
                      {session.antiDetectEnabled
                        ? "anti-detect on"
                        : "standard identity"}
                      {session.proxyEnabled ? " · proxy on" : ""}
                    </p>
                    {session.lastErrorMessage && (
                      <p className="mt-1 truncate text-[10px] text-[#ff8585]">
                        {session.lastErrorCode}: {session.lastErrorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-[10px] text-[#60706b]">
                      <p>{formatNumber(session.messagesSent)} sent</p>
                      <p>{formatNumber(session.repliesReceived)} replies</p>
                    </div>
                    <button
                      onClick={() => removeSession(session)}
                      disabled={busy === session.id}
                      className="rounded-lg border border-white/[0.08] p-2 text-[#71807c] transition hover:border-[#ff7474]/20 hover:text-[#ff8585]"
                    >
                      {busy === session.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {!sessions.length && (
                <div className="flex flex-col items-center py-14 text-center">
                  <Smartphone size={28} className="text-[#40504b]" />
                  <p className="mt-3 text-sm text-[#71807c]">
                    No Telegram sessions yet.
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-[#53615d]">
                    Import an existing session or connect an account by phone
                    after saving API credentials.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <Layers3 size={15} className="text-[#d8b7ff]" />
              <h3 className="text-sm font-semibold">Named session fleets</h3>
            </div>
            <p className="mt-2 text-xs text-[#71807c]">
              Save reusable groups of sending accounts for campaign setup.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {sessions
                .filter(
                  (session) =>
                    session.isLoggedIn && session.status === "active",
                )
                .map((session) => (
                  <label
                    key={session.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#071111] p-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={fleetSessionIds.includes(session.id)}
                      onChange={() =>
                        setFleetSessionIds((current) =>
                          current.includes(session.id)
                            ? current.filter((id) => id !== session.id)
                            : [...current, session.id],
                        )
                      }
                      className="accent-[#d8b7ff]"
                    />
                    <span className="truncate">{session.label}</span>
                  </label>
                ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={fleetName}
                onChange={(event) => setFleetName(event.target.value)}
                placeholder="Fleet name"
                className={FIELD}
              />
              <button
                onClick={createFleet}
                disabled={
                  !fleetName.trim() ||
                  !fleetSessionIds.length ||
                  busy === "fleet"
                }
                className={PRIMARY}
              >
                {busy === "fleet" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Save fleet
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {fleets.map((fleet) => (
                <div
                  key={fleet.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{fleet.name}</p>
                    <p className="mt-1 text-[9px] text-[#60706b]">
                      {fleet.members.length} sessions ·{" "}
                      {fleet.members
                        .map((member) => member.session.label)
                        .join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFleet(fleet)}
                    className="rounded-lg border border-white/[0.08] p-2 text-[#71807c] hover:text-[#ff8585]"
                  >
                    {busy === fleet.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#f4ca64]" />
              <h3 className="text-sm font-semibold">Session safety</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#71807c]">
              Mass messaging requires a clean SpamBot check from the last seven
              days, risk below 70, no active cooldown, and remaining daily
              warmup capacity.
            </p>
            <div className="mt-3 grid gap-2 rounded-xl border border-white/[0.07] bg-[#071111] p-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
              <label className="text-[9px] uppercase tracking-wider text-[#60706b]">
                Policy for {selectedSessionIds.length || "selected"}
                <select
                  value={bulkWarmupMode}
                  onChange={(event) => setBulkWarmupMode(event.target.value)}
                  className={`${FIELD} mt-1 py-2 text-xs`}
                >
                  <option value="safe">
                    Safe · read oriented · 14-day ramp
                  </option>
                  <option value="standard">
                    Standard · human actions · 7-day ramp
                  </option>
                  <option value="off">
                    Off · no background actions · 14-day ramp
                  </option>
                </select>
              </label>
              <button
                onClick={() => runBulkAction("spam_check")}
                disabled={
                  !selectedSessionIds.length || busy.startsWith("bulk:")
                }
                className={SECONDARY}
              >
                {busy === "bulk:spam_check" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ShieldCheck size={13} />
                )}
                Check SpamBot
              </button>
              <button
                onClick={() => runBulkAction("warmup")}
                disabled={
                  !selectedSessionIds.length || busy.startsWith("bulk:")
                }
                className={SECONDARY}
              >
                {busy === "bulk:warmup" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                Warm now
              </button>
              <button
                onClick={() => runBulkAction("warmup_mode")}
                disabled={
                  !selectedSessionIds.length || busy.startsWith("bulk:")
                }
                className={SECONDARY}
              >
                {busy === "bulk:warmup_mode" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                Apply policy
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-semibold">
                          {session.label}
                        </p>
                        <StatusPill status={session.spamStatus} />
                        <span
                          className={`text-[9px] ${session.massDmEligible ? "text-[#b8ff4b]" : "text-[#f4ca64]"}`}
                        >
                          {session.massDmEligible
                            ? "Mass DM ready"
                            : session.eligibilityReason}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] text-[#60706b]">
                        Risk {Math.round(session.riskScore)} · warmup day{" "}
                        {session.warmupDay} ·{" "}
                        {session.dailyLimit == null
                          ? "no daily ramp limit"
                          : `${session.dailyMessagesSent}/${session.dailyLimit} sent today`}{" "}
                        · checked {relativeTime(session.spamCheckedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => runSessionAction(session, "spam_check")}
                        disabled={
                          !session.isLoggedIn ||
                          busy === `spam_check:${session.id}`
                        }
                        className={SECONDARY}
                      >
                        {busy === `spam_check:${session.id}` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={13} />
                        )}
                        Check
                      </button>
                      <button
                        onClick={() => runSessionAction(session, "warmup")}
                        disabled={
                          !session.warmupEnabled ||
                          busy === `warmup:${session.id}`
                        }
                        className={SECONDARY}
                      >
                        {busy === `warmup:${session.id}` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        Warm now
                      </button>
                    </div>
                  </div>
                  <label className="mt-3 block text-[9px] uppercase tracking-wider text-[#60706b]">
                    Warmup policy
                    <select
                      value={session.warmupMode}
                      disabled={busy === `settings:${session.id}`}
                      onChange={(event) =>
                        setWarmupMode(session, event.target.value)
                      }
                      className={`${FIELD} mt-1 py-2 text-xs`}
                    >
                      <option value="safe">
                        Safe · read oriented · 14-day ramp
                      </option>
                      <option value="standard">
                        Standard · human actions · 7-day ramp
                      </option>
                      <option value="off">
                        Off · no background actions · 14-day ramp
                      </option>
                    </select>
                  </label>
                  {session.healthCooldownUntil && (
                    <p className="mt-2 text-[9px] text-[#f4ca64]">
                      Cooldown until{" "}
                      {new Date(session.healthCooldownUntil).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
              {!sessions.length && (
                <p className="py-4 text-center text-xs text-[#60706b]">
                  Connect a session to begin safety checks.
                </p>
              )}
            </div>
          </div>
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-[#65e6ff]" />
              <h3 className="text-sm font-semibold">
                Behavior and detection log
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#71807c]">
              Append-only warmup, pacing, SpamBot, flood, and safety events.
            </p>
            <div className="mt-4 space-y-2">
              {behaviorLogs.slice(0, 20).map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${entry.severity === "critical" ? "bg-[#ff7474]" : entry.severity === "warning" ? "bg-[#f4ca64]" : "bg-[#65e6ff]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-medium">
                        {entry.action.replaceAll("_", " ")}
                      </p>
                      <span className="text-[9px] text-[#53615d]">
                        {relativeTime(entry.performedAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-[#60706b]">
                      {entry.session?.label || "Deleted session"}
                      {entry.target ? ` · ${entry.target}` : ""}
                      {entry.errorCode ? ` · ${entry.errorCode}` : ""}
                    </p>
                    {entry.errorMessage && (
                      <p className="mt-1 truncate text-[9px] text-[#ff8585]">
                        {entry.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {!behaviorLogs.length && (
                <p className="py-5 text-center text-xs text-[#60706b]">
                  No behavior events recorded yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      {deleteSession && (
        <ConfirmModal
          title={`Delete ${deleteSession.label}?`}
          description="The encrypted session and its fleet memberships will be removed. Existing campaign reports retain a deleted-session marker."
          confirmLabel="Delete session"
          busy={busy === deleteSession.id}
          onClose={() => setDeleteSession(null)}
          onConfirm={() => performRemoveSession(deleteSession)}
        />
      )}
    </div>
  );
}

type MessagingWorkflow = "users" | "direct" | "groups" | "fanout" | "schedules";

function MessagingView(props: {
  account: Account;
  lists: ContactList[];
  notify: (message: string, tone?: Toast["tone"]) => void;
  openReports: () => void;
  onUsageChanged: () => Promise<void>;
}) {
  const [workflow, setWorkflow] = useState<MessagingWorkflow>("users");
  const workflows: Array<{
    id: MessagingWorkflow;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    {
      id: "users",
      label: "User campaigns",
      description: "Distribute a list across accounts",
      icon: Users,
    },
    {
      id: "direct",
      label: "Direct message",
      description: "One account to one user",
      icon: Send,
    },
    {
      id: "groups",
      label: "Groups & channels",
      description: "Every account to every destination",
      icon: Globe,
    },
    {
      id: "fanout",
      label: "Every-account DM",
      description: "Every account to up to 50 users",
      icon: Layers3,
    },
    {
      id: "schedules",
      label: "Schedules",
      description: "Recurring group or channel runs",
      icon: History,
    },
  ];
  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8b7ff]">
          <span className="h-px w-7 bg-current" />
          Durable delivery desk
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Choose the job.
          <br />
          <span className="text-[#71807c]">
            Keep every attempt accountable.
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71807c]">
          User distribution, direct sends, group fan-out, every-account DM, and
          recurring delivery each enforce their own contract while sharing one
          durable report ledger.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {workflows.map((item) => (
          <button
            key={item.id}
            onClick={() => setWorkflow(item.id)}
            className={`rounded-2xl border p-3 text-left transition ${workflow === item.id ? "border-[#d8b7ff]/35 bg-[#d8b7ff]/[0.07]" : "border-white/[0.07] bg-[#0b1717] hover:border-white/15"}`}
          >
            <item.icon
              size={16}
              className={
                workflow === item.id ? "text-[#d8b7ff]" : "text-[#60706b]"
              }
            />
            <span className="mt-2 block text-xs font-semibold">
              {item.label}
            </span>
            <span className="mt-1 block text-[9px] leading-4 text-[#60706b]">
              {item.description}
            </span>
          </button>
        ))}
      </div>
      <MessagingCampaignWorkspace
        key={workflow}
        {...props}
        workflow={workflow}
      />
    </div>
  );
}

function MessagingCampaignWorkspace({
  account,
  lists,
  notify,
  openReports,
  onUsageChanged,
  workflow,
}: {
  account: Account;
  lists: ContactList[];
  notify: (message: string, tone?: Toast["tone"]) => void;
  openReports: () => void;
  onUsageChanged: () => Promise<void>;
  workflow: MessagingWorkflow;
}) {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [campaigns, setCampaigns] = useState<TelegramCampaign[]>([]);
  const [fleets, setFleets] = useState<TelegramSessionList[]>([]);
  const [schedules, setSchedules] = useState<TelegramMessageSchedule[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [manualTargets, setManualTargets] = useState("");
  const [sourceListId, setSourceListId] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [mode, setMode] = useState(
    workflow === "groups" || workflow === "fanout" || workflow === "schedules"
      ? "fanout"
      : "balanced",
  );
  const [parseMode, setParseMode] = useState("text");
  const [minDelay, setMinDelay] = useState("3");
  const [maxDelay, setMaxDelay] = useState("8");
  const [pacingMode, setPacingMode] = useState("auto");
  const [perSessionBurst, setPerSessionBurst] = useState("5");
  const [cooldownMin, setCooldownMin] = useState("15");
  const [cooldownMax, setCooldownMax] = useState("30");
  const [perSessionQuota, setPerSessionQuota] = useState("10");
  const [trackReplies, setTrackReplies] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(
    workflow === "schedules",
  );
  const [scheduleTargetType, setScheduleTargetType] = useState<
    "users" | "groups"
  >("groups");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [nextRunAt, setNextRunAt] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [testSessionId, setTestSessionId] = useState("");
  const [testing, setTesting] = useState(false);
  const [deleteSchedule, setDeleteSchedule] =
    useState<TelegramMessageSchedule | null>(null);

  async function load() {
    const [sessionData, campaignData, fleetData, scheduleData] =
      await Promise.all([
        api<{ sessions: TelegramSession[] }>(
          "/api/validator/telegram/sessions",
        ),
        api<{ campaigns: TelegramCampaign[] }>(
          "/api/validator/telegram/campaigns?limit=20",
        ),
        api<{ lists: TelegramSessionList[] }>(
          "/api/validator/telegram/session-lists",
        ),
        api<{ schedules: TelegramMessageSchedule[] }>(
          "/api/validator/telegram/schedules",
        ),
      ]);
    const activeSessions = (sessionData.sessions || []).filter(
      (session) => session.isLoggedIn && session.status === "active",
    );
    setSessions(activeSessions);
    const eligibleSessions = activeSessions.filter(
      (session) => session.massDmEligible,
    );
    setSelectedSessions((current) => {
      const retained = current.filter((id) =>
        eligibleSessions.some((session) => session.id === id),
      );
      if (workflow === "direct")
        return retained.slice(0, 1).length
          ? retained.slice(0, 1)
          : eligibleSessions.slice(0, 1).map((session) => session.id);
      return retained.length
        ? retained
        : eligibleSessions.map((session) => session.id);
    });
    setCampaigns(campaignData.campaigns || []);
    setFleets(fleetData.lists || []);
    setSchedules(scheduleData.schedules || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        load()
          .catch((error) => notify(error.message, "error"))
          .finally(() => setLoading(false)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = campaigns.some((campaign) =>
    ["pending", "running"].includes(campaign.status),
  );
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => load().catch(() => undefined), 1500);
    return () => window.clearInterval(timer);
  }, [hasActive]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const targetType =
        workflow === "schedules"
          ? scheduleTargetType
          : workflow === "groups"
            ? "groups"
            : "users";
      const deliveryMode =
        workflow === "groups" || workflow === "fanout"
          ? "fanout"
          : workflow === "schedules" && targetType === "groups"
            ? "fanout"
            : workflow === "direct"
              ? "balanced"
              : mode;
      if (scheduleEnabled) {
        const manual = manualTargets
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean);
        await api("/api/validator/telegram/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            message,
            targetType,
            mode: deliveryMode,
            parseMode,
            sourceListId:
              targetType === "users" && sourceListId ? sourceListId : null,
            sessionIds: selectedSessions,
            manualTargets: manual,
            intervalMinutes: Number(intervalMinutes),
            nextRunAt: nextRunAt
              ? new Date(nextRunAt).toISOString()
              : new Date().toISOString(),
            configuration: {
              minDelaySeconds: Number(minDelay),
              maxDelaySeconds: Number(maxDelay),
              maxFloodWaitSeconds: 120,
              trackReplies: targetType === "users" && trackReplies,
              replyWindowHours: 24,
              pacingMode,
              perSessionBurst: Number(perSessionBurst),
              cooldownSecondsMin: Number(cooldownMin),
              cooldownSecondsMax: Number(cooldownMax),
              perSessionQuota: Number(perSessionQuota),
            },
          }),
        });
        setName("");
        setMessage("");
        setManualTargets("");
        setScheduleEnabled(workflow === "schedules");
        setNextRunAt("");
        await load();
        notify("Recurring campaign schedule saved.", "success");
        return;
      }
      const data = await api<{ campaign: TelegramCampaign }>(
        "/api/validator/telegram/campaigns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            message,
            targetType,
            mode: deliveryMode,
            parseMode,
            sourceListId:
              targetType === "users" && workflow !== "direct" && sourceListId
                ? sourceListId
                : null,
            sessionIds: selectedSessions,
            manualTargets,
            trackReplies: targetType === "users" && trackReplies,
            replyWindowHours: 24,
            minDelaySeconds: Number(minDelay),
            maxDelaySeconds: Number(maxDelay),
            maxFloodWaitSeconds: 120,
            pacingMode,
            perSessionBurst: Number(perSessionBurst),
            cooldownSecondsMin: Number(cooldownMin),
            cooldownSecondsMax: Number(cooldownMax),
            perSessionQuota: Number(perSessionQuota),
          }),
        },
      );
      setCampaigns((current) => [data.campaign, ...current]);
      setName("");
      setMessage("");
      setManualTargets("");
      await onUsageChanged();
      notify(
        `Campaign queued with ${formatNumber(data.campaign.totalCount)} message attempts.`,
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to create campaign",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(campaign: TelegramCampaign) {
    try {
      await api(`/api/validator/telegram/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      await load();
      notify("Campaign cancellation requested.", "info");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to cancel campaign",
        "error",
      );
    }
  }

  async function updateSchedule(
    schedule: TelegramMessageSchedule,
    action: "toggle" | "delete",
  ) {
    try {
      await api(
        `/api/validator/telegram/schedules/${schedule.id}`,
        action === "delete"
          ? { method: "DELETE" }
          : {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: schedule.status === "active" ? "paused" : "active",
                ...(schedule.status !== "active"
                  ? { nextRunAt: new Date().toISOString() }
                  : {}),
              }),
            },
      );
      await load();
      if (action === "delete") setDeleteSchedule(null);
      notify(
        action === "delete"
          ? "Schedule deleted."
          : `Schedule ${schedule.status === "active" ? "paused" : "resumed"}.`,
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to update schedule",
        "error",
      );
    }
  }

  async function sendTest() {
    if (!testSessionId || !testTarget.trim() || !message.trim()) return;
    setTesting(true);
    try {
      const data = await api<{ campaign: TelegramCampaign }>(
        "/api/validator/telegram/campaigns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Test · ${name.trim() || "message preview"}`,
            message,
            targetType:
              workflow === "groups" ||
              (workflow === "schedules" && scheduleTargetType === "groups")
                ? "groups"
                : "users",
            mode:
              workflow === "groups" ||
              (workflow === "schedules" && scheduleTargetType === "groups")
                ? "fanout"
                : "balanced",
            parseMode,
            sessionIds: [testSessionId],
            manualTargets: [testTarget.trim()],
            trackReplies: false,
            minDelaySeconds: 0,
            maxDelaySeconds: 0,
            pacingMode: "manual",
            perSessionBurst: 1,
            cooldownSecondsMin: 0,
            cooldownSecondsMax: 0,
          }),
        },
      );
      setCampaigns((current) => [data.campaign, ...current]);
      setTestOpen(false);
      setTestTarget("");
      await onUsageChanged();
      notify("Test message queued as a one-attempt campaign.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to queue test message",
        "error",
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#b8ff4b]" />
      </div>
    );
  const manualTargetCount = new Set(
    manualTargets
      .split(/\r?\n|,/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const sourceTargetCount =
    workflow === "users" ||
    workflow === "fanout" ||
    (workflow === "schedules" && scheduleTargetType === "users")
      ? sourceListId
        ? lists.find((list) => list.id === sourceListId)?.itemsCount || 0
        : 0
      : 0;
  const targetEstimate = sourceTargetCount + manualTargetCount;
  const effectiveMode =
    workflow === "groups" ||
    workflow === "fanout" ||
    (workflow === "schedules" && scheduleTargetType === "groups")
      ? "fanout"
      : workflow === "direct"
        ? "balanced"
        : mode;
  const attempts =
    effectiveMode === "fanout"
      ? targetEstimate * selectedSessions.length
      : targetEstimate;
  const directInvalid =
    workflow === "direct" &&
    (manualTargetCount !== 1 || selectedSessions.length !== 1);
  const fanoutOverLimit =
    (workflow === "fanout" ||
      (workflow === "schedules" &&
        scheduleTargetType === "users" &&
        effectiveMode === "fanout")) &&
    targetEstimate > 50;
  const workflowTitle =
    workflow === "users"
      ? "Distribute user outreach"
      : workflow === "direct"
        ? "Send one direct message"
        : workflow === "groups"
          ? "Broadcast to groups and channels"
          : workflow === "fanout"
            ? "Send from every account"
            : "Schedule recurring delivery";
  const targetLabel =
    workflow === "groups" ||
    (workflow === "schedules" && scheduleTargetType === "groups")
      ? "Groups and channels"
      : workflow === "direct"
        ? "Recipient"
        : "Manual users";
  const targetHelp =
    workflow === "groups" ||
    (workflow === "schedules" && scheduleTargetType === "groups")
      ? "public @handles, t.me links, invite links, or Telegram IDs"
      : "usernames, user t.me links, or Telegram IDs";

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.025em]">
            {workflowTitle}
          </h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#71807c]">
            Every attempt, Telegram message ID, sending account, error, and
            eligible reply is persisted even after this page closes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="Ready accounts"
            value={sessions.filter((session) => session.massDmEligible).length}
            icon={Smartphone}
            color="text-[#65e6ff]"
          />
          <Metric
            label="Attempts left"
            value={
              account.messagesRemaining == null
                ? "Unlimited"
                : formatNumber(account.messagesRemaining)
            }
            icon={Send}
            color="text-[#b8ff4b]"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_390px]">
        <form
          onSubmit={create}
          className={`${PANEL} rounded-[28px] p-5 sm:p-7`}
        >
          {workflow === "schedules" && (
            <div className="mb-5 rounded-2xl border border-[#d8b7ff]/15 bg-[#d8b7ff]/[0.035] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f7fa6]">
                Schedule audience
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "groups", label: "Groups & channels" },
                    { id: "users", label: "User distribution" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setScheduleTargetType(option.id);
                      setMode(option.id === "groups" ? "fanout" : "balanced");
                      setSourceListId("");
                      setManualTargets("");
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs transition ${scheduleTargetType === option.id ? "border-[#d8b7ff]/30 bg-[#d8b7ff]/[0.07] text-[#e6d6ff]" : "border-white/[0.07] text-[#71807c]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                {scheduleEnabled ? "Schedule name" : "Campaign name"}
              </span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
                placeholder={
                  workflow === "direct"
                    ? "Direct follow-up"
                    : workflow === "groups" || workflow === "schedules"
                      ? "Community announcement"
                      : "July community outreach"
                }
                className={`${FIELD} mt-2`}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                Delivery contract
              </span>
              {workflow === "users" ||
              (workflow === "schedules" && scheduleTargetType === "users") ? (
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className={`${FIELD} mt-2`}
                >
                  <option value="balanced">Balanced rotation</option>
                  <option value="parallel">Parallel shared queue</option>
                  <option value="split">Parallel split quota</option>
                  <option value="failover">Sequential failover</option>
                  {workflow === "schedules" && (
                    <option value="fanout">
                      Every account fan-out (50 max)
                    </option>
                  )}
                </select>
              ) : (
                <div className={`${FIELD} mt-2 cursor-default text-[#b8c5c1]`}>
                  {workflow === "direct"
                    ? "One account → one user"
                    : workflow === "fanout"
                      ? "Every account → every user"
                      : "Every account → every group/channel"}
                </div>
              )}
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              Message
            </span>
            <textarea
              required
              rows={7}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4096}
              placeholder="Write the message exactly as recipients should receive it..."
              className={`${FIELD} mt-2 resize-y`}
            />
            <span className="mt-1 block text-right font-mono text-[9px] text-[#53615d]">
              {message.length} / 4096
            </span>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(workflow === "users" ||
              workflow === "fanout" ||
              (workflow === "schedules" && scheduleTargetType === "users")) && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                  Source list
                </span>
                <select
                  value={sourceListId}
                  onChange={(event) => setSourceListId(event.target.value)}
                  className={`${FIELD} mt-2`}
                >
                  <option value="">Manual targets only</option>
                  {lists
                    .filter((list) => list.type !== "profile")
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} · {formatNumber(list.itemsCount)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                Formatting
              </span>
              <select
                value={parseMode}
                onChange={(event) => setParseMode(event.target.value)}
                className={`${FIELD} mt-2`}
              >
                <option value="text">Plain text</option>
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              {targetLabel}{" "}
              <span className="font-normal normal-case tracking-normal text-[#53615d]">
                one {targetHelp} per line
              </span>
            </span>
            <textarea
              rows={workflow === "direct" ? 2 : 5}
              value={manualTargets}
              onChange={(event) => setManualTargets(event.target.value)}
              placeholder={
                workflow === "groups" ||
                (workflow === "schedules" && scheduleTargetType === "groups")
                  ? "@community\nhttps://t.me/example_channel\nhttps://t.me/+invite"
                  : "@username\nhttps://t.me/another_user\n123456789"
              }
              className={`${FIELD} mt-2 font-mono`}
            />
          </label>
          {workflow === "direct" && manualTargetCount !== 1 && (
            <p className="mt-2 text-[10px] text-[#f4ca64]">
              Direct message requires exactly one recipient.
            </p>
          )}
          {workflow === "fanout" && (
            <p
              className={`mt-2 text-[10px] ${fanoutOverLimit ? "text-[#ff8585]" : "text-[#71807c]"}`}
            >
              {targetEstimate} / 50 unique targets. Every selected account
              creates one attempt per target; lists over 50 are rejected without
              truncation.
            </p>
          )}
          <div className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                {workflow === "direct" ? "Sending account" : "Sending fleet"}
              </p>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {workflow !== "direct" && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSessions(
                          sessions
                            .filter((session) => session.massDmEligible)
                            .map((session) => session.id),
                        )
                      }
                      className="text-[10px] text-[#65e6ff]"
                    >
                      Select eligible
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSessions([])}
                      className="text-[10px] text-[#81908c]"
                    >
                      Clear
                    </button>
                  </>
                )}
                {fleets.length > 0 && workflow !== "direct" && (
                  <select
                    onChange={(event) => {
                      const fleet = fleets.find(
                        (item) => item.id === event.target.value,
                      );
                      if (fleet)
                        setSelectedSessions(
                          fleet.members
                            .map((member) => member.sessionId)
                            .filter((id) =>
                              sessions.some(
                                (session) =>
                                  session.id === id && session.massDmEligible,
                              ),
                            ),
                        );
                    }}
                    className="rounded-lg border border-white/10 bg-[#071111] px-2 py-1 text-[10px] text-[#81908c]"
                  >
                    <option value="">Apply named fleet</option>
                    {fleets.map((fleet) => (
                      <option key={fleet.id} value={fleet.id}>
                        {fleet.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {sessions.map((session) => (
                <label
                  key={session.id}
                  title={session.eligibilityReason || undefined}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition ${!session.massDmEligible ? "cursor-not-allowed border-[#f4ca64]/15 bg-[#f4ca64]/[0.03] opacity-60" : selectedSessions.includes(session.id) ? "cursor-pointer border-[#65e6ff]/30 bg-[#65e6ff]/[0.06]" : "cursor-pointer border-white/[0.07] bg-[#071111]"}`}
                >
                  <input
                    type={workflow === "direct" ? "radio" : "checkbox"}
                    name={workflow === "direct" ? "direct-session" : undefined}
                    disabled={!session.massDmEligible}
                    checked={selectedSessions.includes(session.id)}
                    onChange={() =>
                      setSelectedSessions((current) =>
                        workflow === "direct"
                          ? [session.id]
                          : current.includes(session.id)
                            ? current.filter((id) => id !== session.id)
                            : [...current, session.id],
                      )
                    }
                    className="accent-[#65e6ff]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {session.label}
                    </span>
                    <span
                      className={`block truncate text-[9px] ${session.massDmEligible ? "text-[#60706b]" : "text-[#f4ca64]"}`}
                    >
                      {session.massDmEligible
                        ? `${session.username ? `@${session.username}` : session.phone} · risk ${Math.round(session.riskScore)}`
                        : session.eligibilityReason}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!sessions.length && (
              <div className="mt-2 rounded-xl border border-[#f4ca64]/20 bg-[#f4ca64]/[0.05] p-3 text-xs text-[#c8ad69]">
                Connect or import at least one active Telegram session before
                launching a campaign.
              </div>
            )}
          </div>
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
            {(workflow === "users" ||
              (workflow === "schedules" && scheduleTargetType === "users")) &&
              mode === "split" && (
                <label className="mb-3 block text-[10px] uppercase tracking-wider text-[#6d7b77]">
                  Requested DMs per account
                  <input
                    type="number"
                    min={1}
                    max={200000}
                    value={perSessionQuota}
                    onChange={(event) => setPerSessionQuota(event.target.value)}
                    className={`${FIELD} mt-2 max-w-xs`}
                  />
                  <span className="mt-1 block normal-case tracking-normal text-[#60706b]">
                    Signal Desk raises this only when needed to cover the full
                    audience without dropping targets.
                  </span>
                </label>
              )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                Pacing
                <select
                  value={pacingMode}
                  onChange={(event) => setPacingMode(event.target.value)}
                  className={`${FIELD} mt-2`}
                >
                  <option value="auto">Automatic safety bands</option>
                  <option value="manual">Manual burst plan</option>
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                Min delay
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step="0.5"
                  disabled={pacingMode === "auto"}
                  value={minDelay}
                  onChange={(event) => setMinDelay(event.target.value)}
                  className={`${FIELD} mt-2`}
                />
              </label>
              <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                Max delay
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step="0.5"
                  disabled={pacingMode === "auto"}
                  value={maxDelay}
                  onChange={(event) => setMaxDelay(event.target.value)}
                  className={`${FIELD} mt-2`}
                />
              </label>
            </div>
            {pacingMode === "manual" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                  Messages per burst
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={perSessionBurst}
                    onChange={(event) => setPerSessionBurst(event.target.value)}
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                  Cooldown min
                  <input
                    type="number"
                    min={0}
                    max={1800}
                    value={cooldownMin}
                    onChange={(event) => setCooldownMin(event.target.value)}
                    className={`${FIELD} mt-2`}
                  />
                </label>
                <label className="text-[10px] uppercase tracking-wider text-[#6d7b77]">
                  Cooldown max
                  <input
                    type="number"
                    min={0}
                    max={1800}
                    value={cooldownMax}
                    onChange={(event) => setCooldownMax(event.target.value)}
                    className={`${FIELD} mt-2`}
                  />
                </label>
              </div>
            )}
            {workflow !== "groups" &&
              !(
                workflow === "schedules" && scheduleTargetType === "groups"
              ) && (
                <label className="mt-3 flex items-center gap-2 text-xs text-[#81908c]">
                  <input
                    type="checkbox"
                    checked={trackReplies}
                    onChange={(event) => setTrackReplies(event.target.checked)}
                    className="accent-[#b8ff4b]"
                  />
                  Track replies for 24 hours
                </label>
              )}
          </div>
          {workflow === "schedules" && (
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3">
              <p className="text-xs font-medium text-[#d8b7ff]">
                Recurring schedule
              </p>
              <p className="mt-1 text-[10px] text-[#60706b]">
                Each run creates a new durable campaign and report.
              </p>
              {scheduleEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[10px] uppercase tracking-wider text-[#60706b]">
                    Every minutes
                    <input
                      type="number"
                      min={5}
                      value={intervalMinutes}
                      onChange={(event) =>
                        setIntervalMinutes(event.target.value)
                      }
                      className={`${FIELD} mt-1`}
                    />
                  </label>
                  <label className="text-[10px] uppercase tracking-wider text-[#60706b]">
                    First run
                    <input
                      type="datetime-local"
                      value={nextRunAt}
                      onChange={(event) => setNextRunAt(event.target.value)}
                      className={`${FIELD} mt-1`}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#071111] p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-mono text-lg text-white">
                ~{formatNumber(attempts)} attempts{" "}
                {scheduleEnabled ? "per run" : ""}
              </p>
              <p className="text-[10px] text-[#60706b]">
                Deduplication and final quota checks happen atomically at
                launch.
              </p>
            </div>
            <button
              disabled={
                submitting ||
                !name.trim() ||
                !message.trim() ||
                !selectedSessions.length ||
                !targetEstimate ||
                directInvalid ||
                fanoutOverLimit
              }
              className={PRIMARY}
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {submitting
                ? "Saving..."
                : scheduleEnabled
                  ? "Save schedule"
                  : "Launch campaign"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTestSessionId(selectedSessions[0] || "");
                setTestTarget(
                  manualTargets
                    .split(/\r?\n|,/)
                    .find((value) => value.trim())
                    ?.trim() || "",
                );
                setTestOpen(true);
              }}
              disabled={
                !message.trim() ||
                !sessions.some((session) => session.massDmEligible)
              }
              className={SECONDARY}
            >
              <Send size={14} /> Test one
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#60706b]">
                  Recent dispatches
                </p>
                <h3 className="mt-1 text-sm font-semibold">Campaign queue</h3>
              </div>
              <button onClick={openReports} className={SECONDARY}>
                All reports
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {campaigns.slice(0, 8).map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs font-medium">
                      {campaign.name}
                    </p>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full bg-gradient-to-r from-[#40d6c2] to-[#b8ff4b] transition-[width]"
                      style={{ width: `${campaign.progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-[#60706b]">
                    <span>
                      {formatNumber(campaign.sentCount)} sent ·{" "}
                      {formatNumber(campaign.failedCount)} failed
                    </span>
                    {["pending", "running"].includes(campaign.status) ? (
                      <button
                        onClick={() => cancel(campaign)}
                        className="text-[#ff8585]"
                      >
                        Stop
                      </button>
                    ) : (
                      <button onClick={openReports} className="text-[#65e6ff]">
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!campaigns.length && (
                <p className="py-8 text-center text-xs text-[#60706b]">
                  No campaigns launched yet.
                </p>
              )}
            </div>
          </div>
          {schedules.length > 0 && (
            <div className={`${PANEL} rounded-[24px] p-5`}>
              <h3 className="text-sm font-semibold">Recurring schedules</h3>
              <div className="mt-3 space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium">
                        {schedule.name}
                      </p>
                      <StatusPill status={schedule.status} />
                    </div>
                    <p className="mt-1 text-[9px] text-[#60706b]">
                      {schedule.targetType === "groups" ? "Groups" : "Users"} ·{" "}
                      {schedule.mode.replaceAll("_", " ")} · every{" "}
                      {schedule.intervalMinutes}m · {schedule.runCount} runs ·
                      next {relativeTime(schedule.nextRunAt)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => updateSchedule(schedule, "toggle")}
                        className="text-[9px] text-[#65e6ff]"
                      >
                        {schedule.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={() => setDeleteSchedule(schedule)}
                        className="text-[9px] text-[#ff8585]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={`${PANEL} rounded-[24px] p-5`}>
            <ShieldCheck size={16} className="text-[#b8ff4b]" />
            <h3 className="mt-3 text-sm font-semibold">
              Quota is transactional
            </h3>
            <p className="mt-2 text-xs leading-5 text-[#71807c]">
              Attempts are reserved before launch. Unsent rows are refunded
              after completion, cancellation, access revocation, or worker
              failure. Sent messages remain charged.
            </p>
          </div>
        </aside>
      </div>
      {testOpen && (
        <Modal
          title="Send one test message"
          description="This uses the current message and formatting, and records one normal billable attempt in Reports."
          onClose={() => setTestOpen(false)}
        >
          <div className="space-y-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              Sending account
              <select
                value={testSessionId}
                onChange={(event) => setTestSessionId(event.target.value)}
                className={`${FIELD} mt-2`}
              >
                <option value="">Choose one eligible account</option>
                {sessions
                  .filter((session) => session.massDmEligible)
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.label}
                      {session.username ? ` · @${session.username}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
              Test destination
              <input
                value={testTarget}
                onChange={(event) => setTestTarget(event.target.value)}
                placeholder={
                  workflow === "groups" ||
                  (workflow === "schedules" && scheduleTargetType === "groups")
                    ? "@test_channel"
                    : "@test_user"
                }
                className={`${FIELD} mt-2 font-mono`}
              />
            </label>
            <div className="rounded-xl border border-white/[0.07] bg-[#071111] p-3">
              <p className="text-[9px] uppercase tracking-wider text-[#60706b]">
                Message preview
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#dce7e3]">
                {message}
              </p>
            </div>
            <button
              onClick={sendTest}
              disabled={testing || !testSessionId || !testTarget.trim()}
              className={`${PRIMARY} w-full`}
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {testing ? "Queueing test..." : "Send test message"}
            </button>
          </div>
        </Modal>
      )}
      {deleteSchedule && (
        <ConfirmModal
          title={`Delete ${deleteSchedule.name}?`}
          description="Future runs will stop permanently. Campaigns and reports already created from this schedule remain available."
          confirmLabel="Delete schedule"
          onClose={() => setDeleteSchedule(null)}
          onConfirm={() => updateSchedule(deleteSchedule, "delete")}
        />
      )}
    </div>
  );
}

function ReportsView({
  notify,
}: {
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [campaigns, setCampaigns] = useState<TelegramCampaign[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<{
    campaign: TelegramCampaign;
    recipients: TelegramCampaignRecipient[];
    sessions: Array<{
      sessionId: string;
      assignedCount: number;
      sentCount: number;
      failedCount: number;
      status: string;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
      session: { label: string; username: string | null; phone: string | null };
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCampaigns() {
    const data = await api<{ campaigns: TelegramCampaign[] }>(
      "/api/validator/telegram/campaigns?limit=100",
    );
    setCampaigns(data.campaigns || []);
    const id = selectedId || data.campaigns?.[0]?.id || "";
    if (id) {
      setSelectedId(id);
      setDetail(await api(`/api/validator/telegram/campaigns/${id}`));
    } else setDetail(null);
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        loadCampaigns()
          .catch((error) => notify(error.message, "error"))
          .finally(() => setLoading(false)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    const selected = campaigns.find((campaign) => campaign.id === selectedId);
    if (
      !selected ||
      (!["pending", "running"].includes(selected.status) &&
        selected.replyTrackingStatus !== "tracking")
    )
      return;
    const timer = window.setInterval(
      () => loadCampaigns().catch(() => undefined),
      2000,
    );
    return () => window.clearInterval(timer);
  }, [selectedId, campaigns]); // eslint-disable-line react-hooks/exhaustive-deps

  async function select(id: string) {
    setSelectedId(id);
    setLoading(true);
    try {
      setDetail(await api(`/api/validator/telegram/campaigns/${id}`));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to load report",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading && !detail)
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#b8ff4b]" />
      </div>
    );
  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4ca64]">
            <span className="h-px w-7 bg-current" />
            Message ledger
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Delivery, account by account.
          </h2>
          <p className="mt-2 text-sm text-[#71807c]">
            One durable row per recipient and sending session, with Telegram
            message IDs, errors, and reply evidence.
          </p>
        </div>
        {detail && (
          <a
            href={`/api/validator/telegram/campaigns/${detail.campaign.id}/export`}
            className={PRIMARY}
          >
            <Download size={14} />
            Export full CSV
          </a>
        )}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside
          className={`${PANEL} max-h-[75vh] overflow-y-auto rounded-[24px] p-3`}
        >
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => select(campaign.id)}
              className={`mb-2 w-full rounded-xl border p-3 text-left transition ${selectedId === campaign.id ? "border-[#f4ca64]/30 bg-[#f4ca64]/[0.06]" : "border-white/[0.06] bg-[#071111] hover:border-white/15"}`}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {campaign.name}
                </p>
                <StatusPill status={campaign.status} />
              </div>
              <p className="mt-2 text-[9px] text-[#60706b]">
                {formatNumber(campaign.sentCount)} sent ·{" "}
                {formatNumber(campaign.repliedCount)} replies ·{" "}
                {relativeTime(campaign.createdAt)}
              </p>
            </button>
          ))}
          {!campaigns.length && (
            <p className="p-8 text-center text-xs text-[#60706b]">
              No campaign reports yet.
            </p>
          )}
        </aside>
        {detail ? (
          <section className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric
                label="Attempts"
                value={detail.campaign.totalCount}
                icon={Users}
              />
              <Metric
                label="Sent"
                value={detail.campaign.sentCount}
                icon={CheckCircle2}
                color="text-[#b8ff4b]"
              />
              <Metric
                label="Failed"
                value={detail.campaign.failedCount}
                icon={XCircle}
                color="text-[#ff8585]"
              />
              <Metric
                label="Replies"
                value={detail.campaign.repliedCount}
                icon={Send}
                color="text-[#65e6ff]"
              />
              <Metric
                label="Progress"
                value={`${detail.campaign.progressPct}%`}
                icon={Gauge}
                color="text-[#f4ca64]"
              />
            </div>
            <div className={`${PANEL} rounded-[24px] p-5`}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold">
                  {detail.campaign.name}
                </h3>
                <StatusPill status={detail.campaign.status} />
                <span className="text-[10px] uppercase tracking-wider text-[#60706b]">
                  Replies: {detail.campaign.replyTrackingStatus}
                </span>
              </div>
              {detail.campaign.errorMessage && (
                <p className="mt-3 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.05] p-3 text-xs text-[#ff9b9b]">
                  {detail.campaign.errorMessage}
                </p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {detail.sessions.map((item) => (
                  <div
                    key={item.sessionId}
                    className="rounded-xl border border-white/[0.06] bg-[#071111] p-3"
                  >
                    <p className="truncate text-xs font-medium">
                      {item.session.label}
                    </p>
                    <p className="mt-1 text-[9px] text-[#60706b]">
                      {item.session.username
                        ? `@${item.session.username}`
                        : item.session.phone}{" "}
                      · {formatNumber(item.assignedCount)} assigned ·{" "}
                      {formatNumber(item.sentCount)} sent ·{" "}
                      {formatNumber(item.failedCount)} failed
                    </p>
                    {item.lastErrorMessage && (
                      <p
                        className="mt-2 truncate text-[9px] text-[#ff8585]"
                        title={item.lastErrorMessage}
                      >
                        {item.lastErrorCode || "SESSION_ERROR"}:{" "}
                        {item.lastErrorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={`${PANEL} overflow-hidden rounded-[24px]`}>
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <p className="text-xs font-semibold">Recipient rows</p>
                <p className="text-[9px] uppercase tracking-wider text-[#60706b]">
                  Showing first 500 · CSV contains all
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#60706b]">
                      <th className="px-4 py-3">Target</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Session</th>
                      <th className="px-3 py-3">Message ID</th>
                      <th className="px-3 py-3">Sent</th>
                      <th className="px-3 py-3">Reply</th>
                      <th className="px-4 py-3">Error / Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {detail.recipients.map((recipient) => {
                      const session = detail.sessions.find(
                        (item) => item.sessionId === recipient.sessionId,
                      );
                      return (
                        <tr key={recipient.id} className="text-xs">
                          <td className="px-4 py-3">
                            <p className="font-mono text-[#dce7e3]">
                              {recipient.targetInput}
                            </p>
                            <p className="text-[9px] text-[#60706b]">
                              {recipient.displayName || recipient.telegramId}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <StatusPill status={recipient.status} />
                          </td>
                          <td className="px-3 py-3 text-[#81908c]">
                            {session?.session.label || "Unassigned"}
                          </td>
                          <td className="px-3 py-3 font-mono text-[#81908c]">
                            {recipient.messageId || "-"}
                          </td>
                          <td className="px-3 py-3 text-[#81908c]">
                            {relativeTime(recipient.sentAt)}
                          </td>
                          <td className="px-3 py-3">
                            {recipient.replied ? (
                              <span className="text-[#65e6ff]">
                                Replied {relativeTime(recipient.repliedAt)}
                              </span>
                            ) : (
                              <span className="text-[#53615d]">No reply</span>
                            )}
                          </td>
                          <td
                            className={`max-w-xs truncate px-4 py-3 ${recipient.errorMessage ? "text-[#ff8585]" : "text-[#81908c]"}`}
                          >
                            {recipient.errorMessage ||
                              recipient.replyPreview ||
                              "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <div
            className={`${PANEL} flex min-h-96 items-center justify-center rounded-[24px] text-sm text-[#60706b]`}
          >
            Select a campaign report.
          </div>
        )}
      </div>
    </div>
  );
}

function ListsView({
  lists,
  refresh,
  notify,
}: {
  lists: ContactList[];
  refresh: () => Promise<ContactList[]>;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [detail, setDetail] = useState<ContactList | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteList, setDeleteList] = useState<ContactList | null>(null);
  const filtered = lists.filter((list) =>
    `${list.name} ${list.type} ${list.source}`
      .toLowerCase()
      .includes(deferredSearch.toLowerCase()),
  );

  async function action(list: ContactList, name: "normalize" | "deduplicate") {
    setBusy(list.id + name);
    setMenu(null);
    try {
      const result = await api<Record<string, number>>(
        `/api/validator/lists/${list.id}/${name}`,
        { method: "POST" },
      );
      notify(
        name === "normalize"
          ? `Normalized ${formatNumber(result.totalScanned)} rows; removed ${formatNumber(result.removed)} unusable entries.`
          : `Removed ${formatNumber(result.duplicatesRemoved)} duplicate entries.`,
        "success",
      );
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  }

  function remove(list: ContactList) {
    setMenu(null);
    setDeleteList(list);
  }

  async function performRemove(list: ContactList) {
    setBusy(list.id + "delete");
    try {
      await api(`/api/validator/lists/${list.id}`, { method: "DELETE" });
      setSelected((current) => current.filter((id) => id !== list.id));
      setDeleteList(null);
      await refresh();
      notify(`Deleted ${list.name}.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Delete failed", "error");
    } finally {
      setBusy(null);
      setMenu(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#40d6c2]">
            <span className="h-px w-7 bg-current" />
            Data workspace
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Lists, cleaned and ready.
          </h2>
          <p className="mt-2 text-sm text-[#71807c]">
            Import, inspect, normalize, merge, and export source and result
            lists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.length >= 2 && (
            <button onClick={() => setMergeOpen(true)} className={SECONDARY}>
              <GitMerge size={15} />
              Merge {selected.length}
            </button>
          )}
          <button onClick={() => setImportOpen(true)} className={PRIMARY}>
            <Plus size={15} />
            Import list
          </button>
        </div>
      </div>
      <div className={`${PANEL} mt-6 overflow-visible rounded-[24px]`}>
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lists, sources, types..."
              className={`${FIELD} pl-10`}
            />
          </div>
          <div className="ml-auto flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e6d68]">
            <span>{formatNumber(filtered.length)} lists</span>
            <span className="h-3 w-px bg-white/10" />
            <span>
              {formatNumber(
                lists.reduce((sum, list) => sum + list.itemsCount, 0),
              )}{" "}
              rows
            </span>
          </div>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[9px] font-bold uppercase tracking-[0.16em] text-[#5d6b67]">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((list) => selected.includes(list.id))
                    }
                    onChange={() =>
                      setSelected(
                        filtered.every((list) => selected.includes(list.id))
                          ? []
                          : filtered.map((list) => list.id),
                      )
                    }
                    className="accent-[#b8ff4b]"
                  />
                </th>
                <th className="px-3 py-3">List</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Rows</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Updated</th>
                <th className="w-24 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.055]">
              {filtered.map((list) => (
                <tr
                  key={list.id}
                  className="group transition hover:bg-white/[0.018]"
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(list.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(list.id)
                            ? current.filter((id) => id !== list.id)
                            : [...current, list.id],
                        )
                      }
                      className="accent-[#b8ff4b]"
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      onClick={() => setDetail(list)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${list.source === "link_filter" ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : "bg-[#65e6ff]/10 text-[#65e6ff]"}`}
                      >
                        {list.source === "link_filter" ? (
                          <UserCheck size={15} />
                        ) : (
                          <Database size={15} />
                        )}
                      </span>
                      <span>
                        <span className="block max-w-xs truncate text-sm font-medium text-[#e6efec] group-hover:text-white">
                          {list.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] text-[#4f5d59]">
                          {list.id.slice(-9)}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#7b8985]">
                      {list.type}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-sm text-[#b8c5c1]">
                    {formatNumber(list.itemsCount)}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#71807c]">
                    {list.source === "link_filter"
                      ? "Validated output"
                      : list.source?.replaceAll("_", " ") || "Manual"}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#60706b]">
                    {relativeTime(list.updatedAt)}
                  </td>
                  <td className="relative px-4 py-3.5 text-right">
                    <button
                      onClick={() => setMenu(menu === list.id ? null : list.id)}
                      className="rounded-lg p-2 text-[#687772] hover:bg-white/5 hover:text-white"
                    >
                      {busy?.startsWith(list.id) ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <MoreHorizontal size={16} />
                      )}
                    </button>
                    {menu === list.id && (
                      <div className="absolute right-4 top-12 z-30 w-48 rounded-xl border border-white/10 bg-[#101c1b] p-1.5 text-left shadow-2xl">
                        <button
                          onClick={() => setDetail(list)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a9b6b2] hover:bg-white/5 hover:text-white"
                        >
                          <Users size={13} />
                          Inspect items
                        </button>
                        <button
                          onClick={() => action(list, "normalize")}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a9b6b2] hover:bg-white/5 hover:text-white"
                        >
                          <Wand2 size={13} />
                          Normalize
                        </button>
                        <button
                          onClick={() => action(list, "deduplicate")}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a9b6b2] hover:bg-white/5 hover:text-white"
                        >
                          <ListFilter size={13} />
                          Deduplicate
                        </button>
                        {["csv", "json", "txt"].map((format) => (
                          <a
                            key={format}
                            href={`/api/validator/lists/${list.id}/export?format=${format}`}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a9b6b2] hover:bg-white/5 hover:text-white"
                          >
                            <Download size={13} />
                            Export {format.toUpperCase()}
                          </a>
                        ))}
                        <div className="my-1 h-px bg-white/[0.07]" />
                        <button
                          onClick={() => remove(list)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#ff8585] hover:bg-[#ff7474]/10"
                        >
                          <Trash2 size={13} />
                          Delete list
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-white/[0.06] md:hidden">
          {filtered.map((list) => (
            <div key={list.id} className="p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(list.id)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(list.id)
                        ? current.filter((id) => id !== list.id)
                        : [...current, list.id],
                    )
                  }
                  className="mt-3 accent-[#b8ff4b]"
                />
                <button
                  onClick={() => setDetail(list)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${list.source === "link_filter" ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : "bg-[#65e6ff]/10 text-[#65e6ff]"}`}
                  >
                    <Database size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {list.name}
                    </span>
                    <span className="mt-1 block text-[10px] text-[#60706b]">
                      {formatNumber(list.itemsCount)} rows · {list.type} ·{" "}
                      {relativeTime(list.updatedAt)}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setMenu(menu === list.id ? null : list.id)}
                  className="rounded-lg p-2 text-[#71807c]"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
              {menu === list.id && (
                <div className="mt-3 grid grid-cols-2 gap-2 pl-7">
                  <button onClick={() => setDetail(list)} className={SECONDARY}>
                    <Users size={13} />
                    Inspect
                  </button>
                  <button
                    onClick={() => action(list, "normalize")}
                    className={SECONDARY}
                  >
                    <Wand2 size={13} />
                    Normalize
                  </button>
                  <a
                    href={`/api/validator/lists/${list.id}/export?format=csv`}
                    className={SECONDARY}
                  >
                    <Download size={13} />
                    CSV
                  </a>
                  <button
                    onClick={() => remove(list)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ff7474]/20 px-3 py-2 text-xs font-medium text-[#ff8585]"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!filtered.length && (
          <div className="flex flex-col items-center py-20 text-center">
            <Layers3 size={30} className="text-[#40504b]" />
            <p className="mt-4 text-sm text-[#71807c]">
              {lists.length
                ? "No lists match your search."
                : "No lists imported yet."}
            </p>
            {!lists.length && (
              <button
                onClick={() => setImportOpen(true)}
                className={`${PRIMARY} mt-4`}
              >
                <Upload size={14} />
                Import first list
              </button>
            )}
          </div>
        )}
      </div>
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={async (message) => {
            setImportOpen(false);
            await refresh();
            notify(message, "success");
          }}
        />
      )}
      {mergeOpen && (
        <MergeModal
          lists={lists.filter((list) => selected.includes(list.id))}
          onClose={() => setMergeOpen(false)}
          onMerged={async (message) => {
            setMergeOpen(false);
            setSelected([]);
            await refresh();
            notify(message, "success");
          }}
          notify={notify}
        />
      )}
      {detail && (
        <ListDetailModal
          list={detail}
          onClose={() => setDetail(null)}
          refreshLists={refresh}
          notify={notify}
        />
      )}
      {deleteList && (
        <ConfirmModal
          title={`Delete ${deleteList.name}?`}
          description={`This permanently removes all ${formatNumber(deleteList.itemsCount)} items in the list. Campaign reports that referenced it remain available.`}
          confirmLabel="Delete list"
          busy={busy === deleteList.id + "delete"}
          onClose={() => setDeleteList(null)}
          onConfirm={() => performRemove(deleteList)}
        />
      )}
    </div>
  );
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("users");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function choose(next: File | null) {
    if (!next) return;
    setFile(next);
    if (!name)
      setName(next.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }

  async function submit() {
    if (!file || !name.trim()) return;
    setLoading(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("name", name.trim());
    form.set("type", type);
    try {
      const response = await fetch("/api/validator/lists/import", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Import failed");
      await onImported(
        `Imported ${formatNumber(data.totalImported)} rows; skipped ${formatNumber(data.totalDuplicate)} duplicates.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Import a Telegram list"
      description="CSV, JSON, TXT, TSV, and semicolon-delimited files are detected automatically."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              id: "users",
              label: "Usernames",
              icon: Users,
              hint: "Handles, IDs, names, phones",
            },
            {
              id: "profile",
              label: "Profiles",
              icon: FileText,
              hint: "Names, bios, account profiles",
            },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setType(option.id)}
              className={`rounded-2xl border p-3 text-left transition ${type === option.id ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.07]" : "border-white/[0.08] bg-[#071111] hover:border-white/15"}`}
            >
              <option.icon
                size={16}
                className={
                  type === option.id ? "text-[#b8ff4b]" : "text-[#6d7b77]"
                }
              />
              <p className="mt-2 text-sm font-semibold">{option.label}</p>
              <p className="mt-0.5 text-[10px] text-[#62716c]">{option.hint}</p>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
            List name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            placeholder="e.g. July community scrape"
            className={`${FIELD} mt-2`}
          />
        </label>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-[#b8ff4b]/60 bg-[#b8ff4b]/[0.06]" : file ? "border-[#40d6c2]/30 bg-[#40d6c2]/[0.04]" : "border-white/10 bg-[#071111] hover:border-white/20"}`}
        >
          <input
            type="file"
            accept=".csv,.json,.txt,.tsv,text/*,application/json"
            className="hidden"
            onChange={(event) => choose(event.target.files?.[0] || null)}
          />
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${file ? "bg-[#40d6c2]/10 text-[#40d6c2]" : "bg-white/[0.04] text-[#71807c]"}`}
          >
            {file ? <Check size={19} /> : <CloudUpload size={19} />}
          </span>
          <p className="mt-3 text-sm font-medium">
            {file ? file.name : "Drop a file here, or browse"}
          </p>
          <p className="mt-1 text-[11px] text-[#61706c]">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB ready to parse`
              : "Up to 100 MB · 500,000 import rows"}
          </p>
        </label>
        {error && (
          <div className="flex gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-3 text-sm text-[#ff9292]">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className={`${SECONDARY} flex-1`}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !file || !name.trim()}
            className={`${PRIMARY} flex-[2]`}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}
            {loading ? "Parsing and importing..." : "Import list"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MergeModal({
  lists,
  onClose,
  onMerged,
  notify,
}: {
  lists: ContactList[];
  onClose: () => void;
  onMerged: (message: string) => void | Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  async function merge() {
    setLoading(true);
    try {
      const data = await api<{ totalItems: number; totalDuplicates: number }>(
        "/api/validator/lists/merge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listIds: lists.map((list) => list.id), name }),
        },
      );
      await onMerged(
        `Merged ${lists.length} lists into ${formatNumber(data.totalItems)} unique rows; removed ${formatNumber(data.totalDuplicates)} duplicates.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Merge failed", "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      title={`Merge ${lists.length} lists`}
      description="Earlier selected lists win when duplicate IDs, usernames, or phones are found."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {lists.map((list, index) => (
            <div
              key={list.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] font-mono text-[10px] text-[#b8ff4b]">
                {index + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm">{list.name}</p>
              <span className="text-xs text-[#60706b]">
                {formatNumber(list.itemsCount)}
              </span>
            </div>
          ))}
        </div>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
            New list name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Combined username signal"
            className={`${FIELD} mt-2`}
          />
        </label>
        <button
          onClick={merge}
          disabled={loading || !name.trim() || lists.length < 2}
          className={`${PRIMARY} w-full`}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <GitMerge size={15} />
          )}
          {loading ? "Merging lists..." : "Create merged list"}
        </button>
      </div>
    </Modal>
  );
}

function ListDetailModal({
  list,
  onClose,
  refreshLists,
  notify,
}: {
  list: ContactList;
  onClose: () => void;
  refreshLists: () => Promise<ContactList[]>;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  async function load() {
    setLoading(true);
    try {
      const [itemData, statData] = await Promise.all([
        api<{
          items: ListItem[];
          pagination: { total: number; totalPages: number };
        }>(
          `/api/validator/lists/${list.id}/items?page=${page}&limit=50&search=${encodeURIComponent(deferredSearch)}`,
        ),
        api<Stats>(`/api/validator/lists/${list.id}/stats`),
      ]);
      setItems(itemData.items);
      setTotal(itemData.pagination.total);
      setPages(itemData.pagination.totalPages);
      setStats(statData);
      setSelected([]);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to load list",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [page, deferredSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function removeItems() {
    if (!selected.length) return;
    const removeCount = selected.length;
    setBusy(true);
    try {
      await api(`/api/validator/lists/${list.id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selected }),
      });
      await load();
      await refreshLists();
      setRemoveOpen(false);
      notify(`Removed ${removeCount} items.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Remove failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const values = manual
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value) =>
        value.startsWith("+")
          ? { phone: value }
          : /^\d+$/.test(value)
            ? { telegramId: value }
            : { username: value },
      );
    if (!values.length) return;
    setBusy(true);
    try {
      const data = await api<{
        totalAdded: number;
        totalDuplicates: number;
        totalInvalid: number;
      }>(`/api/validator/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: values }),
      });
      setManual("");
      setAddOpen(false);
      await load();
      await refreshLists();
      notify(
        `Added ${formatNumber(data.totalAdded)} items; skipped ${formatNumber(data.totalDuplicates + data.totalInvalid)}.`,
        "success",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Add failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={list.name}
      description={`${formatNumber(total)} items · ${list.source === "link_filter" ? "Validated output" : list.source?.replaceAll("_", " ") || "Manual list"}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="All rows" value={stats.totalItems} icon={Database} />
            <Metric
              label="Usernames"
              value={`${stats.usernamePercentage}%`}
              icon={Users}
              color="text-[#b8ff4b]"
            />
            <Metric
              label="Telegram IDs"
              value={stats.uniqueUsers}
              icon={Fingerprint}
              color="text-[#84eaff]"
            />
            <Metric
              label="Phone numbers"
              value={stats.withPhone}
              icon={Activity}
              color="text-[#d8b7ff]"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search username, name, or phone..."
              className={`${FIELD} pl-10`}
            />
          </div>
          <button
            onClick={() => setAddOpen((value) => !value)}
            className={SECONDARY}
          >
            <Plus size={14} />
            Add items
          </button>
          {selected.length > 0 && (
            <button
              onClick={() => setRemoveOpen(true)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ff7474]/20 px-3.5 py-2.5 text-xs font-medium text-[#ff8585]"
            >
              <Trash2 size={13} />
              Remove {selected.length}
            </button>
          )}
          <div className="relative group">
            <button className={SECONDARY}>
              <Download size={14} />
              Export
              <ChevronDown size={12} />
            </button>
            <div className="invisible absolute right-0 top-full z-20 mt-1 w-32 rounded-xl border border-white/10 bg-[#101c1b] p-1 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
              {["csv", "json", "txt"].map((format) => (
                <a
                  key={format}
                  href={`/api/validator/lists/${list.id}/export?format=${format}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a9b6b2] hover:bg-white/5 hover:text-white"
                >
                  {format === "json" ? (
                    <FileJson size={12} />
                  ) : (
                    <FileText size={12} />
                  )}
                  {format.toUpperCase()}
                </a>
              ))}
            </div>
          </div>
        </div>
        {addOpen && (
          <div className="rounded-2xl border border-[#b8ff4b]/15 bg-[#b8ff4b]/[0.035] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">Quick add</p>
                <p className="mt-1 text-[11px] text-[#61706c]">
                  One username, t.me link, Telegram ID, or +phone per line.
                </p>
              </div>
              <button onClick={() => setAddOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <textarea
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              rows={5}
              placeholder={"@username\nhttps://t.me/another_user\n123456789"}
              className={`${FIELD} mt-3 resize-y font-mono`}
            />
            <button
              onClick={addManual}
              disabled={busy || !manual.trim()}
              className={`${PRIMARY} mt-2`}
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add rows
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-white/[0.07] bg-[#071111] text-[9px] font-bold uppercase tracking-[0.16em] text-[#5d6b67]">
                <th className="w-11 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={
                      items.length > 0 && selected.length === items.length
                    }
                    onChange={() =>
                      setSelected(
                        selected.length === items.length
                          ? []
                          : items.map((item) => item.id),
                      )
                    }
                    className="accent-[#b8ff4b]"
                  />
                </th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Telegram ID</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Loader2
                      size={20}
                      className="mx-auto animate-spin text-[#b8ff4b]"
                    />
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="text-xs text-[#a8b5b1] hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                        className="accent-[#b8ff4b]"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-[#84eaff]">
                      {item.username ? `@${item.username}` : "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-[#82908c]">
                      {item.telegramId || "-"}
                    </td>
                    <td className="max-w-52 truncate px-3 py-3">
                      {[item.firstName, item.lastName]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </td>
                    <td className="px-3 py-3 font-mono">{item.phone || "-"}</td>
                    <td className="px-3 py-3 text-[#60706b]">
                      {relativeTime(item.addedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-sm text-[#61706c]"
                  >
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#60706b]">
            Page {page} of {pages} · {formatNumber(total)} items
          </p>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border border-white/10 p-2 text-[#71807c] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-white/10 p-2 text-[#71807c] disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        {removeOpen && (
          <ConfirmModal
            title={`Remove ${selected.length} selected items?`}
            description="The selected rows will be permanently removed from this list. Other lists and existing campaign reports are not affected."
            confirmLabel="Remove items"
            busy={busy}
            onClose={() => setRemoveOpen(false)}
            onConfirm={removeItems}
          />
        )}
      </div>
    </Modal>
  );
}

function HistoryView({
  jobs,
  refresh,
  setActiveJob,
  notify,
}: {
  jobs: Job[];
  refresh: () => Promise<Job[]>;
  setActiveJob: (job: Job) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  async function open(job: Job) {
    setLoadingId(job.id);
    try {
      const data = await api<{ job: Job }>(`/api/validator/jobs/${job.id}`);
      setActiveJob(data.job);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to load run",
        "error",
      );
    } finally {
      setLoadingId(null);
    }
  }
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8b7ff]">
            <span className="h-px w-7 bg-current" />
            Durable run ledger
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Every run, still here.
          </h2>
          <p className="mt-2 text-sm text-[#71807c]">
            Return to live runs or download confirmed results from completed
            work.
          </p>
        </div>
        <button onClick={() => void refresh()} className={SECONDARY}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
          <section
            key={job.id}
            className={`${PANEL} rounded-[22px] p-4 transition hover:border-white/15 sm:p-5`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <button
                onClick={() => open(job)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${job.status === "completed" ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : job.status === "running" ? "bg-[#65e6ff]/10 text-[#65e6ff]" : "bg-white/[0.04] text-[#71807c]"}`}
                >
                  {loadingId === job.id ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Radar size={17} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#e5eeeb]">
                      {job.sourceListName}
                    </span>
                    <StatusPill status={job.status} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#60706b]">
                    Output: {job.resultListName} · {relativeTime(job.createdAt)}
                  </span>
                </span>
              </button>
              <div className="grid grid-cols-3 gap-5 text-center lg:w-[310px]">
                <div>
                  <p className="font-mono text-sm font-semibold text-[#b8ff4b]">
                    {formatNumber(job.validCount)}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-[#56645f]">
                    Valid
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-[#ff8585]">
                    {formatNumber(job.invalidCount)}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-[#56645f]">
                    Invalid
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-[#84eaff]">
                    {ACTIVE.has(job.status)
                      ? `${job.passProgressPct}%`
                      : formatNumber(job.totalRequests)}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-[#56645f]">
                    {ACTIVE.has(job.status) ? "Progress" : "Requests"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {job.resultListId &&
                  ["csv", "json"].map((format) => (
                    <a
                      key={format}
                      href={`/api/validator/lists/${job.resultListId}/export?format=${format}`}
                      className={SECONDARY}
                    >
                      <Download size={13} />
                      {format.toUpperCase()}
                    </a>
                  ))}
                <button onClick={() => open(job)} className={SECONDARY}>
                  Open
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </section>
        ))}
        {!jobs.length && (
          <div
            className={`${PANEL} flex flex-col items-center rounded-[24px] py-20 text-center`}
          >
            <History size={30} className="text-[#40504b]" />
            <p className="mt-4 text-sm text-[#71807c]">
              No validation runs yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
