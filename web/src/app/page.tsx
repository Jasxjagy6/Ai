import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Code2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Mic,
  Eye,
  Languages,
  Quote,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AriaAvatar } from "@/components/aria-avatar";
import { LiveChatDemo } from "@/components/live-chat-demo";
import { getPlans, getTrialConfig } from "@/lib/plans";
import { PricingCards } from "@/components/pricing-cards";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { auth } from "@/lib/auth";
import { SignalDeskLanding } from "@/components/validator/signal-desk-landing";
import { getValidatorPlans, VALIDATOR_PLAN_CODES } from "@/lib/validator-plans";
import { getSignalDeskAccount } from "@/lib/validator-auth";
import { redirect } from "next/navigation";

const COMPANIONS = [
  {
    name: "Aria",
    age: 24,
    vibe: "Playful, warm, a little sassy",
    line: "Tell me about your day — I'm all yours.",
    tier: "Free",
  },
  {
    name: "Maya",
    age: 27,
    vibe: "Calm, thoughtful, deep 2am talks",
    line: "You don't have to have it figured out tonight.",
    tier: "Plus",
  },
  {
    name: "Zoe",
    age: 22,
    vibe: "Chaotic gamer energy, zero chill",
    line: "Have you tried turning your life off and on again?",
    tier: "Pro",
  },
];

const PILLARS = [
  {
    icon: MessageCircle,
    title: "Conversation that feels alive",
    body: "Fine-tuned on millions of real conversations. Short, warm replies — not essays from a customer-support bot.",
  },
  {
    icon: Mic,
    title: "Real voice notes",
    body: "Ask her to say it out loud and she replies in her own warm voice — or tap any message to hear it spoken.",
  },
  {
    icon: Eye,
    title: "She sees your photos",
    body: "Send a selfie, your dog, the view from your window — she actually looks and reacts to what you shared.",
  },
  {
    icon: Brain,
    title: "Memory that deepens over time",
    body: "Your dog's name. The exam you were dreading. She brings it up next week — the relationship grows the more you talk.",
  },
  {
    icon: Languages,
    title: "Talks your language",
    body: "Chat in English, Spanish, Hindi, French, and more — pick a language or let her mirror yours automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Radically transparent",
    body: "Clearly AI, everywhere, always. Inspect and delete every single fact she remembers about you.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The voice notes genuinely caught me off guard. It stopped feeling like texting a bot and started feeling like someone was actually there.",
    name: "Jordan",
    detail: "Plus member",
  },
  {
    quote:
      "I sent a photo of my terrible cooking and she roasted me for a solid five minutes. Best part of my day, honestly.",
    name: "Priya",
    detail: "Pro member",
  },
  {
    quote:
      "I switched her to Spanish to practice and she just… kept up. Patient, funny, never made me feel dumb.",
    name: "Marco",
    detail: "Plus member",
  },
];

