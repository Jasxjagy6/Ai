"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AccountSettingsView } from "@/components/validator/account-settings-view";
import { AiChatterCampaignsView } from "@/components/validator/ai-chatter-campaigns-view";
import { ValidatorDashboard } from "@/components/validator/validator-dashboard";
import { ValidatorGuide } from "@/components/validator/validator-guide";
import { ValidatorReports } from "@/components/validator/validator-reports";
import { SignalSelect } from "@/components/validator/signal-select";
import { TelegramHistoryView } from "@/components/validator/telegram-history-view";
import {
  CAPITALBOT_RESPONSE_LANGUAGES,
  type CapitalBotResponseLanguage,
} from "@/lib/ai-chatter-languages";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  CloudUpload,
  Coins,
  Copy,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileJson,
  FileText,
  Fingerprint,
  Gift,
  Gauge,
  GitMerge,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  Layers3,
  ListFilter,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageCircleMore,
  MoreHorizontal,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  Headphones,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User as UserIcon,
  UserCheck,
  UserPlus,
  Users,
  Settings,
  Wand2,
  X,
  XCircle,
} from "lucide-react";

type Account = {
  id: string;
  email: string;
  accessKeyId: string | null;
  accessKeyPrefix: string | null;
  planCode: string | null;
  requestLimit: number | null;
  requestsUsed: number;
  requestsRemaining: number | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  creditsActive: boolean;
  creditsBalance: number;
  creditsPurchased: number;
  creditsSpent: number;
  referralCode: string | null;
  validatorAccess: boolean;
  messagingAccess: boolean;
  aiChatAccess: boolean;
  aiCampaignLimit: number | null;
  sessionLimit: number | null;
  messageLimit: number | null;
  messagesUsed: number;
  messagesRemaining: number | null;
};
type View =
  | "dashboard"
  | "lists"
  | "history"
  | "sessions"
  | "ai-chatter"
  | "messaging"
  | "reports"
  | "credits"
  | "account-settings"
  | "communication-settings"
  | "affiliates"
  | "updates"
  | "guide";
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
  profileBio: string | null;
  avatarUrl: string | null;
  avatarMime: string | null;
  isPremium: boolean;
  isVerified: boolean;
  isRestricted: boolean;
  profileSyncedAt: string | null;
  profileSyncRequested: boolean;
  telegramUserId: string | null;
  sessionFormat: string;
  sourceFilename: string | null;
  status: string;
  isLoggedIn: boolean;
  hasTwoFactor: boolean;
  antiDetectEnabled: boolean;
  deviceIdentity: Record<string, unknown> | null;
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
  createdAt: string;
  updatedAt: string;
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
export type AiChatterData = {
  creditsBalance: number;
  campaignLimit: number | null;
  activeCampaigns: number;
  campaigns: AiCampaignSummary[];
  sessions: Array<{
    id: string;
    label: string;
    phone: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    status: string;
    isLoggedIn: boolean;
    spamStatus: string;
    riskScore: number;
    lastActiveAt: string | null;
    assignedCampaign: { id: string; name: string } | null;
  }>;
  sessionLists: Array<{ id: string; name: string; sessionIds: string[] }>;
};
export type AiCampaignSummary = {
  id: string;
  name: string;
  provider: "capitalbot" | "cupidbot";
  modelId: number | null;
  presetId: number | null;
  config: {
    provider: "capitalbot" | "cupidbot";
    replyDelayMs: number;
    replyDelayJitterMs: number;
    memoryMessageLimit: number;
    capitalbot: { language: CapitalBotResponseLanguage };
  };
  reengageEnabled: boolean;
  durationMode: "day" | "week" | "until_stopped";
  status: string;
  messagesReceived: number;
  messagesSent: number;
  failedCount: number;
  creditsUsed: number;
  startedAt: string;
  endsAt: string | null;
  stoppedAt: string | null;
  creditGraceStartedAt: string | null;
  creditGraceEndsAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: Array<{
    sessionId: string;
    runtimeStatus: string;
    lastHeartbeatAt: string | null;
    lastError: string | null;
    session: {
      id?: string;
      label: string;
      username: string | null;
      phone: string | null;
      status: string;
      isLoggedIn: boolean;
      spamStatus?: string;
      riskScore?: number;
      lastActiveAt?: string | null;
    };
  }>;
  sessionCount: number;
  liveListeners: number;
  conversations: number;
  jobs: number;
  responseLogs: number;
};
export type AiCampaignDetail = {
  campaign: AiCampaignSummary;
  overview: {
    conversations: number;
    sent: number;
    failed: number;
    successRate: number;
    statusBreakdown: Record<string, number>;
    queueBreakdown: Record<string, number>;
  };
  conversations: Array<{
    id: string;
    sessionId: string;
    peerId: string;
    recipientName: string;
    recipientUsername: string;
    messageCount: number;
    conversationState: string;
    lastCategory: string | null;
    lastIncomingAt: string | null;
    lastOutgoingAt: string | null;
    updatedAt: string;
    session: { label: string; username: string | null; phone: string | null };
  }>;
  recentJobs: Array<{
    id: string;
    sessionId: string;
    peerId: string;
    status: string;
    attempts: number;
    isFollowUp: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    runAfter: string;
    createdAt: string;
    finishedAt: string | null;
  }>;
  responseLogs: Array<{
    id: string;
    sessionId: string;
    peerId: string;
    provider: string;
    status: string;
    category: string | null;
    incomingText: string | null;
    responseText: string | null;
    isFollowUp: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};
export type AiProviderCatalog = {
  models?: Array<Record<string, string | number | boolean | null>>;
  presets?: Array<Record<string, string | number | boolean | null>>;
};
type AiConversationDetail = {
  conversation: {
    id: string;
    sessionId: string;
    peerId: string;
    recipient: Record<string, string> | null;
    messages: Array<{
      id: string;
      telegramMessageId: number | null;
      timestamp: number;
      msg: string;
      isIncoming: boolean;
      confirmed?: boolean;
    }>;
    conversationState: string;
    lastCategory: string | null;
    setting: {
      enabled: boolean;
      config: Record<string, unknown> | null;
    } | null;
    session: { label: string; username: string | null; phone: string | null };
  };
  logs: Array<{
    id: string;
    status: string;
    provider: string;
    category: string | null;
    incomingText: string | null;
    responseText: string | null;
    isFollowUp: boolean;
    didConvert: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};
type LegacyAiChatterData = {
  setting: {
    enabled: boolean;
    reengageEnabled: boolean;
    config: {
      provider: "capitalbot" | "cupidbot";
      replyDelayMs: number;
      replyDelayJitterMs: number;
      memoryMessageLimit: number;
      capitalbot: { language: CapitalBotResponseLanguage };
    };
  };
  providers: Array<{
    provider: "capitalbot" | "cupidbot";
    configured: boolean;
    isValid: boolean;
    modelId: number | null;
    presetId: number | null;
    catalog: {
      models?: Array<Record<string, string | number>>;
      presets?: Array<Record<string, string | number>>;
    } | null;
    lastValidatedAt: string | null;
    validationError: string | null;
  }>;
  sessions: Array<{
    id: string;
    label: string;
    phone: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    status: string;
    isLoggedIn: boolean;
    spamStatus: string;
    riskScore: number;
    lastActiveAt: string | null;
    aiSetting: {
      enabled: boolean;
      config: Record<string, unknown> | null;
      runtimeStatus: string;
      lastConnectedAt: string | null;
      lastHeartbeatAt: string | null;
      lastError: string | null;
    } | null;
  }>;
  overview: {
    conversations: number;
    completed: number;
    sent: number;
    failed: number;
    successRate: number;
    statusBreakdown: Record<string, number>;
    queueBreakdown: Record<string, number>;
  };
  conversations: Array<{
    id: string;
    sessionId: string;
    peerId: string;
    recipientName: string;
    recipientUsername: string;
    messageCount: number;
    conversationState: string;
    lastCategory: string | null;
    lastIncomingAt: string | null;
    lastOutgoingAt: string | null;
    updatedAt: string;
    session: { label: string; username: string | null; phone: string | null };
  }>;
  recentJobs: Array<{
    id: string;
    sessionId: string;
    peerId: string;
    status: string;
    attempts: number;
    isFollowUp: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    runAfter: string;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

const ACTIVE = new Set(["pending", "running"]);
const PANEL = "border border-white/[0.065] bg-[#111311]";
const FIELD =
  "w-full rounded-xl border border-white/[0.075] bg-[#0b0d0c] px-3.5 py-2.5 text-sm text-[#f3f6f2] outline-none transition placeholder:text-[#59625e] focus:border-[#9cff38]/45 focus:ring-2 focus:ring-[#9cff38]/10 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-4 py-2.5 text-sm font-bold text-[#0a0d09] transition hover:bg-[#b4ff66] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-[#b5bdb9] transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-40";

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
  if (init?.method && init.method !== "GET")
    window.dispatchEvent(new Event("signal-desk-account-changed"));
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

function CardPicker({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  accent = "#b8ff4b",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    id: string;
    label: string;
    description?: string | null;
    count?: number;
    disabled?: boolean;
  }>;
  placeholder: string;
  className?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const visible = deferredSearch
    ? options.filter((option) =>
        `${option.label} ${option.description || ""}`
          .toLowerCase()
          .includes(deferredSearch),
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`${FIELD} flex min-h-[42px] items-center gap-3 text-left`}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold"
          style={{
            borderColor: `${accent}44`,
            color: accent,
            background: `${accent}12`,
          }}
        >
          {selected ? (
            selected.label.slice(0, 2).toUpperCase()
          ) : (
            <Layers3 size={13} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-xs ${selected ? "text-white" : "text-[#71807c]"}`}
          >
            {selected?.label || placeholder}
          </span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[9px] text-[#60706b]">
              {selected.description}
            </span>
          )}
        </span>
        {selected?.count != null && (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-[#71807c]">
            {formatNumber(selected.count)}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#60706b] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#091412] shadow-2xl shadow-black/50">
          <div className="border-b border-white/[0.07] p-2.5">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#60706b]"
              />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-white/10 bg-[#071111] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#53615d] focus:border-white/20"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {visible.map((option) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id || "__empty"}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-white/10 bg-white/[0.06]" : "border-transparent hover:bg-white/[0.035]"}`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold"
                    style={{
                      color: active ? "#07100d" : accent,
                      background: active ? accent : `${accent}12`,
                    }}
                  >
                    {option.id ? (
                      option.label.slice(0, 2).toUpperCase()
                    ) : (
                      <X size={12} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[#dce7e3]">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-[9px] text-[#60706b]">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.count != null && (
                    <span className="text-[9px] text-[#60706b]">
                      {formatNumber(option.count)}
                    </span>
                  )}
                  {active && (
                    <CheckCircle2 size={15} style={{ color: accent }} />
                  )}
                </button>
              );
            })}
            {!visible.length && (
              <p className="px-3 py-8 text-center text-xs text-[#60706b]">
                No matching options.
              </p>
            )}
          </div>
        </div>
      )}
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
    active: "border-[#b8ff4b]/25 bg-[#b8ff4b]/10 text-[#b8ff4b]",
    clean: "border-[#b8ff4b]/25 bg-[#b8ff4b]/10 text-[#b8ff4b]",
    offline: "border-white/10 bg-white/5 text-[#889692]",
    inactive: "border-white/10 bg-white/5 text-[#889692]",
    unknown: "border-white/10 bg-white/5 text-[#889692]",
    limited: "border-[#f4ca64]/30 bg-[#f4ca64]/10 text-[#f4ca64]",
    frozen: "border-[#ff7474]/30 bg-[#ff7474]/10 text-[#ff8d8d]",
    restricted: "border-[#ff7474]/30 bg-[#ff7474]/10 text-[#ff8d8d]",
    error: "border-[#ff7474]/30 bg-[#ff7474]/10 text-[#ff8d8d]",
    validating: "border-[#65e6ff]/25 bg-[#65e6ff]/10 text-[#65e6ff]",
    queued_validation: "border-[#f4ca64]/25 bg-[#f4ca64]/10 text-[#f4ca64]",
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#7d8d88] transition hover:bg-white/5 hover:text-white"
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
    <main className="signal-desk-theme validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed]">
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
                href="/buy"
                className="font-semibold text-[#b8ff4b] transition hover:text-[#ceff82]"
              >
                Buy one <ArrowRight size={13} className="inline" />
              </Link>
            </div>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-[#71807c] transition hover:text-white"
            >
              <ArrowLeft size={13} /> Signal Desk home
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
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [desktopNav, setDesktopNav] = useState(true);
  const [accountMenu, setAccountMenu] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [lists, setLists] = useState<ContactList[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationSourceId, setValidationSourceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loaded = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const accountMenuRoot = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const refresh = () => void refreshAccount().catch(() => undefined);
    window.addEventListener("signal-desk-account-changed", refresh);
    return () =>
      window.removeEventListener("signal-desk-account-changed", refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") {
        setAccountMenu(false);
        setNavSearch("");
      }
    }
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuRoot.current?.contains(event.target as Node)) {
        setAccountMenu(false);
      }
    }
    window.addEventListener("keydown", shortcuts);
    document.addEventListener("mousedown", closeAccountMenu);
    return () => {
      window.removeEventListener("keydown", shortcuts);
      document.removeEventListener("mousedown", closeAccountMenu);
    };
  }, []);

  async function logout() {
    await fetch("/api/validator/auth", { method: "DELETE" });
    onLock();
  }

  type NavigationItem = {
    id: View;
    label: string;
    icon: React.ElementType;
    disabled: boolean;
  };
  const navigationSections: Array<{ label: string; items: NavigationItem[] }> =
    [
      {
        label: "Home",
        items: [
          {
            id: "dashboard" as const,
            label: "Dashboard",
            icon: LayoutDashboard,
            disabled: false,
          },
          {
            id: "updates" as const,
            label: "What's new",
            icon: Bell,
            disabled: false,
          },
        ],
      },
      {
        label: "Automation",
        items: [
          {
            id: "lists" as const,
            label: "Lists & Validation",
            icon: Database,
            disabled: !account.validatorAccess && !account.messagingAccess,
          },
          {
            id: "history" as const,
            label: "Run History",
            icon: History,
            disabled: !account.validatorAccess,
          },
        ],
      },
      {
        label: "Communication",
        items: [
          {
            id: "sessions" as const,
            label: "Telegram Sessions",
            icon: Smartphone,
            disabled: !account.messagingAccess,
          },
          {
            id: "ai-chatter" as const,
            label: "AI Chatter",
            icon: MessageCircleMore,
            disabled: !account.messagingAccess,
          },
          {
            id: "messaging" as const,
            label: "Messaging",
            icon: Send,
            disabled: !account.messagingAccess,
          },
          {
            id: "communication-settings" as const,
            label: "Settings",
            icon: Settings,
            disabled: !account.messagingAccess,
          },
        ],
      },
      {
        label: "Analytics",
        items: [
          {
            id: "reports" as const,
            label: "Reports",
            icon: FileText,
            disabled: !account.messagingAccess,
          },
        ],
      },
      {
        label: "Account",
        items: [
          {
            id: "credits" as const,
            label: "Credits & Plan",
            icon: Coins,
            disabled: false,
          },
          {
            id: "account-settings" as const,
            label: "Account Settings",
            icon: UserIcon,
            disabled: !account.messagingAccess,
          },
          {
            id: "affiliates" as const,
            label: "Affiliate Rewards",
            icon: Gift,
            disabled: false,
          },
          {
            id: "guide" as const,
            label: "Guide",
            icon: BookOpen,
            disabled: false,
          },
        ],
      },
    ];
  const navigation = navigationSections.flatMap((section) => section.items);
  const searchResults = navSearch.trim()
    ? navigation.filter((item) =>
        item.label.toLowerCase().includes(navSearch.trim().toLowerCase()),
      )
    : [];

  function openView(destination: View) {
    setView(destination);
    setMobileNav(false);
    setAccountMenu(false);
    setNavSearch("");
  }

  function startValidationFromList(list: ContactList) {
    setActiveJob(null);
    setValidationSourceId(list.id);
    setValidationOpen(true);
  }

  async function inspectValidation(job: Job) {
    try {
      const data = await api<{ job: Job }>(`/api/validator/jobs/${job.id}`);
      setActiveJob(data.job);
      setValidationSourceId(data.job.sourceListId || "");
      setValidationOpen(true);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to load validation run",
        "error",
      );
    }
  }

  const sidebar = (
    <>
      <div className="flex h-[64px] items-center gap-3 border-b border-white/[0.06] px-4">
        <LogoMark small />
        <div>
          <p className="text-[13px] font-semibold tracking-[0.08em] text-white">
            SIGNAL DESK
          </p>
          <p className="text-[8px] uppercase tracking-[0.18em] text-[#5f6e69]">
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

      <div className="border-b border-white/[0.06] px-3 py-3">
        <Link
          href="/buy"
          className="flex items-center justify-center gap-2 rounded-lg border border-[#9cff38]/20 bg-[#9cff38]/[0.045] py-2.5 text-[10px] font-medium text-[#c9f99c] transition hover:border-[#9cff38]/35 hover:bg-[#9cff38]/[0.08]"
        >
          Top up <ArrowRight size={11} /> {formatNumber(account.creditsBalance)}{" "}
          credits
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {navigationSections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex ? "mt-4" : ""}>
            <p className="mb-1 px-2 text-[7px] font-semibold uppercase tracking-[0.17em] text-[#5c6561]">
              {section.label}
            </p>
            {section.items.map((item, itemIndex) => (
              <button
                key={item.id}
                disabled={item.disabled}
                style={{
                  animationDelay: `${(sectionIndex * 3 + itemIndex) * 30}ms`,
                }}
                onClick={() => openView(item.id)}
                className={`validator-nav-in group relative flex h-9 w-full items-center gap-3 rounded-md px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${view === item.id ? "bg-white/[0.055] text-white" : "text-[#9aa39f] hover:bg-white/[0.03] hover:text-white"}`}
              >
                {view === item.id && (
                  <span className="absolute -left-0.5 h-5 w-0.5 rounded-full bg-[#9cff38] shadow-[0_0_8px_rgba(156,255,56,.55)]" />
                )}
                <item.icon
                  size={14}
                  strokeWidth={1.7}
                  className={
                    view === item.id ? "text-[#d8dedb]" : "text-[#89928e]"
                  }
                />
                <span className="truncate text-[10px] font-medium">
                  {item.label}
                </span>
                {item.disabled && <LockKeyhole size={10} className="ml-auto" />}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="signal-desk-theme flex h-dvh overflow-hidden bg-[#0b0d0c] text-[#eef7ed] [font-feature-settings:'ss01']">
      <aside
        className={`${desktopNav ? "lg:flex" : "lg:hidden"} hidden w-[220px] shrink-0 flex-col border-r border-white/[0.065] bg-[#0a0c0b]`}
      >
        {sidebar}
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 validator-fade-in lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNav(false)}
          />
          <aside className="validator-drawer-in absolute inset-y-0 left-0 flex w-[286px] flex-col border-r border-white/[0.08] bg-[#0a0c0b]">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-[64px] shrink-0 items-center border-b border-white/[0.065] bg-[#0c0e0d]/95 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024)
                setDesktopNav((current) => !current);
              else setMobileNav(true);
            }}
            className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#9aa39f] transition hover:bg-white/[0.04] hover:text-white"
            aria-label="Toggle navigation"
          >
            <Menu size={17} />
          </button>
          <h1 className="text-base font-semibold sm:text-lg">
            {navigation.find((item) => item.id === view)?.label}
          </h1>
          <div className="absolute left-1/2 hidden w-[280px] -translate-x-1/2 lg:block xl:w-[320px]">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#69736f]"
              />
              <input
                ref={searchInput}
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    searchResults[0] &&
                    !searchResults[0].disabled
                  )
                    openView(searchResults[0].id);
                }}
                placeholder="Search anything..."
                className="h-9 w-full rounded-lg border border-white/[0.065] bg-[#111311] pl-9 pr-16 text-[10px] text-white outline-none placeholder:text-[#5f6965] focus:border-[#9cff38]/25"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/[0.06] px-1.5 py-0.5 text-[7px] text-[#616a66]">
                Ctrl + K
              </span>
              {!!searchResults.length && (
                <div className="absolute inset-x-0 top-11 overflow-hidden rounded-lg border border-white/[0.08] bg-[#111411] p-1 shadow-2xl">
                  {searchResults.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      disabled={item.disabled}
                      onClick={() => openView(item.id)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[10px] text-[#aeb7b2] hover:bg-white/[0.05] hover:text-white disabled:opacity-35"
                    >
                      <item.icon size={12} /> {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => openView("credits")}
              className="flex h-9 items-center gap-2 rounded-lg border border-[#9cff38]/15 bg-[#9cff38]/[0.035] px-2.5 text-[10px] font-medium text-[#d2f6ae] sm:px-3"
            >
              <Coins size={13} />{" "}
              <span className="hidden sm:inline">
                {formatNumber(account.creditsBalance)} credits
              </span>
            </button>
            <button
              onClick={() => openView("updates")}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#8f9994] transition hover:bg-white/[0.04] hover:text-white"
              aria-label="What's new"
            >
              <Bell size={17} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#9cff38] ring-2 ring-[#0c0e0d]" />
            </button>
            <div ref={accountMenuRoot} className="relative">
              <button
                onClick={() => setAccountMenu((current) => !current)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1d1b] text-xs font-medium text-[#e7ece9] transition hover:bg-[#242824]"
                aria-label="Account menu"
                aria-expanded={accountMenu}
              >
                {account.email.charAt(0).toUpperCase()}
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#9cff38] ring-2 ring-[#0c0e0d]" />
              </button>
              {accountMenu && (
                <div className="absolute right-0 top-12 w-[285px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#111411] shadow-[0_24px_70px_rgba(0,0,0,.6)]">
                  <div className="border-b border-white/[0.06] p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202420] text-sm font-semibold">
                        {account.email.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {account.email}
                        </p>
                        <p className="mt-1 text-[8px] uppercase tracking-[0.13em] text-[#7d9a63]">
                          {account.planCode?.replaceAll("_", " ") ||
                            "Workspace"}{" "}
                          plan
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    {[
                      {
                        id: "credits" as const,
                        label: "Credits & Plan",
                        icon: Coins,
                      },
                      {
                        id: "account-settings" as const,
                        label: "Account Settings",
                        icon: UserIcon,
                      },
                      {
                        id: "affiliates" as const,
                        label: "Affiliate Rewards",
                        icon: Gift,
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => openView(item.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[10px] text-[#aab3af] hover:bg-white/[0.045] hover:text-white"
                      >
                        <item.icon size={13} />
                        {item.label}
                        <ArrowRight size={11} className="ml-auto" />
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-2">
                    <a
                      href="https://t.me/agedguru"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] py-2 text-[9px] text-[#929c97] hover:text-white"
                    >
                      <Headphones size={11} /> Support
                    </a>
                    <button
                      onClick={logout}
                      className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] py-2 text-[9px] text-[#929c97] hover:border-[#ff7474]/20 hover:text-[#ff8d8d]"
                    >
                      <LogOut size={11} /> Lock
                    </button>
                  </div>
                </div>
              )}
            </div>
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
            ) : view === "dashboard" ? (
              <ValidatorDashboard account={account} onNavigate={openView} />
            ) : view === "lists" ? (
              <ListsView
                lists={lists}
                jobs={jobs}
                activeJob={activeJob}
                validatorAccess={account.validatorAccess}
                refresh={loadLists}
                notify={notify}
                onStartValidation={startValidationFromList}
                onInspectValidation={(job) => void inspectValidation(job)}
              />
            ) : view === "history" ? (
              <HistoryView
                jobs={jobs}
                refresh={loadJobs}
                setActiveJob={(job) => {
                  setActiveJob(job);
                  setValidationSourceId(job.sourceListId || "");
                  setValidationOpen(true);
                }}
                notify={notify}
              />
            ) : view === "sessions" ? (
              <TelegramSessionsView account={account} notify={notify} />
            ) : view === "ai-chatter" ? (
              <AiChatterView notify={notify} />
            ) : view === "messaging" ? (
              <MessagingView
                account={account}
                lists={lists}
                notify={notify}
                openReports={() => setView("reports")}
                onUsageChanged={refreshAccount}
              />
            ) : view === "reports" ? (
              <ValidatorReports notify={notify} />
            ) : view === "communication-settings" ? (
              <AccountSettingsView account={account} notify={notify} />
            ) : view === "account-settings" ? (
              <AccountCenter
                account={account}
                mode="account"
                notify={notify}
                onAccountChanged={onAccountChanged}
              />
            ) : view === "credits" ? (
              <AccountCenter
                account={account}
                mode="credits"
                notify={notify}
                onAccountChanged={onAccountChanged}
              />
            ) : view === "affiliates" ? (
              <AccountCenter
                account={account}
                mode="affiliates"
                notify={notify}
                onAccountChanged={onAccountChanged}
              />
            ) : view === "guide" ? (
              <ValidatorGuide
                account={account}
                openFeature={(destination) => setView(destination)}
              />
            ) : (
              <AccountCenter
                account={account}
                mode="updates"
                notify={notify}
                onAccountChanged={onAccountChanged}
              />
            )}
          </div>
        </main>
      </div>
      {validationOpen && (
        <Modal
          title={activeJob ? "Validation inspector" : "Start list validation"}
          description={
            activeJob
              ? `${activeJob.sourceListName} to ${activeJob.resultListName}`
              : "Configure and start a durable public username check for this list."
          }
          onClose={() => setValidationOpen(false)}
          wide
        >
          <ValidateView
            key={`${validationSourceId}:${activeJob?.id || "new"}`}
            lists={lists}
            jobs={jobs}
            activeJob={activeJob}
            initialSourceId={validationSourceId}
            embedded
            setActiveJob={setActiveJob}
            onListsChanged={loadLists}
            onJobsChanged={loadJobs}
            onUsageChanged={refreshAccount}
            notify={notify}
            openLists={() => setValidationOpen(false)}
          />
        </Modal>
      )}
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

type AccountCenterData = {
  account: Account;
  transactions: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    kind: string;
    taskCode: string | null;
    description: string;
    createdAt: string;
  }>;
  rewards: Array<{
    id: string;
    rateBps: number;
    depositUsdCents: number;
    rewardCredits: number;
    createdAt: string;
    referredAccount: { email: string };
  }>;
  referrals: Array<{
    id: string;
    email: string;
    currentPlanCode: string | null;
    createdAt: string;
  }>;
  updates: Array<{
    id: string;
    title: string;
    body: string;
    tag: string;
    publishedAt: string;
  }>;
  creditSettings: {
    affiliateRateBps: number;
    topups: Array<{
      code: string;
      name: string;
      credits: number;
      priceUsdCents: number;
      enabled: boolean;
      featured: boolean;
    }>;
    tasks: Record<
      string,
      {
        label: string;
        baseCost: number;
        itemCost: number;
        itemUnit: number;
        sessionCost: number;
        enabled: boolean;
      }
    >;
  };
};

function AccountCenter({
  account,
  mode,
  notify,
  onAccountChanged,
}: {
  account: Account;
  mode: "account" | "credits" | "affiliates" | "updates";
  notify: (message: string, tone?: Toast["tone"]) => void;
  onAccountChanged: (account: Account) => void;
}) {
  const [data, setData] = useState<AccountCenterData | null>(null);
  const [busyPack, setBusyPack] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const result = await api<AccountCenterData>("/api/validator/account");
    setData(result);
    onAccountChanged(result.account);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => notify(error.message, "error"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function topup(packCode: string) {
    setBusyPack(packCode);
    try {
      const checkout = await api<{
        purchaseId: string;
        claimToken: string;
        paymentUrl: string | null;
      }>("/api/validator/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topup", packCode }),
      });
      window.localStorage.setItem(
        `validator_purchase_${checkout.purchaseId}`,
        checkout.claimToken,
      );
      if (checkout.paymentUrl) window.location.assign(checkout.paymentUrl);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to start top-up",
        "error",
      );
      setBusyPack("");
    }
  }

  if (!data)
    return (
      <div className="flex min-h-[70dvh] items-center justify-center">
        <Loader2 size={23} className="animate-spin text-[#b8ff4b]" />
      </div>
    );

  if (mode === "updates") {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-4 rounded-[24px] border border-[#b8ff4b]/15 bg-gradient-to-r from-[#b8ff4b]/[0.065] to-transparent p-5 sm:p-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
              Signal Desk newsroom
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              News and releases
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#788781]">
              Product releases, safety changes, and operator notices in one
              compact feed.
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/10 text-[#b8ff4b]">
            <Bell size={17} />
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.updates.map((item, index) => (
            <article
              key={item.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`${PANEL} validator-card-in rounded-[20px] p-4 sm:p-5`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                  {item.tag}
                </span>
                <time className="text-[9px] uppercase tracking-wider text-[#5f6d68]">
                  {new Date(item.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              <h3 className="mt-3 text-base font-semibold leading-5 text-[#e3ece8]">
                {item.title}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#80908a]">
                {item.body}
              </p>
            </article>
          ))}
          {!data.updates.length && (
            <div
              className={`${PANEL} rounded-[20px] p-10 text-center md:col-span-2`}
            >
              <Bell size={21} className="mx-auto text-[#52605c]" />
              <p className="mt-3 text-xs text-[#71807c]">
                No news published yet.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "affiliates") {
    const referralUrl =
      typeof window === "undefined" || !account.referralCode
        ? ""
        : `${window.location.origin}/buy?ref=${account.referralCode}`;
    const earned = data.rewards.reduce(
      (sum, reward) => sum + reward.rewardCredits,
      0,
    );
    const deposits = data.rewards.reduce(
      (sum, reward) => sum + reward.depositUsdCents,
      0,
    );
    return (
      <div className="mx-auto w-full max-w-6xl overflow-hidden p-3 sm:p-7 lg:p-10">
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-[#b8ff4b]/20 bg-[radial-gradient(circle_at_top_right,rgba(184,255,75,.12),transparent_45%),rgba(184,255,75,.035)] p-4 sm:rounded-[30px] sm:p-8">
          <div className="grid min-w-0 items-end gap-6 lg:grid-cols-[1fr_.8fr] lg:gap-8">
            <div className="min-w-0">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
                <Gift size={21} />
              </span>
              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b] sm:mt-6 sm:text-[10px]">
                Affiliate network
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Invite operators.
                <br />
                Earn from every deposit.
              </h2>
              <p className="mt-4 max-w-xl text-xs leading-6 text-[#81908c] sm:text-sm sm:leading-7">
                You receive {data.creditSettings.affiliateRateBps / 100}% of
                each referred user&apos;s paid plan and credit top-up as
                workspace credits. Rewards are added automatically after payment
                confirmation.
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071111] p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#60706b]">
                  Your referral link
                </p>
                <span className="rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-2 py-1 text-[8px] font-bold text-[#b8ff4b]">
                  {data.creditSettings.affiliateRateBps / 100}% reward
                </span>
              </div>
              <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b1717] p-3">
                <code className="block max-w-full break-all text-[10px] leading-5 text-[#dfffaa] sm:text-xs">
                  {referralUrl || "Referral link unavailable"}
                </code>
              </div>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#60706b]">
                    Referral code
                  </span>
                  <span className="truncate font-mono text-xs text-[#b8ff4b]">
                    {account.referralCode}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!referralUrl}
                  onClick={async () => {
                    await navigator.clipboard.writeText(referralUrl);
                    setCopied(true);
                    notify("Referral link copied.", "success");
                  }}
                  className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 text-xs font-bold text-[#07100d] transition hover:bg-[#ceff82] disabled:opacity-40 sm:w-auto"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3 sm:gap-4">
          <Metric
            label="Invited users"
            value={data.referrals.length}
            icon={Users}
          />
          <Metric
            label="Reward credits"
            value={earned}
            icon={Coins}
            color="text-[#b8ff4b]"
          />
          <Metric
            label="Tracked deposits"
            value={`$${(deposits / 100).toFixed(2)}`}
            icon={BadgeDollarSign}
            color="text-[#65e6ff]"
          />
        </div>
        <section className={`${PANEL} mt-5 overflow-hidden rounded-[24px]`}>
          <div className="border-b border-white/[0.07] p-5">
            <h3 className="font-semibold">Reward history</h3>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Confirmed deposits and automatically credited rewards.
            </p>
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[9px] uppercase tracking-wider text-[#61706b]">
                  <th className="px-5 py-3">Referred user</th>
                  <th>Deposit</th>
                  <th>Rate</th>
                  <th>Reward</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.rewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-5 py-3">
                      {reward.referredAccount.email}
                    </td>
                    <td>${(reward.depositUsdCents / 100).toFixed(2)}</td>
                    <td>{reward.rateBps / 100}%</td>
                    <td className="font-mono text-[#b8ff4b]">
                      +{reward.rewardCredits.toLocaleString()}
                    </td>
                    <td className="text-xs text-[#71807c]">
                      {new Date(reward.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-white/[0.06] sm:hidden">
            {data.rewards.map((reward) => (
              <article key={reward.id} className="p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
                    <Coins size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {reward.referredAccount.email}
                    </p>
                    <p className="mt-1 text-[9px] text-[#60706b]">
                      ${(reward.depositUsdCents / 100).toFixed(2)} deposit ·{" "}
                      {reward.rateBps / 100}% rate
                    </p>
                    <p className="mt-1 text-[9px] text-[#53615d]">
                      {new Date(reward.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold text-[#b8ff4b]">
                    +{reward.rewardCredits.toLocaleString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
          {!data.rewards.length && (
            <p className="p-10 text-center text-sm text-[#71807c]">
              Share your referral link to start earning.
            </p>
          )}
        </section>
      </div>
    );
  }

  if (mode === "account") {
    const accessRows = [
      ["Access key", account.accessKeyPrefix || "Not available"],
      [
        "Key expiry",
        account.accessExpiresAt
          ? new Date(account.accessExpiresAt).toLocaleString()
          : "No expiry",
      ],
      [
        "Validator access",
        account.validatorAccess ? "Enabled" : "Not included",
      ],
      [
        "Messaging access",
        account.messagingAccess ? "Enabled" : "Not included",
      ],
      ["AI Chatter", account.aiChatAccess ? "Enabled" : "Not included"],
      [
        "Session allowance",
        account.sessionLimit == null
          ? "Unlimited"
          : account.sessionLimit.toLocaleString(),
      ],
      [
        "Message allowance",
        account.messageLimit == null
          ? "Unlimited"
          : account.messageLimit.toLocaleString(),
      ],
      ["Messages used", account.messagesUsed.toLocaleString()],
    ];
    return (
      <div className="mx-auto max-w-[1250px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#9cff38]">
              Workspace account
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Access, plan, and balance.
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#737d78]">
              Every workspace feature is included. Operations consume credits
              from one transparent balance when they run.
            </p>
          </div>
          <Link
            href="/buy"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#9cff38] px-4 py-2.5 text-xs font-bold text-[#0a0d09]"
          >
            Upgrade plan <ArrowRight size={13} />
          </Link>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/[0.065] bg-[#111311] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1b201b] text-[#9cff38]">
                <UserIcon size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {account.email}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.15em] text-[#82a164]">
                  {account.planCode?.replaceAll("_", " ") || "Manual"} plan
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-4">
              <p className="text-[8px] uppercase tracking-wider text-[#626c67]">
                Available balance
              </p>
              <p className="mt-2 font-mono text-4xl font-semibold">
                {account.creditsBalance.toLocaleString()}
              </p>
              <p className="mt-1 text-[9px] text-[#69736f]">
                workspace credits
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/buy"
                  className="rounded-lg bg-[#9cff38] px-3 py-2.5 text-center text-[10px] font-bold text-[#0a0d09]"
                >
                  Top up credits
                </Link>
                <button
                  onClick={() => void load()}
                  className="rounded-lg border border-white/[0.07] px-3 py-2.5 text-[10px] text-[#aab3af]"
                >
                  Refresh account
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3">
                <p className="font-mono text-lg">
                  {account.creditsPurchased.toLocaleString()}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-wider text-[#626c67]">
                  Credits issued
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3">
                <p className="font-mono text-lg">
                  {account.creditsSpent.toLocaleString()}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-wider text-[#626c67]">
                  Credits used
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-white/[0.065] bg-[#111311] p-5">
            <div className="flex items-center gap-3">
              <KeyRound size={17} className="text-[#9cff38]" />
              <div>
                <h3 className="text-sm font-semibold">
                  Login key and permissions
                </h3>
                <p className="mt-1 text-[9px] text-[#69736f]">
                  Only the non-sensitive key prefix is displayed.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {accessRows.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/[0.055] bg-[#0b0d0c] p-3"
                >
                  <p className="text-[8px] uppercase tracking-wider text-[#626c67]">
                    {label}
                  </p>
                  <p
                    className={`mt-2 break-all text-xs ${value === "Enabled" ? "text-[#9cff38]" : "text-[#c0c7c3]"}`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {account.accessExpired && (
              <p className="mt-4 rounded-xl border border-[#f7c948]/20 bg-[#f7c948]/[0.05] p-3 text-[10px] leading-4 text-[#e2c86e]">
                The access period expired. Renew a plan or add credits to
                reactivate eligible paid tools.
              </p>
            )}
          </section>
        </div>
        <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.065] bg-[#111311]">
          <div className="border-b border-white/[0.055] p-4">
            <h3 className="text-sm font-semibold">Recent account ledger</h3>
            <p className="mt-1 text-[9px] text-[#69736f]">
              Latest credit movements on this workspace.
            </p>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {data.transactions.slice(0, 12).map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${transaction.amount > 0 ? "bg-[#9cff38]/10 text-[#9cff38]" : "bg-white/[0.035] text-[#8b9590]"}`}
                >
                  <Coins size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-[#c7ceca]">
                    {transaction.description}
                  </p>
                  <p className="mt-1 text-[8px] text-[#626c67]">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-xs ${transaction.amount > 0 ? "text-[#9cff38]" : "text-[#c7ceca]"}`}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[8px] text-[#626c67]">
                    {transaction.balanceAfter.toLocaleString()} left
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-7 lg:p-10">
      <div className="grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className="overflow-hidden rounded-[30px] border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.055] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
                Available balance
              </p>
              <p className="mt-3 font-mono text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
                {formatNumber(account.creditsBalance)}
              </p>
              <p className="mt-2 text-sm text-[#81908c]">workspace credits</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
              <Coins size={21} />
            </span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-5">
            <div>
              <p className="font-mono text-lg">
                {formatNumber(account.creditsPurchased)}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-[#64736e]">
                Credits issued
              </p>
            </div>
            <div>
              <p className="font-mono text-lg">
                {formatNumber(account.creditsSpent)}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-[#64736e]">
                Credits consumed
              </p>
            </div>
          </div>
        </section>
        <section className={`${PANEL} rounded-[30px] p-6 sm:p-8`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#65e6ff]/10 text-[#65e6ff]">
              <KeyRound size={17} />
            </span>
            <div>
              <p className="font-semibold capitalize">
                {account.planCode?.replaceAll("_", " ") || "Manual access"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[#65736f]">
                Current operating level
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-white/[0.06] pb-3">
              <span className="text-[#71807c]">Workspace email</span>
              <span>{account.email}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.06] pb-3">
              <span className="text-[#71807c]">Key expiry</span>
              <span className={account.accessExpired ? "text-[#ff8d8d]" : ""}>
                {account.accessExpiresAt
                  ? new Date(account.accessExpiresAt).toLocaleDateString()
                  : "No expiry"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71807c]">Paid tasks</span>
              <span
                className={
                  account.creditsActive ? "text-[#b8ff4b]" : "text-[#ff8d8d]"
                }
              >
                {account.creditsActive ? "Ready" : "Top-up required"}
              </span>
            </div>
          </div>
          {account.accessExpired && (
            <p className="mt-5 rounded-xl border border-[#f4ca64]/20 bg-[#f4ca64]/[0.06] p-3 text-xs leading-5 text-[#f4ca64]">
              Your key still signs in normally. Add any credit pack to
              reactivate paid tools, or choose a new plan.
            </p>
          )}
        </section>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8ff4b]">
            Instant capacity
          </p>
          <h3 className="mt-2 text-2xl font-semibold">Top up credits</h3>
        </div>
        <Link
          href="/buy"
          className="text-xs font-semibold text-[#81908c] hover:text-white"
        >
          Compare plans <ArrowRight size={13} className="inline" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.creditSettings.topups
          .filter((pack) => pack.enabled)
          .map((pack) => (
            <article
              key={pack.code}
              className={`relative rounded-[24px] border p-5 ${pack.featured ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.055]" : "border-white/[0.08] bg-[#0b1717]"}`}
            >
              {pack.featured && (
                <span className="absolute right-4 top-4 rounded-full bg-[#b8ff4b] px-2 py-1 text-[8px] font-black uppercase text-[#07100d]">
                  Best value
                </span>
              )}
              <Coins size={18} className="text-[#b8ff4b]" />
              <h4 className="mt-5 font-semibold">{pack.name}</h4>
              <p className="mt-2 font-mono text-2xl">
                {pack.credits.toLocaleString()}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-[#60706b]">
                credits
              </p>
              <button
                disabled={!!busyPack}
                onClick={() => void topup(pack.code)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-bold transition hover:border-[#b8ff4b]/25 hover:text-[#dfffaa] disabled:opacity-40"
              >
                {busyPack === pack.code ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <BadgeDollarSign size={13} />
                )}
                Add for ${(pack.priceUsdCents / 100).toFixed(2)}
              </button>
            </article>
          ))}
      </div>

      <section className={`${PANEL} mt-8 overflow-hidden rounded-[24px]`}>
        <div className="border-b border-white/[0.07] p-5">
          <h3 className="font-semibold">Recent credit activity</h3>
          <p className="mt-1 text-xs text-[#65736f]">
            Every credit movement is recorded.
          </p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {data.transactions.slice(0, 20).map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-4 px-5 py-3.5"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${transaction.amount > 0 ? "bg-[#b8ff4b]/10 text-[#b8ff4b]" : "bg-white/[0.04] text-[#81908c]"}`}
              >
                {transaction.amount > 0 ? (
                  <Coins size={14} />
                ) : (
                  <Activity size={14} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{transaction.description}</p>
                <p className="mt-0.5 text-[10px] text-[#5f6d68]">
                  {new Date(transaction.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-mono text-sm ${transaction.amount > 0 ? "text-[#b8ff4b]" : "text-[#c4cfcb]"}`}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {transaction.amount.toLocaleString()}
                </p>
                <p className="text-[9px] text-[#5f6d68]">
                  {transaction.balanceAfter.toLocaleString()} left
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ValidateView({
  lists,
  jobs,
  activeJob,
  initialSourceId = "",
  embedded = false,
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
  initialSourceId?: string;
  embedded?: boolean;
  setActiveJob: (job: Job | null) => void;
  onListsChanged: () => Promise<ContactList[]>;
  onJobsChanged: () => Promise<Job[]>;
  onUsageChanged: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  openLists: () => void;
}) {
  const eligible = lists.filter((list) => list.type !== "profile");
  const initialSource =
    eligible.find((list) => list.id === initialSourceId) || eligible[0];
  const [sourceId, setSourceId] = useState(initialSource?.id || "");
  const [resultName, setResultName] = useState(
    initialSource ? `${initialSource.name} - Valid Usernames` : "",
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
      <div
        className={embedded ? "" : "mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8"}
      >
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
    <div className={embedded ? "" : "mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8"}>
      <div className={embedded ? "" : "grid gap-6 xl:grid-cols-[1fr_390px]"}>
        <section>
          {!embedded && (
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
                previews in a durable background run and writes confirmed
                profiles into a clean result list.
              </p>
            </div>
          )}
          <div
            className={`${embedded ? "" : PANEL} rounded-[28px] ${embedded ? "" : "p-5 sm:p-7"}`}
          >
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
                    {embedded ? (
                      <div className={`${FIELD} flex items-center gap-3 pl-11`}>
                        <span className="min-w-0 flex-1 truncate">
                          {selected?.name}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] text-[#71807c]">
                          {formatNumber(selected?.itemsCount || 0)} rows
                        </span>
                      </div>
                    ) : (
                      <CardPicker
                        value={effectiveSourceId}
                        onChange={(id) => {
                          setSourceId(id);
                          const list = eligible.find((item) => item.id === id);
                          if (list)
                            setResultName(`${list.name} - Valid Usernames`);
                        }}
                        placeholder="Choose an imported list"
                        className="[&_button:first-child]:pl-11"
                        options={eligible.map((list) => ({
                          id: list.id,
                          label: list.name,
                          description: `${list.type} list`,
                          count: list.itemsCount,
                        }))}
                      />
                    )}
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
        {!embedded && (
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
        )}
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

type StatsData = {
  totalJobs: number;
  totalValid: number;
  totalInvalid: number;
  totalFailed: number;
  totalProcessed: number;
  totalRequests: number;
  successRate: number;
  byStatus: Record<string, number>;
  lists: { total: number; totalItems: number; byType: Record<string, number> };
  recentJobs: Array<{
    id: string;
    status: string;
    validCount: number;
    invalidCount: number;
    failedCount: number;
    totalCount: number;
    totalRequests: number;
    createdAt: string;
    finishedAt: string | null;
    sourceListName: string;
  }>;
  daily: Array<{ date: string; total: number; valid: number; invalid: number }>;
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
    daily: Array<{
      date: string;
      runs: number;
      sent: number;
      failed: number;
      replied: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    kind: "validator" | "message_run" | "account_settings";
    name: string;
    status: string;
    succeeded: number;
    failed: number;
    total: number;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

function StatsCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className={`${PANEL} rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[#6cebd9]">
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#61706b]">
            {label}
          </p>
          <p className="mt-0.5 truncate text-xl font-semibold tracking-[-0.02em] text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {sub && (
            <p className="mt-px truncate text-[10px] text-[#53615d]">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<StatsData>("/api/validator/stats")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[#b8ff4b]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[400px] items-center justify-center text-sm text-[#74837e]">
          Could not load dashboard
        </div>
      </div>
    );
  }

  const graph = data.messaging.daily;
  const graphMax = Math.max(
    1,
    ...graph.map((day) => Math.max(day.sent, day.replied, day.runs)),
  );
  const points = (key: "sent" | "replied" | "runs") =>
    graph
      .map((day, index) => {
        const x =
          graph.length === 1
            ? 50
            : (index / Math.max(1, graph.length - 1)) * 100;
        const y = 92 - (day[key] / graphMax) * 78;
        return `${x},${y}`;
      })
      .join(" ");
  const successfulResults = data.totalValid + data.messaging.sent;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
            Signal Desk overview
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#788781]">
            Sessions, validation results, message runs, and recent operations
            across your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#b8ff4b]/15 bg-[#b8ff4b]/[0.045] px-4 py-3 text-xs text-[#91a09b]">
          <span className="h-2 w-2 rounded-full bg-[#b8ff4b] shadow-[0_0_10px_#b8ff4b]" />
          {data.sessions.active} account{data.sessions.active === 1 ? "" : "s"}{" "}
          online
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Total sessions"
          value={data.sessions.total}
          icon={Smartphone}
          sub={`${data.sessions.clean} clean SpamBot checks`}
        />
        <StatsCard
          label="Active sessions"
          value={data.sessions.active}
          icon={Activity}
          sub={`${data.sessions.inactive} currently offline`}
        />
        <StatsCard
          label="Successful results"
          value={successfulResults}
          icon={CheckCircle2}
          sub={`${data.totalValid.toLocaleString()} valid + ${data.messaging.sent.toLocaleString()} delivered`}
        />
        <StatsCard
          label="Message success"
          value={`${data.messaging.successRate}%`}
          icon={Send}
          sub={`${data.messaging.runs.toLocaleString()} message runs`}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.55fr_.85fr]">
        <section className={`${PANEL} overflow-hidden rounded-[24px]`}>
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Message runs</h3>
              <p className="mt-1 text-[10px] text-[#60706b]">
                Delivery activity over the last 30 days
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] uppercase tracking-wider text-[#71807c]">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#b8ff4b]" /> Sent
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#65e6ff]" /> Replies
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#d8b7ff]" /> Runs
              </span>
            </div>
          </div>
          <div className="p-5">
            {graph.length ? (
              <div className="relative h-[290px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#071111] p-3">
                <div className="pointer-events-none absolute inset-3 flex flex-col justify-between">
                  {[0, 1, 2, 3, 4].map((line) => (
                    <span
                      key={line}
                      className="block border-t border-white/[0.05]"
                    />
                  ))}
                </div>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="relative h-full w-full overflow-visible"
                >
                  <defs>
                    <linearGradient
                      id="messageArea"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#b8ff4b" stopOpacity=".28" />
                      <stop offset="1" stopColor="#b8ff4b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`0,100 ${points("sent")} 100,100`}
                    fill="url(#messageArea)"
                  />
                  <polyline
                    points={points("sent")}
                    fill="none"
                    stroke="#b8ff4b"
                    strokeWidth="1.8"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={points("replied")}
                    fill="none"
                    stroke="#65e6ff"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={points("runs")}
                    fill="none"
                    stroke="#d8b7ff"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="absolute inset-x-4 bottom-2 flex justify-between text-[8px] text-[#53615d]">
                  <span>{graph[0]?.date.slice(5)}</span>
                  <span>
                    {graph[Math.floor(graph.length / 2)]?.date.slice(5)}
                  </span>
                  <span>{graph.at(-1)?.date.slice(5)}</span>
                </div>
              </div>
            ) : (
              <div className="flex h-[290px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-[#53615d]">
                Message activity will appear after the first run.
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Runs", value: data.messaging.runs },
                { label: "Sent", value: data.messaging.sent },
                { label: "Replies", value: data.messaging.replied },
                { label: "Failed", value: data.messaging.failed },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/[0.06] bg-[#071111] p-3"
                >
                  <p className="font-mono text-lg font-semibold">
                    {formatNumber(item.value)}
                  </p>
                  <p className="text-[8px] uppercase tracking-wider text-[#60706b]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${PANEL} overflow-hidden rounded-[24px]`}>
          <div className="border-b border-white/[0.07] p-5">
            <h3 className="text-sm font-semibold">Recent jobs</h3>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Latest operations across the workspace
            </p>
          </div>
          <div className="divide-y divide-white/[0.055]">
            {data.recentActivity.map((job) => (
              <div
                key={`${job.kind}:${job.id}`}
                className="flex items-center gap-3 p-4"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${job.kind === "message_run" ? "bg-[#d8b7ff]/10 text-[#d8b7ff]" : job.kind === "validator" ? "bg-[#65e6ff]/10 text-[#65e6ff]" : "bg-[#b8ff4b]/10 text-[#b8ff4b]"}`}
                >
                  {job.kind === "message_run" ? (
                    <Send size={14} />
                  ) : job.kind === "validator" ? (
                    <Radar size={14} />
                  ) : (
                    <UserIcon size={14} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold capitalize">
                    {job.name}
                  </p>
                  <p className="mt-1 text-[9px] text-[#60706b]">
                    {job.succeeded}/{job.total} successful |{" "}
                    {relativeTime(job.createdAt)}
                  </p>
                </div>
                <StatusPill status={job.status} />
              </div>
            ))}
            {!data.recentActivity.length && (
              <p className="p-10 text-center text-xs text-[#53615d]">
                No jobs recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Validator jobs"
          value={data.totalJobs}
          icon={Radar}
          sub={`${data.totalValid.toLocaleString()} valid results`}
        />
        <StatsCard
          label="Validation rate"
          value={`${data.successRate}%`}
          icon={ShieldCheck}
          sub={`${data.totalProcessed.toLocaleString()} processed`}
        />
        <StatsCard
          label="Lists and rows"
          value={data.lists.total}
          icon={Layers3}
          sub={`${data.lists.totalItems.toLocaleString()} imported rows`}
        />
        <StatsCard
          label="Account replies"
          value={data.sessions.repliesReceived}
          icon={MessageCircleMore}
          sub={`${data.sessions.messagesSent.toLocaleString()} messages sent`}
        />
      </div>
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
  const [refreshing, setRefreshing] = useState(false);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [importResults, setImportResults] = useState<
    Array<{
      ok: boolean;
      filename?: string;
      code?: string;
      error?: string;
      session?: TelegramSession;
    }>
  >([]);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [challenge, setChallenge] = useState("");
  const [fleetName, setFleetName] = useState("");
  const [fleetSessionIds, setFleetSessionIds] = useState<string[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkWarmupMode, setBulkWarmupMode] = useState("safe");
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addAccountMode, setAddAccountMode] = useState<
    "choice" | "upload" | "login"
  >("choice");
  const [detailSession, setDetailSession] = useState<TelegramSession | null>(
    null,
  );
  const [sessionMenu, setSessionMenu] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState("25");
  const [organizeSessionIds, setOrganizeSessionIds] = useState<string[]>([]);
  const [organizeStep, setOrganizeStep] = useState<"ask" | "name" | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [historyDeleteOpen, setHistoryDeleteOpen] = useState(false);
  const credentialsPrompted = useRef(false);
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
    if (!credentialData.credential && !credentialsPrompted.current) {
      credentialsPrompted.current = true;
      setCredentialOpen(true);
    }
    setApiId(
      credentialData.credential ? String(credentialData.credential.apiId) : "",
    );
    setSessions(sessionData.sessions || []);
    setDetailSession((current) =>
      current
        ? sessionData.sessions.find((session) => session.id === current.id) ||
          current
        : null,
    );
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
      !sessions.some((session) =>
        ["queued_validation", "validating"].includes(session.status),
      )
    )
      return;
    const timer = window.setInterval(() => {
      void api<{ sessions: TelegramSession[] }>(
        "/api/validator/telegram/sessions",
      )
        .then((data) => {
          setSessions(data.sessions || []);
          setDetailSession((current) =>
            current
              ? data.sessions.find((session) => session.id === current.id) ||
                current
              : null,
          );
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [sessions]);

  async function refreshInventory() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
      notify("Telegram accounts refreshed.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to refresh accounts",
        "error",
      );
    } finally {
      setRefreshing(false);
    }
  }

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
          setAddAccountOpen(false);
          setAddAccountMode("choice");
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
      setCredentialOpen(false);
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
        results: Array<{
          ok: boolean;
          filename?: string;
          code?: string;
          error?: string;
          session?: TelegramSession;
        }>;
      }>("/api/validator/telegram/sessions", { method: "POST", body: form });
      setImportResults(data.results);
      const importedIds = data.results.flatMap((result) =>
        result.ok && result.session ? [result.session.id] : [],
      );
      setFiles([]);
      await load();
      const failed = data.results.filter((result) => !result.ok).length;
      notify(
        failed
          ? `${failed} session${failed === 1 ? "" : "s"} failed to import: ${data.results.find((result) => !result.ok)?.error || "invalid session data"}`
          : `Queued ${data.imported} session${data.imported === 1 ? "" : "s"} for validation.`,
        failed ? "error" : "success",
      );
      if (importedIds.length && !failed) {
        setAddAccountOpen(false);
        setAddAccountMode("choice");
        setOrganizeSessionIds(importedIds);
        setOrganizeStep("ask");
      }
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
    action:
      | "spam_check"
      | "warmup"
      | "warmup_mode"
      | "login"
      | "logout"
      | "delete"
      | "profile_sync",
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
      if (action === "delete") setSelectedSessionIds([]);
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
    action: "spam_check" | "warmup" | "login" | "logout" | "profile_sync",
  ) {
    setBusy(`${action}:${session.id}`);
    try {
      const data = await api<{ session: TelegramSession }>(
        `/api/validator/telegram/sessions/${session.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      setDetailSession((current) =>
        current?.id === session.id ? data.session : current,
      );
      await load();
      notify(
        action === "spam_check"
          ? "@SpamBot check queued."
          : action === "warmup"
            ? "Warmup action queued."
            : action === "login"
              ? "Session login queued."
              : action === "logout"
                ? "Session logged out from this workspace."
                : "Telegram profile refresh queued.",
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

  function openTelegramClient(session: TelegramSession) {
    if (!session.isLoggedIn || session.status !== "active") {
      notify(
        "This account must be active and logged in before opening its Telegram client.",
        "error",
      );
      return false;
    }
    const popup = window.open(
      `/telegram/client/${encodeURIComponent(session.id)}`,
      `signal_desk_telegram_${session.id}`,
      "popup=yes,noopener=no,noreferrer=no,resizable=yes,scrollbars=yes,width=1180,height=800",
    );
    if (!popup) {
      notify(
        "Your browser blocked the Telegram client window. Allow popups for Signal Desk and try again.",
        "error",
      );
      return false;
    }
    try {
      popup.focus();
    } catch {
      /* The window still opened when focus is restricted. */
    }
    return true;
  }

  function openSelectedClients() {
    const selected = sessions.filter((session) =>
      selectedSessionIds.includes(session.id),
    );
    const ready = selected.filter(
      (session) => session.isLoggedIn && session.status === "active",
    );
    let opened = 0;
    for (const session of ready) opened += Number(openTelegramClient(session));
    const skipped = selected.length - ready.length;
    if (opened)
      notify(
        `Opened ${opened} Telegram client window${opened === 1 ? "" : "s"}${skipped ? `; ${skipped} inactive account${skipped === 1 ? " was" : "s were"} skipped` : ""}.`,
        "success",
      );
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
      setDetailSession((current) =>
        current?.id === session.id ? data.session : current,
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

  async function organizeUploadedSessions() {
    if (!fleetName.trim() || !organizeSessionIds.length) return;
    setBusy("organize");
    try {
      await api("/api/validator/telegram/session-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fleetName.trim(),
          sessionIds: organizeSessionIds,
        }),
      });
      notify(
        `Organized ${organizeSessionIds.length} session${organizeSessionIds.length === 1 ? "" : "s"} into ${fleetName.trim()}.`,
        "success",
      );
      setFleetName("");
      setOrganizeSessionIds([]);
      setOrganizeStep(null);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to organize sessions",
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
  const visibleSessions = sessions.filter((session) => {
    const matchesSearch =
      `${session.label} ${session.firstName || ""} ${session.lastName || ""} ${session.username || ""} ${session.phone || ""}`
        .toLowerCase()
        .includes(sessionSearch.trim().toLowerCase());
    const matchesFilter =
      sessionFilter === "all" ||
      (sessionFilter === "active" &&
        session.isLoggedIn &&
        session.status === "active") ||
      (sessionFilter === "offline" && !session.isLoggedIn) ||
      (sessionFilter === "error" &&
        (session.status === "error" || Boolean(session.lastErrorMessage))) ||
      session.spamStatus === sessionFilter;
    return matchesSearch && matchesFilter;
  });
  const activeSessionCount = sessions.filter(
    (session) => session.isLoggedIn && session.status === "active",
  ).length;
  const selectedAll =
    visibleSessions.length > 0 &&
    visibleSessions.every((session) => selectedSessionIds.includes(session.id));
  const pageSize = Number(sessionPageSize);
  const sessionPages = Math.max(
    1,
    Math.ceil(visibleSessions.length / pageSize),
  );
  const currentSessionPage = Math.min(sessionPage, sessionPages);
  const pagedSessions = visibleSessions.slice(
    (currentSessionPage - 1) * pageSize,
    currentSessionPage * pageSize,
  );
  const accountName = (session: TelegramSession) =>
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.label;

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#65e6ff]">
            <span className="h-px w-7 bg-current" /> Telegram account vault
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Accounts
          </h2>
          <p className="mt-2 text-sm text-[#71807c]">
            Manage and organize your Telegram sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCredentialOpen(true)}
            className={SECONDARY}
          >
            <Settings size={15} /> API settings
          </button>
          <button
            type="button"
            onClick={() => {
              if (!credential) {
                setCredentialOpen(true);
                return;
              }
              setAddAccountMode("choice");
              setAddAccountOpen(true);
            }}
            className={PRIMARY}
          >
            <UserPlus size={15} /> Add account
          </button>
        </div>
      </div>

      {!credential && (
        <button
          type="button"
          onClick={() => setCredentialOpen(true)}
          className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-[#f4ca64]/25 bg-[#f4ca64]/[0.06] p-4 text-left"
        >
          <KeyRound size={17} className="mt-0.5 shrink-0 text-[#f4ca64]" />
          <span>
            <span className="block text-sm font-semibold text-[#f6d984]">
              Enter Telegram API credentials to continue
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#9d8b5a]">
              Add the API ID and API hash from my.telegram.org before uploading
              or connecting accounts.
            </span>
          </span>
        </button>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          label="Total accounts"
          value={sessions.length}
          icon={Smartphone}
          sub="Unlimited fleet allowance"
        />
        <StatsCard
          label="Active accounts"
          value={activeSessionCount}
          icon={CheckCircle2}
          sub={`${sessions.length - activeSessionCount} offline or pending`}
        />
        <StatsCard
          label="SpamBot clean"
          value={
            sessions.filter((session) => session.spamStatus === "clean").length
          }
          icon={ShieldCheck}
          sub="Ready safety checks"
        />
        <StatsCard
          label="Premium accounts"
          value={sessions.filter((session) => session.isPremium).length}
          icon={Star}
          sub={`${sessions.filter((session) => session.spamStatus === "frozen").length} frozen · ${sessions.filter((session) => session.spamStatus === "limited").length} limited`}
        />
        <StatsCard
          label="Messages sent"
          value={sessions.reduce(
            (sum, session) => sum + session.messagesSent,
            0,
          )}
          icon={Send}
          sub={`${sessions.reduce((sum, session) => sum + session.repliesReceived, 0)} replies received`}
        />
      </div>

      <section className={`${PANEL} mt-5 overflow-visible rounded-[24px]`}>
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]"
            />
            <input
              value={sessionSearch}
              onChange={(event) => {
                setSessionSearch(event.target.value);
                setSessionPage(1);
              }}
              placeholder="Search account, username, phone..."
              className={`${FIELD} pl-10`}
            />
          </div>
          <SignalSelect
            value={sessionFilter}
            onChange={(value) => {
              setSessionFilter(value);
              setSessionPage(1);
            }}
            placeholder="Account status"
            searchable={false}
            className="lg:max-w-52"
            accent="#65e6ff"
            options={[
              { value: "all", label: "All accounts" },
              { value: "active", label: "Active" },
              { value: "offline", label: "Offline" },
              { value: "clean", label: "SpamBot clean" },
              { value: "limited", label: "Limited" },
              { value: "frozen", label: "Frozen" },
              { value: "error", label: "Errors" },
            ]}
          />
          <SignalSelect
            value={sessionPageSize}
            onChange={(value) => {
              setSessionPageSize(value);
              setSessionPage(1);
            }}
            placeholder="Rows per page"
            searchable={false}
            className="lg:max-w-36"
            options={["25", "50", "100"].map((value) => ({
              value,
              label: `${value} per page`,
            }))}
          />
          <button
            type="button"
            onClick={() => void refreshInventory()}
            disabled={refreshing}
            className={SECONDARY}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {selectedSessionIds.length > 0 && (
          <div className="border-b border-[#b8ff4b]/15 bg-[linear-gradient(90deg,rgba(156,255,56,.055),rgba(156,255,56,.018))] p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="min-w-40 rounded-xl border border-[#b8ff4b]/15 bg-[#0b0d0c]/55 px-3 py-2">
                <p className="text-sm font-semibold text-[#dfffaa]">
                  {selectedSessionIds.length} selected
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedSessionIds([])}
                  className="mt-1 text-[10px] text-[#91a09b] hover:text-white"
                >
                  Clear selection
                </button>
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                <div className="flex min-w-max items-center gap-2 xl:justify-end">
                  <button
                    onClick={openSelectedClients}
                    disabled={busy.startsWith("bulk:")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-3.5 py-2.5 text-xs font-bold text-[#07100d]"
                  >
                    <ExternalLink size={13} /> Open clients
                  </button>
                  <button
                    onClick={() => setHistoryDeleteOpen(true)}
                    disabled={busy.startsWith("bulk:")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ff7474]/25 bg-[#ff7474]/[0.07] px-3.5 py-2.5 text-xs font-semibold text-[#ff9696]"
                  >
                    <Trash2 size={13} /> Delete history
                  </button>
                  <span className="mx-1 h-7 w-px bg-white/[0.07]" />
                  <button
                    onClick={() => void runBulkAction("login")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <LogIn size={13} /> Reconnect
                  </button>
                  <button
                    onClick={() => void runBulkAction("logout")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <LogOut size={13} /> Disconnect
                  </button>
                  <button
                    onClick={() => void runBulkAction("spam_check")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <ShieldCheck size={13} /> SpamBot
                  </button>
                  <button
                    onClick={() => void runBulkAction("profile_sync")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <RefreshCw size={13} /> Sync profiles
                  </button>
                  <button
                    onClick={() => void runBulkAction("warmup")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <Sparkles size={13} /> Warm now
                  </button>
                  <SignalSelect
                    value={bulkWarmupMode}
                    onChange={setBulkWarmupMode}
                    placeholder="Warmup policy"
                    searchable={false}
                    className="w-40 text-xs"
                    accent="#65e6ff"
                    options={[
                      { value: "safe", label: "Safe policy" },
                      { value: "standard", label: "Standard policy" },
                      { value: "off", label: "Warmup off" },
                    ]}
                  />
                  <button
                    onClick={() => void runBulkAction("warmup_mode")}
                    disabled={busy.startsWith("bulk:")}
                    className={SECONDARY}
                  >
                    <Check size={13} /> Apply
                  </button>
                  <button
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={busy.startsWith("bulk:")}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#ff7474]/20 px-3.5 py-2.5 text-xs font-medium text-[#ff9696]"
                  >
                    <Trash2 size={13} /> Delete accounts
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[930px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[9px] font-bold uppercase tracking-[0.16em] text-[#60706b]">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedAll}
                    onChange={() =>
                      setSelectedSessionIds(
                        selectedAll
                          ? selectedSessionIds.filter(
                              (id) =>
                                !visibleSessions.some(
                                  (session) => session.id === id,
                                ),
                            )
                          : [
                              ...new Set([
                                ...selectedSessionIds,
                                ...visibleSessions.map((session) => session.id),
                              ]),
                            ],
                      )
                    }
                    className="accent-[#b8ff4b]"
                  />
                </th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Spam protection</th>
                <th className="px-3 py-3">Last active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.055]">
              {pagedSessions.map((session) => (
                <tr
                  key={session.id}
                  className={`transition hover:bg-white/[0.018] ${selectedSessionIds.includes(session.id) ? "bg-[#b8ff4b]/[0.025]" : session.spamStatus === "frozen" ? "bg-[#ff7474]/[0.02]" : session.spamStatus === "limited" ? "bg-[#f4ca64]/[0.015]" : ""}`}
                >
                  <td className="px-4 py-3.5">
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
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#13201e] font-semibold text-[#b8ff4b]">
                        {session.avatarUrl ? (
                          <img
                            src={session.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          accountName(session).slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="block max-w-xs truncate text-sm font-semibold">
                            {accountName(session)}
                          </span>
                          {session.isPremium && (
                            <span
                              title="Telegram Premium"
                              className="inline-flex items-center gap-1 rounded-full border border-[#f4ca64]/25 bg-[#f4ca64]/[0.07] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#f4ca64]"
                            >
                              <Star size={8} fill="currentColor" /> Premium
                            </span>
                          )}
                          {session.isVerified && (
                            <CheckCircle2
                              size={12}
                              className="text-[#65e6ff]"
                            />
                          )}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-[#60706b]">
                          {session.username
                            ? `@${session.username}`
                            : session.phone || session.label}
                        </span>
                        {session.lastErrorMessage && (
                          <span className="mt-2 flex max-w-md items-start gap-1.5 rounded-lg border border-[#ff7474]/15 bg-[#ff7474]/[0.045] px-2 py-1.5 text-[9px] leading-4 text-[#ff9292]">
                            <AlertCircle
                              size={11}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="break-words">
                              <strong>
                                {session.lastErrorCode || "SESSION_ERROR"}
                              </strong>
                              : {session.lastErrorMessage}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusPill
                      status={
                        session.status === "error"
                          ? "error"
                          : session.isLoggedIn
                            ? session.status
                            : "offline"
                      }
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusPill status={session.spamStatus} />
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#71807c]">
                    {relativeTime(session.lastActiveAt || session.updatedAt)}
                  </td>
                  <td className="relative px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={`/api/validator/telegram/sessions/${session.id}/download`}
                        title="Download decrypted session"
                        className="rounded-lg border border-white/[0.08] p-2 text-[#71807c] transition hover:border-[#b8ff4b]/25 hover:text-[#b8ff4b]"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => setDetailSession(session)}
                        title="View session details"
                        className="rounded-lg border border-white/[0.08] p-2 text-[#71807c] transition hover:border-[#65e6ff]/25 hover:text-[#65e6ff]"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openTelegramClient(session)}
                        disabled={
                          !session.isLoggedIn || session.status !== "active"
                        }
                        title="Open Telegram client in its own window"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#9cff38]/15 bg-[#9cff38]/[0.035] px-2.5 py-2 text-[9px] font-semibold text-[#c8eea4] transition hover:border-[#9cff38]/30 hover:bg-[#9cff38]/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ExternalLink size={12} /> Login
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSessionMenu(
                            sessionMenu === session.id ? null : session.id,
                          )
                        }
                        className="rounded-lg border border-white/[0.08] p-2 text-[#71807c] transition hover:text-white"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    {sessionMenu === session.id && (
                      <div className="absolute right-4 top-12 z-30 w-52 rounded-xl border border-white/10 bg-[#101c1b] p-1.5 text-left shadow-2xl">
                        <button
                          onClick={() => {
                            setSessionMenu(null);
                            void runSessionAction(
                              session,
                              session.isLoggedIn ? "logout" : "login",
                            );
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#aebbb6] hover:bg-white/5 hover:text-white"
                        >
                          {session.isLoggedIn ? (
                            <LogOut size={13} />
                          ) : (
                            <LogIn size={13} />
                          )}
                          {session.isLoggedIn ? "Log out" : "Log back in"}
                        </button>
                        <button
                          onClick={() => {
                            setSessionMenu(null);
                            void runSessionAction(session, "profile_sync");
                          }}
                          disabled={!session.isLoggedIn}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#aebbb6] hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                          <RefreshCw size={13} /> Refresh profile
                        </button>
                        <button
                          onClick={() => {
                            setSessionMenu(null);
                            void runSessionAction(session, "spam_check");
                          }}
                          disabled={!session.isLoggedIn}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#aebbb6] hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                          <ShieldCheck size={13} /> Run SpamBot check
                        </button>
                        <button
                          onClick={() => {
                            setSessionMenu(null);
                            void runSessionAction(session, "warmup");
                          }}
                          disabled={!session.isLoggedIn}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#aebbb6] hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                          <Sparkles size={13} /> Warm now
                        </button>
                        <div className="my-1 h-px bg-white/[0.07]" />
                        <button
                          onClick={() => {
                            setSessionMenu(null);
                            removeSession(session);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#ff8585] hover:bg-[#ff7474]/10"
                        >
                          <Trash2 size={13} /> Delete account
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
          {pagedSessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 ${selectedSessionIds.includes(session.id) ? "bg-[#b8ff4b]/[0.025]" : session.spamStatus === "frozen" ? "bg-[#ff7474]/[0.02]" : ""}`}
            >
              <div className="flex items-start gap-3">
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
                  className="mt-4 accent-[#b8ff4b]"
                />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#13201e] font-semibold text-[#b8ff4b]">
                  {session.avatarUrl ? (
                    <img
                      src={session.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    accountName(session).slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    <span className="truncate">{accountName(session)}</span>
                    {session.isPremium && (
                      <span title="Telegram Premium">
                        <Star
                          size={11}
                          fill="currentColor"
                          className="shrink-0 text-[#f4ca64]"
                        />
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#60706b]">
                    {session.username
                      ? `@${session.username}`
                      : session.phone || session.label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill
                      status={
                        session.status === "error"
                          ? "error"
                          : session.isLoggedIn
                            ? session.status
                            : "offline"
                      }
                    />
                    <StatusPill status={session.spamStatus} />
                    {session.isPremium && (
                      <span className="rounded-full border border-[#f4ca64]/20 px-2 py-1 text-[8px] font-bold uppercase text-[#f4ca64]">
                        Premium
                      </span>
                    )}
                  </div>
                  {session.lastErrorMessage && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#ff7474]/15 bg-[#ff7474]/[0.045] p-2 text-[9px] leading-4 text-[#ff9292]">
                      <AlertCircle size={11} className="mt-0.5 shrink-0" />
                      <span className="break-words">
                        <strong>
                          {session.lastErrorCode || "SESSION_ERROR"}
                        </strong>
                        : {session.lastErrorMessage}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailSession(session)}
                  className="rounded-lg border border-white/10 p-2 text-[#65e6ff]"
                >
                  <Eye size={14} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 pl-7">
                <button
                  type="button"
                  onClick={() => openTelegramClient(session)}
                  disabled={!session.isLoggedIn || session.status !== "active"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-3 py-2.5 text-[10px] font-bold text-[#07100d] disabled:opacity-30"
                >
                  <ExternalLink size={13} /> Login
                </button>
                <a
                  href={`/api/validator/telegram/sessions/${session.id}/download`}
                  className={SECONDARY}
                >
                  <Download size={13} /> Export
                </a>
                <button
                  onClick={() =>
                    void runSessionAction(
                      session,
                      session.isLoggedIn ? "logout" : "login",
                    )
                  }
                  className={SECONDARY}
                >
                  {session.isLoggedIn ? (
                    <LogOut size={13} />
                  ) : (
                    <LogIn size={13} />
                  )}
                  {session.isLoggedIn ? "Disconnect" : "Reconnect"}
                </button>
                <button
                  onClick={() => removeSession(session)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ff7474]/20 text-[10px] text-[#ff8585]"
                >
                  <Trash2 size={13} /> Delete account
                </button>
              </div>
            </div>
          ))}
        </div>
        {!visibleSessions.length && (
          <div className="flex flex-col items-center py-16 text-center">
            <Smartphone size={28} className="text-[#40504b]" />
            <p className="mt-3 text-sm text-[#71807c]">
              {sessions.length
                ? "No accounts match this filter."
                : "No Telegram accounts yet."}
            </p>
            <button
              type="button"
              onClick={() =>
                credential ? setAddAccountOpen(true) : setCredentialOpen(true)
              }
              className={`${PRIMARY} mt-4`}
            >
              <Plus size={14} /> Add first account
            </button>
          </div>
        )}
        {!!visibleSessions.length && (
          <div className="flex flex-col gap-2 border-t border-white/[0.06] px-4 py-3 text-[10px] text-[#60706b] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(currentSessionPage - 1) * pageSize + 1}-
              {Math.min(currentSessionPage * pageSize, visibleSessions.length)}{" "}
              of {visibleSessions.length} matching accounts
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentSessionPage <= 1}
                onClick={() =>
                  setSessionPage((value) => Math.max(1, value - 1))
                }
                className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="min-w-16 text-center">
                {currentSessionPage} / {sessionPages}
              </span>
              <button
                type="button"
                disabled={currentSessionPage >= sessionPages}
                onClick={() =>
                  setSessionPage((value) => Math.min(sessionPages, value + 1))
                }
                className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={`${PANEL} mt-5 rounded-[24px] p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-[#65e6ff]" />
              <h3 className="text-sm font-semibold">Recent session activity</h3>
            </div>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Warmup, pacing, SpamBot, flood, and safety events from the
              Telegram worker.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
            Last 20
          </span>
        </div>
        <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
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
                  <p className="truncate text-xs font-medium capitalize">
                    {entry.action.replaceAll("_", " ")}
                  </p>
                  <span className="shrink-0 text-[9px] text-[#53615d]">
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
            <p className="py-6 text-center text-xs text-[#60706b]">
              No session activity recorded yet.
            </p>
          )}
        </div>
      </section>

      {Boolean(0) && credential && flow && (
        <>
          <div className={`${PANEL} mb-5 rounded-[24px] p-4 sm:p-5`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <h3 className="text-sm font-semibold">Bulk account controls</h3>
                <p className="mt-1 text-[10px] text-[#60706b]">
                  Select accounts once, then run SpamBot, warmup, or policy
                  actions together.
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
                API credentials, session material, login codes, 2FA passwords,
                and proxies are encrypted before PostgreSQL storage. Telegram
                connections run only in the dedicated Hydrogram worker.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-[#0b1717] px-4 py-3 text-xs text-[#71807c]">
              <span className="block font-mono text-xl text-[#eef7ed]">
                {sessions.length} / unlimited
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
                    onChange={(event) => {
                      setFiles(Array.from(event.target.files || []));
                      setImportResults([]);
                    }}
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
                          flow.status === "awaiting_password"
                            ? "password"
                            : "text"
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
                          ![
                            "completed",
                            "failed",
                            "expired",
                            "cancelled",
                          ].includes(flow.status)
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
                    <span><strong>{flow.errorCode || "TELEGRAM_LOGIN_FAILED"}</strong>: {flow.errorMessage}</span>
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
                        Import an existing session or connect an account by
                        phone after saving API credentials.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className={`${PANEL} rounded-[24px] p-5`}>
                <div className="flex items-center gap-2">
                  <Layers3 size={15} className="text-[#d8b7ff]" />
                  <h3 className="text-sm font-semibold">
                    Named session fleets
                  </h3>
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
                        <p className="truncate text-xs font-medium">
                          {fleet.name}
                        </p>
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
                  Mass messaging requires a clean SpamBot check from the last
                  seven days, risk below 70, no active cooldown, and remaining
                  daily warmup capacity.
                </p>
                <div className="mt-3 grid gap-2 rounded-xl border border-white/[0.07] bg-[#071111] p-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
                  <label className="text-[9px] uppercase tracking-wider text-[#60706b]">
                    Policy for {selectedSessionIds.length || "selected"}
                    <SignalSelect
                      value={bulkWarmupMode}
                      onChange={setBulkWarmupMode}
                      placeholder="Warmup policy"
                      searchable={false}
                      className="mt-1 py-2 text-xs"
                      accent="#65e6ff"
                      options={[
                        {
                          value: "safe",
                          label: "Safe",
                          description: "Read oriented · 14-day ramp",
                        },
                        {
                          value: "standard",
                          label: "Standard",
                          description: "Human actions · 7-day ramp",
                        },
                        {
                          value: "off",
                          label: "Off",
                          description: "No background actions · 14-day ramp",
                        },
                      ]}
                    />
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
                            onClick={() =>
                              runSessionAction(session, "spam_check")
                            }
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
                        <SignalSelect
                          value={session.warmupMode}
                          disabled={busy === `settings:${session.id}`}
                          onChange={(value) =>
                            void setWarmupMode(session, value)
                          }
                          placeholder="Warmup policy"
                          searchable={false}
                          className="mt-1 py-2 text-xs"
                          accent="#65e6ff"
                          options={[
                            {
                              value: "safe",
                              label: "Safe",
                              description: "Read oriented · 14-day ramp",
                            },
                            {
                              value: "standard",
                              label: "Standard",
                              description: "Human actions · 7-day ramp",
                            },
                            {
                              value: "off",
                              label: "Off",
                              description:
                                "No background actions · 14-day ramp",
                            },
                          ]}
                        />
                      </label>
                      {session.healthCooldownUntil && (
                        <p className="mt-2 text-[9px] text-[#f4ca64]">
                          Cooldown until{" "}
                          {new Date(
                            session.healthCooldownUntil,
                          ).toLocaleString()}
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
        </>
      )}

      {credentialOpen && (
        <Modal
          title="Telegram API settings"
          description="Credentials are encrypted before storage and the API hash is never returned."
          onClose={() => setCredentialOpen(false)}
        >
          <form onSubmit={saveCredential} className="space-y-4">
            <div className="rounded-2xl border border-[#65e6ff]/15 bg-[#65e6ff]/[0.045] p-4 text-xs leading-5 text-[#8ba5a0]">
              Create an application at my.telegram.org and enter its API ID and
              API hash here. These credentials are used only by the dedicated
              Telegram worker.
            </div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
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
            {credential && (
              <p className="text-[10px] text-[#60706b]">
                Current credential saved {relativeTime(credential.updatedAt)}.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCredentialOpen(false)}
                className={`${SECONDARY} flex-1`}
              >
                Cancel
              </button>
              <button
                disabled={busy === "credential" || !apiId || !apiHash}
                className={`${PRIMARY} flex-[2]`}
              >
                {busy === "credential" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ShieldCheck size={15} />
                )}
                {credential ? "Rotate credentials" : "Encrypt and save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {addAccountOpen && (
        <Modal
          title={
            addAccountMode === "choice"
              ? "Add Telegram account"
              : addAccountMode === "upload"
                ? "Import session files"
                : "Connect by phone"
          }
          description={
            addAccountMode === "choice"
              ? "Choose how to add accounts to this workspace."
              : addAccountMode === "upload"
                ? "Import existing encrypted authorization material."
                : "Use Telegram's durable code and 2FA login flow."
          }
          onClose={() => {
            setAddAccountOpen(false);
            setAddAccountMode("choice");
          }}
        >
          {addAccountMode === "choice" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAddAccountMode("upload")}
                className="rounded-2xl border border-white/[0.08] bg-[#071111] p-5 text-left transition hover:border-[#65e6ff]/35 hover:bg-[#65e6ff]/[0.035]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#65e6ff]/10 text-[#65e6ff]">
                  <CloudUpload size={19} />
                </span>
                <span className="mt-4 block text-sm font-semibold">
                  Upload sessions
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#71807c]">
                  Add ZIP, SQLite session, JSON, TXT, or session-string files in
                  bulk.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAddAccountMode("login")}
                className="rounded-2xl border border-white/[0.08] bg-[#071111] p-5 text-left transition hover:border-[#d8b7ff]/35 hover:bg-[#d8b7ff]/[0.035]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8b7ff]/10 text-[#d8b7ff]">
                  <Smartphone size={19} />
                </span>
                <span className="mt-4 block text-sm font-semibold">
                  Log in with OTP
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#71807c]">
                  Connect one account using its phone number, Telegram code, and
                  optional 2FA.
                </span>
              </button>
            </div>
          )}

          {addAccountMode === "upload" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setAddAccountMode("choice")}
                className="inline-flex items-center gap-1.5 text-xs text-[#71807c] hover:text-white"
              >
                <ArrowLeft size={13} /> Choose another method
              </button>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-white/10 bg-[#071111] p-8 text-center transition hover:border-[#65e6ff]/30">
                <input
                  multiple
                  type="file"
                  accept=".session,.sqlite,.db,.json,.txt,.zip"
                  className="hidden"
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files || []));
                    setImportResults([]);
                  }}
                />
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#65e6ff]/10 text-[#65e6ff]">
                  <CloudUpload size={21} />
                </span>
                <span className="mt-3 text-sm font-semibold">
                  {files.length
                    ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                    : "Choose files or a ZIP archive"}
                </span>
                <span className="mt-1 text-[10px] text-[#60706b]">
                  Pyrogram, Hydrogram, Telethon, JSON, TXT, and ZIP
                </span>
              </label>
              {files.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#071111] p-3">
                  {files.map((file, index) => (
                    <p
                      key={`${file.name}-${index}`}
                      className="truncate text-[10px] text-[#81908c]"
                    >
                      {file.name}
                    </p>
                  ))}
                </div>
              )}
              {importResults.length > 0 && (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#071111] p-3">
                  {importResults.map((result, index) => (
                    <div
                      key={`${result.filename || result.session?.id || "import"}-${index}`}
                      className={`rounded-lg border p-2.5 ${result.ok ? "border-[#b8ff4b]/15 bg-[#b8ff4b]/[0.035]" : "border-[#ff7474]/20 bg-[#ff7474]/[0.045]"}`}
                    >
                      <div className="flex items-start gap-2">
                        {result.ok ? (
                          <CheckCircle2
                            size={13}
                            className="mt-0.5 shrink-0 text-[#b8ff4b]"
                          />
                        ) : (
                          <AlertCircle
                            size={13}
                            className="mt-0.5 shrink-0 text-[#ff8585]"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-semibold text-[#dce7e3]">
                            {result.filename ||
                              result.session?.sourceFilename ||
                              result.session?.label ||
                              `Session ${index + 1}`}
                          </p>
                          <p
                            className={`mt-1 break-words text-[9px] leading-4 ${result.ok ? "text-[#71807c]" : "text-[#ff9292]"}`}
                          >
                            {result.ok ? (
                              "Imported and queued for Telegram authorization validation."
                            ) : (
                              <>
                                <strong>
                                  {result.code || "SESSION_IMPORT_FAILED"}
                                </strong>
                                :{" "}
                                {result.error ||
                                  "The session could not be imported."}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={uploadSessions}
                disabled={!files.length || busy === "upload"}
                className={`${PRIMARY} w-full`}
              >
                {busy === "upload" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {busy === "upload"
                  ? "Encrypting and importing..."
                  : "Import and validate"}
              </button>
            </div>
          )}

          {addAccountMode === "login" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setAddAccountMode("choice")}
                className="inline-flex items-center gap-1.5 text-xs text-[#71807c] hover:text-white"
              >
                <ArrowLeft size={13} /> Choose another method
              </button>
              {flowWaiting ? (
                <div className="rounded-2xl border border-[#d8b7ff]/20 bg-[#d8b7ff]/[0.05] p-4">
                  <p className="text-sm font-semibold">
                    {flow.status === "awaiting_password"
                      ? "Two-step verification required"
                      : `Code sent to ${flow.phone}`}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#71807c]">
                    {flow.status === "awaiting_password"
                      ? "Enter the Telegram 2FA password. It is encrypted immediately and removed after this attempt."
                      : "Enter the confirmation code received from Telegram."}
                  </p>
                  <input
                    autoFocus
                    type={
                      flow.status === "awaiting_password" ? "password" : "text"
                    }
                    value={challenge}
                    onChange={(event) => setChallenge(event.target.value)}
                    placeholder={
                      flow.status === "awaiting_password"
                        ? "2FA password"
                        : "Confirmation code"
                    }
                    className={`${FIELD} mt-4`}
                  />
                  <button
                    type="button"
                    onClick={submitChallenge}
                    disabled={!challenge || busy === "challenge"}
                    className={`${PRIMARY} mt-3 w-full`}
                  >
                    {busy === "challenge" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ArrowRight size={14} />
                    )}{" "}
                    Continue
                  </button>
                </div>
              ) : (
                <form onSubmit={beginLogin} className="space-y-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                    Phone number
                    <input
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+15551234567"
                      className={`${FIELD} mt-2`}
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                    Account label
                    <input
                      required
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Sales account 1"
                      className={`${FIELD} mt-2`}
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
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
                      busy === "login" ||
                      !!(
                        flow &&
                        ![
                          "completed",
                          "failed",
                          "expired",
                          "cancelled",
                        ].includes(flow.status)
                      )
                    }
                    className={`${PRIMARY} w-full`}
                  >
                    {busy === "login" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}{" "}
                    Send Telegram code
                  </button>
                </form>
              )}
              {flow &&
                !flowWaiting &&
                !["completed", "failed", "expired", "cancelled"].includes(
                  flow.status,
                ) && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#65e6ff]/15 bg-[#65e6ff]/[0.04] p-3 text-xs text-[#8eb3ad]">
                    <Loader2 size={14} className="animate-spin" /> Telegram
                    worker is processing this login...
                  </div>
                )}
              {flow?.errorMessage && (
                <div className="flex gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-3 text-xs text-[#ff9b9b]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span><strong>{flow.errorCode || "TELEGRAM_LOGIN_FAILED"}</strong>: {flow.errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {detailSession && (
        <Modal
          title={accountName(detailSession)}
          description={
            detailSession.username
              ? `@${detailSession.username}`
              : detailSession.phone || detailSession.label
          }
          onClose={() => setDetailSession(null)}
          wide
        >
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-white/[0.07] bg-[#071111] p-5 text-center">
              <span className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#13201e] text-3xl font-semibold text-[#b8ff4b]">
                {detailSession.avatarUrl ? (
                  <img
                    src={detailSession.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  accountName(detailSession).slice(0, 1).toUpperCase()
                )}
              </span>
              <p className="mt-4 text-lg font-semibold">
                {accountName(detailSession)}
              </p>
              <p className="mt-1 text-xs text-[#71807c]">
                {detailSession.profileBio || "No Telegram bio"}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <StatusPill
                  status={
                    detailSession.status === "error"
                      ? "error"
                      : detailSession.isLoggedIn
                        ? detailSession.status
                        : "offline"
                  }
                />
                <StatusPill status={detailSession.spamStatus} />
              </div>
              <div className="mt-4 flex justify-center gap-2">
                {detailSession.isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#f4ca64]/25 bg-[#f4ca64]/10 px-2 py-1 text-[9px] font-bold text-[#f4ca64]">
                    <Star size={10} fill="currentColor" /> Telegram Premium
                  </span>
                )}
                {detailSession.isVerified && (
                  <span className="rounded-full bg-[#65e6ff]/10 px-2 py-1 text-[9px] text-[#65e6ff]">
                    Verified
                  </span>
                )}
                {detailSession.isRestricted && (
                  <span className="rounded-full bg-[#ff7474]/10 px-2 py-1 text-[9px] text-[#ff8585]">
                    Restricted
                  </span>
                )}
              </div>
            </aside>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Telegram ID", detailSession.telegramUserId || "Not synced"],
                  ["Phone", detailSession.phone || "Hidden"],
                  ["Session format", detailSession.sessionFormat],
                  ["Messages sent", formatNumber(detailSession.messagesSent)],
                  ["Replies", formatNumber(detailSession.repliesReceived)],
                  [
                    "Risk score",
                    `${Math.round(detailSession.riskScore)} / 100`,
                  ],
                ].map(([name, value]) => (
                  <div
                    key={name}
                    className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
                      {name}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#dce7e3]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#65e6ff]">
                  Anti-detect identity
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {detailSession.deviceIdentity &&
                  Object.entries(detailSession.deviceIdentity).length ? (
                    Object.entries(detailSession.deviceIdentity).map(
                      ([name, value]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 text-xs"
                        >
                          <span className="text-[#60706b]">
                            {name.replaceAll("_", " ")}
                          </span>
                          <span className="truncate text-right text-[#b8c5c1]">
                            {String(value)}
                          </span>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-xs text-[#60706b]">
                      No device identity saved.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#d8b7ff]">
                    Connection
                  </p>
                  <p className="mt-3 text-xs text-[#aebbb6]">
                    Proxy:{" "}
                    {detailSession.proxyEnabled
                      ? detailSession.proxyLabel || "Enabled"
                      : "Disabled"}
                  </p>
                  <p className="mt-2 text-xs text-[#71807c]">
                    Anti-detect:{" "}
                    {detailSession.antiDetectEnabled ? "Enabled" : "Disabled"}
                  </p>
                  <p className="mt-2 text-xs text-[#71807c]">
                    Last active: {relativeTime(detailSession.lastActiveAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#f4ca64]">
                    Safety
                  </p>
                  <p className="mt-3 text-xs text-[#aebbb6]">
                    {detailSession.massDmEligible
                      ? "Mass messaging ready"
                      : detailSession.eligibilityReason ||
                        "Safety review needed"}
                  </p>
                  <p className="mt-2 text-xs text-[#71807c]">
                    SpamBot checked: {relativeTime(detailSession.spamCheckedAt)}
                  </p>
                  <p className="mt-2 text-xs text-[#71807c]">
                    Warmup day {detailSession.warmupDay}, mode{" "}
                    {detailSession.warmupMode}
                  </p>
                </div>
              </div>
              {detailSession.lastErrorMessage && (
                <div className="rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-3 text-xs text-[#ff9b9b]">
                  {detailSession.lastErrorCode || "SESSION_ERROR"}:{" "}
                  {detailSession.lastErrorMessage}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openTelegramClient(detailSession)}
                  disabled={
                    !detailSession.isLoggedIn ||
                    detailSession.status !== "active"
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-4 py-2.5 text-xs font-bold text-[#07100d] disabled:opacity-35"
                >
                  <ExternalLink size={13} /> Open Telegram client
                </button>
                <a
                  href={`/api/validator/telegram/sessions/${detailSession.id}/download`}
                  className={SECONDARY}
                >
                  <Download size={13} /> Download decrypted
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void runSessionAction(
                      detailSession,
                      detailSession.isLoggedIn ? "logout" : "login",
                    )
                  }
                  className={SECONDARY}
                >
                  {detailSession.isLoggedIn ? (
                    <LogOut size={13} />
                  ) : (
                    <LogIn size={13} />
                  )}
                  {detailSession.isLoggedIn ? "Log out" : "Log back in"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runSessionAction(detailSession, "profile_sync")
                  }
                  disabled={!detailSession.isLoggedIn}
                  className={SECONDARY}
                >
                  <RefreshCw size={13} /> Sync profile
                </button>
                <SignalSelect
                  value={detailSession.warmupMode}
                  onChange={(value) => void setWarmupMode(detailSession, value)}
                  disabled={busy === `settings:${detailSession.id}`}
                  placeholder="Warmup policy"
                  searchable={false}
                  className="min-w-44 text-xs"
                  accent="#65e6ff"
                  options={[
                    { value: "safe", label: "Safe warmup" },
                    { value: "standard", label: "Standard warmup" },
                    { value: "off", label: "Warmup off" },
                  ]}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {organizeStep === "ask" && (
        <Modal
          title="Organize imported accounts?"
          description={`${organizeSessionIds.length} account${organizeSessionIds.length === 1 ? " was" : "s were"} imported successfully.`}
          onClose={() => {
            setOrganizeStep(null);
            setOrganizeSessionIds([]);
          }}
        >
          <p className="text-sm leading-6 text-[#81908c]">
            Place these accounts into a named Session List so they can be found
            and selected together later.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOrganizeStep(null);
                setOrganizeSessionIds([]);
              }}
              className={`${SECONDARY} flex-1`}
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => setOrganizeStep("name")}
              className={`${PRIMARY} flex-[2]`}
            >
              <Layers3 size={14} /> Create Session List
            </button>
          </div>
        </Modal>
      )}

      {organizeStep === "name" && (
        <Modal
          title="Name this Session List"
          description="The imported accounts will remain available individually."
          onClose={() => {
            setOrganizeStep(null);
            setOrganizeSessionIds([]);
            setFleetName("");
          }}
        >
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
            List name
            <input
              autoFocus
              value={fleetName}
              onChange={(event) => setFleetName(event.target.value)}
              maxLength={120}
              placeholder="e.g. July sales accounts"
              className={`${FIELD} mt-2`}
            />
          </label>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setOrganizeStep("ask")}
              className={`${SECONDARY} flex-1`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={organizeUploadedSessions}
              disabled={!fleetName.trim() || busy === "organize"}
              className={`${PRIMARY} flex-[2]`}
            >
              {busy === "organize" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}{" "}
              Save list
            </button>
          </div>
        </Modal>
      )}

      {bulkDeleteOpen && (
        <ConfirmModal
          title={`Delete ${selectedSessionIds.length} selected accounts?`}
          description="Their encrypted session data and Session List memberships will be permanently removed. Existing reports retain deleted-session markers."
          confirmLabel="Delete selected accounts"
          busy={busy === "bulk:delete"}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={async () => {
            await runBulkAction("delete");
            setBulkDeleteOpen(false);
          }}
        />
      )}
      {historyDeleteOpen && (
        <Modal
          title="Delete Telegram chat history"
          description="Run the same fast, durable Hydrogram job for the selected accounts, or switch to one or more Session Lists."
          onClose={() => setHistoryDeleteOpen(false)}
          wide
        >
          <TelegramHistoryView
            compact
            initialSessionIds={selectedSessionIds}
            notify={notify}
            onStarted={() => setSelectedSessionIds([])}
          />
        </Modal>
      )}
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
                <SignalSelect
                  value={mode}
                  onChange={setMode}
                  placeholder="Delivery contract"
                  searchable={false}
                  className="mt-2"
                  accent="#d8b7ff"
                  options={[
                    {
                      value: "balanced",
                      label: "Balanced rotation",
                      description: "Distribute recipients across the fleet",
                    },
                    {
                      value: "parallel",
                      label: "Parallel shared queue",
                      description: "Accounts work from one shared queue",
                    },
                    {
                      value: "split",
                      label: "Parallel split quota",
                      description: "Reserve a quota for each account",
                    },
                    {
                      value: "failover",
                      label: "Sequential failover",
                      description: "Continue with the next account on failure",
                    },
                    ...(workflow === "schedules"
                      ? [
                          {
                            value: "fanout",
                            label: "Every account fan-out",
                            description:
                              "Every account sends to each user · 50 max",
                          },
                        ]
                      : []),
                  ]}
                />
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
                <CardPicker
                  value={sourceListId}
                  onChange={setSourceListId}
                  placeholder="Manual targets only"
                  className="mt-2"
                  accent="#d8b7ff"
                  options={[
                    {
                      id: "",
                      label: "Manual targets only",
                      description: "Use the entries typed below",
                    },
                    ...lists
                      .filter((list) => ["users", "merged"].includes(list.type))
                      .map((list) => ({
                        id: list.id,
                        label: list.name,
                        description: `${list.type} contact list`,
                        count: list.itemsCount,
                      })),
                  ]}
                />
              </label>
            )}
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">
                Formatting
              </span>
              <SignalSelect
                value={parseMode}
                onChange={setParseMode}
                placeholder="Message formatting"
                searchable={false}
                className="mt-2"
                accent="#d8b7ff"
                options={[
                  { value: "text", label: "Plain text" },
                  { value: "markdown", label: "Markdown" },
                  { value: "html", label: "HTML" },
                ]}
              />
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
                  <CardPicker
                    value=""
                    onChange={(id) => {
                      const fleet = fleets.find((item) => item.id === id);
                      if (fleet)
                        setSelectedSessions(
                          fleet.members
                            .map((member) => member.sessionId)
                            .filter((sessionId) =>
                              sessions.some(
                                (session) =>
                                  session.id === sessionId &&
                                  session.massDmEligible,
                              ),
                            ),
                        );
                    }}
                    placeholder="Apply named fleet"
                    className="min-w-[210px]"
                    accent="#d8b7ff"
                    options={fleets.map((fleet) => ({
                      id: fleet.id,
                      label: fleet.name,
                      description: fleet.members
                        .slice(0, 3)
                        .map((member) => member.session.label)
                        .join(", "),
                      count: fleet.members.length,
                    }))}
                  />
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
                <SignalSelect
                  value={pacingMode}
                  onChange={setPacingMode}
                  placeholder="Pacing mode"
                  searchable={false}
                  className="mt-2 normal-case tracking-normal"
                  accent="#d8b7ff"
                  options={[
                    {
                      value: "auto",
                      label: "Automatic safety bands",
                      description: "Signal Desk controls bursts and cooldowns",
                    },
                    {
                      value: "manual",
                      label: "Manual burst plan",
                      description: "Use the delay and burst values below",
                    },
                  ]}
                />
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
              <CardPicker
                value={testSessionId}
                onChange={setTestSessionId}
                placeholder="Choose one eligible account"
                className="mt-2"
                accent="#65e6ff"
                options={sessions
                  .filter((session) => session.massDmEligible)
                  .map((session) => ({
                    id: session.id,
                    label: session.label,
                    description: session.username
                      ? `@${session.username}`
                      : session.phone || "Eligible session",
                  }))}
              />
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

function AiChatterView({
  notify,
}: {
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  return <AiChatterCampaignsView notify={notify} />;
}

export function LegacyAiChatterView({
  notify,
}: {
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [data, setData] = useState<LegacyAiChatterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [provider, setProvider] = useState<"capitalbot" | "cupidbot">(
    "capitalbot",
  );
  const [secret, setSecret] = useState("");
  const [modelId, setModelId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [responseLanguage, setResponseLanguage] =
    useState<CapitalBotResponseLanguage>("English");
  const [showPolicy, setShowPolicy] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<{
    sessionId: string;
    peerId: string;
  } | null>(null);
  const [detail, setDetail] = useState<AiConversationDetail | null>(null);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const result = await api<LegacyAiChatterData>(
        "/api/validator/ai-chatter",
      );
      setData(result);
      setProvider(result.setting.config.provider);
      setResponseLanguage(result.setting.config.capitalbot.language);
      const capital = result.providers.find(
        (item) => item.provider === "capitalbot",
      );
      if (capital) {
        setModelId(capital.modelId ? String(capital.modelId) : "");
        setPresetId(capital.presetId ? String(capital.presetId) : "");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => notify(error.message, "error"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.setting.enabled) return;
    const timer = window.setInterval(
      () => void load(true).catch(() => undefined),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [data?.setting.enabled]);

  async function updateGlobal(
    patch: Record<string, string | number | boolean>,
    message: string,
  ) {
    setBusy("global");
    try {
      await api("/api/validator/ai-chatter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load(true);
      notify(message, "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "AI settings failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveProvider(event: React.FormEvent) {
    event.preventDefault();
    if (data?.setting.enabled) {
      notify("Turn off AI Chatter before changing provider settings.", "error");
      return;
    }
    setBusy("provider");
    try {
      await api("/api/validator/ai-chatter/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          secret,
          ...(provider === "capitalbot" && modelId
            ? { modelId: Number(modelId) }
            : {}),
          ...(provider === "capitalbot" && presetId
            ? { presetId: Number(presetId) }
            : {}),
        }),
      });
      setSecret("");
      await load(true);
      notify(
        `${provider === "capitalbot" ? "CapitalBot" : "CupidBot"} credential validated and encrypted.`,
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Provider validation failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveModelPreset() {
    if (!modelId || !presetId) return;
    if (data?.setting.enabled) {
      notify(
        "Turn off AI Chatter before changing the model or preset.",
        "error",
      );
      return;
    }
    setBusy("catalog");
    try {
      await api("/api/validator/ai-chatter/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "capitalbot",
          modelId: Number(modelId),
          presetId: Number(presetId),
        }),
      });
      await load(true);
      notify("CapitalBot model and preset updated.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Update failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function setSessionEnabled(sessionId: string, enabled: boolean) {
    setBusy(`session:${sessionId}`);
    try {
      await api(`/api/validator/ai-chatter/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, catchup: true }),
      });
      await load(true);
      notify(
        enabled
          ? "AI listener is starting; pending DMs will be checked once."
          : "AI listener is stopping for this session.",
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Session update failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function openConversation(sessionId: string, peerId: string) {
    setSelectedConversation({ sessionId, peerId });
    setDetail(null);
    try {
      setDetail(
        await api<AiConversationDetail>(
          `/api/validator/ai-chatter/conversations/${sessionId}/${peerId}`,
        ),
      );
    } catch (error) {
      setSelectedConversation(null);
      notify(
        error instanceof Error ? error.message : "Conversation load failed",
        "error",
      );
    }
  }

  async function setConversationEnabled(enabled: boolean) {
    if (!selectedConversation) return;
    setBusy("conversation");
    try {
      await api(
        `/api/validator/ai-chatter/conversations/${selectedConversation.sessionId}/${selectedConversation.peerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      await openConversation(
        selectedConversation.sessionId,
        selectedConversation.peerId,
      );
      notify(
        enabled ? "AI resumed for this chat." : "AI paused for this chat.",
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Chat update failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function clearMemory() {
    if (!selectedConversation) return;
    setBusy("memory");
    try {
      await api(
        `/api/validator/ai-chatter/conversations/${selectedConversation.sessionId}/${selectedConversation.peerId}`,
        { method: "DELETE" },
      );
      setSelectedConversation(null);
      setDetail(null);
      await load(true);
      notify("Conversation memory cleared.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Memory clear failed",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  if (loading || !data)
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#b8ff4b]" />
      </div>
    );

  const activeProvider = data.providers.find(
    (item) => item.provider === data.setting.config.provider,
  );
  const capital = data.providers.find((item) => item.provider === "capitalbot");
  const models = capital?.catalog?.models || [];
  const presets = capital?.catalog?.presets || [];
  const enabledSessions = data.sessions.filter(
    (session) => session.aiSetting?.enabled,
  ).length;
  const queueDepth =
    (data.overview.queueBreakdown.pending || 0) +
    (data.overview.queueBreakdown.processing || 0);

  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[28px] border border-[#b8ff4b]/20 bg-[radial-gradient(circle_at_top_right,rgba(184,255,75,.11),transparent_38%),#0b1717] p-5 sm:p-7">
        <div className="grid items-end gap-6 xl:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]">
              <span className="h-px w-8 bg-current" /> AI operations
              <button
                onClick={() => setShowPolicy(true)}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-[#60706b] transition hover:border-white/20 hover:text-white xl:ml-3"
                title="Response language settings"
              >
                <Settings size={12} />
              </button>
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Conversations that run themselves.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#81908c]">
              Personal DMs only. Signal Desk listens in real time, keeps memory
              isolated by Telegram account and peer, delays replies naturally,
              and records every provider outcome and Telegram send.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full border border-[#65e6ff]/20 bg-[#65e6ff]/[0.06] px-3 py-1.5 text-[#a8f1ff]">
                {data.setting.config.provider === "capitalbot"
                  ? "CapitalBot"
                  : "CupidBot"}{" "}
                active provider
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[#82908b]">
                {enabledSessions} of {data.sessions.length} sessions enabled
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[#82908b]">
                {queueDepth} jobs in flight
              </span>
            </div>
          </div>
          <div className="min-w-[250px] rounded-2xl border border-white/[0.08] bg-[#071111]/90 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#60706b]">
                  Account kill switch
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${data.setting.enabled ? "text-[#b8ff4b]" : "text-[#8b9994]"}`}
                >
                  {data.setting.enabled
                    ? "AI Chatter is live"
                    : "AI Chatter is off"}
                </p>
              </div>
              <button
                onClick={() =>
                  void updateGlobal(
                    { enabled: !data.setting.enabled },
                    data.setting.enabled
                      ? "AI Chatter stopped account-wide."
                      : "AI Chatter enabled account-wide.",
                  )
                }
                disabled={
                  busy === "global" ||
                  (!activeProvider?.isValid && !data.setting.enabled)
                }
                className={`relative h-7 w-12 rounded-full transition ${data.setting.enabled ? "bg-[#b8ff4b]" : "bg-white/10"}`}
                title={
                  !activeProvider?.isValid
                    ? "Validate the selected provider first"
                    : undefined
                }
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-[#07100d] transition ${data.setting.enabled ? "left-6" : "left-1"}`}
                />
              </button>
            </div>
            {!activeProvider?.isValid && (
              <p className="mt-3 text-[10px] leading-4 text-[#f4ca64]">
                Validate the selected provider before turning AI on.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          label="Conversations"
          value={data.overview.conversations}
          icon={MessageCircleMore}
          sub="Isolated memory rows"
        />
        <StatsCard
          label="Replies sent"
          value={data.overview.sent}
          icon={Send}
          sub={`${data.overview.completed} provider outcomes`}
        />
        <StatsCard
          label="Send success"
          value={`${data.overview.successRate}%`}
          icon={ShieldCheck}
          sub={`${data.overview.failed} failed attempts`}
        />
        <StatsCard
          label="Queue depth"
          value={queueDepth}
          icon={Activity}
          sub={`${data.overview.queueBreakdown.processing || 0} processing`}
        />
        <StatsCard
          label="Live listeners"
          value={
            data.sessions.filter(
              (session) => session.aiSetting?.runtimeStatus === "listening",
            ).length
          }
          icon={Radar}
          sub={`${enabledSessions} configured`}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className={`${PANEL} rounded-[24px] p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#65e6ff]">
                Provider vault
              </p>
              <h3 className="mt-1 text-lg font-semibold">API access</h3>
              <p className="mt-1 text-[10px] leading-4 text-[#60706b]">
                Keys are validated server-side and encrypted with AES-GCM.
              </p>
            </div>
            <KeyRound size={18} className="text-[#65e6ff]" />
          </div>
          {data.setting.enabled && (
            <p className="mt-4 rounded-xl border border-[#f4ca64]/20 bg-[#f4ca64]/[0.06] px-3 py-2 text-[10px] leading-4 text-[#f4ca64]">
              Turn off AI Chatter to change the provider, API key, model, or
              preset.
            </p>
          )}
          <label className="mt-4 block text-[9px] font-bold uppercase tracking-wider text-[#65736f]">
            Active provider
            <SignalSelect
              value={data.setting.config.provider}
              onChange={(value) => {
                const nextProvider = value as "capitalbot" | "cupidbot";
                setProvider(nextProvider);
                void updateGlobal(
                  { provider: nextProvider },
                  "Active AI provider updated.",
                );
              }}
              disabled={data.setting.enabled || busy === "global"}
              placeholder="Active provider"
              searchable={false}
              className="mt-2 normal-case tracking-normal"
              accent="#65e6ff"
              options={[
                { value: "capitalbot", label: "CapitalBot" },
                { value: "cupidbot", label: "CupidBot" },
              ]}
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["capitalbot", "cupidbot"] as const).map((item) => {
              const saved = data.providers.find(
                (value) => value.provider === item,
              );
              return (
                <button
                  key={item}
                  onClick={() => setProvider(item)}
                  disabled={data.setting.enabled}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${provider === item ? "border-[#65e6ff]/30 bg-[#65e6ff]/[0.06]" : "border-white/[0.07] bg-[#071111]"}`}
                >
                  <p className="text-xs font-semibold">
                    {item === "capitalbot" ? "CapitalBot" : "CupidBot"}
                  </p>
                  <p
                    className={`mt-1 text-[9px] ${saved?.isValid ? "text-[#b8ff4b]" : "text-[#60706b]"}`}
                  >
                    {saved?.isValid ? "Validated" : "Not configured"}
                  </p>
                </button>
              );
            })}
          </div>
          <form onSubmit={saveProvider} className="mt-4 space-y-3">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-[#65736f]">
              {provider === "capitalbot" ? "License key" : "Access token"}
              <input
                type="password"
                required
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                disabled={data.setting.enabled}
                placeholder="Encrypted after validation"
                className={`${FIELD} mt-2 font-mono`}
              />
            </label>
            <button
              disabled={
                data.setting.enabled || busy === "provider" || !secret.trim()
              }
              className={`${PRIMARY} w-full`}
            >
              {busy === "provider" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Validate and save
            </button>
          </form>
          {capital?.isValid && (
            <div className="mt-4 border-t border-white/[0.07] pt-4">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">
                CapitalBot routing
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SignalSelect
                  value={modelId}
                  onChange={setModelId}
                  disabled={data.setting.enabled}
                  placeholder="Model"
                  accent="#65e6ff"
                  options={
                    models.length
                      ? models.map((model) => {
                          const id = String(model.modelId || model.id || "");
                          return {
                            value: id,
                            label: String(
                              model.name || model.modelName || `Model ${id}`,
                            ),
                          };
                        })
                      : [{ value: modelId, label: `Model ${modelId || 43}` }]
                  }
                />
                <SignalSelect
                  value={presetId}
                  onChange={setPresetId}
                  disabled={data.setting.enabled}
                  placeholder="Preset"
                  accent="#65e6ff"
                  options={
                    presets.length
                      ? presets.map((preset) => {
                          const id = String(preset.id || preset.presetId || "");
                          return {
                            value: id,
                            label: String(
                              preset.name ||
                                preset.presetName ||
                                `Preset ${id}`,
                            ),
                          };
                        })
                      : [{ value: presetId, label: `Preset ${presetId || 88}` }]
                  }
                />
              </div>
              <button
                onClick={saveModelPreset}
                disabled={
                  data.setting.enabled ||
                  busy === "catalog" ||
                  !modelId ||
                  !presetId
                }
                className={`${SECONDARY} mt-2 w-full`}
              >
                Save model and preset
              </button>
            </div>
          )}
        </section>
      </div>

      <section className={`${PANEL} mt-5 overflow-hidden rounded-[24px]`}>
        <div className="flex flex-col gap-2 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Telegram AI listeners</h3>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Session toggles inherit the account policy. Runtime heartbeat
              confirms the listener is actually connected.
            </p>
          </div>
          <button onClick={() => void load(true)} className={SECONDARY}>
            <RefreshCw size={13} /> Refresh health
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {data.sessions.map((session) => {
            const enabled = session.aiSetting?.enabled || false;
            const available =
              session.status === "active" &&
              session.isLoggedIn &&
              session.spamStatus !== "frozen";
            const runtime = session.aiSetting?.runtimeStatus || "stopped";
            return (
              <article
                key={session.id}
                className={`rounded-2xl border p-4 ${enabled ? "border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.035]" : "border-white/[0.07] bg-[#071111]"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${runtime === "listening" ? "animate-pulse bg-[#b8ff4b] shadow-[0_0_10px_#b8ff4b]" : runtime === "error" ? "bg-[#ff7474]" : "bg-[#53615d]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {session.label}
                    </p>
                    <p className="mt-1 truncate text-[9px] text-[#60706b]">
                      {session.username
                        ? `@${session.username}`
                        : session.phone || "No username"}{" "}
                      · {session.spamStatus} · risk{" "}
                      {Math.round(session.riskScore)}
                    </p>
                  </div>
                  <button
                    disabled={!available || busy === `session:${session.id}`}
                    onClick={() => void setSessionEnabled(session.id, !enabled)}
                    className={`relative h-6 w-10 shrink-0 rounded-full transition ${enabled ? "bg-[#b8ff4b]" : "bg-white/10"}`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-[#07100d] transition ${enabled ? "left-5" : "left-1"}`}
                    />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[9px]">
                  <span
                    className={`uppercase tracking-wider ${runtime === "listening" ? "text-[#b8ff4b]" : runtime === "error" ? "text-[#ff8585]" : "text-[#60706b]"}`}
                  >
                    {runtime}
                  </span>
                  <span className="text-[#53615d]">
                    Heartbeat {relativeTime(session.aiSetting?.lastHeartbeatAt)}
                  </span>
                </div>
                {session.aiSetting?.lastError && (
                  <p
                    className="mt-2 truncate text-[9px] text-[#ff8585]"
                    title={session.aiSetting.lastError}
                  >
                    {session.aiSetting.lastError}
                  </p>
                )}
                {!available && (
                  <p className="mt-2 text-[9px] text-[#f4ca64]">
                    Requires an active, non-frozen session.
                  </p>
                )}
              </article>
            );
          })}
          {!data.sessions.length && (
            <p className="p-8 text-center text-xs text-[#60706b] md:col-span-2 xl:col-span-3">
              Add a Telegram session before enabling AI Chatter.
            </p>
          )}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className={`${PANEL} overflow-hidden rounded-[24px]`}>
          <div className="border-b border-white/[0.07] p-5">
            <h3 className="font-semibold">Conversations</h3>
            <p className="mt-1 text-[10px] text-[#60706b]">
              Open a peer to inspect the exact memory and provider/send ledger.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#60706b]">
                  <th className="px-4 py-3">Recipient</th>
                  <th>Session</th>
                  <th>Messages</th>
                  <th>State</th>
                  <th>Last activity</th>
                  <th className="px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.conversations.map((conversation) => (
                  <tr key={conversation.id} className="text-xs">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {conversation.recipientName ||
                          `Peer ${conversation.peerId}`}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-[#60706b]">
                        {conversation.recipientUsername
                          ? `@${conversation.recipientUsername}`
                          : conversation.peerId}
                      </p>
                    </td>
                    <td className="text-[#81908c]">
                      {conversation.session.label}
                    </td>
                    <td className="font-mono text-[#81908c]">
                      {conversation.messageCount}
                    </td>
                    <td>
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] ${conversation.conversationState === "active" ? "border-[#b8ff4b]/20 text-[#b8ff4b]" : "border-[#f4ca64]/20 text-[#f4ca64]"}`}
                      >
                        {conversation.conversationState}
                      </span>
                    </td>
                    <td className="text-[#81908c]">
                      {relativeTime(conversation.updatedAt)}
                    </td>
                    <td className="px-4">
                      <button
                        onClick={() =>
                          void openConversation(
                            conversation.sessionId,
                            conversation.peerId,
                          )
                        }
                        className={SECONDARY}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.conversations.length && (
            <p className="p-12 text-center text-xs text-[#60706b]">
              No AI conversations yet. Incoming personal DMs appear here after
              an enabled listener receives them.
            </p>
          )}
        </section>
        <aside className={`${PANEL} rounded-[24px] p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Queue ledger</h3>
              <p className="mt-1 text-[9px] text-[#60706b]">
                Most recent 20 jobs
              </p>
            </div>
            <Activity size={16} className="text-[#65e6ff]" />
          </div>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {data.recentJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => void openConversation(job.sessionId, job.peerId)}
                className="w-full rounded-xl border border-white/[0.06] bg-[#071111] p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${job.status === "sent" ? "bg-[#b8ff4b]" : job.status === "pending" || job.status === "processing" ? "animate-pulse bg-[#65e6ff]" : job.status === "failed" ? "bg-[#ff7474]" : "bg-[#f4ca64]"}`}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {job.status}
                  </span>
                  <span className="ml-auto text-[8px] text-[#53615d]">
                    {relativeTime(job.createdAt)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[9px] text-[#71807c]">
                  Peer {job.peerId} · attempt {job.attempts}
                  {job.isFollowUp ? " · follow-up" : ""}
                </p>
                {job.errorMessage && (
                  <p
                    className="mt-1 truncate text-[9px] text-[#ff8585]"
                    title={job.errorMessage}
                  >
                    {job.errorCode}: {job.errorMessage}
                  </p>
                )}
              </button>
            ))}
            {!data.recentJobs.length && (
              <p className="p-8 text-center text-[10px] text-[#60706b]">
                Queue is empty.
              </p>
            )}
          </div>
        </aside>
      </div>

      {selectedConversation && (
        <Modal
          title={
            detail
              ? detail.conversation.recipient?.name ||
                `Peer ${detail.conversation.peerId}`
              : "Loading conversation"
          }
          description={
            detail
              ? `${detail.conversation.session.label} · isolated Telegram memory and audit trail`
              : undefined
          }
          onClose={() => {
            setSelectedConversation(null);
            setDetail(null);
          }}
          wide
        >
          {!detail ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 size={23} className="animate-spin text-[#b8ff4b]" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      void setConversationEnabled(
                        detail.conversation.setting?.enabled === false,
                      )
                    }
                    disabled={busy === "conversation"}
                    className={SECONDARY}
                  >
                    {detail.conversation.setting?.enabled === false ? (
                      <>
                        <Check size={13} /> Resume AI
                      </>
                    ) : (
                      <>
                        <CircleStop size={13} /> Pause this chat
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => void clearMemory()}
                    disabled={busy === "memory"}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] px-3 py-2.5 text-xs text-[#ff9b9b]"
                  >
                    <Trash2 size={13} /> Clear memory
                  </button>
                  <span className="ml-auto text-[9px] uppercase tracking-wider text-[#60706b]">
                    {detail.conversation.messages.length} memory messages
                  </span>
                </div>
                <div className="mt-4 max-h-[62vh] space-y-3 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                  {detail.conversation.messages.map((message, index) => (
                    <div
                      key={`${message.id}-${index}`}
                      className={`flex ${message.isIncoming ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${message.isIncoming ? "rounded-bl-sm border border-white/[0.08] bg-[#0b1717]" : "rounded-br-sm bg-[#b8ff4b] text-[#07100d]"}`}
                      >
                        <p className="whitespace-pre-wrap text-xs leading-5">
                          {message.msg}
                        </p>
                        <p
                          className={`mt-1 text-[8px] ${message.isIncoming ? "text-[#53615d]" : "text-[#42521d]"}`}
                        >
                          {new Date(message.timestamp).toLocaleString()} · TG{" "}
                          {message.telegramMessageId || "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <aside className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#65e6ff]">
                  Provider and send log
                </p>
                <div className="mt-3 max-h-[66vh] space-y-2 overflow-y-auto">
                  {[...detail.logs].reverse().map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${log.status === "sent" ? "bg-[#b8ff4b]" : log.status === "failed" ? "bg-[#ff7474]" : "bg-[#f4ca64]"}`}
                        />
                        <span className="text-[9px] font-bold uppercase tracking-wider">
                          {log.status}
                        </span>
                        <span className="ml-auto text-[8px] text-[#53615d]">
                          {relativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-[9px] text-[#71807c]">
                        {log.provider}
                        {log.isFollowUp ? " · follow-up" : ""}
                        {log.category ? ` · ${log.category}` : ""}
                      </p>
                      {log.incomingText && (
                        <p className="mt-2 rounded-lg border border-white/[0.05] p-2 text-[10px] leading-4 text-[#9ba9a4]">
                          In: {log.incomingText}
                        </p>
                      )}
                      {log.responseText && (
                        <p className="mt-2 rounded-lg bg-[#b8ff4b]/[0.06] p-2 text-[10px] leading-4 text-[#dfffaa]">
                          Out: {log.responseText}
                        </p>
                      )}
                      {log.errorMessage && (
                        <p className="mt-2 text-[9px] leading-4 text-[#ff8585]">
                          {log.errorCode}: {log.errorMessage}
                        </p>
                      )}
                    </div>
                  ))}
                  {!detail.logs.length && (
                    <p className="p-8 text-center text-[10px] text-[#60706b]">
                      No provider attempts yet.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </Modal>
      )}
      {showPolicy && (
        <Modal
          title="Response language"
          description="Choose the fixed language CapitalBot uses for every reply"
          onClose={() => setShowPolicy(false)}
        >
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#65736f]">
            CapitalBot language
            <SignalSelect
              value={responseLanguage}
              onChange={(value) =>
                setResponseLanguage(value as CapitalBotResponseLanguage)
              }
              placeholder="Response language"
              className="mt-2 normal-case tracking-normal"
              accent="#65e6ff"
              options={CAPITALBOT_RESPONSE_LANGUAGES.map((language) => ({
                value: language,
                label: language,
              }))}
            />
          </label>
          <p className="mt-3 text-[10px] leading-4 text-[#60706b]">
            Automatic language detection is disabled. CapitalBot will reply in
            the selected language even when the user writes in another language.
          </p>
          {data.setting.config.provider === "cupidbot" && (
            <p className="mt-3 rounded-xl border border-white/[0.07] bg-[#071111] px-3 py-2 text-[10px] leading-4 text-[#81908c]">
              This setting applies when CapitalBot is active. CupidBot remains
              fixed to English.
            </p>
          )}
          <button
            onClick={() =>
              void updateGlobal(
                { responseLanguage },
                "CapitalBot response language saved.",
              )
            }
            disabled={busy === "global"}
            className={`${PRIMARY} mt-5 w-full`}
          >
            <Save size={14} /> Save language
          </button>
        </Modal>
      )}
    </div>
  );
}

type DateRangePreset = "24h" | "3d" | "7d" | "30d" | "all" | "custom";

export function ReportsView({
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
  const [datePreset, setDatePreset] = useState<DateRangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function dateParams(preset: DateRangePreset): string {
    if (preset === "all") return "";
    const now = new Date();
    let from: Date;
    switch (preset) {
      case "24h":
        from = new Date(now.getTime() - 86400000);
        break;
      case "3d":
        from = new Date(now.getTime() - 3 * 86400000);
        break;
      case "7d":
        from = new Date(now.getTime() - 7 * 86400000);
        break;
      case "30d":
        from = new Date(now.getTime() - 30 * 86400000);
        break;
      case "custom":
        return `from=${encodeURIComponent(customFrom || now.toISOString())}&to=${encodeURIComponent(customTo || now.toISOString())}`;
      default:
        return "";
    }
    return `from=${from.toISOString()}&to=${now.toISOString()}`;
  }

  async function loadCampaigns() {
    const params = dateParams(datePreset);
    const data = await api<{ campaigns: TelegramCampaign[] }>(
      `/api/validator/telegram/campaigns?limit=100${params ? `&${params}` : ""}`,
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
        <div className="flex items-center gap-2">
          {detail && (
            <a
              href={`/api/validator/telegram/campaigns/${detail.campaign.id}/export`}
              className={PRIMARY}
            >
              <Download size={14} />
              Export CSV
            </a>
          )}
          <a
            href={`/api/validator/reports/export?${dateParams(datePreset)}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <Download size={14} />
            Export all ({campaigns.length})
          </a>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["24h", "3d", "7d", "30d", "all"] as DateRangePreset[]).map(
          (preset) => (
            <button
              key={preset}
              onClick={() => {
                setDatePreset(preset);
                loadCampaigns();
              }}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${datePreset === preset ? "border-[#f4ca64]/40 bg-[#f4ca64]/[0.08] text-[#f4ca64]" : "border-white/[0.07] text-[#71807c] hover:border-white/20"}`}
            >
              {preset === "24h"
                ? "24 hours"
                : preset === "3d"
                  ? "3 days"
                  : preset === "7d"
                    ? "7 days"
                    : preset === "30d"
                      ? "30 days"
                      : "All time"}
            </button>
          ),
        )}
        <button
          onClick={() => setDatePreset("custom")}
          className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${datePreset === "custom" ? "border-[#f4ca64]/40 bg-[#f4ca64]/[0.08] text-[#f4ca64]" : "border-white/[0.07] text-[#71807c] hover:border-white/20"}`}
        >
          Custom
        </button>
        {datePreset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5 text-[10px] text-white"
            />
            <span className="text-[10px] text-[#60706b]">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5 text-[10px] text-white"
            />
            <button
              onClick={() => loadCampaigns()}
              className="rounded-lg bg-[#f4ca64] px-2.5 py-1.5 text-[10px] font-semibold text-[#07100d]"
            >
              Apply
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-[300px_1fr]">
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
  jobs,
  activeJob,
  validatorAccess,
  refresh,
  notify,
  onStartValidation,
  onInspectValidation,
}: {
  lists: ContactList[];
  jobs: Job[];
  activeJob: Job | null;
  validatorAccess: boolean;
  refresh: () => Promise<ContactList[]>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  onStartValidation: (list: ContactList) => void;
  onInspectValidation: (job: Job) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [detail, setDetail] = useState<ContactList | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [deleteList, setDeleteList] = useState<ContactList | null>(null);
  const [sessionLists, setSessionLists] = useState<TelegramSessionList[]>([]);
  const [sessionListsLoading, setSessionListsLoading] = useState(true);
  const [sessionListDetail, setSessionListDetail] =
    useState<TelegramSessionList | null>(null);
  const [deleteSessionList, setDeleteSessionList] =
    useState<TelegramSessionList | null>(null);
  const filtered = lists.filter(
    (list) =>
      !deletingIds.includes(list.id) &&
      `${list.name} ${list.type} ${list.source}`
        .toLowerCase()
        .includes(deferredSearch.toLowerCase()),
  );
  const currentActiveJob =
    (activeJob && ACTIVE.has(activeJob.status) ? activeJob : null) ||
    jobs.find((job) => ACTIVE.has(job.status)) ||
    null;
  const validationJobFor = (list: ContactList) =>
    (currentActiveJob?.sourceListId === list.id ? currentActiveJob : null) ||
    jobs.find((job) => job.sourceListId === list.id);
  const canValidate = (list: ContactList) =>
    validatorAccess && list.type !== "profile";
  const otherValidationActive = !!currentActiveJob;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api<{ lists: TelegramSessionList[] }>(
        "/api/validator/telegram/session-lists",
      )
        .then((data) => setSessionLists(data.lists || []))
        .catch((error) =>
          notify(
            error instanceof Error
              ? error.message
              : "Unable to load Session Lists",
            "error",
          ),
        )
        .finally(() => setSessionListsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setDeleteList(null);
    setMenu(null);
    setSelected((current) => current.filter((id) => id !== list.id));
    setDeletingIds((current) => [...new Set([...current, list.id])]);
    try {
      await api(`/api/validator/lists/${list.id}`, { method: "DELETE" });
      void refresh().catch(() => undefined);
      notify(`Deleted ${list.name}.`, "success");
    } catch (error) {
      setDeletingIds((current) => current.filter((id) => id !== list.id));
      notify(error instanceof Error ? error.message : "Delete failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function performRemoveSessionList(list: TelegramSessionList) {
    setBusy(list.id + "delete");
    try {
      await api(`/api/validator/telegram/session-lists/${list.id}`, {
        method: "DELETE",
      });
      setSessionLists((current) =>
        current.filter((item) => item.id !== list.id),
      );
      setDeleteSessionList(null);
      setSessionListDetail((current) =>
        current?.id === list.id ? null : current,
      );
      notify(`Deleted Session List ${list.name}.`, "success");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to delete Session List",
        "error",
      );
    } finally {
      setBusy(null);
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
            Import, inspect, validate, normalize, merge, and export source and
            result lists from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.length === 1 &&
            (() => {
              const list = lists.find((item) => item.id === selected[0]);
              const job = list ? validationJobFor(list) : undefined;
              if (!list || !canValidate(list)) return null;
              if (job && ACTIVE.has(job.status))
                return (
                  <button
                    type="button"
                    onClick={() => onInspectValidation(job)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#f4ca64]/25 bg-[#f4ca64]/[0.07] px-3.5 py-2.5 text-sm font-semibold text-[#f4ca64]"
                  >
                    <Loader2 size={14} className="animate-spin" /> Running
                    validation {job.progressPct}% · Inspect
                  </button>
                );
              return (
                <button
                  type="button"
                  onClick={() => onStartValidation(list)}
                  disabled={otherValidationActive}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#b8ff4b]/25 bg-[#b8ff4b]/[0.07] px-3.5 py-2.5 text-sm font-semibold text-[#c9f99c] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Radar size={14} />{" "}
                  {job ? "Validate again" : "Start validation"}
                </button>
              );
            })()}
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
      <section className={`${PANEL} mt-6 rounded-[24px] p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d8b7ff]/10 text-[#d8b7ff]">
                <Smartphone size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Session Lists</h3>
                <p className="mt-0.5 text-[10px] text-[#60706b]">
                  Organized Telegram accounts from session imports.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#60706b]">
            {formatNumber(sessionLists.length)} lists ·{" "}
            {formatNumber(
              sessionLists.reduce((sum, list) => sum + list.members.length, 0),
            )}{" "}
            memberships
          </p>
        </div>
        {sessionListsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[#d8b7ff]" />
          </div>
        ) : sessionLists.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sessionLists.map((list) => {
              const active = list.members.filter(
                (member) =>
                  member.session.isLoggedIn &&
                  member.session.status === "active",
              ).length;
              return (
                <article
                  key={list.id}
                  className="group rounded-2xl border border-white/[0.07] bg-[#071111] p-4 transition hover:border-[#d8b7ff]/25"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d8b7ff]/10 text-[#d8b7ff]">
                      <Layers3 size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#e6efec]">
                        {list.name}
                      </p>
                      <p className="mt-1 text-[10px] text-[#60706b]">
                        {list.members.length} account
                        {list.members.length === 1 ? "" : "s"} ·{" "}
                        <span className={active ? "text-[#b8ff4b]" : ""}>
                          {active} active
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteSessionList(list)}
                      title="Delete Session List"
                      className="rounded-lg p-2 text-[#60706b] opacity-100 transition hover:bg-[#ff7474]/10 hover:text-[#ff8585] md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {list.description && (
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#71807c]">
                      {list.description}
                    </p>
                  )}
                  <div className="mt-4 flex min-h-9 items-center">
                    {list.members.slice(0, 5).map((member, index) => (
                      <span
                        key={member.sessionId}
                        title={member.session.label}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#071111] bg-[#13201e] text-[10px] font-semibold ${member.session.isLoggedIn ? "text-[#b8ff4b]" : "text-[#71807c]"} ${index ? "-ml-2" : ""}`}
                      >
                        {member.session.label.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                    {list.members.length > 5 && (
                      <span className="-ml-2 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-[#071111] bg-[#172321] px-1.5 text-[9px] text-[#81908c]">
                        +{list.members.length - 5}
                      </span>
                    )}
                    {!list.members.length && (
                      <span className="text-[10px] text-[#53615d]">
                        No accounts in this list
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="text-[9px] text-[#53615d]">
                      Updated {relativeTime(list.updatedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSessionListDetail(list)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#d8b7ff] hover:text-white"
                    >
                      View accounts <ArrowRight size={11} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-[#071111]/60 py-9 text-center">
            <Layers3 size={22} className="mx-auto text-[#40504b]" />
            <p className="mt-3 text-xs text-[#71807c]">No Session Lists yet.</p>
            <p className="mt-1 text-[10px] text-[#53615d]">
              Import Telegram sessions from Accounts and organize them after
              upload.
            </p>
          </div>
        )}
      </section>

      <div className={`${PANEL} mt-5 overflow-visible rounded-[24px]`}>
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
          <table className="w-full min-w-[940px] text-left">
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
                <th className="px-3 py-3">Validation</th>
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
                  <td className="px-3 py-3.5">
                    {(() => {
                      const job = validationJobFor(list);
                      if (!canValidate(list))
                        return (
                          <span className="text-[10px] text-[#53615d]">
                            Not available
                          </span>
                        );
                      if (job)
                        return (
                          <div className="min-w-[160px] rounded-xl border border-white/[0.07] bg-[#071111] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onInspectValidation(job)}
                              className="block w-full text-left"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${ACTIVE.has(job.status) ? "animate-pulse bg-[#f4ca64]" : job.status === "completed" ? "bg-[#b8ff4b]" : job.status === "failed" ? "bg-[#ff7474]" : "bg-[#71807c]"}`}
                                />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-[#aebbb6]">
                                  {ACTIVE.has(job.status)
                                    ? "Running validation"
                                    : job.status.replaceAll("_", " ")}
                                </span>
                              </span>
                              <span className="mt-1 block text-[9px] text-[#60706b]">
                                {job.progressPct}% ·{" "}
                                {formatNumber(job.validCount)} valid ·{" "}
                                <span className="text-[#b8ff4b]">Inspect</span>
                              </span>
                            </button>
                            {!ACTIVE.has(job.status) && (
                              <button
                                type="button"
                                onClick={() => onStartValidation(list)}
                                disabled={otherValidationActive}
                                className="mt-2 border-t border-white/[0.06] pt-2 text-[9px] font-semibold text-[#c9f99c] disabled:opacity-35"
                              >
                                Validate again
                              </button>
                            )}
                          </div>
                        );
                      return (
                        <button
                          type="button"
                          onClick={() => onStartValidation(list)}
                          disabled={otherValidationActive}
                          title={
                            otherValidationActive
                              ? "Inspect or finish the active validation first"
                              : undefined
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.045] px-3 py-2 text-[10px] font-semibold text-[#c9f99c] transition hover:bg-[#b8ff4b]/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Radar size={12} /> Start validating
                        </button>
                      );
                    })()}
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
                        {canValidate(list) && (
                          <button
                            onClick={() => {
                              setMenu(null);
                              const job = validationJobFor(list);
                              if (job && ACTIVE.has(job.status))
                                onInspectValidation(job);
                              else onStartValidation(list);
                            }}
                            disabled={
                              otherValidationActive &&
                              !ACTIVE.has(validationJobFor(list)?.status || "")
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#c9f99c] hover:bg-[#b8ff4b]/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <Radar size={13} />
                            {ACTIVE.has(validationJobFor(list)?.status || "")
                              ? "Inspect live validation"
                              : "Start validation"}
                          </button>
                        )}
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {list.name}
                    </span>
                    <span className="mt-1 block text-[10px] text-[#60706b]">
                      {formatNumber(list.itemsCount)} rows · {list.type} ·{" "}
                      {relativeTime(list.updatedAt)}
                    </span>
                    {(() => {
                      const job = validationJobFor(list);
                      if (!job) return null;
                      return (
                        <span
                          className={`mt-1 block text-[9px] ${ACTIVE.has(job.status) ? "text-[#f4ca64]" : "text-[#8b9994]"}`}
                        >
                          {ACTIVE.has(job.status)
                            ? "Running validation"
                            : `Validation ${job.status}`}{" "}
                          · {job.progressPct}% · tap Inspect
                        </span>
                      );
                    })()}
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
                  {canValidate(list) && (
                    <button
                      onClick={() => {
                        const job = validationJobFor(list);
                        if (job && ACTIVE.has(job.status))
                          onInspectValidation(job);
                        else onStartValidation(list);
                      }}
                      disabled={
                        otherValidationActive &&
                        !ACTIVE.has(validationJobFor(list)?.status || "")
                      }
                      className={`${SECONDARY} text-[#c9f99c] disabled:opacity-35`}
                    >
                      <Radar size={13} />
                      {ACTIVE.has(validationJobFor(list)?.status || "")
                        ? "Live run"
                        : "Validate"}
                    </button>
                  )}
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
          validationJob={validationJobFor(detail)}
          canValidate={canValidate(detail)}
          validationBlocked={
            otherValidationActive &&
            !ACTIVE.has(validationJobFor(detail)?.status || "")
          }
          onValidate={() => {
            setDetail(null);
            onStartValidation(detail);
          }}
          onInspectValidation={(job) => {
            setDetail(null);
            onInspectValidation(job);
          }}
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
      {sessionListDetail && (
        <Modal
          title={sessionListDetail.name}
          description={`${sessionListDetail.members.length} organized Telegram account${sessionListDetail.members.length === 1 ? "" : "s"}`}
          onClose={() => setSessionListDetail(null)}
        >
          {sessionListDetail.description && (
            <p className="mb-4 rounded-xl border border-white/[0.07] bg-[#071111] p-3 text-xs leading-5 text-[#81908c]">
              {sessionListDetail.description}
            </p>
          )}
          <div className="space-y-2">
            {sessionListDetail.members.map((member) => (
              <div
                key={member.sessionId}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#13201e] text-sm font-semibold ${member.session.isLoggedIn ? "text-[#b8ff4b]" : "text-[#71807c]"}`}
                >
                  {member.session.label.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.session.label}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#60706b]">
                    {member.session.username
                      ? `@${member.session.username}`
                      : member.session.phone || "Telegram account"}
                  </p>
                </div>
                <StatusPill
                  status={
                    member.session.isLoggedIn
                      ? member.session.status
                      : "offline"
                  }
                />
              </div>
            ))}
            {!sessionListDetail.members.length && (
              <p className="py-8 text-center text-xs text-[#60706b]">
                This Session List is empty.
              </p>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setSessionListDetail(null)}
              className={`${SECONDARY} flex-1`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setDeleteSessionList(sessionListDetail)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#ff7474]/20 px-3 py-2 text-xs font-medium text-[#ff8585] hover:bg-[#ff7474]/10"
            >
              <Trash2 size={13} /> Delete list
            </button>
          </div>
        </Modal>
      )}
      {deleteSessionList && (
        <ConfirmModal
          title={`Delete Session List ${deleteSessionList.name}?`}
          description="The list and its memberships will be removed. The Telegram accounts themselves will remain in Accounts."
          confirmLabel="Delete Session List"
          busy={busy === deleteSessionList.id + "delete"}
          onClose={() => setDeleteSessionList(null)}
          onConfirm={() => performRemoveSessionList(deleteSessionList)}
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
  validationJob,
  canValidate,
  validationBlocked,
  onValidate,
  onInspectValidation,
}: {
  list: ContactList;
  onClose: () => void;
  refreshLists: () => Promise<ContactList[]>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  validationJob?: Job;
  canValidate: boolean;
  validationBlocked: boolean;
  onValidate: () => void;
  onInspectValidation: (job: Job) => void;
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
        {canValidate && (
          <section
            className={`rounded-2xl border p-4 ${validationJob && ACTIVE.has(validationJob.status) ? "border-[#f4ca64]/25 bg-[#f4ca64]/[0.055]" : "border-[#b8ff4b]/25 bg-[#b8ff4b]/[0.055]"}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${validationJob && ACTIVE.has(validationJob.status) ? "bg-[#f4ca64]/10 text-[#f4ca64]" : "bg-[#b8ff4b]/10 text-[#b8ff4b]"}`}
              >
                {validationJob && ACTIVE.has(validationJob.status) ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Radar size={18} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#edf6e9]">
                  {validationJob && ACTIVE.has(validationJob.status)
                    ? "Validation is running on this list"
                    : validationJob
                      ? "Run this list through validation again"
                      : "Validate this list"}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#71807c]">
                  {validationJob && ACTIVE.has(validationJob.status)
                    ? `${validationJob.progressPct}% complete · ${formatNumber(validationJob.validCount)} valid usernames confirmed so far.`
                    : "Check every usable public username and write confirmed results into a new clean list."}
                </p>
              </div>
              {validationJob && ACTIVE.has(validationJob.status) ? (
                <button
                  type="button"
                  onClick={() => onInspectValidation(validationJob)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f4ca64] px-4 text-xs font-bold text-[#141006]"
                >
                  <Eye size={14} /> Inspect live run
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onValidate}
                  disabled={validationBlocked}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 text-xs font-bold text-[#07100d] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Radar size={14} />{" "}
                  {validationJob ? "Validate again" : "Start validation"}
                </button>
              )}
            </div>
          </section>
        )}
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
          {canValidate &&
            (validationJob ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onInspectValidation(validationJob)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.045] px-3.5 py-2.5 text-xs font-semibold text-[#c9f99c]"
                >
                  {ACTIVE.has(validationJob.status) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Radar size={14} />
                  )}
                  {ACTIVE.has(validationJob.status)
                    ? `Running ${validationJob.progressPct}%`
                    : "Inspect validation"}
                </button>
                {!ACTIVE.has(validationJob.status) && (
                  <button
                    type="button"
                    onClick={onValidate}
                    disabled={validationBlocked}
                    className={`${SECONDARY} disabled:opacity-35`}
                  >
                    <RefreshCw size={13} /> Validate again
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onValidate}
                disabled={validationBlocked}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.045] px-3.5 py-2.5 text-xs font-semibold text-[#c9f99c] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Radar size={14} /> Start validating
              </button>
            ))}
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
