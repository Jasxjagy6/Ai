"use client";

import { useDeferredValue, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  CalendarDays,
  Database,
  FileText,
  LayoutDashboard,
  Gift,
  History,
  KeyRound,
  Layers3,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  Radar,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  UserCog,
} from "lucide-react";

export type GuideDestination =
  | "updates"
  | "lists"
  | "history"
  | "sessions"
  | "ai-chatter"
  | "dashboard"
  | "messaging"
  | "reports"
  | "credits"
  | "account-settings"
  | "communication-settings"
  | "affiliates";

type Access = "all" | "validator" | "workspace" | "messaging" | "ai";
type GuideChapter = {
  id: string;
  destination: GuideDestination;
  title: string;
  kicker: string;
  summary: string;
  icon: React.ElementType;
  accent: string;
  access: Access;
  prerequisites: string[];
  steps: Array<{ title: string; detail: string }>;
  controls: Array<{ name: string; detail: string }>;
  results: string[];
  warnings: string[];
  visual: {
    eyebrow: string;
    title: string;
    metric: string;
    metricLabel: string;
    rows: Array<{ label: string; value: string; tone?: "good" | "warn" | "info" }>;
  };
};

const CHAPTERS: GuideChapter[] = [
  {
    id: "updates",
    destination: "updates",
    title: "What's New",
    kicker: "Release feed",
    summary: "Read product releases, safety changes, operating notices, and other updates published by the Signal Desk team.",
    icon: Bell,
    accent: "#b8ff4b",
    access: "all",
    prerequisites: ["A signed-in Signal Desk workspace."],
    steps: [
      { title: "Open What's New", detail: "Select the first sidebar item. The newest published notice appears first." },
      { title: "Check the label and date", detail: "Each card includes a release tag and publication date so you can separate product changes from safety or service notices." },
      { title: "Read the complete note", detail: "Line breaks and longer instructions are preserved inside the update card." },
    ],
    controls: [
      { name: "Release tag", detail: "Identifies the type of announcement." },
      { name: "Published date", detail: "Shows when the change was released." },
      { name: "Update card", detail: "Contains the title and complete operator note." },
    ],
    results: ["A chronological record of currently published product information."],
    warnings: ["This is an information feed. It does not change workspace settings."],
    visual: {
      eyebrow: "Signal Desk newsroom",
      title: "News and releases",
      metric: "NEW",
      metricLabel: "operator notices",
      rows: [
        { label: "Safety update", value: "Published Jul 25", tone: "warn" },
        { label: "Messaging release", value: "Feature details", tone: "good" },
        { label: "Service notice", value: "Read full note", tone: "info" },
      ],
    },
  },
  {
    id: "validator",
    destination: "lists",
    title: "Validator",
    kicker: "Public username checks",
    summary: "Turn an imported list into a clean list of confirmed public Telegram usernames without connecting a Telegram account.",
    icon: Radar,
    accent: "#b8ff4b",
    access: "validator",
    prerequisites: [
      "Validator access enabled on the current key.",
      "A non-profile source list containing public usernames or t.me user links.",
      "An active Signal Desk subscription.",
    ],
    steps: [
      { title: "Prepare the source", detail: "Import a Usernames list in Lists. Normalize mixed files first when they contain links, IDs, phones, or inconsistent columns." },
      { title: "Choose the source and output", detail: "Open Lists, choose Start validating on the source list, then name the clean result list. The result list is created when the durable run starts." },
      { title: "Choose network routing", detail: "Keep Use proxies enabled to test up to three working public proxies. Turn it off to use the validator server IP directly." },
      { title: "Launch and monitor", detail: "The list shows Running validation while the job is active. Select Inspect to open the live panel, which updates every 1.5 seconds and stores every state." },
      { title: "Export or stop safely", detail: "Download CSV, JSON, or TXT while results are arriving. Safe stop preserves already confirmed usernames in the output list." },
    ],
    controls: [
      { name: "Source list", detail: "Accepts user-oriented lists, including a previous validated output when you want to check it again. Profile lists are excluded." },
      { name: "Result list name", detail: "Names the new list that receives confirmed public profiles." },
      { name: "Use proxies", detail: "Routes public web-preview requests through tested public proxies when available." },
      { name: "Live result stream", detail: "Shows recent valid, invalid, and request-error outcomes with the resolved display name or error code." },
      { name: "Run metrics", detail: "Separates valid, not found, request errors, ignored rows, duplicates, requests, passes, and remaining usernames." },
    ],
    results: [
      "Confirmed usernames are written into a normal list with source type Validated output.",
      "The complete run remains available in Run History.",
      "The run can make multiple passes, up to the configured six-pass limit, to retry recoverable failures.",
    ],
    warnings: [
      "Only usernames with 5-32 characters, a leading letter, and letters, digits, or underscores are requested.",
      "Telegram IDs, phone numbers, spaced names, punctuation, invalid handles, and duplicates are ignored before billing requests begin.",
      "A single validation run supports at most 200,000 source rows.",
      "Validation uses public t.me pages. It does not DM users, import contacts, join groups, or use saved Telegram sessions.",
    ],
    visual: {
      eyebrow: "Validation run",
      title: "Public username signal",
      metric: "73%",
      metricLabel: "pass progress",
      rows: [
        { label: "@confirmed_user", value: "VALID", tone: "good" },
        { label: "@missing_user", value: "NOT FOUND", tone: "warn" },
        { label: "@retry_later", value: "RETRY", tone: "info" },
      ],
    },
  },
  {
    id: "lists",
    destination: "lists",
    title: "Lists",
    kicker: "Data workspace",
    summary: "Import, inspect, clean, combine, edit, and export the data used by validation, messaging, and profile-list workflows.",
    icon: Layers3,
    accent: "#40d6c2",
    access: "workspace",
    prerequisites: ["Validator or Messaging access for the workspace."],
    steps: [
      { title: "Import a list", detail: "Choose Usernames for Telegram identities or Profiles for names, usernames, bios, and account-profile rows. Upload CSV, JSON, TXT, TSV, or semicolon-delimited data." },
      { title: "Inspect parsing", detail: "Open the list to review username, Telegram ID, name, phone, row statistics, and pagination. Common header names are detected automatically." },
      { title: "Clean the data", detail: "Normalize to canonical Telegram fields, then deduplicate by Telegram ID, lowercase username, or phone number." },
      { title: "Edit when needed", detail: "Quick Add accepts one username, t.me link, Telegram ID, or +phone per line. Select rows to remove only those entries." },
      { title: "Validate, merge, or export", detail: "Start validation directly from an eligible username list. Select at least two lists to merge them, or export any list as CSV, JSON, or TXT." },
    ],
    controls: [
      { name: "List type", detail: "Usernames are used for validation and outreach. Profiles preserve name and bio fields for Account Settings profile-list deployment." },
      { name: "Start validating", detail: "Opens the Signal Desk launch panel for that list. Active validation status and its live inspector remain attached to the source list." },
      { name: "Search", detail: "Filters the workspace by list name, source, or type; the detail view searches identities inside one list." },
      { name: "Normalize", detail: "Converts supported t.me links and common columns into canonical username, ID, phone, name, access hash, and bio values." },
      { name: "Deduplicate", detail: "Removes repeated canonical identities without changing unrelated lists." },
      { name: "Merge", detail: "Creates a new list; source lists remain intact." },
      { name: "Delete", detail: "Permanently removes the selected list and its rows. Existing campaign reports remain available." },
    ],
    results: [
      "Imports report added and duplicate counts.",
      "List details show all-row, username, Telegram-ID, and phone coverage.",
      "Exports contain all rows, not only the currently visible page.",
    ],
    warnings: [
      "The import interface supports files up to 100 MB and 500,000 valid rows.",
      "Telegram access hashes are stored as signed 64-bit integers and are only retained with a Telegram ID.",
      "Deleting a list is permanent. Merge first if you need a preserved combined copy.",
    ],
    visual: {
      eyebrow: "Data workspace",
      title: "Lists, cleaned and ready",
      metric: "500K",
      metricLabel: "max import rows",
      rows: [
        { label: "July usernames", value: "12,840 rows", tone: "info" },
        { label: "Valid output", value: "8,311 rows", tone: "good" },
        { label: "Profile source", value: "240 rows", tone: "warn" },
      ],
    },
  },
  {
    id: "history",
    destination: "history",
    title: "Run History",
    kicker: "Validation ledger",
    summary: "Return to every durable validator run, reopen its full live view, and download confirmed output later.",
    icon: History,
    accent: "#d8b7ff",
    access: "validator",
    prerequisites: ["Validator access. A run appears here as soon as it is created."],
    steps: [
      { title: "Locate the run", detail: "Use the source name, output name, status, creation time, valid count, invalid count, and request count to identify it." },
      { title: "Open full details", detail: "Open launches the validation inspector from Lists with progress, passes, stream entries, errors, routing, and safe-stop state." },
      { title: "Download output", detail: "CSV and JSON shortcuts are available as soon as a result list exists." },
      { title: "Refresh", detail: "Reload the ledger to fetch newly created or recently completed runs." },
    ],
    controls: [
      { name: "Status pill", detail: "Shows pending, running, completed, failed, or cancelled state." },
      { name: "Valid / Invalid", detail: "Displays the durable outcome counters saved for the run." },
      { name: "Progress / Requests", detail: "Active runs show pass progress; finished runs show total public requests." },
      { name: "Open", detail: "Loads the complete run snapshot and switches to Validator." },
    ],
    results: ["A durable audit trail remains after closing the page or signing out."],
    warnings: ["Exports contain confirmed output only; invalid and request-error details remain in the run view."],
    visual: {
      eyebrow: "Durable run ledger",
      title: "Every run, still here",
      metric: "30",
      metricLabel: "recent runs loaded",
      rows: [
        { label: "July source", value: "COMPLETED", tone: "good" },
        { label: "Retry batch", value: "RUNNING 42%", tone: "info" },
        { label: "Stopped test", value: "CANCELLED", tone: "warn" },
      ],
    },
  },
  {
    id: "sessions",
    destination: "sessions",
    title: "Telegram Sessions",
    kicker: "Account vault and safety",
    summary: "Connect or import Telegram accounts, organize fleets, check account health, and control warmup before messaging or AI use.",
    icon: Smartphone,
    accent: "#65e6ff",
    access: "messaging",
    prerequisites: [
      "Messaging access and available session allowance.",
      "A Telegram API ID and API hash from my.telegram.org.",
      "For phone login: access to the Telegram confirmation code and 2FA password when enabled.",
    ],
    steps: [
      { title: "Save Telegram API credentials", detail: "Enter the API ID and API hash. The hash is encrypted at rest and is never returned by the API." },
      { title: "Add accounts", detail: "Import Hydrogram strings, Pyrogram/Hydrogram SQLite, Telethon SQLite, JSON, TXT, or bounded ZIP files; or connect by phone with an optional SOCKS proxy." },
      { title: "Complete login", detail: "Enter the Telegram code, then the 2FA password if requested. The durable login flow survives page refreshes while active." },
      { title: "Run safety checks", detail: "Select accounts for a bulk SpamBot check, warmup action, or warmup-policy update. The same actions are available per session." },
      { title: "Build fleets", detail: "Save named groups of active sessions and reuse them during campaign or Account Settings target selection." },
      { title: "Read the behavior log", detail: "Review warmup, pacing, SpamBot, flood, cooldown, and safety events with account and error context." },
    ],
    controls: [
      { name: "Import sessions", detail: "Queues worker validation for supported session files. The total request is limited to 25 MB." },
      { name: "Connect by phone", detail: "Creates encrypted session material after code and optional 2FA completion." },
      { name: "SpamBot check", detail: "Asks Telegram's SpamBot for account restriction state and updates eligibility." },
      { name: "Safe warmup", detail: "Read-oriented background behavior with a 14-day ramp." },
      { name: "Standard warmup", detail: "Human-like actions with a faster 7-day ramp." },
      { name: "Warmup off", detail: "Stops background actions while retaining the conservative 14-day sending ramp." },
      { name: "Named fleets", detail: "Reusable account selections for multi-account operations." },
    ],
    results: [
      "The inventory shows login state, identity, proxy state, sent messages, replies, spam status, risk, daily ramp, and cooldowns.",
      "Only the dedicated Hydrogram worker opens Telegram connections.",
    ],
    warnings: [
      "Mass messaging requires an active logged-in session, a clean SpamBot check from the last seven days, risk below 70, no health cooldown, and daily warmup capacity.",
      "Deleting a session removes encrypted session material and fleet membership. Existing reports retain a deleted-session marker.",
      "Session import, SpamBot checks, and manual warmup are included while the subscription is active.",
    ],
    visual: {
      eyebrow: "MTProto account vault",
      title: "Sessions, sealed and ready",
      metric: "8 / 10",
      metricLabel: "session allowance",
      rows: [
        { label: "Sales account 1", value: "MASS DM READY", tone: "good" },
        { label: "Community account", value: "WARMUP DAY 4", tone: "info" },
        { label: "Backup account", value: "SPAM CHECK DUE", tone: "warn" },
      ],
    },
  },
  {
    id: "ai-chatter",
    destination: "ai-chatter",
    title: "AI Chatter",
    kicker: "Personal DM automation",
    summary: "Listen for personal Telegram DMs, generate replies through CapitalBot or CupidBot, and retain isolated conversation memory and provider logs.",
    icon: MessageCircleMore,
    accent: "#b8ff4b",
    access: "ai",
    prerequisites: [
      "AI Chatter plan access, Messaging access, and at least one active non-frozen Telegram session.",
      "A validated CapitalBot license key or CupidBot access token.",
      "For CapitalBot, a selected model and preset from the validated provider catalog.",
    ],
    steps: [
      { title: "Configure while AI is off", detail: "Select the active provider, validate and encrypt its key, and choose the CapitalBot model and preset when applicable." },
      { title: "Choose CapitalBot language", detail: "Open the small settings button in the AI header. CapitalBot uses the saved fixed language with automatic detection disabled. CupidBot remains fixed to English." },
      { title: "Enable session listeners", detail: "Turn on only the Telegram accounts that should handle personal DMs. Enabling requests a one-time catch-up for recent pending chats." },
      { title: "Turn on the account switch", detail: "The account kill switch must be live for configured session listeners to connect and process jobs." },
      { title: "Inspect operations", detail: "Use overview metrics, listener heartbeat, conversation rows, and the queue ledger to verify runtime health." },
      { title: "Control one conversation", detail: "Inspect a peer to review exact memory and send logs, pause or resume AI for that chat, or permanently clear its memory." },
    ],
    controls: [
      { name: "Account kill switch", detail: "Stops or starts AI account-wide without deleting per-session configuration." },
      { name: "Active provider", detail: "Chooses CapitalBot or CupidBot for account-level responses." },
      { name: "Provider vault", detail: "Validates keys server-side and stores them with AES-GCM encryption." },
      { name: "Response language", detail: "Forces every CapitalBot reply into the saved language, including Italian, regardless of the user's input language." },
      { name: "Session listener", detail: "Starts one real-time personal-DM listener for an eligible Telegram session." },
      { name: "Conversation inspector", detail: "Shows incoming and outgoing memory, Telegram message IDs, provider result, category, follow-up marker, and send error." },
    ],
    results: [
      "Memory is isolated by workspace account, Telegram session, and peer.",
      "CapitalBot receives at most the most recent 55 memory messages per request.",
      "The listener heartbeat and runtime state distinguish configured sessions from actually connected listeners.",
      "Every provider attempt and Telegram send outcome is written to the ledger.",
    ],
    warnings: [
      "AI Chatter handles personal DMs only. Groups, channels, bots, self-messages, and Telegram service account 777000 are excluded.",
      "Turn AI Chatter off before changing provider, API key, CapitalBot model, or preset. The API enforces this even if the UI is bypassed.",
      "The one-time catch-up is bounded to recent conversations and does not scan unlimited history.",
      "Clearing conversation memory cannot be undone.",
    ],
    visual: {
      eyebrow: "AI operations",
      title: "Conversations that run themselves",
      metric: "LIVE",
      metricLabel: "listener heartbeat",
      rows: [
        { label: "CapitalBot / Italian", value: "ACTIVE", tone: "good" },
        { label: "Peer 552013", value: "REPLY SENT", tone: "info" },
        { label: "Peer 882104", value: "CHAT PAUSED", tone: "warn" },
      ],
    },
  },
  {
    id: "dashboard",
    destination: "dashboard",
    title: "Dashboard",
    kicker: "Workspace overview",
    summary: "Review sessions, validator results, message runs, recent jobs, delivery trends, replies, and workspace performance in one place.",
    icon: LayoutDashboard,
    accent: "#6cebd9",
    access: "all",
    prerequisites: ["A signed-in workspace. Empty workspaces show zero-state analytics."],
    steps: [
      { title: "Read account health", detail: "Total sessions, active sessions, successful results, and delivery rate summarize workspace health." },
      { title: "Review message activity", detail: "The 30-day graph combines message runs, sent messages, and replies." },
      { title: "Compare outcomes", detail: "Validator result cards show valid and invalid totals alongside message delivery results." },
      { title: "Check recent jobs", detail: "The newest validator, messaging, and account-setting jobs share one status feed." },
    ],
    controls: [
      { name: "Session metrics", detail: "Total, active, clean, and inactive Telegram account counts." },
      { name: "Message activity", detail: "Campaign runs, deliveries, failures, and replies grouped by day." },
      { name: "Result outcomes", detail: "Cumulative validator and messaging success totals." },
      { name: "Recent jobs", detail: "A combined health feed for all major workspace operations." },
    ],
    results: ["Dashboard analytics are read-only and update from durable session, validation, campaign, and account-setting records."],
    warnings: ["Recent activity reflects jobs saved in this workspace; Telegram-side activity outside Signal Desk is not counted."],
    visual: {
      eyebrow: "Signal Desk analytics",
      title: "Workspace at a glance",
      metric: "98%",
      metricLabel: "delivery success",
      rows: [
        { label: "Valid usernames", value: "8,311", tone: "good" },
        { label: "Invalid usernames", value: "4,102", tone: "warn" },
        { label: "Public requests", value: "13,024", tone: "info" },
      ],
    },
  },
  {
    id: "messaging",
    destination: "messaging",
    title: "Messaging",
    kicker: "Durable Telegram delivery",
    summary: "Launch user campaigns, single direct messages, group broadcasts, every-account fan-out, test sends, and recurring schedules.",
    icon: Send,
    accent: "#d8b7ff",
    access: "messaging",
    prerequisites: [
      "An active subscription and at least one eligible Telegram session.",
      "At least one active session that currently passes mass-DM safety checks.",
      "A message and at least one valid target from a list or manual input.",
    ],
    steps: [
      { title: "Choose a workflow", detail: "Use User campaigns, Direct message, Groups & channels, Every-account DM, or Schedules. Each workflow applies a different delivery contract." },
      { title: "Build the audience", detail: "For users, combine one source list with manual usernames, user t.me links, or Telegram IDs. Group jobs accept manual public handles, t.me links, invite links, or IDs." },
      { title: "Choose delivery and accounts", detail: "Pick a delivery mode and eligible sessions, or apply a named fleet. Direct message requires exactly one account and one recipient." },
      { title: "Set formatting and pacing", detail: "Choose plain text, Markdown, or HTML. Automatic pacing uses safety bands; manual pacing exposes delay, burst, and cooldown controls." },
      { title: "Estimate and test", detail: "Review the attempt estimate. Test One creates a normal one-attempt billable campaign with the current message and formatting." },
      { title: "Launch or schedule", detail: "A normal launch creates a durable campaign immediately. A schedule creates a new durable campaign and report on each run." },
    ],
    controls: [
      { name: "Balanced rotation", detail: "Assigns unique recipients across selected sessions in round-robin order." },
      { name: "Parallel shared queue", detail: "Shares unique recipients across the eligible account pool while workers process concurrently." },
      { name: "Parallel split quota", detail: "Assigns consecutive recipient blocks per account. Requested per-account quota is raised when needed to cover the full audience." },
      { name: "Sequential failover", detail: "Leaves recipients available to the ordered account pool so another eligible session can continue when one cannot send." },
      { name: "Every-account fan-out", detail: "Creates one attempt for every selected account and every target. User fan-out is limited to 50 unique users." },
      { name: "Track replies", detail: "For user messages, watches eligible replies for 24 hours and records a preview and Telegram message ID." },
      { name: "Schedules", detail: "Runs every five minutes or longer from the chosen first-run time. Existing schedules can be paused, resumed, or deleted." },
    ],
    results: [
      "Every attempt stores its target, assigned account, state, Telegram message ID, error, and optional reply evidence.",
      "Recent dispatches update every 1.5 seconds while work is pending or running.",
      "Reports remain available after cancellation, schedule deletion, page close, or session deletion.",
    ],
    warnings: [
      "Messages are limited to 4,096 characters. A campaign is limited to 200,000 attempts and 500 selected sessions.",
      "User fan-out rejects more than 50 unique targets without truncating the list.",
      "Group and channel workflows always use every-account fan-out and do not accept a source list.",
      "Manual and list targets are deduplicated before the final attempt count is reserved.",
      "Campaigns stop sending when the workspace subscription expires and can continue after renewal.",
    ],
    visual: {
      eyebrow: "Durable delivery desk",
      title: "Keep every attempt accountable",
      metric: "1,280",
      metricLabel: "estimated attempts",
      rows: [
        { label: "Ready accounts", value: "6", tone: "good" },
        { label: "Balanced rotation", value: "SELECTED", tone: "info" },
        { label: "Reply tracking", value: "24 HOURS", tone: "warn" },
      ],
    },
  },
  {
    id: "reports",
    destination: "reports",
    title: "Reports",
    kicker: "Campaign audit ledger",
    summary: "Inspect delivery and reply evidence for campaigns by date, sending account, and recipient, then export complete CSV records.",
    icon: FileText,
    accent: "#f4ca64",
    access: "messaging",
    prerequisites: ["Messaging access. Reports appear as soon as a campaign is created."],
    steps: [
      { title: "Choose a date range", detail: "Filter to 24 hours, 3 days, 7 days, 30 days, all time, or a custom start and end date." },
      { title: "Select a campaign", detail: "The left ledger lists up to 100 recent campaigns in the chosen range with sent, reply, status, and age context." },
      { title: "Read account totals", detail: "Per-session cards show assigned, sent, failed, state, and the latest session-level error." },
      { title: "Inspect recipients", detail: "The table shows target input, state, sending account, Telegram message ID, sent time, reply evidence, and error or preview." },
      { title: "Export", detail: "Export the selected campaign or all campaigns in the active date range." },
    ],
    controls: [
      { name: "Date presets", detail: "Apply a server-side created-at range to campaign loading and bulk export." },
      { name: "Campaign metrics", detail: "Attempts, sent, failed, replies, and processed percentage." },
      { name: "Reply status", detail: "Shows whether the 24-hour watcher is pending, tracking, completed, or failed." },
      { name: "Recipient rows", detail: "The interface loads the first 500 rows for speed; the campaign CSV includes every row." },
      { name: "Export all", detail: "Downloads campaigns covered by the selected date range." },
    ],
    results: [
      "Telegram message IDs and reply previews provide durable evidence for successful sends and responses.",
      "Campaign and account errors remain visible after the worker finishes.",
    ],
    warnings: ["A missing reply means no eligible reply was observed inside the configured tracking window; it does not prove the recipient never read the message."],
    visual: {
      eyebrow: "Message ledger",
      title: "Delivery, account by account",
      metric: "91%",
      metricLabel: "campaign progress",
      rows: [
        { label: "@target_one", value: "SENT / 42118", tone: "good" },
        { label: "@target_two", value: "REPLIED", tone: "info" },
        { label: "@target_three", value: "FLOOD WAIT", tone: "warn" },
      ],
    },
  },
  {
    id: "credits",
    destination: "credits",
    title: "Subscription",
    kicker: "Access and billing",
    summary: "Review the active subscription, expiry date, included access, and renewal options.",
    icon: CalendarDays,
    accent: "#b8ff4b",
    access: "all",
    prerequisites: ["A signed-in workspace. Renewals require completing the hosted payment flow."],
    steps: [
      { title: "Check remaining time", detail: "The subscription card shows whether access is active and how many days remain." },
      { title: "Review access", detail: "Confirm the subscription period, workspace email, expiry, and included all-feature access." },
      { title: "Renew or extend", detail: "Choose a period on the Buy page. Confirmed renewals extend from the current expiry when it is still in the future." },
      { title: "Keep the same key", detail: "The workspace access key remains linked across renewals unless an admin rotates it." },
    ],
    controls: [
      { name: "Subscription status", detail: "Shows active or expired access." },
      { name: "Current period", detail: "The latest subscription period attached to the workspace." },
      { name: "Expiry", detail: "The exact date and time when feature access pauses." },
      { name: "Access key", detail: "Shows the non-sensitive key prefix linked to the workspace." },
    ],
    results: ["Confirmed purchases and affiliate rewards extend the workspace subscription automatically."],
    warnings: [
      "An expired subscription keeps the workspace signed in for renewal, but operational APIs and workers remain locked.",
      "All periods include every feature and unlimited operational usage while active.",
    ],
    visual: {
      eyebrow: "Signal Desk subscription",
      title: "Workspace access",
      metric: "24 DAYS",
      metricLabel: "remaining",
      rows: [
        { label: "Included access", value: "ALL FEATURES", tone: "good" },
        { label: "Operational usage", value: "UNLIMITED", tone: "info" },
        { label: "Renewal", value: "EXTENDS TIME", tone: "warn" },
      ],
    },
  },
  {
    id: "account-settings",
    destination: "communication-settings",
    title: "Account Settings",
    kicker: "Profiles, photos, and stories",
    summary: "Apply deliberate profile edits, per-session photo assignments, imported profile lists, and Telegram stories through durable worker jobs.",
    icon: UserCog,
    accent: "#b8ff4b",
    access: "messaging",
    prerequisites: [
      "Messaging access and at least one active, logged-in Telegram session.",
      "For profile-list deployment, a Profile-type list imported in Lists.",
      "For stories, Telegram Premium and live story eligibility on each target account.",
    ],
    steps: [
      { title: "Choose targets", detail: "Pick individual active sessions or use a named session list. The same target picker is shared by Manual, Profile List, and Story tabs." },
      { title: "Use Manual for exact edits", detail: "Enable only the fields to change. Set first name, set or remove last name, username, bio, or profile photo, then queue one durable batch." },
      { title: "Assign different photos", detail: "Upload a photo, capture the current target selection into the per-session photo queue, change targets, and repeat before applying all groups." },
      { title: "Use an imported profile list", detail: "Choose profile fields, build a deterministic preview, inspect each assignment, then apply. Short lists cycle and reused usernames receive unique suffixes." },
      { title: "Compose a story", detail: "Upload media, add an optional caption and link, select privacy, duration, and pinning, then post to the current targets." },
      { title: "Monitor and cancel", detail: "Progress survives page close. A cancellation stops pending jobs; a session already being processed may finish first." },
    ],
    controls: [
      { name: "Set / Remove", detail: "Set writes the entered value. Remove clears supported optional fields. First name is set-only because Telegram requires it." },
      { name: "Remove all photos", detail: "Deletes the visible avatar and complete profile-photo history for every target." },
      { name: "Photo queue", detail: "Associates each uploaded image with the sessions selected at the moment Add Assignment is clicked." },
      { name: "Profile List preview", detail: "Maps imported rows to sessions in order and shows repeated rows, final unique usernames, and assigned profile photos before applying." },
      { name: "Story privacy", detail: "Choose Everyone, Contacts, or Close friends." },
      { name: "Story duration", detail: "Choose 6, 12, 24, or 48 hours and optionally keep the story pinned on the profile." },
      { name: "Batch progress", detail: "Shows processed, succeeded, failed, and skipped counts with per-session errors." },
    ],
    results: [
      "Profile and story work continues in the Hydrogram worker after the browser closes.",
      "Inactive or logged-out sessions are recorded as skipped instead of silently disappearing.",
      "Story history can be expanded to inspect the result for every session.",
    ],
    warnings: [
      "Manual profile photos must be JPG, PNG, or WebP and 5 MB or smaller.",
      "Story media must be JPG, PNG, WebP, MP4, WebM, or MOV and 50 MB or smaller.",
      "Usernames must follow Telegram's 5-32 character rules. Bios are limited to 70 characters; story captions are limited to 2,048.",
      "Remove All Profile Photos is irreversible.",
      "Story jobs can be skipped when an account lacks Premium or has reached Telegram's current story limit.",
    ],
    visual: {
      eyebrow: "Account operations",
      title: "Shape every profile",
      metric: "12 / 12",
      metricLabel: "jobs completed",
      rows: [
        { label: "Manual profile update", value: "COMPLETED", tone: "good" },
        { label: "Photo assignment", value: "RUNNING", tone: "info" },
        { label: "Story upload", value: "1 SKIPPED", tone: "warn" },
      ],
    },
  },
  {
    id: "affiliates",
    destination: "affiliates",
    title: "Affiliate Rewards",
    kicker: "Referral time",
    summary: "Share the workspace referral link and receive extra subscription days from confirmed subscriptions purchased by referred users.",
    icon: Gift,
    accent: "#b8ff4b",
    access: "all",
    prerequisites: ["A workspace referral code and a referred user who completes a qualifying payment."],
    steps: [
      { title: "Copy your link", detail: "Use the copy button beside the referral URL. The link carries your workspace referral code into the Buy flow." },
      { title: "Share it", detail: "The referred operator must enter through the tracked link before purchasing a subscription." },
      { title: "Receive rewards", detail: "After payment confirmation, the configured percentage of the purchased period is added as subscription days." },
      { title: "Audit earnings", detail: "Review invited-user count, earned days, masked referred email, rate, and date." },
    ],
    controls: [
      { name: "Referral link", detail: "Tracked Buy URL unique to this workspace." },
      { name: "Referral code", detail: "The identifier embedded in the referral link." },
      { name: "Reward metrics", detail: "Total referred users, earned subscription days, and reward rate." },
      { name: "Reward history", detail: "One row per confirmed qualifying payment and reward." },
    ],
    results: ["Affiliate days appear in Reward History and extend the subscription automatically."],
    warnings: ["The reward percentage is controlled by current workspace settings. Unconfirmed or failed payments do not produce rewards."],
    visual: {
      eyebrow: "Affiliate network",
      title: "Invite operators and earn",
      metric: "10%",
      metricLabel: "example reward rate",
      rows: [
        { label: "jo***@mail.com", value: "+30 days", tone: "good" },
        { label: "an***@mail.com", value: "+18 days", tone: "info" },
        { label: "Referral link", value: "COPIED", tone: "warn" },
      ],
    },
  },
];

