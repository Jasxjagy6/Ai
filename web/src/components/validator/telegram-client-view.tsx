"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  CircleUserRound,
  Download,
  Edit3,
  File,
  Forward,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircleMore,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pin,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { SignalSelect } from "@/components/validator/signal-select";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#080c0b] px-3.5 py-2.5 text-sm text-[#eef7ed] outline-none transition placeholder:text-[#61706d] focus:border-[#9cff38]/50 focus:ring-2 focus:ring-[#9cff38]/10 disabled:opacity-45";
const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-xs font-semibold text-[#b8c5c1] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#9cff38] px-4 py-2.5 text-xs font-bold text-[#07100d] transition hover:bg-[#b8ff68] disabled:cursor-not-allowed disabled:opacity-40";

type Session = {
  id: string;
  label: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  status: string;
  isLoggedIn: boolean;
  isPremium: boolean;
  isVerified: boolean;
  spamStatus: string;
  avatarUrl: string | null;
};
type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  isSelf: boolean;
  isContact: boolean;
  isBot: boolean;
  isPremium: boolean;
  isVerified: boolean;
  isRestricted: boolean;
  status: string | null;
  lastOnlineAt: string | null;
};
type Chat = {
  id: string;
  type: string;
  title: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  bio: string | null;
  membersCount: number | null;
  isVerified: boolean;
  isRestricted: boolean;
  isCreator: boolean;
  isScam: boolean;
  isFake: boolean;
  hasProtectedContent: boolean;
};
type Media = {
  kind: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  emoji: string | null;
};
type Message = {
  id: number;
  chatId: string | null;
  text: string;
  date: string | null;
  editDate: string | null;
  outgoing: boolean;
  replyToMessageId: number | null;
  views: number | null;
  forwards: number | null;
  sender: User | null;
  senderChat: Chat | null;
  media: Media | null;
  service: string | null;
  pending?: boolean;
};
type Dialog = {
  chat: Chat;
  topMessage: Message | null;
  unreadCount: number;
  unreadMentions: number;
  unreadMark: boolean;
  pinned: boolean;
};
type SettingsData = {
  notifications: Record<
    string,
    {
      muted: boolean;
      muteUntil: number;
      showPreviews: boolean;
      silent: boolean;
    }
  >;
  privacy: Record<string, string>;
  password: {
    hasPassword: boolean;
    hint: string | null;
    hasRecovery: boolean;
    emailPattern: string | null;
  };
  authorizationTtlDays: number;
  authorizations: Array<{
    hash: string;
    current: boolean;
    deviceModel: string;
    platform: string;
    systemVersion: string;
    appName: string;
    appVersion: string;
    ip: string;
    country: string;
    region: string;
    createdAt: string | null;
    activeAt: string | null;
  }>;
};
type Command = {
  id: string;
  status: string;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  dataUrl?: string | null;
};
type ChatMember = {
  user: User | null;
  status: string;
  customTitle: string | null;
  joinedAt: string | null;
  untilAt: string | null;
  canBeEdited: boolean;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

async function command<T>(
  sessionId: string,
  kind: string,
  payload: Record<string, unknown> = {},
  timeout = 90_000,
): Promise<{ result: T; dataUrl?: string | null }> {
  const queued = await request<{ command: Command }>(
    `/api/validator/telegram/client/sessions/${sessionId}/commands`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    },
  );
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    const data = await request<{ command: Command }>(
      `/api/validator/telegram/client/commands/${queued.command.id}`,
    );
    if (data.command.status === "completed")
      return {
        result: (data.command.result || {}) as T,
        dataUrl: data.command.dataUrl,
      };
    if (["failed", "cancelled", "expired"].includes(data.command.status))
      throw new Error(
        data.command.errorMessage || `Telegram command ${data.command.status}`,
      );
  }
  throw new Error("Telegram command timed out");
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TG"
  );
}

