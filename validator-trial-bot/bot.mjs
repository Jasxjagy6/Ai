import { mkdir, readFile, writeFile } from "node:fs/promises";

const BOT_TOKEN = process.env.VALIDATOR_TRIAL_BOT_TOKEN?.trim();
const TRIAL_SECRET = process.env.VALIDATOR_TRIAL_SECRET?.trim();
const API_BASE = (process.env.VALIDATOR_TRIAL_API_BASE || "http://localhost:3100").replace(/\/$/, "");
const PANEL_URL = (process.env.VALIDATOR_PUBLIC_URL || "https://play-casino.me").replace(/\/$/, "");

if (!BOT_TOKEN) throw new Error("VALIDATOR_TRIAL_BOT_TOKEN is not configured");
if (!TRIAL_SECRET || TRIAL_SECRET.length < 32)
  throw new Error("VALIDATOR_TRIAL_SECRET is not configured");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TRIAL_CALLBACK = "claim_signal_desk_trial";
const STATE_FILE = process.env.VALIDATOR_TRIAL_BOT_STATE || "/app/data/dashboard-messages.json";
let offset = 0;
const dashboardMessages = new Map(
  Object.entries(
    await readFile(STATE_FILE, "utf8")
      .then((value) => JSON.parse(value))
      .catch(() => ({})),
  ).map(([chatId, messageId]) => [chatId, Number(messageId)]),
);

async function rememberDashboard(chatId, messageId) {
  dashboardMessages.set(String(chatId), messageId);
  await mkdir(new URL(".", `file://${STATE_FILE}`).pathname, { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify(Object.fromEntries(dashboardMessages)),
    "utf8",
  );
}

async function forgetDashboard(chatId) {
  dashboardMessages.delete(String(chatId));
  await mkdir(new URL(".", `file://${STATE_FILE}`).pathname, { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify(Object.fromEntries(dashboardMessages)),
    "utf8",
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function telegram(method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok)
    throw new Error(body.description || `Telegram ${method} failed`);
  return body.result;
}

function homeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Get 7-day trial", callback_data: TRIAL_CALLBACK }],
      [
        { text: "View all features", callback_data: "show_features" },
        { text: "Open Signal Desk", url: PANEL_URL },
      ],
    ],
  };
}

function featuresKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Get 7-day trial", callback_data: TRIAL_CALLBACK }],
      [
        { text: "Back to overview", callback_data: "show_home" },
        { text: "Open Signal Desk", url: PANEL_URL },
      ],
    ],
  };
}

function trialKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Open Signal Desk", url: `${PANEL_URL}/workspace` }],
      [{ text: "Buy credits or a plan", url: `${PANEL_URL}/buy` }],
      [{ text: "Back to overview", callback_data: "show_home" }],
    ],
  };
}

const INTRO = `<b>Signal Desk Telegram Operations Panel</b>

Run Telegram account fleets from one secure workspace. Import or log in sessions, validate usernames, send durable messaging campaigns, schedule delivery, manage account profiles, use AI Chatter, inspect every result, and export reports.

<b>Every plan includes every feature.</b>
Credits are charged only when an operation runs.

<b>Free trial</b>
7 days • 2,500 credits • all features • one trial per Telegram account

Tap the button below to issue your private panel login key.`;

const FEATURES = `<b>Everything included in Signal Desk</b>

• Telegram session import and phone login
• Independent Telegram account client
• Username validation and list operations
• Direct, balanced, parallel, split, failover, and fan-out messaging
• Group and channel delivery
• Recurring schedules and safe pacing
• Per-session delivery history and reply tracking
• CSV and workspace report exports
• SpamBot checks, health controls, and warmup
• Profile, photo, story, privacy, and history tools
• AI Chatter campaigns and conversation memory
• Session lists, bulk actions, and account isolation

Every plan can use every feature. Your credit balance is consumed only by operations that run.`;

