/**
 * Aria Telegram bot.
 *
 * Uses the same Aria backend as the website via the public API
 * (dogfooding /api/v1/chat/completions). Users link their website
 * account with /link to share their subscription tier and quota.
 */
import { Bot, Context, session, SessionFlavor } from "grammy";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = process.env.ARIA_API_BASE ?? "http://localhost:3000";
// Service key used for unlinked users (free-tier limits enforced per telegram id below)
const SERVICE_KEY = process.env.ARIA_SERVICE_KEY ?? "";

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

type SessionData = {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  apiKey?: string; // set via /link — uses the user's own plan limits
  messagesToday: number;
  day: string;
};

type BotContext = Context & SessionFlavor<SessionData>;

const FREE_TG_MESSAGES_PER_DAY = 20;
const HISTORY_WINDOW = 24;

const bot = new Bot<BotContext>(BOT_TOKEN);

bot.use(
  session({
    initial: (): SessionData => ({
      history: [],
      messagesToday: 0,
      day: new Date().toISOString().slice(0, 10),
    }),
  })
);

const DISCLOSURE =
  "💜 Hey, I'm Aria — an AI companion, not a real person. " +
  "I'm here to chat, listen, and keep you company!";

bot.command("start", async (ctx) => {
  ctx.session.history = [];
  await ctx.reply(
    `${DISCLOSURE}\n\n` +
      "Just send me a message and we'll start talking 😊\n\n" +
      "Commands:\n" +
      "/new — start a fresh conversation\n" +
      "/link <api-key> — link your aria account (higher limits)\n" +
      "/help — all commands + info"
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    `${DISCLOSURE}\n\n` +
      "/new — forget our current conversation and start fresh\n" +
      "/link <api-key> — link your website account. Create a key at " +
      `${API_BASE}/developers to use your Plus/Pro limits here\n` +
      "/unlink — remove your linked account\n" +
      `\nFree usage: ${FREE_TG_MESSAGES_PER_DAY} messages/day. ` +
      `Linked accounts use their plan's API quota instead.\n\n` +
      "⚠️ I'm an AI. If you're in crisis, please reach out to a real person — " +
      "in India: iCall 9152987821, elsewhere: findahelpline.com"
  );
});

bot.command("new", async (ctx) => {
  ctx.session.history = [];
  await ctx.reply("okay, clean slate 😄 so... hi again! what's up?");
});

bot.command("link", async (ctx) => {
  const key = (ctx.match ?? "").trim();
  if (!key.startsWith("aria_sk_")) {
    await ctx.reply(
      `That doesn't look like an aria key. Create one at ${API_BASE}/developers then send:\n/link aria_sk_...`
    );
    return;
  }
  // validate the key against the API
  const res = await fetch(`${API_BASE}/api/v1/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    await ctx.reply("Hmm, that key didn't work — double-check it and try again?");
    return;
  }
  ctx.session.apiKey = key;
  await ctx.reply("Linked! 🎉 You now chat with your plan's limits. (I'd delete that message with the key if I were you 😉)");
});

bot.command("unlink", async (ctx) => {
  ctx.session.apiKey = undefined;
  await ctx.reply("Unlinked — back to free limits.");
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return; // unknown command

  // daily quota for unlinked users
  const today = new Date().toISOString().slice(0, 10);
  if (ctx.session.day !== today) {
    ctx.session.day = today;
    ctx.session.messagesToday = 0;
  }
  const key = ctx.session.apiKey || SERVICE_KEY;
  if (!ctx.session.apiKey) {
    if (ctx.session.messagesToday >= FREE_TG_MESSAGES_PER_DAY) {
      await ctx.reply(
        `We've hit today's free limit (${FREE_TG_MESSAGES_PER_DAY} messages) 💔 ` +
          `I'll be here tomorrow — or link your account for more: ${API_BASE}/pricing`
      );
      return;
    }
    ctx.session.messagesToday += 1;
  }
  if (!key) {
    await ctx.reply("Bot isn't configured yet (missing service key). Ping the admin!");
    return;
  }

  await ctx.replyWithChatAction("typing");

  ctx.session.history.push({ role: "user", content: text });
  ctx.session.history = ctx.session.history.slice(-HISTORY_WINDOW);

  try {
    const res = await fetch(`${API_BASE}/api/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: ctx.session.history, max_tokens: 300 }),
    });

    if (res.status === 429) {
      await ctx.reply(
        `Your plan's daily API limit is used up 😅 upgrade or come back after midnight UTC: ${API_BASE}/pricing`
      );
      return;
    }
    if (!res.ok) {
      await ctx.reply("ugh, my brain glitched for a second 😵‍💫 try that again?");
      return;
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const reply = data.choices[0]?.message?.content?.trim();
    if (!reply) {
      await ctx.reply("i went blank... say that again? 😅");
      return;
    }

    ctx.session.history.push({ role: "assistant", content: reply });
    ctx.session.history = ctx.session.history.slice(-HISTORY_WINDOW);
    await ctx.reply(reply);
  } catch (e) {
    console.error("chat error", e);
    await ctx.reply("connection hiccup 🙈 give me a sec and try again");
  }
});

bot.catch((err) => console.error("bot error", err));

console.log("Aria Telegram bot starting...");
bot.start();
