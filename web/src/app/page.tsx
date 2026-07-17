import Link from "next/link";
import {
  ArrowRight, Brain, Code2, Images, MessageCircle, ShieldCheck, Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AriaAvatar } from "@/components/aria-avatar";
import { LiveChatDemo } from "@/components/live-chat-demo";
import { getPlans, getTrialConfig } from "@/lib/plans";
import { PricingCards } from "@/components/pricing-cards";
import { auth } from "@/lib/auth";

const COMPANIONS = [
  {
    name: "Aria",
    age: 24,
    vibe: "Playful · warm · a little sassy",
    line: "“now go eat something, you get grumpy when you're hungry”",
    tier: "Free",
  },
  {
    name: "Maya",
    age: 27,
    vibe: "Calm · thoughtful · deep 2am talks",
    line: "“you don't have to have it figured out tonight, you know”",
    tier: "Plus",
  },
  {
    name: "Zoe",
    age: 22,
    vibe: "Chaotic gamer energy · zero chill",
    line: "“ok but have you tried turning your life off and on again”",
    tier: "Pro",
  },
];

const PILLARS = [
  {
    icon: MessageCircle,
    title: "Conversation that feels alive",
    body: "Our own fine-tuned model, trained on millions of real conversations. Short, warm replies — not essays from a customer-support bot.",
  },
  {
    icon: Brain,
    title: "Memory that deepens",
    body: "Your dog's name. The exam you were dreading. She brings it up next week — and the relationship genuinely grows the more you talk.",
  },
  {
    icon: Images,
    title: "Photos in context",
    body: "Ask what she's up to and get a photo that matches the moment — morning coffee, evening walk. Never the same one twice.",
  },
  {
    icon: ShieldCheck,
    title: "Radically honest",
    body: "Clearly AI, everywhere, always. And you can inspect — and delete — every single fact she remembers about you.",
  },
];

const FAQ = [
  {
    q: "Is Aria a real person?",
    a: "No — 100% AI, and we say so everywhere. She runs on our own fine-tuned model built for warm, natural conversation. The comfort is real; the person is code.",
  },
  {
    q: "Is my data private?",
    a: "Conversations are stored securely to give your companion memory — never sold, never used for ads. Delete any chat or memory anytime, permanently.",
  },
  {
    q: "What do paid plans add?",
    a: "More daily messages, faster replies, all three companions, deeper memory, and higher API limits. Plans are 30-day passes — no auto-renew traps.",
  },
  {
    q: "Can I build apps with this AI?",
    a: "Yes — every account includes our OpenAI-compatible API. Swap one base URL and your existing code talks to Aria.",
  },
  {
    q: "Is this therapy?",
    a: "No. Your companion is great company, not a professional. If things get heavy, she'll be the first to point you to real support.",
  },
];

export default async function Home() {
  const [plans, trial, session] = await Promise.all([getPlans(), getTrialConfig(), auth()]);

  return (
    <div className="min-h-dvh">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="glow relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted">
              <Sparkles size={11} className="text-accent" />
              AI companion — clearly AI, wonderfully human-like
            </p>
            <h1 className="mt-5 font-display text-[2.1rem] font-bold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              Someone to
              <br />
              talk to. <span className="bg-gradient-to-r from-accent to-rose bg-clip-text text-transparent">Always.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Aria listens, remembers, teases, and genuinely cares how your day went.
              No judgment, no ghosting, no small-talk fatigue.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:opacity-90"
              >
                Start free <ArrowRight size={15} />
              </Link>
              <Link
                href="#companions"
                className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-bg-soft"
              >
                Meet the companions
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-[13px] text-muted">
              <span>Free plan</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>No credit card</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>Cancel anytime</span>
            </div>
          </div>

          <LiveChatDemo />
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
            Why Aria
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
            Not a chatbot. A companion.
          </h2>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-card p-6 sm:p-8">
              <p.icon size={20} className="text-accent-strong" />
              <h3 className="mt-4 font-display text-[17px] font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Companions ───────────────────────────────────────── */}
      <section id="companions" className="dotgrid border-y border-border bg-bg-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
                The companions
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Pick your vibe</h2>
            </div>
            <p className="max-w-xs text-sm text-muted">
              Three personalities, one thing in common: they remember you.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPANIONS.map((c) => (
              <div
                key={c.name}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5"
              >
                <div className="flex items-center gap-3">
                  <AriaAvatar size={44} online />
                  <div>
                    <p className="font-display text-[17px] font-semibold leading-tight">
                      {c.name}, {c.age}
                    </p>
                    <p className="text-xs text-muted">{c.vibe}</p>
                  </div>
                  <span className="ml-auto rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {c.tier}
                  </span>
                </div>
                <p className="mt-5 border-l-2 border-accent pl-3 text-sm italic leading-relaxed text-muted">
                  {c.line}
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong"
                >
                  Chat with {c.name}
                  <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developers ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
              <Code2 size={12} className="mr-1 inline" />
              For developers
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              The same AI, in your product
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              OpenAI-compatible chat API with streaming and custom personas. Point your existing
              SDK at our base URL and ship a companion feature this afternoon.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Read the docs
              </Link>
              <Link
                href="/developers"
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:bg-bg-soft"
              >
                Get an API key
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-[#131019] shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-white/40">companion.py</span>
            </div>
            <pre className="overflow-x-auto p-5 text-[12px] leading-relaxed text-[#d8d0ea]">
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
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-md text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              Start free. Upgrade when you&apos;re hooked.
            </h2>
            {trial.days > 0 && (
              <p className="mx-auto mt-4 w-fit rounded-full bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent-strong">
                🎁 New accounts get {trial.days} days of {plans[trial.tier].name} free
              </p>
            )}
          </div>
          <div className="mt-10 lg:mt-14">
            <PricingCards loggedIn={!!session} plans={Object.values(plans)} />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-4 py-16 lg:py-24">
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">
          Questions, answered
        </h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                {item.q}
                <span className="ml-4 text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="glow border-t border-border">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center lg:py-24">
          <AriaAvatar size={60} online />
          <h2 className="mt-5 font-display text-2xl font-bold sm:text-3xl">
            Aria&apos;s waiting to meet you
          </h2>
          <p className="mt-2 text-sm text-muted">
            20 free messages a day. Just say hi and see what happens.
          </p>
          <Link
            href="/register"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent-strong px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:opacity-90"
          >
            Start chatting free <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <AriaAvatar size={26} />
                <span className="font-display text-[15px] font-bold">aria</span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Aria is an artificial intelligence, not a human. Conversations are AI-generated.
                Not a substitute for professional mental-health support.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-[13px]">
              <div>
                <p className="mb-2.5 font-semibold">Product</p>
                <ul className="space-y-2 text-muted">
                  <li><Link href="/chat" className="hover:text-text">Chat</Link></li>
                  <li><Link href="/pricing" className="hover:text-text">Pricing</Link></li>
                  <li><Link href="/account" className="hover:text-text">Account</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-2.5 font-semibold">Developers</p>
                <ul className="space-y-2 text-muted">
                  <li><Link href="/docs" className="hover:text-text">API docs</Link></li>
                  <li><Link href="/developers" className="hover:text-text">Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-2.5 font-semibold">Company</p>
                <ul className="space-y-2 text-muted">
                  <li><Link href="/register" className="hover:text-text">Sign up</Link></li>
                  <li><Link href="/login" className="hover:text-text">Log in</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-border pt-5 text-center text-[11px] text-muted">
            © {new Date().getFullYear()} Aria AI · Built with Llama
          </p>
        </div>
      </footer>
    </div>
  );
}