const QUICK_STARTS = [
  { title: "Validate usernames", path: "Lists -> Start validating -> Run History", detail: "Import a user list, launch its public check from the list row, then export confirmed handles." },
  { title: "Send a campaign", path: "Sessions -> Messaging -> Reports", detail: "Connect safe accounts, launch delivery, then inspect every attempt and reply." },
  { title: "Automate DMs", path: "Sessions -> AI Chatter", detail: "Validate a provider, enable listeners, then turn on the account kill switch." },
  { title: "Manage profiles", path: "Sessions -> Account Settings", detail: "Pick active sessions and queue exact profile, photo, profile-list, or story changes." },
];

function canOpen(access: Access, account: { validatorAccess: boolean; messagingAccess: boolean; aiChatAccess: boolean }) {
  if (access === "all") return true;
  if (access === "validator") return account.validatorAccess;
  if (access === "workspace") return account.validatorAccess || account.messagingAccess;
  if (access === "ai") return account.messagingAccess && account.aiChatAccess;
  return account.messagingAccess;
}

function accessName(access: Access) {
  return {
    all: "Available to every workspace",
    validator: "Requires Validator access",
    workspace: "Requires Validator or Messaging access",
    messaging: "Requires Messaging access",
    ai: "Requires Messaging and AI Chatter access",
  }[access];
}

