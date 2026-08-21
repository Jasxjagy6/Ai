"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  CircleStop,
  Loader2,
  MessageCircleMore,
  Plus,
  Radar,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  CAPITALBOT_RESPONSE_LANGUAGES,
  type CapitalBotResponseLanguage,
} from "@/lib/ai-chatter-languages";
import { SignalSelect } from "@/components/validator/signal-select";

type Tone = "success" | "error" | "info";
type Session = {
  id: string;
  label: string;
  phone: string | null;
  username: string | null;
  status: string;
  isLoggedIn: boolean;
  spamStatus: string;
  riskScore: number;
  assignedCampaign: { id: string; name: string } | null;
};
type Campaign = {
  id: string;
  name: string;
  provider: "capitalbot" | "cupidbot";
  modelId: number | null;
  presetId: number | null;
  config: {
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
  startedAt: string;
  endsAt: string | null;
  stoppedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  liveListeners: number;
  conversations: number;
  jobs: number;
  responseLogs: number;
  sessions: Array<{
    sessionId: string;
    runtimeStatus: string;
    lastHeartbeatAt: string | null;
    lastError: string | null;
    session: Session;
  }>;
};
type LandingData = {
  campaignLimit: number | null;
  activeCampaigns: number;
  campaigns: Campaign[];
  sessions: Session[];
  sessionLists: Array<{ id: string; name: string; sessionIds: string[] }>;
};
type Conversation = {
  id: string;
  sessionId: string;
  peerId: string;
  recipientName: string;
  recipientUsername: string;
  messageCount: number;
  conversationState: string;
  lastCategory: string | null;
  updatedAt: string;
  session: { label: string; username: string | null; phone: string | null };
};
type Job = {
  id: string;
  sessionId: string;
  peerId: string;
  status: string;
  attempts: number;
  isFollowUp: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};
type ResponseLog = {
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
};
type Detail = {
  campaign: Campaign;
  overview: {
    conversations: number;
    sent: number;
    failed: number;
    successRate: number;
    statusBreakdown: Record<string, number>;
    queueBreakdown: Record<string, number>;
  };
  conversations: Conversation[];
  recentJobs: Job[];
  responseLogs: ResponseLog[];
};
type ConversationDetail = {
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
    }>;
    setting: { enabled: boolean } | null;
    session: { label: string; username: string | null; phone: string | null };
  };
  logs: ResponseLog[];
};
type Catalog = {
  models?: Array<Record<string, string | number | boolean | null>>;
  presets?: Array<Record<string, string | number | boolean | null>>;
};
type Tab = "overview" | "accounts" | "conversations" | "jobs" | "logs";

const PANEL = "border border-white/[0.065] bg-[#111311]";
const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#071111] px-3.5 py-2.5 text-sm text-[#eef7ed] outline-none transition placeholder:text-[#61706d] focus:border-[#b8ff4b]/60 focus:ring-2 focus:ring-[#b8ff4b]/10 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d] transition hover:bg-[#ceff82] disabled:pointer-events-none disabled:opacity-40";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 text-sm font-medium text-[#b8c5c1] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40";
const ACTIVE = new Set(["starting", "running", "subscription_paused"]);

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  if (init?.method && init.method !== "GET") {
    window.dispatchEvent(new Event("signal-desk-account-changed"));
  }
  return body as T;
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString();
}