async function render(chatId, messageId, text, replyMarkup) {
  if (messageId) {
    try {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      });
    } catch (error) {
      if (!String(error).includes("message is not modified")) throw error;
    }
    await rememberDashboard(chatId, messageId);
    return messageId;
  }
  const existing = dashboardMessages.get(String(chatId));
  if (existing) {
    try {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: existing,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      });
      return existing;
    } catch (error) {
      if (!String(error).includes("message is not modified"))
        await forgetDashboard(chatId);
      else return existing;
    }
  }
  const sent = await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
  await rememberDashboard(chatId, sent.message_id);
  return sent.message_id;
}

async function showHome(chatId, messageId) {
  await render(chatId, messageId, INTRO, homeKeyboard());
}

async function showFeatures(chatId, messageId) {
  await render(chatId, messageId, FEATURES, featuresKeyboard());
}

async function claimTrial(user) {
  const response = await fetch(`${API_BASE}/api/validator/trial/telegram`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TRIAL_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      telegramUserId: String(user.id),
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Trial service rejected the claim");
  return body;
}

async function deliverTrial(chatId, messageId, user) {
  await render(
    chatId,
    messageId,
    `<b>Preparing your Signal Desk trial</b>\n\nCreating your isolated workspace, login key, and 2,500-credit balance...`,
    { inline_keyboard: [] },
  );
  const trial = await claimTrial(user);
  const expires = new Date(trial.expiresAt).toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const status = trial.alreadyClaimed
    ? "Your Telegram account already claimed its one-time trial. Here is the same login key again. No additional credits were added."
    : "Your trial is active. A new isolated workspace and 2,500 credits were issued.";
  await render(chatId, messageId, `<b>Signal Desk 7-day trial</b>

${status}

<b>Login key</b>
<code>${escapeHtml(trial.key)}</code>

<b>Trial details</b>
• Access: every panel feature
• Credits granted: ${Number(trial.creditsGranted).toLocaleString()}
• Current balance: ${Number(trial.creditsBalance).toLocaleString()}
• Expires: ${escapeHtml(expires)} UTC
• Panel: ${escapeHtml(`${PANEL_URL}/workspace`)}

Open the panel, enter this key, and keep it private. The trial cannot be claimed again from another username on the same Telegram ID.`,
    trialKeyboard());
}

async function handleUpdate(update) {
  const message = update.message;
  if (message?.text) {
    if (message.chat.type !== "private") return;
    await telegram("deleteMessage", {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }).catch(() => undefined);
    const command = message.text.split(/\s+/, 1)[0].split("@")[0].toLowerCase();
    if (command === "/trial") {
      await deliverTrial(
        message.chat.id,
        dashboardMessages.get(String(message.chat.id)),
        message.from,
      );
      return;
    }
    if (command === "/features") {
      await showFeatures(
        message.chat.id,
        dashboardMessages.get(String(message.chat.id)),
      );
      return;
    }
    await showHome(
      message.chat.id,
      dashboardMessages.get(String(message.chat.id)),
    );
    return;
  }

  const query = update.callback_query;
  if (!query) return;
  await telegram("answerCallbackQuery", {
    callback_query_id: query.id,
    text: query.data === TRIAL_CALLBACK ? "Preparing your trial..." : undefined,
  });
  if (!query.message || query.message.chat.type !== "private") return;
  if (query.data === TRIAL_CALLBACK) {
    await deliverTrial(query.message.chat.id, query.message.message_id, query.from);
  } else if (query.data === "show_features") {
    await showFeatures(query.message.chat.id, query.message.message_id);
  } else if (query.data === "show_home") {
    await showHome(query.message.chat.id, query.message.message_id);
  }
}

async function configureBot() {
  const me = await telegram("getMe");
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Open Signal Desk" },
      { command: "features", description: "See every panel feature" },
      { command: "trial", description: "Claim your one-time 7-day trial" },
    ],
  });
  console.log(`Signal Desk trial bot connected as @${me.username}`);
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["message", "callback_query"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("Trial bot update failed", error);
          const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
          const messageId = update.callback_query?.message?.message_id || dashboardMessages.get(String(chatId));
          if (chatId)
            await render(
              chatId,
              messageId,
              "<b>Trial service unavailable</b>\n\nPlease try again in a moment.",
              homeKeyboard(),
            ).catch(() => undefined);
        }
      }
    } catch (error) {
      console.error("Trial bot polling failed", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

await configureBot();
await poll();