function GuideVisual({ chapter }: { chapter: GuideChapter }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#050b0a] shadow-[0_22px_70px_rgba(0,0,0,.28)]">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] bg-[#071111] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff7474]/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#f4ca64]/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#b8ff4b]/70" />
        <span className="ml-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#53615d]">Interface map / {chapter.title}</span>
      </div>
      <div className="grid min-h-56 sm:grid-cols-[1fr_145px]">
        <div className="border-b border-white/[0.07] p-4 sm:border-b-0 sm:border-r">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: chapter.accent }}>{chapter.visual.eyebrow}</p>
          <p className="mt-2 max-w-[260px] text-lg font-semibold leading-5 tracking-[-0.035em]">{chapter.visual.title}</p>
          <div className="mt-4 space-y-2">
            {chapter.visual.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0b1717] px-3 py-2.5">
                <span className={`h-2 w-2 rounded-full ${row.tone === "good" ? "bg-[#b8ff4b]" : row.tone === "warn" ? "bg-[#f4ca64]" : "bg-[#65e6ff]"}`} />
                <span className="min-w-0 flex-1 truncate text-[10px] text-[#aebbb6]">{row.label}</span>
                <span className="shrink-0 font-mono text-[8px] text-[#71807c]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between bg-[radial-gradient(circle_at_top,rgba(184,255,75,.06),transparent_68%)] p-4">
          <chapter.icon size={18} style={{ color: chapter.accent }} />
          <div>
            <p className="font-mono text-2xl font-semibold tracking-[-0.05em]">{chapter.visual.metric}</p>
            <p className="mt-1 text-[8px] uppercase leading-3 tracking-[0.14em] text-[#60706b]">{chapter.visual.metricLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideList({ title, icon: Icon, items, numbered = false }: { title: string; icon: React.ElementType; items: string[]; numbered?: boolean }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#71807c]"><Icon size={13} /> {title}</div>
      <div className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <div key={item} className="flex gap-2.5 text-[11px] leading-5 text-[#9aa8a3]">
            <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded ${numbered ? "bg-white/[0.05] font-mono text-[8px] text-[#b8ff4b]" : "text-[#b8ff4b]"}`}>
              {numbered ? index + 1 : <Check size={11} />}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ValidatorGuide({
  account,
  openFeature,
}: {
  account: { validatorAccess: boolean; messagingAccess: boolean; aiChatAccess: boolean };
  openFeature: (destination: GuideDestination) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState("start");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const visible = CHAPTERS.filter((chapter) => {
    if (!deferredSearch) return true;
    return [
      chapter.title,
      chapter.kicker,
      chapter.summary,
      ...chapter.prerequisites,
      ...chapter.steps.flatMap((step) => [step.title, step.detail]),
      ...chapter.controls.flatMap((control) => [control.name, control.detail]),
      ...chapter.results,
      ...chapter.warnings,
    ].join(" ").toLowerCase().includes(deferredSearch);
  });

  function jump(id: string) {
    setActiveId(id);
    document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <section id="guide-start" className="scroll-mt-6 overflow-hidden rounded-[30px] border border-[#b8ff4b]/20 bg-[radial-gradient(circle_at_84%_18%,rgba(184,255,75,.13),transparent_26%),radial-gradient(circle_at_62%_120%,rgba(101,230,255,.09),transparent_33%),#0b1717] p-5 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]"><BookOpen size={14} /> Signal Desk operator manual</div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">Every feature, from first input to final proof.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#899893]">Use this guide to prepare data, connect Telegram accounts, automate conversations, deliver campaigns, manage profiles, and understand the durable records created by every operation.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.13em] text-[#91a09b]">
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">{CHAPTERS.length} feature chapters</span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">Step-by-step workflows</span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">Limits and safety notes</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.09] bg-[#050b0a]/70 p-4 backdrop-blur-xl">
            <label className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#71807c]">Search the complete guide</label>
            <div className="relative mt-2">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try campaigns, access hash, stories..." className="w-full rounded-xl border border-white/10 bg-[#071111] py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-[#53615d] focus:border-[#b8ff4b]/50" />
            </div>
            <p className="mt-2 text-[9px] leading-4 text-[#53615d]">Searches steps, controls, outputs, prerequisites, limits, and warnings.</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_STARTS.map((item, index) => (
          <article key={item.title} className="rounded-2xl border border-white/[0.08] bg-[#0b1717] p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b8ff4b]/10 font-mono text-[10px] text-[#b8ff4b]">0{index + 1}</span>
            <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
            <p className="mt-1 font-mono text-[9px] text-[#65e6ff]">{item.path}</p>
            <p className="mt-2 text-[10px] leading-4 text-[#71807c]">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-2xl border border-[#65e6ff]/15 bg-[#65e6ff]/[0.035] p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex gap-3"><ShieldCheck size={17} className="shrink-0 text-[#65e6ff]" /><div><p className="text-xs font-semibold">Access locks</p><p className="mt-1 text-[10px] leading-4 text-[#71807c]">Operational tools lock when the subscription expires. Open Subscription or Buy to renew access.</p></div></div>
          <div className="flex gap-3"><Activity size={17} className="shrink-0 text-[#65e6ff]" /><div><p className="text-xs font-semibold">Durable work</p><p className="mt-1 text-[10px] leading-4 text-[#71807c]">Validator runs, campaigns, account changes, stories, and login flows are stored server-side instead of depending on the browser tab.</p></div></div>
          <div className="flex gap-3"><KeyRound size={17} className="shrink-0 text-[#65e6ff]" /><div><p className="text-xs font-semibold">Workspace controls</p><p className="mt-1 text-[10px] leading-4 text-[#71807c]">Subscription opens renewal options, Refresh reloads workspace data, Support opens Telegram help, and Lock signs out.</p></div></div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[230px_1fr]">
        <aside className="hidden xl:block">
          <div className="sticky top-5 max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#071111] p-2">
            <button onClick={() => jump("start")} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-semibold ${activeId === "start" ? "bg-[#b8ff4b]/10 text-[#dfffaa]" : "text-[#71807c] hover:text-white"}`}><BookOpen size={13} /> Start here</button>
            {CHAPTERS.map((chapter, index) => (
              <button key={chapter.id} onClick={() => jump(chapter.id)} className={`mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] transition ${activeId === chapter.id ? "bg-white/[0.06] text-white" : "text-[#71807c] hover:bg-white/[0.03] hover:text-white"}`}>
                <span className="w-5 font-mono text-[8px] text-[#53615d]">{String(index + 1).padStart(2, "0")}</span>
                <chapter.icon size={12} style={{ color: activeId === chapter.id ? chapter.accent : undefined }} />
                <span className="truncate">{chapter.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {visible.map((chapter, chapterIndex) => {
            const allowed = canOpen(chapter.access, account);
            return (
              <article key={chapter.id} id={`guide-${chapter.id}`} className="scroll-mt-5 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#0b1717]">
                <header className="border-b border-white/[0.07] p-5 sm:p-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-white/[0.025]" style={{ borderColor: `${chapter.accent}35`, color: chapter.accent }}><chapter.icon size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.17em]" style={{ color: chapter.accent }}><span>{String(chapterIndex + 1).padStart(2, "0")}</span><span className="h-px w-5 bg-current" /><span>{chapter.kicker}</span></div>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{chapter.title}</h3>
                      <p className="mt-2 max-w-3xl text-xs leading-6 text-[#81908c]">{chapter.summary}</p>
                    </div>
                    <button onClick={() => allowed && openFeature(chapter.destination)} disabled={!allowed} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45">
                      {allowed ? <ArrowRight size={14} /> : <LockKeyhole size={14} />}
                      {allowed ? "Open feature" : "Access locked"}
                    </button>
                  </div>
                  <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] ${allowed ? "border-[#b8ff4b]/15 bg-[#b8ff4b]/[0.035] text-[#9ebf75]" : "border-[#f4ca64]/20 bg-[#f4ca64]/[0.045] text-[#c4a967]"}`}>
                    {allowed ? <CheckCircle2 size={13} /> : <LockKeyhole size={13} />}{accessName(chapter.access)}
                  </div>
                </header>

                <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_390px]">
                  <div className="space-y-5">
                    <GuideList title="Before you start" icon={ListChecks} items={chapter.prerequisites} />
                    <section>
                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#71807c]"><Activity size={13} /> How it works</div>
                      <div className="mt-3 space-y-3">
                        {chapter.steps.map((step, index) => (
                          <div key={step.title} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-mono text-[9px]" style={{ color: chapter.accent }}>{String(index + 1).padStart(2, "0")}</span>
                            <div><p className="text-xs font-semibold text-[#dce7e3]">{step.title}</p><p className="mt-1 text-[10px] leading-5 text-[#71807c]">{step.detail}</p></div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section>
                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#71807c]"><Database size={13} /> Controls explained</div>
                      <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071111]">
                        {chapter.controls.map((control) => (
                          <div key={control.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[155px_1fr] sm:gap-4"><p className="text-[10px] font-semibold text-[#cbd7d2]">{control.name}</p><p className="text-[10px] leading-5 text-[#71807c]">{control.detail}</p></div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <GuideVisual chapter={chapter} />
                    <GuideList title="What gets saved" icon={CheckCircle2} items={chapter.results} />
                    <section className="rounded-2xl border border-[#f4ca64]/18 bg-[#f4ca64]/[0.035] p-4">
                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#f4ca64]"><AlertTriangle size={13} /> Limits and cautions</div>
                      <div className="mt-3 space-y-2.5">{chapter.warnings.map((warning) => <p key={warning} className="text-[10px] leading-5 text-[#a99a73]">{warning}</p>)}</div>
                    </section>
                  </aside>
                </div>
              </article>
            );
          })}

          {!visible.length && (
            <div className="rounded-[26px] border border-white/[0.08] bg-[#0b1717] p-12 text-center">
              <Search size={24} className="mx-auto text-[#53615d]" />
              <h3 className="mt-4 text-sm font-semibold">No guide section matches that search</h3>
              <p className="mt-2 text-xs text-[#71807c]">Try a feature name, control, file format, status, or limit.</p>
              <button onClick={() => setSearch("")} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs text-[#b8ff4b]">Clear search</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