function time(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function bytes(value: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function TelegramClientView({ session }: { session: Session }) {
  const [me, setMe] = useState<User | null>(null);
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [dialogsRefreshing, setDialogsRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [drawer, setDrawer] = useState<
    | "settings"
    | "contacts"
    | "contactManager"
    | "profile"
    | "chat"
    | "manage"
    | null
  >(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    try {
      return localStorage.getItem("signalDesk.telegramDensity") === "compact"
        ? "compact"
        : "comfortable";
    } catch {
      return "comfortable";
    }
  });
  const activeChat =
    dialogs.find((dialog) => dialog.chat.id === activeChatId)?.chat || null;
  const activeChatTitle = activeChat?.title || "";
  const messageScroller = useRef<HTMLDivElement>(null);
  const messageRequest = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);

  async function bootstrap() {
    setError("");
    const data = await command<{ me: User; dialogs: Dialog[] }>(
      session.id,
      "bootstrap",
      {},
      120_000,
    );
    setMe(data.result.me);
    setDialogs(data.result.dialogs || []);
    setActiveChatId(
      (current) =>
        current ||
        (window.innerWidth >= 768
          ? data.result.dialogs?.[0]?.chat.id || ""
          : ""),
    );
  }

  async function refreshDialogs(visible = false) {
    if (visible && dialogsRefreshing) return;
    if (visible) setDialogsRefreshing(true);
    try {
      const data = await command<{ dialogs: Dialog[] }>(
        session.id,
        "dialogs",
        { limit: 200 },
        120_000,
      );
      setDialogs(data.result.dialogs || []);
    } finally {
      if (visible) setDialogsRefreshing(false);
    }
  }

  async function loadMessages(chatId: string, quiet = false) {
    if (!chatId || messageRequest.current) return;
    messageRequest.current = true;
    if (!quiet) setMessagesLoading(true);
    try {
      const data = await command<{ messages: Message[] }>(
        session.id,
        "messages",
        { chatId, limit: 60 },
      );
      setMessages(data.result.messages || []);
      setDialogs((current) =>
        current.map((dialog) =>
          dialog.chat.id === chatId
            ? { ...dialog, unreadCount: 0, unreadMark: false }
            : dialog,
        ),
      );
      const newest = data.result.messages?.at(-1)?.id || 0;
      if (newest)
        void command(session.id, "read_history", {
          chatId,
          maxId: newest,
        }).catch(() => undefined);
    } catch (reason) {
      if (!quiet)
        setError(
          reason instanceof Error ? reason.message : "Unable to load messages",
        );
    } finally {
      messageRequest.current = false;
      if (!quiet) setMessagesLoading(false);
    }
  }

  function selectChat(chatId: string) {
    setMessages([]);
    setReplyTo(null);
    setEditing(null);
    setChatSearchOpen(false);
    setSearchResults([]);
    setPinnedMessages([]);
    setPinnedOpen(false);
    setActiveChatId(chatId);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void bootstrap()
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to connect account",
          ),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void refreshDialogs().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeChatId) return;
    const initial = window.setTimeout(() => void loadMessages(activeChatId), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void loadMessages(activeChatId, true);
    }, 4000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const element = messageScroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, activeChatId]);

  useEffect(() => {
    if (!activeChatTitle) return;
    document.title = `${activeChatTitle} | ${me ? [me.firstName, me.lastName].filter(Boolean).join(" ") || me.username || session.label : session.label}`;
  }, [activeChatTitle, me, session.label]);

  const filteredDialogs = dialogs.filter((dialog) =>
    `${dialog.chat.title} ${dialog.chat.username || ""} ${dialog.topMessage?.text || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  async function sendMessage() {
    const text = composer.trim();
    if (!activeChatId || !text || busy) return;
    setBusy("send");
    try {
      if (editing) {
        const data = await command<{ message: Message }>(
          session.id,
          "edit_message",
          { chatId: activeChatId, messageId: editing.id, text },
        );
        setMessages((current) =>
          current.map((message) =>
            message.id === editing.id ? data.result.message : message,
          ),
        );
      } else {
        const optimistic: Message = {
          id: -Date.now(),
          chatId: activeChatId,
          text,
          date: new Date().toISOString(),
          editDate: null,
          outgoing: true,
          replyToMessageId: replyTo?.id || null,
          views: null,
          forwards: null,
          sender: me,
          senderChat: null,
          media: null,
          service: null,
          pending: true,
        };
        setMessages((current) => [...current, optimistic]);
        setComposer("");
        const data = await command<{ message: Message }>(
          session.id,
          "send_message",
          {
            chatId: activeChatId,
            text,
            ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
          },
        );
        setMessages((current) =>
          current.map((message) =>
            message.id === optimistic.id ? data.result.message : message,
          ),
        );
      }
      setComposer("");
      setReplyTo(null);
      setEditing(null);
    } catch (reason) {
      setMessages((current) => current.filter((message) => !message.pending));
      setError(reason instanceof Error ? reason.message : "Message failed");
    } finally {
      setBusy("");
    }
  }

  async function uploadMedia(file?: globalThis.File, forcedType?: "voice") {
    if (!file || !activeChatId) return;
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await request<{
        mediaPath: string;
        fileName: string;
        mimeType: string;
      }>("/api/validator/telegram/client/upload", {
        method: "POST",
        body: form,
      });
      const mediaType =
        forcedType ||
        (file.type.startsWith("image/")
          ? "photo"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "document");
      const data = await command<{ message: Message }>(
        session.id,
        "send_media",
        {
          chatId: activeChatId,
          mediaPath: uploaded.mediaPath,
          mediaType,
          fileName: uploaded.fileName,
          caption: composer.trim(),
          ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
        },
        180_000,
      );
      setMessages((current) => [...current, data.result.message]);
      setComposer("");
      setReplyTo(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Media upload failed",
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorder.current?.stop();
      setRecording(false);
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunks.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunks.current, { type: mimeType });
        recordingChunks.current = [];
        if (blob.size)
          void uploadMedia(
            new globalThis.File([blob], `voice-${Date.now()}.webm`, {
              type: mimeType,
            }),
            "voice",
          );
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Microphone access failed",
      );
    }
  }

  async function loadPinned() {
    if (!activeChatId) return;
    setBusy("pinned");
    try {
      const data = await command<{ messages: Message[] }>(
        session.id,
        "pinned_messages",
        { chatId: activeChatId, limit: 50 },
      );
      setPinnedMessages(data.result.messages || []);
      setPinnedOpen(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Pinned messages failed",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateMessageAction(
    kind: "pin_message" | "unpin_message" | "react_message",
    message: Message,
    emoji?: string,
  ) {
    setBusy(`${kind}:${message.id}`);
    try {
      await command(session.id, kind, {
        chatId: activeChatId,
        messageId: message.id,
        ...(emoji !== undefined ? { emoji } : {}),
      });
      if (kind !== "react_message") await loadPinned();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message action failed",
      );
    } finally {
      setBusy("");
    }
  }

  async function unpinAllMessages() {
    if (!activeChatId) return;
    setBusy("unpin_all");
    try {
      await command(session.id, "unpin_all_messages", { chatId: activeChatId });
      setPinnedMessages([]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to unpin messages",
      );
    } finally {
      setBusy("");
    }
  }

  async function deleteMessage(message: Message, revoke: boolean) {
    setBusy(`delete:${message.id}`);
    try {
      await command(session.id, "delete_messages", {
        chatId: activeChatId,
        messageIds: [message.id],
        revoke,
      });
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  async function forwardMessage(chatId: string) {
    if (!forwarding) return;
    setBusy("forward");
    try {
      await command(session.id, "forward_messages", {
        chatId,
        fromChatId: activeChatId,
        messageIds: [forwarding.id],
      });
      setForwarding(null);
      if (chatId === activeChatId) await loadMessages(activeChatId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Forward failed");
    } finally {
      setBusy("");
    }
  }

  async function searchInChat() {
    if (!activeChatId || !chatSearch.trim()) return;
    setBusy("search");
    try {
      const data = await command<{ messages: Message[] }>(
        session.id,
        "search_messages",
        { chatId: activeChatId, query: chatSearch.trim(), limit: 50 },
      );
      setSearchResults(data.result.messages || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed");
    } finally {
      setBusy("");
    }
  }

  async function downloadMedia(message: Message) {
    setBusy(`media:${message.id}`);
    try {
      const data = await command<{ messageId: number }>(
        session.id,
        "download_media",
        { chatId: activeChatId, messageId: message.id },
        180_000,
      );
      if (data.dataUrl)
        window.open(data.dataUrl, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Download failed");
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="signal-desk-theme flex h-dvh items-center justify-center bg-[#090c0b] text-[#eef7ed]">
        <div className="text-center">
          <Loader2 size={26} className="mx-auto animate-spin text-[#9cff38]" />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#60706b]">
            Connecting isolated account window
          </p>
        </div>
      </div>
    );

  return (
    <div className="signal-desk-theme flex h-dvh overflow-hidden bg-[#090c0b] text-[#eef7ed]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0d100e]/95 px-3 backdrop-blur-xl sm:px-4">
          {activeChatId && (
            <button
              type="button"
              onClick={() => setActiveChatId("")}
              className="rounded-xl border border-white/10 p-2 text-[#9aa6a1] md:hidden"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawer("profile")}
            className="flex min-w-0 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-white/[0.035]"
          >
            <Avatar
              label={
                me
                  ? [me.firstName, me.lastName].filter(Boolean).join(" ") ||
                    me.username ||
                    session.label
                  : session.label
              }
              image={session.avatarUrl}
            />
            <span className="hidden min-w-0 sm:block">
              <span className="flex items-center gap-1.5">
                <span className="block max-w-48 truncate text-xs font-semibold">
                  {me
                    ? [me.firstName, me.lastName].filter(Boolean).join(" ") ||
                      me.username ||
                      session.label
                    : session.label}
                </span>
                {(me?.isPremium || session.isPremium) && <PremiumMark />}
                {(me?.isVerified || session.isVerified) && (
                  <CheckCircle2 size={11} className="text-[#65e6ff]" />
                )}
              </span>
              <span className="mt-0.5 block truncate text-[8px] text-[#60706b]">
                {me?.username
                  ? `@${me.username}`
                  : me?.phone || session.phone || session.id}
              </span>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <StatusMark status={session.spamStatus} />
            <button
              type="button"
              onClick={() => setDrawer("contacts")}
              className="rounded-xl p-2.5 text-[#83908b] hover:bg-white/[0.04] hover:text-white"
              title="Contacts"
            >
              <Users size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDrawer("contactManager")}
              className="hidden rounded-xl p-2.5 text-[#83908b] hover:bg-white/[0.04] hover:text-white sm:block"
              title="Add or remove contacts"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDrawer("settings")}
              className="rounded-xl p-2.5 text-[#83908b] hover:bg-white/[0.04] hover:text-white"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#9cff38]/15 bg-[#9cff38]/[0.04] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#bde990] sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9cff38]" />{" "}
              Live
            </span>
          </div>
        </header>

        {error && (
          <div className="flex shrink-0 items-center gap-2 border-b border-red-500/15 bg-red-500/[0.06] px-4 py-2 text-[10px] text-red-300">
            <Shield size={12} />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button type="button" onClick={() => setError("")}>
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <aside
            className={`${activeChatId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/[0.065] bg-[#0c0f0d] md:w-[330px] xl:w-[370px]`}
          >
            <div className="border-b border-white/[0.06] p-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search chats and recent messages"
                  className={`${FIELD} py-2.5 pl-9 text-xs`}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#60706b]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-[8px] uppercase tracking-wider text-[#53615d]">
                <span>{filteredDialogs.length} conversations</span>
                <button
                  type="button"
                  onClick={() =>
                    void refreshDialogs(true).catch((reason) =>
                      setError(reason.message),
                    )
                  }
                  disabled={dialogsRefreshing}
                  className="flex items-center gap-1 hover:text-[#9cff38] disabled:opacity-45"
                >
                  <RefreshCw size={10} className={dialogsRefreshing ? "animate-spin" : ""} />
                  {dialogsRefreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredDialogs.map((dialog) => (
                <DialogRow
                  key={dialog.chat.id}
                  dialog={dialog}
                  active={activeChatId === dialog.chat.id}
                  compact={density === "compact"}
                  onClick={() => selectChat(dialog.chat.id)}
                />
              ))}
              {!filteredDialogs.length && (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <MessageCircleMore size={25} className="text-[#40504b]" />
                  <p className="mt-3 text-xs text-[#60706b]">
                    No matching conversations.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <main
            className={`${activeChatId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#090c0b]`}
          >
            {!activeChat ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-[#111311]">
                  <MessageCircleMore size={27} className="text-[#53615d]" />
                </span>
                <p className="mt-4 text-sm font-semibold">
                  Select a conversation
                </p>
                <p className="mt-1 text-xs text-[#60706b]">
                  Chats stay isolated to this account window.
                </p>
              </div>
            ) : (
              <>
                <div className="flex h-[62px] shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0d100e] px-3 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setDrawer("chat")}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar label={activeChat.title} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="block truncate text-xs font-semibold sm:text-sm">
                          {activeChat.title}
                        </span>
                        {activeChat.isVerified && (
                          <CheckCircle2 size={12} className="text-[#65e6ff]" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-[#60706b]">
                        {activeChat.username
                          ? `@${activeChat.username}`
                          : activeChat.membersCount
                            ? `${activeChat.membersCount.toLocaleString()} members`
                            : activeChat.type}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatSearchOpen((value) => !value)}
                    className="rounded-xl p-2.5 text-[#71807c] hover:bg-white/[0.04] hover:text-white"
                  >
                    <Search size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadPinned()}
                    className="rounded-xl p-2.5 text-[#71807c] hover:bg-white/[0.04] hover:text-white"
                    title="Pinned messages"
                  >
                    {busy === "pinned" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Pin size={15} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawer("manage")}
                    className="rounded-xl p-2.5 text-[#71807c] hover:bg-white/[0.04] hover:text-white"
                    title="Members and notifications"
                  >
                    <Users size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawer("chat")}
                    className="rounded-xl p-2.5 text-[#71807c] hover:bg-white/[0.04] hover:text-white"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                {pinnedOpen && (
                  <div className="shrink-0 border-b border-[#9cff38]/10 bg-[#0c120e] p-3">
                    <div className="flex items-center gap-2">
                      <Pin size={12} className="text-[#9cff38]" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#bde990]">
                        Pinned messages
                      </span>
                      <span className="text-[8px] text-[#60706b]">
                        {pinnedMessages.length}
                      </span>
                      {!!pinnedMessages.length && (
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => void unpinAllMessages()}
                          className="ml-auto text-[8px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-40"
                        >
                          Unpin all
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPinnedOpen(false)}
                        className={`${pinnedMessages.length ? "" : "ml-auto"} text-[#60706b] hover:text-white`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="mt-2 flex max-h-28 flex-col gap-1 overflow-y-auto">
                      {pinnedMessages.map((message) => (
                        <button
                          key={message.id}
                          type="button"
                          onClick={() => {
                            setMessages((current) =>
                              current.some((item) => item.id === message.id)
                                ? current
                                : [...current, message].sort(
                                    (a, b) => a.id - b.id,
                                  ),
                            );
                            setPinnedOpen(false);
                          }}
                          className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-left text-[9px] text-[#aebbb6] hover:bg-white/[0.05]"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {message.text ||
                              `[${message.media?.kind || "media"}]`}
                          </span>
                          <span className="shrink-0 text-[7px] text-[#53615d]">
                            {time(message.date)}
                          </span>
                        </button>
                      ))}
                      {!pinnedMessages.length && (
                        <p className="py-2 text-[9px] text-[#60706b]">
                          No pinned messages in this conversation.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {chatSearchOpen && (
                  <div className="shrink-0 border-b border-white/[0.06] bg-[#0c0f0d] p-3">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={chatSearch}
                        onChange={(event) => setChatSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void searchInChat();
                        }}
                        placeholder="Search this conversation"
                        className={`${FIELD} py-2 text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => void searchInChat()}
                        className={BUTTON}
                      >
                        {busy === "search" ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Search size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChatSearchOpen(false);
                          setSearchResults([]);
                        }}
                        className={BUTTON}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                        {searchResults.map((message) => (
                          <button
                            key={message.id}
                            type="button"
                            onClick={() => {
                              setMessages((current) =>
                                current.some((item) => item.id === message.id)
                                  ? current
                                  : [...current, message].sort(
                                      (a, b) => a.id - b.id,
                                    ),
                              );
                              setChatSearchOpen(false);
                            }}
                            className="block w-full truncate rounded-lg bg-white/[0.025] px-3 py-2 text-left text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
                          >
                            {message.sender?.firstName ||
                              (message.outgoing ? "You" : activeChat.title)}
                            :{" "}
                            {message.text ||
                              `[${message.media?.kind || "media"}]`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div
                  ref={messageScroller}
                  className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
                >
                  {messagesLoading && !messages.length ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2
                        size={20}
                        className="animate-spin text-[#9cff38]"
                      />
                    </div>
                  ) : messages.length ? (
                    <div className="mx-auto flex max-w-4xl flex-col gap-1.5">
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          busy={busy}
                          onReply={() => {
                            setReplyTo(message);
                            setEditing(null);
                          }}
                          onEdit={() => {
                            setEditing(message);
                            setReplyTo(null);
                            setComposer(message.text);
                          }}
                          onDelete={(revoke) =>
                            void deleteMessage(message, revoke)
                          }
                          onForward={() => setForwarding(message)}
                          onDownload={() => void downloadMedia(message)}
                          onPin={() =>
                            void updateMessageAction("pin_message", message)
                          }
                          onUnpin={() =>
                            void updateMessageAction("unpin_message", message)
                          }
                          onReact={(emoji) =>
                            void updateMessageAction(
                              "react_message",
                              message,
                              emoji,
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[#60706b]">
                      No messages in this chat.
                    </div>
                  )}
                </div>
                {(replyTo || editing) && (
                  <div className="mx-3 mb-1 flex items-center gap-3 rounded-xl border border-[#9cff38]/15 bg-[#9cff38]/[0.04] px-3 py-2 sm:mx-4">
                    <span className="h-7 w-0.5 rounded-full bg-[#9cff38]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-semibold text-[#bde990]">
                        {editing
                          ? "Editing message"
                          : `Replying to ${replyTo?.outgoing ? "yourself" : replyTo?.sender?.firstName || activeChat.title}`}
                      </span>
                      <span className="block truncate text-[9px] text-[#60706b]">
                        {editing?.text ||
                          replyTo?.text ||
                          `[${replyTo?.media?.kind || "media"}]`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setEditing(null);
                        if (editing) setComposer("");
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="shrink-0 border-t border-white/[0.06] bg-[#0d100e] p-3 sm:p-4">
                  <div className="mx-auto flex max-w-4xl items-end gap-2">
                    <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-[#71807c] transition hover:border-white/20 hover:text-white">
                      <input
                        type="file"
                        className="hidden"
                        disabled={!!busy}
                        onChange={(event) => {
                          void uploadMedia(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                      <Paperclip size={16} />
                    </label>
                    <textarea
                      value={composer}
                      onChange={(event) =>
                        setComposer(event.target.value.slice(0, 4096))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      rows={1}
                      placeholder={
                        recording
                          ? "Recording voice note..."
                          : editing
                            ? "Edit message"
                            : "Write a message"
                      }
                      disabled={recording}
                      className={`${FIELD} max-h-32 min-h-10 resize-none py-2.5`}
                    />
                    {composer.trim() || editing ? (
                      <button
                        type="button"
                        disabled={!composer.trim() || !!busy}
                        onClick={() => void sendMessage()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#9cff38] text-[#07100d] disabled:opacity-35"
                      >
                        {busy === "send" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : editing ? (
                          <Check size={16} />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void toggleRecording()}
                        title={
                          recording
                            ? "Stop and send voice note"
                            : "Record voice note"
                        }
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${recording ? "animate-pulse bg-red-400 text-[#260808]" : "bg-[#9cff38] text-[#07100d]"}`}
                      >
                        <Mic size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {drawer === "settings" && (
        <SettingsDrawer
          sessionId={session.id}
          density={density}
          setDensity={(value) => {
            setDensity(value);
            try {
              localStorage.setItem("signalDesk.telegramDensity", value);
            } catch {}
          }}
          onClose={() => setDrawer(null)}
          onError={setError}
        />
      )}
      {drawer === "contacts" && (
        <ContactsDrawer
          sessionId={session.id}
          onClose={() => setDrawer(null)}
          onManage={() => setDrawer("contactManager")}
          onOpen={(id) => {
            if (!dialogs.some((dialog) => dialog.chat.id === id))
              setDialogs((current) => [
                {
                  chat: {
                    id,
                    type: "private",
                    title: id,
                    firstName: null,
                    lastName: null,
                    username: null,
                    bio: null,
                    membersCount: null,
                    isVerified: false,
                    isRestricted: false,
                    isCreator: false,
                    isScam: false,
                    isFake: false,
                    hasProtectedContent: false,
                  },
                  topMessage: null,
                  unreadCount: 0,
                  unreadMentions: 0,
                  unreadMark: false,
                  pinned: false,
                },
                ...current,
              ]);
            selectChat(id);
            setDrawer(null);
          }}
          onError={setError}
        />
      )}
      {drawer === "contactManager" && (
        <ContactManagerDrawer
          sessionId={session.id}
          onClose={() => setDrawer(null)}
          onError={setError}
        />
      )}
      {drawer === "profile" && (
        <ProfileDrawer
          session={session}
          me={me}
          setMe={setMe}
          onClose={() => setDrawer(null)}
          onError={setError}
        />
      )}
      {drawer === "chat" && activeChat && (
        <ChatDrawer
          sessionId={session.id}
          chat={activeChat}
          onClose={() => setDrawer(null)}
          onChanged={(action) => {
            if (["archive_chat", "leave_chat"].includes(action)) {
              setDialogs((current) =>
                current.filter((dialog) => dialog.chat.id !== activeChat.id),
              );
              setActiveChatId("");
            }
            if (action === "clear_chat") setMessages([]);
          }}
          onError={setError}
        />
      )}
      {drawer === "manage" && activeChat && (
        <ManageChatDrawer
          sessionId={session.id}
          chat={activeChat}
          onClose={() => setDrawer(null)}
          onChatChanged={(chat) =>
            setDialogs((current) =>
              current.map((dialog) =>
                dialog.chat.id === chat.id ? { ...dialog, chat } : dialog,
              ),
            )
          }
          onError={setError}
        />
      )}
      {forwarding && (
        <ForwardModal
          dialogs={dialogs}
          message={forwarding}
          busy={busy === "forward"}
          onClose={() => setForwarding(null)}
          onForward={(chatId) => void forwardMessage(chatId)}
        />
      )}
    </div>
  );
}

function Avatar({
  label,
  image,
  small = false,
}: {
  label: string;
  image?: string | null;
  small?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#17201b] font-bold text-[#9cff38] ${small ? "h-9 w-9 text-[10px]" : "h-10 w-10 text-xs"}`}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(label)
      )}
    </span>
  );
}

function PremiumMark() {
  return (
    <span
      title="Telegram Premium"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#f4ca64]/25 bg-[#f4ca64]/[0.08] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#f4ca64]"
    >
      <Star size={8} fill="currentColor" /> Premium
    </span>
  );
}

function StatusMark({ status }: { status: string }) {
  if (!status || status === "clean") return null;
  const frozen = status === "frozen";
  return (
    <span
      className={`hidden rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-wider sm:inline-flex ${frozen ? "border-red-500/25 bg-red-500/[0.07] text-red-300" : "border-amber-500/25 bg-amber-500/[0.07] text-amber-300"}`}
    >
      {status}
    </span>
  );
}

function DialogRow({
  dialog,
  active,
  compact,
  onClick,
}: {
  dialog: Dialog;
  active: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-white/[0.04] px-3 text-left transition ${compact ? "py-2" : "py-3"} ${active ? "bg-[#9cff38]/[0.055]" : "hover:bg-white/[0.025]"}`}
    >
      <Avatar label={dialog.chat.title} small />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-xs font-semibold">
            {dialog.chat.title}
          </span>
          {dialog.chat.isVerified && (
            <CheckCircle2 size={10} className="text-[#65e6ff]" />
          )}
          <span className="ml-auto text-[8px] text-[#53615d]">
            {time(dialog.topMessage?.date || null)}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[9px] text-[#60706b]">
            {dialog.topMessage?.outgoing && (
              <span className="text-[#89958f]">You: </span>
            )}
            {dialog.topMessage?.text ||
              (dialog.topMessage?.media
                ? `[${dialog.topMessage.media.kind}]`
                : "No messages")}
          </span>
          {dialog.pinned && (
            <Archive size={9} className="shrink-0 text-[#53615d]" />
          )}
          {dialog.unreadCount > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#9cff38] px-1 text-[7px] font-bold text-[#07100d]">
              {dialog.unreadCount > 99 ? "99+" : dialog.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function MessageBubble({
  message,
  busy,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onDownload,
  onPin,
  onUnpin,
  onReact,
}: {
  message: Message;
  busy: string;
  onReply: () => void;
  onEdit: () => void;
  onDelete: (revoke: boolean) => void;
  onForward: () => void;
  onDownload: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onReact: (emoji: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const sender = message.sender
    ? [message.sender.firstName, message.sender.lastName]
        .filter(Boolean)
        .join(" ") || message.sender.username
    : message.senderChat?.title;
  return (
    <div
      className={`group flex ${message.outgoing ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[88%] rounded-2xl border px-3 py-2 sm:max-w-[72%] ${message.outgoing ? "border-[#9cff38]/15 bg-[#9cff38]/[0.08]" : "border-white/[0.07] bg-[#111311]"} ${message.pending ? "opacity-55" : ""}`}
      >
        {!message.outgoing && sender && (
          <p className="mb-1 text-[8px] font-bold text-[#9cff38]">{sender}</p>
        )}
        {message.media && (
          <button
            type="button"
            onClick={onDownload}
            disabled={busy === `media:${message.id}`}
            className="mb-2 flex min-w-44 items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-[#9cff38]">
              {message.media.kind === "photo" ? (
                <ImageIcon size={15} />
              ) : (
                <File size={15} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold">
                {message.media.fileName || message.media.kind}
              </span>
              <span className="mt-1 block text-[8px] text-[#60706b]">
                {bytes(message.media.fileSize)}
                {message.media.duration ? ` · ${message.media.duration}s` : ""}
              </span>
            </span>
            {busy === `media:${message.id}` ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
          </button>
        )}
        {message.text && (
          <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-[#dce7e3]">
            {message.text}
          </p>
        )}
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span className="text-[7px] text-[#60706b]">
            {time(message.date)}
            {message.editDate ? " · edited" : ""}
          </span>
          {message.pending && (
            <Loader2 size={8} className="animate-spin text-[#9cff38]" />
          )}
        </div>
        {message.id > 0 && (
          <button
            type="button"
            onClick={() => setMenu((value) => !value)}
            className="absolute -right-7 top-1 rounded-lg p-1.5 text-[#60706b] hover:bg-white/[0.05] hover:text-white md:hidden md:group-hover:block"
          >
            <MoreHorizontal size={13} />
          </button>
        )}
        {menu && (
          <div
            className={`absolute top-7 z-20 w-40 rounded-xl border border-white/10 bg-[#111612] p-1.5 shadow-2xl ${message.outgoing ? "right-0" : "left-0"}`}
          >
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onReply();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
            >
              <Reply size={11} /> Reply
            </button>
            {message.outgoing && message.text && (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
              >
                <Edit3 size={11} /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onForward();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
            >
              <Forward size={11} /> Forward
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onPin();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
            >
              <Pin size={11} /> Pin
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onUnpin();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-[#aebbb6] hover:bg-white/[0.05]"
            >
              <Pin size={11} /> Unpin
            </button>
            <div className="my-1 flex items-center gap-1 border-y border-white/[0.05] px-1 py-1.5">
              {["👍", "❤️", "🔥", "👏", "😁"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onReact(emoji);
                  }}
                  className="rounded-md p-1 text-xs hover:bg-white/[0.07]"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onDelete(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-red-300 hover:bg-red-500/[0.06]"
            >
              <Trash2 size={11} /> Delete for me
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onDelete(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-red-300 hover:bg-red-500/[0.06]"
            >
              <Trash2 size={11} /> Delete both sides
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerShell({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: typeof Settings;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <aside
        onMouseDown={(event) => event.stopPropagation()}
        className="validator-modal-in flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0d100e] shadow-2xl"
      >
        <div className="flex h-[62px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9cff38]/10 text-[#9cff38]">
            <Icon size={15} />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl p-2 text-[#71807c] hover:bg-white/[0.04] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

function SettingsDrawer({
  sessionId,
  density,
  setDensity,
  onClose,
  onError,
}: {
  sessionId: string;
  density: "compact" | "comfortable";
  setDensity: (value: "compact" | "comfortable") => void;
  onClose: () => void;
  onError: (value: string) => void;
}) {
  const [tab, setTab] = useState("notifications");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState("");
  const [passwordMode, setPasswordMode] = useState<
    "enable" | "change" | "disable" | ""
  >("");
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    hint: "",
    email: "",
  });

  async function load() {
    const data = await command<SettingsData>(sessionId, "settings");
    setSettings(data.result);
  }
  useEffect(() => {
    const timer = window.setTimeout(
      () => void load().catch((reason) => onError(reason.message)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function update(kind: string, payload: Record<string, unknown>) {
    setBusy(kind);
    try {
      const data = await command<SettingsData>(sessionId, kind, payload);
      setSettings(data.result);
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Settings update failed",
      );
    } finally {
      setBusy("");
    }
  }
  const tabs = [
    { id: "notifications", label: "Alerts", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "security", label: "Security", icon: Lock },
    { id: "appearance", label: "Display", icon: Menu },
  ];
  return (
    <DrawerShell title="Telegram settings" icon={Settings} onClose={onClose}>
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-[#080c0b] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[8px] font-semibold ${tab === item.id ? "bg-[#9cff38]/15 text-[#9cff38]" : "text-[#60706b] hover:text-white"}`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>
      {!settings ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[#9cff38]" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "notifications" &&
            Object.entries(settings.notifications).map(([scope, value]) => (
              <section
                key={scope}
                className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Bell size={13} className="text-[#9cff38]" />
                  <h3 className="text-xs font-semibold capitalize">
                    {scope === "users" ? "Private chats" : scope}
                  </h3>
                  {busy === "update_notify" && (
                    <Loader2 size={11} className="ml-auto animate-spin" />
                  )}
                </div>
                <Toggle
                  label="Notifications"
                  on={!value.muted}
                  icon={value.muted ? VolumeX : Volume2}
                  onChange={(enabled) =>
                    void update("update_notify", { scope, muted: !enabled })
                  }
                />
                <Toggle
                  label="Message preview"
                  on={value.showPreviews}
                  icon={MessageCircleMore}
                  onChange={(enabled) =>
                    void update("update_notify", {
                      scope,
                      showPreviews: enabled,
                    })
                  }
                />
                <Toggle
                  label="Silent delivery"
                  on={value.silent}
                  icon={VolumeX}
                  onChange={(enabled) =>
                    void update("update_notify", { scope, silent: enabled })
                  }
                />
              </section>
            ))}
          {tab === "privacy" &&
            Object.entries(settings.privacy).map(([key, value]) => (
              <section
                key={key}
                className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4"
              >
                <p className="mb-3 text-xs font-semibold">
                  {{
                    statusTimestamp: "Last seen & online",
                    profilePhoto: "Profile photo",
                    phoneNumber: "Phone number",
                    phoneCall: "Voice / video calls",
                    forwards: "Forwarded messages",
                    chatInvite: "Group invites",
                    voiceMessages: "Voice messages",
                  }[key] || key}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {["everybody", "contacts", "nobody"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        void update("update_privacy", { key, value: option })
                      }
                      className={`rounded-lg border px-2 py-2 text-[9px] capitalize ${value === option ? "border-[#9cff38]/30 bg-[#9cff38]/10 text-[#9cff38]" : "border-white/[0.06] text-[#71807c]"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          {tab === "security" && (
            <>
              <section className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
                <div className="flex items-center gap-2">
                  <KeyRound size={14} className="text-[#f4ca64]" />
                  <h3 className="text-xs font-semibold">
                    Two-step verification
                  </h3>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-[#60706b]">
                  {settings.password.hasPassword
                    ? `Cloud password enabled${settings.password.hint ? ` · hint: ${settings.password.hint}` : ""}`
                    : "No cloud password is set."}
                </p>
                {!passwordMode ? (
                  <div className="mt-3 flex gap-2">
                    {!settings.password.hasPassword ? (
                      <button
                        type="button"
                        onClick={() => setPasswordMode("enable")}
                        className={PRIMARY}
                      >
                        Enable 2FA
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPasswordMode("change")}
                          className={BUTTON}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setPasswordMode("disable")}
                          className="rounded-xl border border-red-500/20 px-3 py-2 text-[10px] text-red-300"
                        >
                          Disable
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {passwordMode !== "enable" && (
                      <input
                        type="password"
                        value={password.currentPassword}
                        onChange={(event) =>
                          setPassword((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                        placeholder="Current password"
                        className={FIELD}
                      />
                    )}
                    {passwordMode !== "disable" && (
                      <>
                        <input
                          type="password"
                          value={password.newPassword}
                          onChange={(event) =>
                            setPassword((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                          placeholder="New password"
                          className={FIELD}
                        />
                        <input
                          value={password.hint}
                          onChange={(event) =>
                            setPassword((current) => ({
                              ...current,
                              hint: event.target.value,
                            }))
                          }
                          placeholder="Hint (optional)"
                          className={FIELD}
                        />
                        {passwordMode === "enable" && (
                          <input
                            type="email"
                            value={password.email}
                            onChange={(event) =>
                              setPassword((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            placeholder="Recovery email (optional)"
                            className={FIELD}
                          />
                        )}
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void update("password", {
                            action: passwordMode,
                            ...password,
                          }).then(() => {
                            setPasswordMode("");
                            setPassword({
                              currentPassword: "",
                              newPassword: "",
                              hint: "",
                              email: "",
                            });
                          });
                        }}
                        className={PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordMode("")}
                        className={BUTTON}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className="text-[#65e6ff]" />
                  <h3 className="text-xs font-semibold">Active devices</h3>
                  <span className="ml-auto text-[8px] text-[#60706b]">
                    {settings.authorizations.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {settings.authorizations.map((authorization) => (
                    <div
                      key={authorization.hash}
                      className="rounded-xl border border-white/[0.06] bg-[#0d100e] p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[10px] font-semibold">
                            {authorization.appName || authorization.deviceModel}
                            {authorization.current && (
                              <span className="rounded-full bg-[#9cff38]/10 px-1.5 py-0.5 text-[7px] uppercase text-[#9cff38]">
                                Current
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-[8px] text-[#60706b]">
                            {[
                              authorization.deviceModel,
                              authorization.platform,
                              authorization.systemVersion,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="mt-1 block truncate text-[8px] text-[#53615d]">
                            {[
                              authorization.country,
                              authorization.region,
                              authorization.ip,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {!authorization.current && (
                          <button
                            type="button"
                            onClick={() =>
                              void update("reset_authorization", {
                                hash: authorization.hash,
                              })
                            }
                            className="rounded-lg border border-red-500/20 p-2 text-red-300"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <SignalSelect
                    value={String(settings.authorizationTtlDays || 180)}
                    onChange={(value) =>
                      void update("authorization_ttl", { days: Number(value) })
                    }
                    searchable={false}
                    placeholder="Auto-terminate devices"
                    options={[30, 90, 180, 365].map((days) => ({
                      value: String(days),
                      label:
                        days === 365 ? "After 1 year" : `After ${days} days`,
                    }))}
                  />
                </div>
                {settings.authorizations.some(
                  (authorization) => !authorization.current,
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      void update("reset_other_authorizations", {})
                    }
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] py-2.5 text-[10px] font-semibold text-red-300"
                  >
                    <LogOut size={12} /> Terminate all other devices
                  </button>
                )}
              </section>
            </>
          )}
          {tab === "appearance" && (
            <section className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
              <h3 className="text-xs font-semibold">Conversation density</h3>
              <p className="mt-1 text-[9px] leading-4 text-[#60706b]">
                Stored independently for every browser profile. Signal Desk dark
                mode remains enforced.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["compact", "comfortable"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDensity(value)}
                    className={`rounded-xl border p-3 text-[10px] capitalize ${density === value ? "border-[#9cff38]/30 bg-[#9cff38]/10 text-[#9cff38]" : "border-white/[0.07] text-[#71807c]"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DrawerShell>
  );
}

function Toggle({
  label,
  on,
  icon: Icon,
  onChange,
}: {
  label: string;
  on: boolean;
  icon: typeof Bell;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/[0.05] p-3 text-left"
    >
      <Icon size={13} className={on ? "text-[#9cff38]" : "text-[#60706b]"} />
      <span className="flex-1 text-[10px] text-[#aebbb6]">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${on ? "bg-[#9cff38]" : "bg-[#27302c]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function ContactsDrawer({
  sessionId,
  onClose,
  onOpen,
  onManage,
  onError,
}: {
  sessionId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onManage: () => void;
  onError: (value: string) => void;
}) {
  const [contacts, setContacts] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void command<{ contacts: User[] }>(sessionId, "contacts")
      .then((data) => setContacts(data.result.contacts || []))
      .catch((reason) => onError(reason.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = contacts.filter((contact) =>
    `${contact.firstName || ""} ${contact.lastName || ""} ${contact.username || ""} ${contact.phone || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <DrawerShell title="Contacts" icon={Users} onClose={onClose}>
      <button
        type="button"
        onClick={onManage}
        className={`${PRIMARY} mb-3 w-full`}
      >
        <UserPlus size={13} /> Add or remove contacts
      </button>
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contacts"
          className={`${FIELD} pl-9`}
        />
      </div>
      <div className="mt-4 space-y-1">
        {filtered.map((contact) => {
          const name =
            [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
            contact.username ||
            contact.phone ||
            contact.id;
          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => onOpen(contact.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left hover:border-white/[0.07] hover:bg-white/[0.025]"
            >
              <Avatar label={name} small />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold">{name}</span>
                  {contact.isPremium && (
                    <Star
                      size={10}
                      fill="currentColor"
                      className="text-[#f4ca64]"
                    />
                  )}
                </span>
                <span className="mt-1 block truncate text-[8px] text-[#60706b]">
                  {contact.username
                    ? `@${contact.username}`
                    : contact.phone || contact.status}
                </span>
              </span>
            </button>
          );
        })}
        {!contacts.length && (
          <div className="flex h-52 items-center justify-center">
            <Loader2 size={18} className="animate-spin text-[#9cff38]" />
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

function ContactManagerDrawer({
  sessionId,
  onClose,
  onError,
}: {
  sessionId: string;
  onClose: () => void;
  onError: (value: string) => void;
}) {
  const [contacts, setContacts] = useState<User[]>([]);
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({
    userId: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  async function load() {
    const data = await command<{ contacts: User[] }>(sessionId, "contacts");
    setContacts(data.result.contacts || []);
  }
  useEffect(() => {
    const timer = window.setTimeout(
      () => void load().catch((reason) => onError(reason.message)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function add() {
    setBusy("add");
    try {
      const data = await command<{ contact: User }>(
        sessionId,
        "add_contact",
        form,
      );
      setContacts((current) => [
        data.result.contact,
        ...current.filter((item) => item.id !== data.result.contact.id),
      ]);
      setForm({ userId: "", firstName: "", lastName: "", phone: "" });
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Contact add failed");
    } finally {
      setBusy("");
    }
  }
  async function remove(contact: User) {
    setBusy(contact.id);
    try {
      await command(sessionId, "delete_contacts", { userIds: [contact.id] });
      setContacts((current) =>
        current.filter((item) => item.id !== contact.id),
      );
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Contact removal failed",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <DrawerShell title="Manage contacts" icon={UserPlus} onClose={onClose}>
      <section className="rounded-2xl border border-[#9cff38]/10 bg-[#9cff38]/[0.025] p-4">
        <h3 className="text-xs font-semibold">Add Telegram contact</h3>
        <p className="mt-1 text-[9px] leading-4 text-[#60706b]">
          Use a Telegram ID or username the account can resolve.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            value={form.userId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                userId: event.target.value.replace(/^@/, ""),
              }))
            }
            placeholder="ID or username"
            className={`${FIELD} col-span-2`}
          />
          <input
            value={form.firstName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                firstName: event.target.value,
              }))
            }
            placeholder="First name"
            className={FIELD}
          />
          <input
            value={form.lastName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                lastName: event.target.value,
              }))
            }
            placeholder="Last name"
            className={FIELD}
          />
          <input
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Phone (optional)"
            className={`${FIELD} col-span-2`}
          />
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={!form.userId.trim() || !form.firstName.trim() || !!busy}
          className={`${PRIMARY} mt-3 w-full`}
        >
          {busy === "add" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <UserPlus size={13} />
          )}{" "}
          Add contact
        </button>
      </section>
      <div className="mt-4 space-y-1">
        <p className="mb-2 px-1 text-[8px] font-bold uppercase tracking-wider text-[#60706b]">
          Saved contacts · {contacts.length}
        </p>
        {contacts.map((contact) => {
          const name =
            [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
            contact.username ||
            contact.phone ||
            contact.id;
          return (
            <div
              key={contact.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#080c0b] p-2.5"
            >
              <Avatar label={name} small />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {name}
                </span>
                <span className="mt-1 block truncate text-[8px] text-[#60706b]">
                  {contact.username
                    ? `@${contact.username}`
                    : contact.phone || contact.id}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void remove(contact)}
                disabled={!!busy}
                title="Remove contact"
                className="rounded-lg border border-red-500/15 p-2 text-red-300"
              >
                {busy === contact.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UserMinus size={12} />
                )}
              </button>
            </div>
          );
        })}
        {!contacts.length && !busy && (
          <p className="py-10 text-center text-[10px] text-[#60706b]">
            No saved contacts.
          </p>
        )}
      </div>
    </DrawerShell>
  );
}

function ManageChatDrawer({
  sessionId,
  chat,
  onClose,
  onChatChanged,
  onError,
}: {
  sessionId: string;
  chat: Chat;
  onClose: () => void;
  onChatChanged: (chat: Chat) => void;
  onError: (value: string) => void;
}) {
  const isUser = ["private", "bot"].includes(chat.type);
  const [busy, setBusy] = useState("");
  const [muted, setMuted] = useState(false);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [commonChats, setCommonChats] = useState<Chat[]>([]);
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState(chat.title);
  const [bio, setBio] = useState(chat.bio || "");

  async function loadMembers() {
    const data = await command<{ members: ChatMember[] }>(
      sessionId,
      "chat_members",
      {
        chatId: chat.id,
        query,
        limit: 100,
        filter: "search",
      },
    );
    setMembers(data.result.members || []);
  }

  async function load() {
    const notification = await command<{ notification: { muted: boolean } }>(
      sessionId,
      "peer_notify",
      { chatId: chat.id },
    );
    setMuted(notification.result.notification.muted);
    if (isUser) {
      const data = await command<{ chats: Chat[] }>(sessionId, "common_chats", {
        userId: chat.id,
        limit: 100,
      });
      setCommonChats(data.result.chats || []);
    } else {
      await loadMembers();
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(
      () => void load().catch((reason) => onError(reason.message)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(kind: string, payload: Record<string, unknown> = {}) {
    setBusy(kind);
    try {
      const data = await command<{
        chat?: Chat;
        notification?: { muted: boolean };
      }>(sessionId, kind, { chatId: chat.id, ...payload }, 180_000);
      if (data.result.chat) onChatChanged(data.result.chat);
      if (data.result.notification) setMuted(data.result.notification.muted);
      if (
        ["add_chat_member", "remove_chat_member", "set_chat_admin"].includes(
          kind,
        )
      )
        await loadMembers();
      if (kind === "add_chat_member") setMemberId("");
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Telegram chat update failed",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <DrawerShell
      title={isUser ? "Peer controls" : "Members and administration"}
      icon={Users}
      onClose={onClose}
    >
      <section className="rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
        <div className="flex items-center gap-3">
          <Avatar label={chat.title} small />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">
              {chat.title}
            </span>
            <span className="mt-1 block text-[8px] text-[#60706b]">
              {chat.membersCount
                ? `${chat.membersCount.toLocaleString()} members`
                : chat.type}
            </span>
          </span>
        </div>
        <Toggle
          label="Conversation notifications"
          on={!muted}
          icon={muted ? VolumeX : Volume2}
          onChange={(enabled) => void run("peer_notify", { muted: !enabled })}
        />
      </section>
      {isUser ? (
        <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
          <h3 className="text-xs font-semibold">Groups in common</h3>
          <p className="mt-1 text-[9px] text-[#60706b]">
            {commonChats.length} shared conversations
          </p>
          <div className="mt-3 space-y-1">
            {commonChats.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] p-2.5"
              >
                <Avatar label={item.title} small />
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">
                  {item.title}
                </span>
                <span className="text-[8px] text-[#60706b]">
                  {item.membersCount?.toLocaleString()}
                </span>
              </div>
            ))}
            {!commonChats.length && (
              <p className="py-6 text-center text-[9px] text-[#60706b]">
                No common chats found.
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
            <h3 className="text-xs font-semibold">Group identity</h3>
            <div className="mt-3 space-y-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 128))}
                className={FIELD}
              />
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 255))}
                rows={3}
                placeholder="Group description"
                className={`${FIELD} resize-none`}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void run("update_chat", { title, bio })}
                  disabled={!title.trim() || !!busy}
                  className={PRIMARY}
                >
                  {busy === "update_chat" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}{" "}
                  Save
                </button>
                <label className={`${BUTTON} cursor-pointer`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const form = new FormData();
                      form.append("file", file);
                      try {
                        setBusy("photo");
                        const uploaded = await request<{ mediaPath: string }>(
                          "/api/validator/telegram/client/upload",
                          { method: "POST", body: form },
                        );
                        await run("set_chat_photo", {
                          mediaPath: uploaded.mediaPath,
                        });
                      } catch (reason) {
                        onError(
                          reason instanceof Error
                            ? reason.message
                            : "Photo update failed",
                        );
                      } finally {
                        setBusy("");
                        event.currentTarget.value = "";
                      }
                    }}
                  />
                  <ImageIcon size={12} /> Photo
                </label>
              </div>
            </div>
          </section>
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#080c0b] p-4">
            <h3 className="text-xs font-semibold">Add member</h3>
            <div className="mt-3 flex gap-2">
              <input
                value={memberId}
                onChange={(event) =>
                  setMemberId(event.target.value.replace(/^@/, ""))
                }
                placeholder="Telegram ID or username"
                className={FIELD}
              />
              <button
                type="button"
                onClick={() =>
                  void run("add_chat_member", { userId: memberId })
                }
                disabled={!memberId.trim() || !!busy}
                className={PRIMARY}
              >
                <UserPlus size={13} />
              </button>
            </div>
          </section>
          <section className="mt-4">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#60706b]"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      void loadMembers().catch((reason) =>
                        onError(reason.message),
                      );
                  }}
                  placeholder="Search members"
                  className={`${FIELD} pl-8`}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  void loadMembers().catch((reason) => onError(reason.message))
                }
                className={BUTTON}
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="mt-3 space-y-1">
              {members.map((member) => {
                const user = member.user;
                if (!user) return null;
                const name =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  user.username ||
                  user.id;
                const admin = ["owner", "administrator"].includes(
                  member.status,
                );
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#080c0b] p-2.5"
                  >
                    <Avatar label={name} small />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold">
                        {name}
                      </span>
                      <span className="mt-1 block text-[7px] uppercase tracking-wider text-[#60706b]">
                        {member.customTitle || member.status}
                      </span>
                    </span>
                    {member.status !== "owner" && (
                      <>
                        <button
                          type="button"
                          title={
                            admin
                              ? "Remove administrator"
                              : "Promote administrator"
                          }
                          onClick={() =>
                            void run("set_chat_admin", {
                              userId: user.id,
                              admin: !admin,
                            })
                          }
                          disabled={!!busy}
                          className="rounded-lg border border-white/10 p-2 text-[#9cff38]"
                        >
                          <ShieldCheck size={11} />
                        </button>
                        <button
                          type="button"
                          title="Remove member"
                          onClick={() =>
                            void run("remove_chat_member", {
                              userId: user.id,
                              ban: false,
                            })
                          }
                          disabled={!!busy}
                          className="rounded-lg border border-red-500/15 p-2 text-red-300"
                        >
                          <UserMinus size={11} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {!members.length && (
                <p className="py-10 text-center text-[9px] text-[#60706b]">
                  No members returned.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </DrawerShell>
  );
}

function ProfileDrawer({
  session,
  me,
  setMe,
  onClose,
  onError,
}: {
  session: Session;
  me: User | null;
  setMe: (value: User) => void;
  onClose: () => void;
  onError: (value: string) => void;
}) {
  const [firstName, setFirstName] = useState(me?.firstName || "");
  const [lastName, setLastName] = useState(me?.lastName || "");
  const [username, setUsername] = useState(me?.username || "");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState("");
  async function save() {
    setBusy("save");
    try {
      const data = await command<{ me: User }>(session.id, "update_profile", {
        firstName,
        lastName,
        bio,
      });
      if (username !== (me?.username || "")) {
        const userData = await command<{ me: User }>(
          session.id,
          "set_username",
          { username },
        );
        setMe(userData.result.me);
      } else setMe(data.result.me);
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Profile update failed",
      );
    } finally {
      setBusy("");
    }
  }
  async function photo(file?: globalThis.File) {
    if (!file) return;
    setBusy("photo");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await request<{ mediaPath: string }>(
        "/api/validator/telegram/client/upload",
        { method: "POST", body: form },
      );
      await command(
        session.id,
        "set_profile_photo",
        { mediaPath: uploaded.mediaPath },
        180_000,
      );
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Photo update failed");
    } finally {
      setBusy("");
    }
  }
  const name = me
    ? [me.firstName, me.lastName].filter(Boolean).join(" ") ||
      me.username ||
      session.label
    : session.label;
  return (
    <DrawerShell
      title="My Telegram profile"
      icon={CircleUserRound}
      onClose={onClose}
    >
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-[#080c0b] p-5">
        <Avatar label={name} image={session.avatarUrl} />{" "}
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
          {name}
          {(me?.isPremium || session.isPremium) && <PremiumMark />}
        </div>
        <p className="mt-1 text-[9px] text-[#60706b]">
          {me?.phone || session.phone}
        </p>
        <label className={`${BUTTON} mt-4 cursor-pointer`}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void photo(event.target.files?.[0])}
          />
          <ImageIcon size={12} /> Change profile photo
        </label>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
          First name
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={`${FIELD} mt-2`}
          />
        </label>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
          Last name
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={`${FIELD} mt-2`}
          />
        </label>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
          Username
          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value.replace(/^@/, ""))
            }
            className={`${FIELD} mt-2`}
          />
        </label>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-[#60706b]">
          Bio
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 70))}
            rows={3}
            className={`${FIELD} mt-2 resize-none`}
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!firstName.trim() || !!busy}
          className={`${PRIMARY} w-full`}
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}{" "}
          Save profile
        </button>
      </div>
    </DrawerShell>
  );
}

function ChatDrawer({
  sessionId,
  chat,
  onClose,
  onChanged,
  onError,
}: {
  sessionId: string;
  chat: Chat;
  onClose: () => void;
  onChanged: (action: string) => void;
  onError: (value: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  async function run(kind: string, payload: Record<string, unknown> = {}) {
    setBusy(kind);
    try {
      await command(sessionId, kind, { chatId: chat.id, ...payload }, 180_000);
      onChanged(kind);
      if (kind !== "clear_chat") onClose();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Chat action failed");
    } finally {
      setBusy("");
      setConfirm("");
    }
  }
  const user = ["private", "bot"].includes(chat.type);
  return (
    <DrawerShell
      title="Conversation details"
      icon={CircleUserRound}
      onClose={onClose}
    >
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-[#080c0b] p-5">
        <Avatar label={chat.title} />
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
          {chat.title}
          {chat.isVerified && (
            <CheckCircle2 size={12} className="text-[#65e6ff]" />
          )}
        </div>
        <p className="mt-1 text-[9px] text-[#60706b]">
          {chat.username
            ? `@${chat.username}`
            : chat.membersCount
              ? `${chat.membersCount.toLocaleString()} members`
              : chat.type}
        </p>
        {chat.bio && (
          <p className="mt-3 text-center text-[10px] leading-5 text-[#82908c]">
            {chat.bio}
          </p>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void run("archive_chat")}
          className={BUTTON}
        >
          <Archive size={13} /> Archive
        </button>
        <button
          type="button"
          onClick={() => void run("unarchive_chat")}
          className={BUTTON}
        >
          <ArrowDownToLine size={13} /> Unarchive
        </button>
        {user && (
          <>
            <button
              type="button"
              onClick={() => void run("block_user", { userId: chat.id })}
              className={BUTTON}
            >
              <Shield size={13} /> Block
            </button>
            <button
              type="button"
              onClick={() => void run("unblock_user", { userId: chat.id })}
              className={BUTTON}
            >
              <ShieldCheck size={13} /> Unblock
            </button>
          </>
        )}
      </div>
      <section className="mt-5 rounded-2xl border border-red-500/15 bg-red-500/[0.035] p-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-red-200">
          <Trash2 size={13} /> Destructive actions
        </h3>
        <p className="mt-2 text-[9px] leading-4 text-[#8a6c6c]">
          History deletion is immediate. Telegram decides whether both-side
          deletion is permitted.
        </p>
        <div className="mt-3 space-y-2">
          {confirm === "clear" ? (
            <ConfirmRow
              busy={!!busy}
              onCancel={() => setConfirm("")}
              onConfirm={() => void run("clear_chat", { revoke: false })}
              label="Clear history for me"
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("clear")}
              className="flex w-full items-center gap-2 rounded-xl border border-red-500/15 p-3 text-[10px] text-red-300"
            >
              <Trash2 size={12} /> Clear chat history
            </button>
          )}
          {confirm === "both" ? (
            <ConfirmRow
              busy={!!busy}
              onCancel={() => setConfirm("")}
              onConfirm={() => void run("clear_chat", { revoke: true })}
              label="Delete for both sides"
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("both")}
              className="flex w-full items-center gap-2 rounded-xl border border-red-500/15 p-3 text-[10px] text-red-300"
            >
              <Trash2 size={12} /> Delete for both sides
            </button>
          )}
          {!user &&
            (confirm === "leave" ? (
              <ConfirmRow
                busy={!!busy}
                onCancel={() => setConfirm("")}
                onConfirm={() => void run("leave_chat")}
                label="Leave this chat"
              />
            ) : (
              <button
                type="button"
                onClick={() => setConfirm("leave")}
                className="flex w-full items-center gap-2 rounded-xl border border-red-500/15 p-3 text-[10px] text-red-300"
              >
                <LogOut size={12} /> Leave group or channel
              </button>
            ))}
        </div>
      </section>
    </DrawerShell>
  );
}

function ConfirmRow({
  busy,
  label,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
      <p className="text-[9px] text-red-200">Confirm: {label}?</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} className={BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-xl bg-red-300 px-3 py-2 text-[9px] font-bold text-[#230808]"
        >
          {busy ? "Working" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

function ForwardModal({
  dialogs,
  message,
  busy,
  onClose,
  onForward,
}: {
  dialogs: Dialog[];
  message: Message;
  busy: boolean;
  onClose: () => void;
  onForward: (chatId: string) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="validator-modal-in flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d100e]"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] p-4">
          <Forward size={15} className="text-[#9cff38]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Forward message</h3>
            <p className="mt-1 truncate text-[9px] text-[#60706b]">
              {message.text || `[${message.media?.kind || "media"}]`}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destination"
            className={FIELD}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 pt-0">
          {dialogs
            .filter((dialog) =>
              dialog.chat.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((dialog) => (
              <button
                key={dialog.chat.id}
                type="button"
                disabled={busy}
                onClick={() => onForward(dialog.chat.id)}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/[0.04]"
              >
                <Avatar label={dialog.chat.title} small />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {dialog.chat.title}
                </span>
                {busy && <Loader2 size={12} className="animate-spin" />}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
