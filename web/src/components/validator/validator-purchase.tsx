"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CalendarDays,
  KeyRound,
  Loader2,
  Radar,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { ValidatorPlan } from "@/lib/validator-plans";

type Purchase = {
  id: string;
  email: string;
  planCode: string;
  planName: string;
  purchaseType: "plan";
  durationDays: number;
  status: string;
  amountUsdCents: number;
  paymentUrl: string | null;
  issued: boolean;
};

function LogoMark() {
  return (
    <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#b8ff4b]/30 bg-[#b8ff4b]/10">
      <Radar size={20} className="text-[#b8ff4b]" />
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b8ff4b] shadow-[0_0_10px_#b8ff4b]" />
    </span>
  );
}

export function ValidatorPurchase({
  plans,
  initialPurchase,
  initialToken,
  initialPlan,
  initialReferral,
}: {
  plans: ValidatorPlan[];
  initialPurchase?: string;
  initialToken?: string;
  initialPlan?: string;
  initialReferral?: string;
}) {
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferral || "");
  const [selected, setSelected] = useState(
    plans.find((plan) => plan.code === initialPlan)?.code ||
      plans.find((plan) => plan.featured)?.code ||
      plans[0]?.code ||
      "month",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [purchaseId, setPurchaseId] = useState(initialPurchase || "");
  const [token, setToken] = useState(initialToken || "");
  const [key, setKey] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!purchaseId) return;
    const stored =
      window.localStorage.getItem(`validator_purchase_${purchaseId}`) || "";
    const activeToken = token || stored;
    if (!activeToken) return;
    window.localStorage.setItem(
      `validator_purchase_${purchaseId}`,
      activeToken,
    );
    if (initialToken)
      window.history.replaceState(
        {},
        "",
        `/buy?purchase=${encodeURIComponent(purchaseId)}`,
      );
    let stopped = false;
    let timer: number | undefined;
    async function poll() {
      try {
        const response = await fetch(
          `/api/validator/billing/purchases/${purchaseId}?token=${encodeURIComponent(activeToken)}`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.error || "Unable to retrieve payment");
        if (stopped) return;
        setPurchase(data.purchase);
        setEmail(data.purchase.email);
        if (data.purchase.issued && !claimed) {
          const claim = await fetch(
            `/api/validator/billing/purchases/${purchaseId}/claim`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: activeToken }),
            },
          );
          const result = await claim.json().catch(() => ({}));
          if (!claim.ok)
            throw new Error(result.error || "Unable to activate purchase");
          if (!stopped) {
            setKey(result.key || null);
            setClaimed(true);
          }
          return;
        }
        if (
          !data.purchase.issued &&
          !["expired", "refunded", "failed"].includes(data.purchase.status)
        )
          timer = window.setTimeout(poll, 3000);
      } catch (caught) {
        if (!stopped)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to retrieve payment",
          );
      }
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [claimed, initialToken, purchaseId, token]);

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/validator/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "plan",
          email,
          planCode: selected,
          referralCode: referralCode || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Unable to start checkout");
      window.localStorage.setItem(
        `validator_purchase_${data.purchaseId}`,
        data.claimToken,
      );
      if (data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }
      setPurchaseId(data.purchaseId);
      setToken(data.claimToken);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start checkout",
      );
    } finally {
      setBusy(false);
    }
  }

  if (purchaseId) {
    const failed =
      purchase && ["expired", "refunded", "failed"].includes(purchase.status);
    return (
      <main className="signal-desk-theme validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] px-4 py-10 text-[#eef7ed] sm:px-6">
        <div className="validator-orb validator-orb-one" />
        <div className="validator-orb validator-orb-two" />
        <div className="relative mx-auto max-w-2xl validator-reveal">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-[#71807c] hover:text-white"
          >
            <ArrowLeft size={13} /> Signal Desk
          </Link>
          <section className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1717]/95 shadow-[0_30px_100px_rgba(0,0,0,.55)]">
            <div className="border-b border-white/[0.07] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <LogoMark />
                <div>
                  <p className="text-sm font-semibold tracking-[0.08em]">
                    SIGNAL DESK
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-[#5f6e69]">
                    Secure subscription activation
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              {claimed ? (
                <div className="validator-reveal">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b8ff4b]/25 bg-[#b8ff4b]/10 text-[#b8ff4b]">
                    {key ? <KeyRound size={24} /> : <CalendarDays size={24} />}
                  </span>
                  <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
                    Purchase activated
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                    Your {purchase?.durationDays}-day subscription is active.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[#81908c]">
                    {key
                      ? "Your plan includes a new access key. Keep it somewhere safe; this browser is already signed in."
                      : "Your existing workspace subscription was extended. You can continue operating immediately."}
                  </p>
                  {key && (
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#b8ff4b]/20 bg-[#071111] p-4">
                      <code className="min-w-0 flex-1 break-all font-mono text-sm text-[#dfffaa]">
                        {key}
                      </code>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(key);
                          setCopied(true);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-[#81908c] hover:text-[#b8ff4b]"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  )}
                  <Link
                    href="/workspace"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3.5 text-sm font-bold text-[#07100d]"
                  >
                    Open workspace <ArrowRight size={16} />
                  </Link>
                </div>
              ) : failed ? (
                <div>
                  <h1 className="text-3xl font-semibold">
                    Payment {purchase?.status}.
                  </h1>
                  <p className="mt-3 text-sm text-[#81908c]">
                    No subscription time was issued. Return to the plans and try again
                    when ready.
                  </p>
                  <Link
                    href="/buy"
                    className="mt-6 inline-flex rounded-xl bg-[#b8ff4b] px-5 py-3 text-sm font-bold text-[#07100d]"
                  >
                    Return to plans
                  </Link>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Loader2
                    size={28}
                    className="mx-auto animate-spin text-[#b8ff4b]"
                  />
                  <h1 className="mt-5 text-2xl font-semibold">
                    Confirming your payment
                  </h1>
                  <p className="mt-2 text-sm text-[#71807c]">
                    The workspace will activate automatically.
                  </p>
                </div>
              )}
              {error && (
                <p className="mt-5 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] p-3 text-sm text-[#ff9b9b]">
                  {error}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const current = plans.find((plan) => plan.code === selected);
  return (
    <main className="signal-desk-theme validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed]">
      <div className="validator-orb validator-orb-one" />
      <div className="validator-orb validator-orb-two" />
      <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between validator-reveal">
          <Link href="/" className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold tracking-[0.08em]">
                SIGNAL DESK
              </p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-[#5f6e69]">
                Subscriptions
              </p>
            </div>
          </Link>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-xs text-[#71807c] hover:text-white"
          >
            <ArrowLeft size={13} />I have a key
          </Link>
        </header>
        <section className="mx-auto max-w-3xl pb-10 pt-16 text-center sm:pt-24 validator-reveal">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8ff4b]">
            <Sparkles size={12} />
            Every feature included
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
            Choose your operating level.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#81908c] sm:text-base">
            Every subscription includes every Signal Desk feature, unlimited
            fleet access, and unlimited operations while the period is active.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <button
              key={plan.code}
              onClick={() => setSelected(plan.code)}
              style={{ animationDelay: `${index * 80}ms` }}
              className={`validator-card-in group relative rounded-[26px] border p-5 text-left transition hover:-translate-y-1 ${selected === plan.code ? "border-[#b8ff4b]/45 bg-[#b8ff4b]/[0.07]" : "border-white/[0.08] bg-[#0b1717] hover:border-white/20"}`}
            >
              {plan.featured && (
                <span className="absolute right-4 top-4 rounded-full bg-[#b8ff4b] px-2 py-1 text-[8px] font-black uppercase text-[#07100d]">
                  Recommended
                </span>
              )}
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected === plan.code ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "bg-white/[0.04] text-[#71807c]"}`}
              >
                {plan.code === "year" ? <CalendarDays size={18} /> : <WalletCards size={18} />}
              </span>
              <p className="mt-5 text-lg font-semibold">{plan.name}</p>
              <p className="mt-1 min-h-10 text-xs leading-5 text-[#65736f]">
                {plan.tagline}
              </p>
              <p className="mt-5 font-mono text-3xl font-semibold">
                ${(plan.priceUsdCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 font-mono text-xs text-[#b8ff4b]">
                {plan.durationDays} days full access
              </p>
              <div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4">
                {plan.features.map((feature) => (
                  <p
                    key={feature}
                    className="flex items-start gap-2 text-[11px] leading-5 text-[#81908c]"
                  >
                    <Check size={12} className="mt-1 shrink-0 text-[#b8ff4b]" />
                    {feature}
                  </p>
                ))}
              </div>
            </button>
          ))}
        </section>
        <section className="mx-auto mb-16 mt-6 max-w-2xl rounded-[26px] border border-white/[0.09] bg-[#0b1717]/95 p-5 shadow-2xl sm:p-6 validator-reveal">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 text-[#40d6c2]" />
            <div>
              <h2 className="text-sm font-semibold">
                Activate {current?.name}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#65736f]">
                Your email identifies your isolated workspace. Checkout
                continues securely through OxaPay.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
              Delivery email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operator@example.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071111] px-4 py-3 text-sm text-white outline-none focus:border-[#b8ff4b]/50"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">
              Referral code{" "}
              <span className="normal-case tracking-normal text-[#4e5c58]">
                optional
              </span>
              <input
                value={referralCode}
                onChange={(event) =>
                  setReferralCode(event.target.value.toUpperCase())
                }
                placeholder="SIGNALCODE"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071111] px-4 py-3 font-mono text-sm text-white outline-none focus:border-[#b8ff4b]/50"
              />
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] p-3 text-sm text-[#ff9b9b]">
              {error}
            </p>
          )}
          <button
            onClick={checkout}
            disabled={busy || !email.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3.5 text-sm font-bold text-[#07100d] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <KeyRound size={16} />
            )}
            {busy
              ? "Preparing checkout..."
              : `Pay $${((current?.priceUsdCents || 0) / 100).toFixed(2)} with OxaPay`}
            <ArrowRight size={16} className="ml-auto" />
          </button>
        </section>
      </div>
    </main>
  );
}