const FAQ = [
  {
    q: "Is Aria a real person?",
    a: "No — 100% AI, and we say so everywhere. She runs on our own fine-tuned model built for warm, natural conversation.",
  },
  {
    q: "Is my data private?",
    a: "Conversations are stored securely to give your companion memory — never sold, never used for ads. Delete any chat or memory anytime, permanently.",
  },
  {
    q: "What do paid plans add?",
    a: "More daily messages, faster replies, all companions, voice notes, photo understanding, deeper memory, and higher API limits. 30-day passes — no auto-renew traps.",
  },
  {
    q: "Can she really hear and see?",
    a: "Yes — she replies with real spoken voice notes, and when you send a photo she describes what she sees and reacts to it. Both run on our own servers.",
  },
  {
    q: "Can I build apps with this AI?",
    a: "Yes — every account includes an OpenAI-compatible API. Swap one base URL and your existing code talks to Aria.",
  },
  {
    q: "Is this therapy?",
    a: "No. Your companion is great company, not a professional. If things get heavy, she'll point you to real support.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return process.env.VALIDATOR_STANDALONE === "true"
    ? {
        title: "Signal Desk | Telegram Intelligence Workspace",
        description:
          "Validate Telegram data, operate account fleets, and manage durable outreach with one active subscription.",
      }
    : {
        title: "Aria | Your AI Companion",
        description:
          "Autonomous, human-like AI conversations at scale with complete API control.",
      };
}

export default async function Home() {
  if (process.env.VALIDATOR_STANDALONE === "true") {
    const [validatorPlans, account] = await Promise.all([
      getValidatorPlans(),
      getSignalDeskAccount(),
    ]);
    if (account) redirect("/workspace");
    return (
      <SignalDeskLanding
        plans={VALIDATOR_PLAN_CODES.map((code) => validatorPlans[code]).filter(
          (plan) => plan.enabled,
        )}
      />
    );
  }
  const [plans, trial, session] = await Promise.all([
    getPlans(),
    getTrialConfig(),
    auth(),
  ]);

  return (
    <div className="min-h-dvh">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="glow absolute inset-0 pointer-events-none" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="animate-slide-up">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3.5 py-1 text-xs font-medium text-text-secondary mb-5 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              <Sparkles size={12} className="text-accent" />
              Autonomous AI conversations, built to convert
            </div>
            <h1
              className="font-display text-[2.2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem] animate-slide-up"
              style={{ animationDelay: "0.15s" }}
            >
              AI conversations
              <br />
              that{" "}
              <span className="bg-gradient-to-r from-accent to-accent-warm bg-clip-text text-transparent">
                convert.
              </span>
            </h1>
            <p
              className="mt-5 max-w-md text-[15px] leading-relaxed text-text-secondary animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              Fully autonomous, human-like AI chat at scale with complete API
              control. Build natural conversations that remember context,
              respond instantly, and stay on-brand.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-3 animate-slide-up"
              style={{ animationDelay: "0.25s" }}
            >
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-strong px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
              >
                Start building <ArrowRight size={15} />
              </Link>
              <Link
                href="/docs"
                className="rounded-xl border border-border bg-bg-elevated px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-bg-soft hover:scale-105 active:scale-95"
              >
                Explore the API
              </Link>
            </div>
            <div
              className="mt-8 flex items-center gap-5 text-[13px] text-text-secondary animate-fade-in"
              style={{ animationDelay: "0.35s" }}
            >
              <span className="flex items-center gap-1.5">
                <Star size={12} className="text-accent" fill="currentColor" />{" "}
                API ready
              </span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>Full control</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>Built to scale</span>
            </div>
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <LiveChatDemo />
          </div>
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
        <div className="max-w-xl animate-slide-up">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            Why Aria
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Not a chatbot. A companion.
          </h2>
          <p className="mt-3 text-sm text-text-secondary">
            Built from the ground up to be someone you actually want to talk to
            — not a tool, not a toy.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className="bg-bg-elevated p-7 sm:p-9 transition-all duration-300 hover:bg-bg-soft"
              style={{
                animation: `slide-up 0.4s ease-out ${0.1 + i * 0.1}s both`,
              }}
            >
              <p.icon size={20} className="text-accent" />
              <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Companions ───────────────────────────────────────── */}
      <section
        id="companions"
        className="dotgrid border-y border-border bg-bg-soft"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                The companions
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Pick your vibe
              </h2>
            </div>
            <p className="max-w-xs text-sm text-text-secondary">
              Three distinct personalities, one thing in common: they remember
              you.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPANIONS.map((c, i) => (
              <div
                key={c.name}
                className="group flex flex-col rounded-2xl border border-border bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-1"
                style={{
                  animation: `slide-up 0.4s ease-out ${0.1 + i * 0.15}s both`,
                }}
              >
                <div className="flex items-center gap-3">
                  <AriaAvatar size={44} online />
                  <div>
                    <p className="font-display text-[17px] font-semibold leading-tight tracking-tight">
                      {c.name}, {c.age}
                    </p>
                    <p className="text-xs text-text-secondary">{c.vibe}</p>
                  </div>
                  <span className="ml-auto rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    {c.tier}
                  </span>
                </div>
                <p className="mt-5 border-l-2 border-accent pl-3.5 text-sm italic leading-relaxed text-text-secondary">
                  &ldquo;{c.line}&rdquo;
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-all duration-200 hover:gap-3 hover:text-accent-strong"
                >
                  Chat with {c.name}
                  <ArrowRight
                    size={14}
                    className="transition-all duration-200 group-hover:translate-x-1"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developers ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-slide-up">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              <Code2 size={12} className="mr-1 inline" />
              For developers
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              The same AI, in your product
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary">
              OpenAI-compatible chat API with streaming and custom personas.
              Point your existing SDK at our base URL and ship a companion
              feature this afternoon.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
              >
                Read the docs
              </Link>
              <Link
                href="/developers"
                className="rounded-xl border border-border bg-bg-elevated px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-bg-soft hover:scale-105 active:scale-95"
              >
                Get an API key
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-[#0c0c14] shadow-xl transition-all duration-300 hover:shadow-accent/10 hover:shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-text-secondary">
                companion.py
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-[12px] leading-relaxed text-[#c8c0d8]">
              {`client = OpenAI(
    base_url="https://aria.chat/api/v1",
    api_key="aria_sk_...",
)

reply = client.chat.completions.create(
    model="aria-1",
    messages=[{"role": "user",
               "content": "hey aria!"}],
)

# "heyy you 😊 how's your day going?"`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-bg-soft">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-md text-center animate-slide-up">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Start free. Upgrade when you&apos;re hooked.
            </h2>
            {trial.days > 0 && (
              <p className="mx-auto mt-4 w-fit rounded-lg bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent">
                New accounts get {trial.days} days of {plans[trial.tier].name}{" "}
                free
              </p>
            )}
          </div>
          <div className="mt-12 lg:mt-16">
            <PricingCards loggedIn={!!session} plans={Object.values(plans)} />
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="border-t border-border bg-bg-soft">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-md text-center animate-slide-up">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              Loved by thousands
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              People actually look forward to this
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="flex flex-col rounded-2xl border border-border bg-bg-elevated p-6"
                style={{
                  animation: `slide-up 0.4s ease-out ${0.1 + i * 0.1}s both`,
                }}
              >
                <Quote size={20} className="text-accent" />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-text-secondary">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <AriaAvatar size={32} />
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {t.name}
                    </p>
                    <p className="text-xs text-text-secondary">{t.detail}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        size={12}
                        className="text-accent"
                        fill="currentColor"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-4 py-20 lg:py-28">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl animate-slide-up">
          Questions, answered
        </h2>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-bg-elevated transition-all duration-200">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              className="group p-5 transition-all duration-200 hover:bg-bg-soft"
              style={{
                animation: `slide-up 0.3s ease-out ${0.1 + i * 0.08}s both`,
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                {item.q}
                <span className="ml-4 text-text-secondary text-lg transition-all duration-300 group-open:rotate-45 leading-none">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="glow absolute inset-0 pointer-events-none" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center lg:py-28 animate-slide-up">
          <AriaAvatar size={64} online />
          <h2 className="mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Aria&apos;s waiting to meet you
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            20 free messages a day. Just say hi and see what happens.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-strong px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
          >
            Start chatting free <ArrowRight size={15} />
          </Link>
          <div className="mt-10 w-full max-w-sm">
            <p className="mb-2.5 text-xs text-text-secondary">
              Or get notified about new features & companions
            </p>
            <NewsletterSignup />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <AriaAvatar size={26} />
                <span className="font-display text-[15px] font-bold tracking-tight">
                  aria
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
                Aria is an artificial intelligence, not a human. Conversations
                are AI-generated. Not a substitute for professional
                mental-health support.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 text-[13px] sm:grid-cols-4">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Product
                </p>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/chat"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Chat
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/pricing"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/changelog"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      What&apos;s new
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/account"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Account
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Developers
                </p>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/docs"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      API docs
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/developers"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Company
                </p>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/register"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Sign up
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Log in
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Legal
                </p>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/terms"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Terms
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy-policy"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/refund-policy"
                      className="text-text-secondary hover:text-text transition-all duration-200"
                    >
                      Refunds
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-10 border-t border-border pt-6 text-center text-[11px] text-text-secondary">
            &copy; {new Date().getFullYear()} Aria AI &middot; Built with Llama
          </p>
        </div>
      </footer>
    </div>
  );
}