function statusTone(status: string) {
  if (status === "running" || status === "listening") return "border-[#b8ff4b]/25 bg-[#b8ff4b]/[0.07] text-[#b8ff4b]";
  if (status === "subscription_paused") return "border-[#f4ca64]/30 bg-[#f4ca64]/[0.08] text-[#f4ca64]";
  if (status === "starting" || status === "processing" || status === "pending") return "border-[#65e6ff]/25 bg-[#65e6ff]/[0.07] text-[#8feeff]";
  if (status === "error" || status === "failed" || status === "grace_expired") return "border-[#ff7474]/25 bg-[#ff7474]/[0.07] text-[#ff9292]";
  return "border-white/10 bg-white/[0.035] text-[#82908b]";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusTone(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function Overlay({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <section className={`max-h-[94vh] w-full overflow-y-auto rounded-[24px] border border-white/10 bg-[#0b1717] shadow-2xl ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/[0.07] bg-[#0b1717]/95 p-5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && <p className="mt-1 text-[10px] leading-4 text-[#71807c]">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 p-2 text-[#71807c] hover:text-white">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

export function AiChatterCampaignsView({
  notify,
}: {
  notify: (message: string, tone?: Tone) => void;
}) {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [conversationTarget, setConversationTarget] = useState<{ sessionId: string; peerId: string } | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const root = useRef<HTMLDivElement>(null);

  function scrollToTop() {
    root.current?.closest("main")?.scrollTo({ top: 0 });
  }

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const next = await request<LandingData>("/api/validator/ai-chatter");
      setData(next);
      if (selectedId && !next.campaigns.some((campaign) => campaign.id === selectedId)) {
        setSelectedId("");
        setDetail(null);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadDetail(id: string, quiet = false) {
    if (!quiet) setDetail(null);
    const next = await request<Detail>(`/api/validator/ai-chatter/campaigns/${id}`);
    setSelectedId(id);
    setDetail(next);
    if (!quiet) scrollToTop();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => notify(error.message, "error"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.campaigns.some((campaign) => ACTIVE.has(campaign.status)) && !selectedId) return;
    const timer = window.setInterval(() => {
      void load(true).catch(() => undefined);
      if (selectedId) void loadDetail(selectedId, true).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [data?.campaigns, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function campaignAction(action: "stop" | "restart" | "delete" | "reengage") {
    if (!selectedId || !detail) return;
    setBusy(action);
    try {
      if (action === "delete") {
        await request(`/api/validator/ai-chatter/campaigns/${selectedId}`, { method: "DELETE" });
        setSelectedId("");
        setDetail(null);
        notify("AI campaign deleted.", "success");
      } else {
        await request(`/api/validator/ai-chatter/campaigns/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "reengage"
              ? { action: "update", reengageEnabled: !detail.campaign.reengageEnabled }
              : { action },
          ),
        });
        await loadDetail(selectedId, true);
        notify(
          action === "stop"
            ? "Campaign stopped and session leases released."
            : action === "restart"
              ? "Campaign listeners are restarting."
              : "Re-engagement policy updated.",
          "success",
        );
      }
      await load(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Campaign action failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function openConversation(sessionId: string, peerId: string) {
    if (!selectedId) return;
    setConversationTarget({ sessionId, peerId });
    setConversation(null);
    try {
      setConversation(
        await request<ConversationDetail>(
          `/api/validator/ai-chatter/campaigns/${selectedId}/conversations/${sessionId}/${peerId}`,
        ),
      );
    } catch (error) {
      setConversationTarget(null);
      notify(error instanceof Error ? error.message : "Conversation load failed", "error");
    }
  }

  async function updateConversation(action: "toggle" | "clear") {
    if (!selectedId || !conversationTarget || !conversation) return;
    setBusy(`conversation:${action}`);
    const url = `/api/validator/ai-chatter/campaigns/${selectedId}/conversations/${conversationTarget.sessionId}/${conversationTarget.peerId}`;
    try {
      if (action === "clear") {
        await request(url, { method: "DELETE" });
        setConversationTarget(null);
        setConversation(null);
        await loadDetail(selectedId, true);
        notify("Conversation memory cleared.", "success");
      } else {
        await request(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: conversation.conversation.setting?.enabled === false }),
        });
        await openConversation(conversationTarget.sessionId, conversationTarget.peerId);
        notify("Conversation AI policy updated.", "success");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Conversation update failed", "error");
    } finally {
      setBusy("");
    }
  }

  if (loading || !data) {
    return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#b8ff4b]" /></div>;
  }

  const limitReached = data.campaignLimit !== null && data.activeCampaigns >= data.campaignLimit;

  if (selectedId) {
    return (
      <div ref={root} className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
        <button onClick={() => { setSelectedId(""); setDetail(null); scrollToTop(); }} className={SECONDARY}>
          <ArrowLeft size={14} /> Campaigns
        </button>
        {!detail ? (
          <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#b8ff4b]" /></div>
        ) : (
          <CampaignInspector
            detail={detail}
            tab={tab}
            setTab={setTab}
            busy={busy}
            onAction={campaignAction}
            onRefresh={() => void loadDetail(selectedId).catch((error) => notify(error.message, "error"))}
            onConversation={openConversation}
          />
        )}
        {conversationTarget && (
          <Overlay
            title={conversation?.conversation.recipient?.name || `Peer ${conversationTarget.peerId}`}
            description={conversation ? `${conversation.conversation.session.label} · campaign-isolated memory and provider ledger` : undefined}
            onClose={() => { setConversationTarget(null); setConversation(null); }}
            wide
          >
            {!conversation ? (
              <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-[#b8ff4b]" /></div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
                <section>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void updateConversation("toggle")} className={SECONDARY} disabled={busy.startsWith("conversation:")}>
                      {conversation.conversation.setting?.enabled === false ? <><Check size={13} /> Resume AI</> : <><CircleStop size={13} /> Pause chat</>}
                    </button>
                    <button onClick={() => void updateConversation("clear")} className="inline-flex items-center gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] px-3 py-2 text-xs text-[#ff9b9b]" disabled={busy.startsWith("conversation:")}>
                      <Trash2 size={13} /> Clear memory
                    </button>
                  </div>
                  <div className="mt-4 max-h-[62vh] space-y-3 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                    {conversation.conversation.messages.map((message, index) => (
                      <div key={`${message.id}-${index}`} className={`flex ${message.isIncoming ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${message.isIncoming ? "rounded-bl-sm border border-white/[0.08] bg-[#0b1717]" : "rounded-br-sm bg-[#b8ff4b] text-[#07100d]"}`}>
                          <p className="whitespace-pre-wrap text-xs leading-5">{message.msg}</p>
                          <p className={`mt-1 text-[8px] ${message.isIncoming ? "text-[#53615d]" : "text-[#42521d]"}`}>{new Date(message.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <aside>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#65e6ff]">Provider and send log</p>
                  <div className="mt-3 max-h-[66vh] space-y-2 overflow-y-auto">
                    {[...conversation.logs].reverse().map((log) => <LogCard key={log.id} log={log} />)}
                    {!conversation.logs.length && <Empty text="No provider attempts yet." />}
                  </div>
                </aside>
              </div>
            )}
          </Overlay>
        )}
      </div>
    );
  }

  return (
    <div ref={root} className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[28px] border border-[#b8ff4b]/20 bg-[radial-gradient(circle_at_top_right,rgba(184,255,75,.13),transparent_42%),#0b1717] p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]">AI campaign control</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Every fleet gets its own mind.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#81908c]">
              Isolated provider keys, memory, listeners, queues, and audit trails. Run multiple AI campaigns without crossing credentials or conversations.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} disabled={limitReached || data.campaignLimit === 0} className={`${PRIMARY} min-w-48`}>
            <Plus size={15} /> Create campaign
          </button>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active campaigns" value={`${data.activeCampaigns} / ${data.campaignLimit ?? "∞"}`} icon={Radar} />
        <Metric label="Replies sent" value={data.campaigns.reduce((sum, campaign) => sum + campaign.messagesSent, 0).toLocaleString()} icon={Send} />
        <Metric label="Incoming stored" value={data.campaigns.reduce((sum, campaign) => sum + campaign.messagesReceived, 0).toLocaleString()} icon={Activity} />
        <Metric label="Conversation memory" value={data.campaigns.reduce((sum, campaign) => sum + campaign.conversations, 0).toLocaleString()} icon={MessageCircleMore} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">AI campaigns</h3>
          <p className="mt-1 text-[10px] text-[#60706b]">Open a campaign to inspect its accounts, memory, jobs, responses, and errors.</p>
        </div>
        <button onClick={() => void load()} className={SECONDARY}><RefreshCw size={13} /> Refresh</button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.campaigns.map((campaign) => (
          <button
            key={campaign.id}
            onClick={() => void loadDetail(campaign.id).catch((error) => notify(error.message, "error"))}
            className="group rounded-[22px] border border-white/[0.08] bg-[#0b1717] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#65e6ff]/[0.08] text-[#65e6ff]"><Radar size={17} /></span>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold">{campaign.name}</h4>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-[#60706b]">{campaign.provider} · {campaign.durationMode.replaceAll("_", " ")}</p>
              </div>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/[0.06] py-4">
              <CardStat label="Accounts" value={`${campaign.liveListeners}/${campaign.sessionCount}`} />
              <CardStat label="Chats" value={campaign.conversations} />
              <CardStat label="Sent" value={campaign.messagesSent} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-[9px] text-[#60706b]">
              <span>{campaign.messagesReceived.toLocaleString()} incoming</span>
              <span>·</span>
              <span>{campaign.jobs.toLocaleString()} jobs</span>
              <span className="ml-auto">Updated {relativeTime(campaign.updatedAt || campaign.createdAt)}</span>
            </div>
            {campaign.lastError && <p className="mt-3 truncate text-[9px] text-[#ff8585]" title={campaign.lastError}>{campaign.lastError}</p>}
          </button>
        ))}
      </div>
      {!data.campaigns.length && (
        <section className={`${PANEL} mt-5 rounded-[24px] p-12 text-center`}>
          <Radar size={25} className="mx-auto text-[#65e6ff]" />
          <h3 className="mt-4 font-semibold">No AI campaigns yet</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#60706b]">Create a campaign, validate its private provider key, and assign one or more Telegram sessions.</p>
        </section>
      )}
      {data.campaignLimit === 0 && <p className="mt-4 text-center text-xs text-[#f4ca64]">Your current plan does not include AI campaigns.</p>}
      {limitReached && data.campaignLimit !== 0 && <p className="mt-4 text-center text-xs text-[#f4ca64]">Stop an active campaign before creating another, or increase the plan limit.</p>}

      {createOpen && (
        <CreateCampaign
          data={data}
          onClose={() => setCreateOpen(false)}
          notify={notify}
          onCreated={async (campaign) => {
            setCreateOpen(false);
            await load(true);
            await loadDetail(campaign.id);
          }}
        />
      )}
    </div>
  );
}

function CreateCampaign({
  data,
  onClose,
  onCreated,
  notify,
}: {
  data: LandingData;
  onClose: () => void;
  onCreated: (campaign: Campaign) => Promise<void>;
  notify: (message: string, tone?: Tone) => void;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"capitalbot" | "cupidbot">("capitalbot");
  const [secret, setSecret] = useState("");
  const [durationMode, setDurationMode] = useState<"day" | "week" | "until_stopped">("week");
  const [language, setLanguage] = useState<CapitalBotResponseLanguage>("English");
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [modelId, setModelId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [validated, setValidated] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [replyDelayMs, setReplyDelayMs] = useState(3000);
  const [replyDelayJitterMs, setReplyDelayJitterMs] = useState(2000);
  const [memoryMessageLimit, setMemoryMessageLimit] = useState(100);
  const [reengageEnabled, setReengageEnabled] = useState(true);
  const [busy, setBusy] = useState("");

  const available = data.sessions.filter(
    (session) => !session.assignedCampaign && session.status === "active" && session.isLoggedIn && session.spamStatus !== "frozen",
  );
  const models = catalog?.models || [];
  const presets = catalog?.presets || [];

  function resetCredential(nextProvider: "capitalbot" | "cupidbot") {
    setProvider(nextProvider);
    setSecret("");
    setCatalog(null);
    setModelId("");
    setPresetId("");
    setValidated(false);
  }

  async function validateCredential() {
    setBusy("validate");
    try {
      const result = await request<{ valid: true; catalog: Catalog | null }>("/api/validator/ai-chatter/validate-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, secret }),
      });
      setCatalog(result.catalog);
      const firstModel = result.catalog?.models?.[0];
      const firstPreset = result.catalog?.presets?.[0];
      setModelId(String(firstModel?.modelId || firstModel?.id || ""));
      setPresetId(String(firstPreset?.id || firstPreset?.presetId || ""));
      setValidated(true);
      notify("Provider credential validated. It will be encrypted with this campaign.", "success");
    } catch (error) {
      setValidated(false);
      notify(error instanceof Error ? error.message : "Provider validation failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function create() {
    setBusy("create");
    try {
      const result = await request<{ campaign: Campaign }>("/api/validator/ai-chatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider,
          secret,
          durationMode,
          responseLanguage: language,
          sessionIds: selected,
          modelId: modelId ? Number(modelId) : null,
          presetId: presetId ? Number(presetId) : null,
          replyDelayMs,
          replyDelayJitterMs,
          memoryMessageLimit,
          reengageEnabled,
        }),
      });
      notify("AI campaign created. Its Telegram listeners are starting.", "success");
      await onCreated(result.campaign);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Campaign creation failed", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <Overlay title="Create AI campaign" description="One encrypted provider key, isolated memory, and an exclusive Telegram session fleet" onClose={onClose} wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-4">
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Campaign name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekend conversion desk" className={`${FIELD} mt-2`} /></label>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Provider</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["capitalbot", "cupidbot"] as const).map((item) => (
                <button key={item} onClick={() => resetCredential(item)} className={`rounded-xl border p-3 text-left ${provider === item ? "border-[#65e6ff]/35 bg-[#65e6ff]/[0.07]" : "border-white/[0.08] bg-[#071111]"}`}>
                  <p className="text-xs font-semibold">{item === "capitalbot" ? "CapitalBot" : "CupidBot"}</p>
                  <p className="mt-1 text-[9px] text-[#60706b]">Campaign-private credential</p>
                </button>
              ))}
            </div>
          </div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#65736f]">{provider === "capitalbot" ? "License key" : "Access token"}<div className="mt-2 flex gap-2"><input type="password" value={secret} onChange={(event) => { setSecret(event.target.value); setValidated(false); }} className={`${FIELD} font-mono`} placeholder="Encrypted after campaign creation" /><button onClick={() => void validateCredential()} disabled={busy === "validate" || secret.trim().length < 8} className={SECONDARY}>{busy === "validate" ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}{validated ? "Validated" : "Validate"}</button></div></label>
          {provider === "capitalbot" && validated && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Model<SignalSelect value={modelId} onChange={setModelId} placeholder="Choose model" className="mt-2 normal-case tracking-normal" accent="#65e6ff" options={models.map((model) => { const id = String(model.modelId || model.id || ""); return { value: id, label: String(model.name || model.modelName || `Model ${id}`) }; })} /></label>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Preset<SignalSelect value={presetId} onChange={setPresetId} placeholder="Choose preset" className="mt-2 normal-case tracking-normal" accent="#65e6ff" options={presets.map((preset) => { const id = String(preset.id || preset.presetId || ""); return { value: id, label: String(preset.name || preset.presetName || `Preset ${id}`) }; })} /></label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Duration<SignalSelect value={durationMode} onChange={(value) => setDurationMode(value as typeof durationMode)} placeholder="Campaign duration" searchable={false} className="mt-2 normal-case tracking-normal" accent="#65e6ff" options={[{ value: "day", label: "1 day" }, { value: "week", label: "1 week" }, { value: "until_stopped", label: "Until stopped" }]} /></label>
            <label className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">Response language<SignalSelect value={language} onChange={(value) => setLanguage(value as CapitalBotResponseLanguage)} placeholder="Response language" className="mt-2 normal-case tracking-normal" accent="#65e6ff" options={CAPITALBOT_RESPONSE_LANGUAGES.map((item) => ({ value: item, label: item }))} /></label>
          </div>
          <button onClick={() => setAdvanced(!advanced)} className="text-[10px] text-[#65e6ff]">{advanced ? "Hide" : "Show"} reply and memory policy</button>
          {advanced && (
            <div className="grid gap-3 rounded-2xl border border-white/[0.07] bg-[#071111] p-3 sm:grid-cols-3">
              <NumberField label="Delay ms" value={replyDelayMs} set={setReplyDelayMs} />
              <NumberField label="Jitter ms" value={replyDelayJitterMs} set={setReplyDelayJitterMs} />
              <NumberField label="Memory messages" value={memoryMessageLimit} set={setMemoryMessageLimit} />
              <label className="flex items-center gap-2 text-[10px] text-[#81908c] sm:col-span-3"><input type="checkbox" checked={reengageEnabled} onChange={(event) => setReengageEnabled(event.target.checked)} /> Enable up to three natural re-engagement attempts</label>
            </div>
          )}
        </section>
        <section>
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-wider text-[#65e6ff]">Exclusive session fleet</p><p className="mt-1 text-[10px] text-[#60706b]">{selected.length} selected · assigned sessions are unavailable</p></div>
            <SignalSelect
              value=""
              onChange={(value) => {
                const list = data.sessionLists.find((item) => item.id === value);
                if (list) setSelected((current) => [...new Set([...current, ...list.sessionIds.filter((id) => available.some((session) => session.id === id))])]);
              }}
              placeholder="Add from session list"
              className="max-w-52 normal-case tracking-normal"
              accent="#65e6ff"
              options={data.sessionLists.map((list) => ({ value: list.id, label: list.name, description: `${list.sessionIds.length} accounts` }))}
            />
          </div>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#071111] p-3">
            {data.sessions.map((session) => {
              const usable = available.some((item) => item.id === session.id);
              const checked = selected.includes(session.id);
              return (
                <label key={session.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? "border-[#b8ff4b]/25 bg-[#b8ff4b]/[0.05]" : "border-white/[0.06]"} ${usable ? "cursor-pointer" : "opacity-55"}`}>
                  <input type="checkbox" checked={checked} disabled={!usable} onChange={(event) => setSelected((current) => event.target.checked ? [...current, session.id] : current.filter((id) => id !== session.id))} />
                  <span className={`h-2 w-2 rounded-full ${session.status === "active" && session.isLoggedIn ? "bg-[#b8ff4b]" : "bg-[#ff7474]"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{session.label}</p><p className="mt-1 truncate text-[9px] text-[#60706b]">{session.username ? `@${session.username}` : session.phone || "No username"} · {session.spamStatus} · risk {Math.round(session.riskScore)}</p></div>
                  {session.assignedCampaign && <span className="max-w-28 truncate text-[8px] text-[#f4ca64]" title={session.assignedCampaign.name}>{session.assignedCampaign.name}</span>}
                </label>
              );
            })}
            {!data.sessions.length && <Empty text="Add Telegram sessions before creating a campaign." />}
          </div>
        </section>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
        <button onClick={onClose} className={SECONDARY}>Cancel</button>
        <button onClick={() => void create()} disabled={busy === "create" || !name.trim() || !validated || !selected.length} className={PRIMARY}>{busy === "create" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create and start campaign</button>
      </div>
    </Overlay>
  );
}

function CampaignInspector({
  detail,
  tab,
  setTab,
  busy,
  onAction,
  onRefresh,
  onConversation,
}: {
  detail: Detail;
  tab: Tab;
  setTab: (tab: Tab) => void;
  busy: string;
  onAction: (action: "stop" | "restart" | "delete" | "reengage") => Promise<void>;
  onRefresh: () => void;
  onConversation: (sessionId: string, peerId: string) => Promise<void>;
}) {
  const { campaign, overview } = detail;
  const queueDepth = (overview.queueBreakdown.pending || 0) + (overview.queueBreakdown.processing || 0);
  const active = ACTIVE.has(campaign.status);
  return (
    <>
      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#65e6ff]/20 bg-[radial-gradient(circle_at_top_right,rgba(101,230,255,.12),transparent_40%),#0b1717] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={campaign.status} /><span className="text-[9px] uppercase tracking-wider text-[#60706b]">{campaign.provider} · {campaign.durationMode.replaceAll("_", " ")}</span></div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{campaign.name}</h2>
            <p className="mt-2 text-xs text-[#71807c]">Started {new Date(campaign.startedAt).toLocaleString()}{campaign.endsAt ? ` · Ends ${new Date(campaign.endsAt).toLocaleString()}` : " · Runs until manually stopped"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onRefresh} className={SECONDARY}><RefreshCw size={13} /> Refresh</button>
            <button onClick={() => void onAction("reengage")} disabled={!!busy} className={SECONDARY}>{campaign.reengageEnabled ? "Re-engagement on" : "Re-engagement off"}</button>
            {active ? <button onClick={() => void onAction("stop")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-[#f4ca64]/25 bg-[#f4ca64]/[0.06] px-3.5 py-2.5 text-sm text-[#f4ca64]"><CircleStop size={14} /> Stop</button> : <button onClick={() => void onAction("restart")} disabled={!!busy} className={PRIMARY}><Radar size={14} /> Restart</button>}
            {!active && <button onClick={() => void onAction("delete")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] px-3.5 py-2.5 text-sm text-[#ff9b9b]"><Trash2 size={14} /> Delete</button>}
          </div>
        </div>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Assigned accounts" value={`${campaign.liveListeners} / ${campaign.sessionCount}`} icon={Users} />
        <Metric label="Conversations" value={overview.conversations.toLocaleString()} icon={MessageCircleMore} />
        <Metric label="Replies sent" value={overview.sent.toLocaleString()} icon={Send} />
        <Metric label="Success rate" value={`${overview.successRate}%`} icon={ShieldCheck} />
        <Metric label="Queue depth" value={queueDepth.toLocaleString()} icon={Activity} />
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-white/[0.08] pb-3">
        {(["overview", "accounts", "conversations", "jobs", "logs"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs capitalize ${tab === item ? "bg-[#b8ff4b] font-bold text-[#07100d]" : "border border-white/[0.08] text-[#81908c]"}`}>{item}</button>)}
      </div>
      <section className={`${PANEL} mt-4 overflow-hidden rounded-[24px]`}>
        {tab === "overview" && (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div><h3 className="font-semibold">Campaign policy</h3><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><Info label="Provider" value={campaign.provider} /><Info label="Language" value={campaign.provider === "capitalbot" ? campaign.config.capitalbot.language : "English"} /><Info label="Model / preset" value={campaign.provider === "capitalbot" ? `${campaign.modelId || "-"} / ${campaign.presetId || "-"}` : "Provider managed"} /><Info label="Memory limit" value={`${campaign.config.memoryMessageLimit} messages`} /><Info label="Reply delay" value={`${campaign.config.replyDelayMs} ms`} /><Info label="Delay jitter" value={`${campaign.config.replyDelayJitterMs} ms`} /></dl></div>
            <div><h3 className="font-semibold">Runtime totals</h3><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><Info label="Incoming stored" value={campaign.messagesReceived.toLocaleString()} /><Info label="Replies sent" value={campaign.messagesSent.toLocaleString()} /><Info label="Failed jobs" value={campaign.failedCount.toLocaleString()} /><Info label="Provider logs" value={campaign.responseLogs.toLocaleString()} /></dl>{campaign.lastError && <p className="mt-4 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-3 text-[10px] leading-4 text-[#ff9292]">{campaign.lastError}</p>}</div>
          </div>
        )}
        {tab === "accounts" && (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{campaign.sessions.map((membership) => <article key={membership.sessionId} className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4"><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${membership.runtimeStatus === "listening" ? "animate-pulse bg-[#b8ff4b]" : membership.runtimeStatus === "error" ? "bg-[#ff7474]" : "bg-[#65e6ff]"}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{membership.session.label}</p><p className="mt-1 truncate text-[9px] text-[#60706b]">{membership.session.username ? `@${membership.session.username}` : membership.session.phone || "No username"}</p></div><StatusBadge status={membership.runtimeStatus} /></div><p className="mt-3 text-[9px] text-[#53615d]">Heartbeat {relativeTime(membership.lastHeartbeatAt)}</p>{membership.lastError && <p className="mt-2 text-[9px] leading-4 text-[#ff8585]">{membership.lastError}</p>}</article>)}</div>
        )}
        {tab === "conversations" && <ConversationTable conversations={detail.conversations} open={onConversation} />}
        {tab === "jobs" && <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">{detail.recentJobs.map((job) => <button key={job.id} onClick={() => void onConversation(job.sessionId, job.peerId)} className="rounded-xl border border-white/[0.06] bg-[#071111] p-3 text-left"><div className="flex items-center gap-2"><StatusBadge status={job.status} /><span className="ml-auto text-[8px] text-[#53615d]">{relativeTime(job.createdAt)}</span></div><p className="mt-2 font-mono text-[9px] text-[#71807c]">Peer {job.peerId} · attempt {job.attempts}{job.isFollowUp ? " · follow-up" : ""}</p>{job.errorMessage && <p className="mt-2 text-[9px] text-[#ff8585]">{job.errorCode}: {job.errorMessage}</p>}</button>)}{!detail.recentJobs.length && <Empty text="The campaign queue is empty." />}</div>}
        {tab === "logs" && <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">{detail.responseLogs.map((log) => <button key={log.id} onClick={() => void onConversation(log.sessionId, log.peerId)} className="text-left"><LogCard log={log} /></button>)}{!detail.responseLogs.length && <Empty text="No provider or Telegram response logs yet." />}</div>}
      </section>
    </>
  );
}

function ConversationTable({ conversations, open }: { conversations: Conversation[]; open: (sessionId: string, peerId: string) => Promise<void> }) {
  return <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#60706b]"><th className="px-4 py-3">Recipient</th><th>Account</th><th>Messages</th><th>State</th><th>Updated</th><th className="px-4">Action</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{conversations.map((item) => <tr key={item.id} className="text-xs"><td className="px-4 py-3"><p className="font-medium">{item.recipientName || `Peer ${item.peerId}`}</p><p className="mt-1 font-mono text-[9px] text-[#60706b]">{item.recipientUsername ? `@${item.recipientUsername}` : item.peerId}</p></td><td className="text-[#81908c]">{item.session.label}</td><td className="font-mono text-[#81908c]">{item.messageCount}</td><td><StatusBadge status={item.conversationState} /></td><td className="text-[#71807c]">{relativeTime(item.updatedAt)}</td><td className="px-4"><button onClick={() => void open(item.sessionId, item.peerId)} className={SECONDARY}>Inspect</button></td></tr>)}</tbody></table></div>{!conversations.length && <Empty text="No campaign conversations yet. Incoming personal DMs appear here." />}</>;
}

function LogCard({ log }: { log: ResponseLog }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"><div className="flex items-center gap-2"><StatusBadge status={log.status} /><span className="ml-auto text-[8px] text-[#53615d]">{relativeTime(log.createdAt)}</span></div><p className="mt-2 text-[9px] text-[#71807c]">{log.provider}{log.isFollowUp ? " · follow-up" : ""}{log.category ? ` · ${log.category}` : ""}</p>{log.incomingText && <p className="mt-2 line-clamp-2 rounded-lg border border-white/[0.05] p-2 text-[10px] leading-4 text-[#9ba9a4]">In: {log.incomingText}</p>}{log.responseText && <p className="mt-2 line-clamp-2 rounded-lg bg-[#b8ff4b]/[0.06] p-2 text-[10px] leading-4 text-[#dfffaa]">Out: {log.responseText}</p>}{log.errorMessage && <p className="mt-2 text-[9px] leading-4 text-[#ff8585]">{log.errorCode}: {log.errorMessage}</p>}</div>;
}

function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-[#65736f]">{label}<input type="number" value={value} onChange={(event) => set(Number(event.target.value))} className={`${FIELD} mt-2`} /></label>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Radar }) {
  return <div className={`${PANEL} rounded-2xl p-4`}><Icon size={15} className="text-[#65e6ff]" /><p className="mt-4 font-mono text-2xl font-semibold">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-[#60706b]">{label}</p></div>;
}

function CardStat({ label, value }: { label: string; value: number | string }) {
  return <div><p className="font-mono text-lg font-semibold">{value}</p><p className="mt-1 text-[8px] uppercase tracking-wider text-[#60706b]">{label}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-[#071111] p-3"><dt className="text-[8px] uppercase tracking-wider text-[#60706b]">{label}</dt><dd className="mt-2 font-medium capitalize text-[#bdc9c5]">{value}</dd></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-[10px] text-[#60706b]">{text}</p>;
}
