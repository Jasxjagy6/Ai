import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  Coins,
  Fingerprint,
  Gauge,
  Layers3,
  MessageSquareText,
  Radar,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ValidatorPlan } from "@/lib/validator-plans";

const CAPABILITIES = [
  {
    icon: Radar,
    label: "Validate",
    title: "Find live Telegram identities",
    body: "Run large username lists through a durable validation pipeline with live progress, clean exports, and precise row-level results.",
  },
  {
    icon: Send,
    label: "Deliver",
    title: "Operate account fleets safely",
    body: "Direct messages, balanced campaigns, every-account fan-out, groups, channels, schedules, replies, and session-level reports.",
  },
  {
    icon: Layers3,
    label: "Organize",
    title: "Turn raw data into clean lists",
    body: "Import, normalize, deduplicate, merge, inspect, and export contact data without losing its Telegram identity metadata.",
  },
];

function Mark() {
  return (
    <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#b8ff4b]/30 bg-[#b8ff4b]/10">
      <Radar size={21} className="text-[#b8ff4b]" />
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b8ff4b] shadow-[0_0_12px_#b8ff4b]" />
    </span>
  );
}

export function SignalDeskLanding({ plans }: { plans: ValidatorPlan[] }) {
  return (
    <main className="signal-desk-theme validator-grid min-h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed]">
      <div className="validator-orb validator-orb-one" />
      <div className="validator-orb validator-orb-two" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="flex h-20 items-center border-b border-white/[0.07]">
          <Link href="/" className="flex items-center gap-3">
            <Mark />
            <span>
              <span className="block text-sm font-semibold tracking-[0.1em]">
                SIGNAL DESK
              </span>
              <span className="block text-[9px] uppercase tracking-[0.2em] text-[#60706b]">
                Telegram intelligence
              </span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-7 text-xs text-[#7d8d88] md:flex">
            <a href="#capabilities" className="transition hover:text-white">
              Platform
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Plans
            </a>
            <a
              href="https://t.me/agedguru"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Support
            </a>
          </nav>
          <Link
            href="/workspace"
            className="ml-5 inline-flex items-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-xs font-bold text-[#07100d] transition hover:bg-[#ceff82]"
          >
            Open workspace <ArrowRight size={14} />
          </Link>
        </header>

        <section className="grid min-h-[760px] items-center gap-14 py-20 lg:grid-cols-[1.12fr_.88fr] lg:py-24">
          <div className="validator-reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />{" "}
              Live Telegram operations
            </span>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[.96] tracking-[-0.065em] sm:text-7xl lg:text-[88px]">
              Find the signal.
              <br />
              <span className="text-[#81908c]">Move with precision.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[#81908c] sm:text-lg">
              A dedicated operating system for Telegram data, validation,
              account fleets, and durable outreach. One credit balance. Every
              action visible. No hidden limits.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/buy"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b8ff4b] px-6 py-4 text-sm font-bold text-[#07100d] transition hover:-translate-y-0.5 hover:bg-[#ceff82]"
              >
                Choose a plan <ArrowRight size={17} />
              </Link>
              <Link
                href="/workspace"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-4 text-sm font-semibold text-[#c3cfcb] transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                <Fingerprint size={16} /> I have an access key
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[11px] uppercase tracking-[0.14em] text-[#64736e]">
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#b8ff4b]" /> Credit-based
                usage
              </span>
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#b8ff4b]" /> Encrypted
                sessions
              </span>
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#b8ff4b]" /> Affiliate rewards
              </span>
            </div>
          </div>

          <div className="relative validator-card-in">
            <div className="absolute -inset-10 rounded-full bg-[#b8ff4b]/[0.03] blur-3xl" />
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#0b1717]/95 p-5 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#61706c]">
                    Operations overview
                  </p>
                  <p className="mt-1 text-lg font-semibold">Workspace pulse</p>
                </div>
                <span className="rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                  All systems ready
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Credits", "24,680", Coins, "text-[#b8ff4b]"],
                  ["Live sessions", "18", Users, "text-[#65e6ff]"],
                  ["Validated", "184K", Gauge, "text-[#d8b7ff]"],
                  ["Reply rate", "12.8%", MessageSquareText, "text-[#f4ca64]"],
                ].map(([label, value, Icon, color]) => {
                  const MetricIcon = Icon as typeof Coins;
                  return (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-white/[0.07] bg-[#071111] p-4"
                    >
                      <MetricIcon size={16} className={String(color)} />
                      <p className="mt-5 font-mono text-2xl font-semibold">
                        {String(value)}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#56645f]">
                        {String(label)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#071111] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Campaign velocity</span>
                  <span className="font-mono text-xs text-[#b8ff4b]">81%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full w-[81%] rounded-full bg-gradient-to-r from-[#40d6c2] to-[#b8ff4b] shadow-[0_0_18px_rgba(184,255,75,.3)]" />
                </div>
                <div className="mt-4 flex justify-between text-[9px] uppercase tracking-[0.14em] text-[#56645f]">
                  <span>Clean delivery</span>
                  <span>Risk-controlled fleet</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          className="border-t border-white/[0.07] py-24"
        >
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]">
              Built for operators
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              One disciplined workspace,
              <br />
              from raw list to real result.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {CAPABILITIES.map((item, index) => (
              <article
                key={item.title}
                style={{ animationDelay: `${index * 90}ms` }}
                className="validator-card-in rounded-[28px] border border-white/[0.08] bg-[#0b1717] p-6 transition hover:-translate-y-1 hover:border-[#b8ff4b]/20"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
                    <item.icon size={19} />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5a6864]">
                    0{index + 1} / {item.label}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#74837e]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-t border-white/[0.07] py-24">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b8ff4b]">
              Transparent capacity
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Plans start the engine.
              <br />
              Credits keep it moving.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#74837e]">
              Every plan includes credits. Top up whenever you need more, and
              see the exact cost of each task from your workspace.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.code}
                className={`relative rounded-[28px] border p-6 ${plan.featured ? "border-[#b8ff4b]/40 bg-[#b8ff4b]/[0.055]" : "border-white/[0.08] bg-[#0b1717]"}`}
              >
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#b8ff4b] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#07100d]">
                    Recommended
                  </span>
                )}
                <BadgeDollarSign size={20} className="text-[#b8ff4b]" />
                <h3 className="mt-7 text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 min-h-12 text-xs leading-5 text-[#677670]">
                  {plan.tagline}
                </p>
                <p className="mt-6 font-mono text-3xl font-semibold">
                  ${(plan.priceUsdCents / 100).toFixed(0)}
                  <span className="text-xs font-normal text-[#66756f]">
                    {" "}
                    / {plan.durationDays || "lifetime"} days
                  </span>
                </p>
                <p className="mt-2 font-mono text-sm text-[#b8ff4b]">
                  {plan.creditsIncluded.toLocaleString()} credits included
                </p>
                <div className="mt-6 space-y-2 border-t border-white/[0.07] pt-5">
                  {plan.features.map((feature) => (
                    <p
                      key={feature}
                      className="flex items-start gap-2 text-xs leading-5 text-[#899791]"
                    >
                      <Check
                        size={13}
                        className="mt-0.5 shrink-0 text-[#b8ff4b]"
                      />
                      {feature}
                    </p>
                  ))}
                </div>
                <Link
                  href={`/buy?plan=${plan.code}`}
                  className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold ${plan.featured ? "bg-[#b8ff4b] text-[#07100d]" : "border border-white/10 bg-white/[0.035] text-white"}`}
                >
                  Select {plan.name}
                  <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20 overflow-hidden rounded-[34px] border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.055] p-8 sm:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <ShieldCheck size={24} className="text-[#b8ff4b]" />
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
                Your data stays isolated.
                <br />
                Your costs stay visible.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#82908b]">
                Encrypted Telegram credentials, account-owned lists, durable
                credit history, safety-aware campaign execution, and a support
                line when you need a human.
              </p>
            </div>
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b8ff4b] px-6 py-4 text-sm font-bold text-[#07100d]"
            >
              Enter Signal Desk <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/[0.07] py-8 text-[10px] uppercase tracking-[0.14em] text-[#55635f] sm:flex-row sm:items-center">
          <span>Signal Desk by Aria Labs</span>
          <span className="sm:ml-auto">
            Telegram operations, measured precisely
          </span>
        </footer>
      </div>
    </main>
  );
}
