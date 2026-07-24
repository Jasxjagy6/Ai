"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, Crown, Infinity, KeyRound, Loader2, Radar, ShieldCheck, Sparkles, TimerReset, WalletCards } from "lucide-react";

type Plan = {
  code: "trial" | "month" | "year" | "lifetime" | "messaging_month" | "messaging_year" | "messaging_lifetime";
  name: string;
  tagline: string;
  priceUsdCents: number;
  durationDays: number | null;
  requestLimit: number | null;
  validatorAccess: boolean;
  messagingAccess: boolean;
  sessionLimit: number | null;
  messageLimit: number | null;
  enabled: boolean;
  featured: boolean;
  features: string[];
};

type Purchase = {
  id: string;
  email: string;
  planCode: string;
  planName: string;
  status: string;
  amountUsdCents: number;
  paymentUrl: string | null;
  expiresAt: string | null;
  requestLimit: number | null;
  requestsUsed: number;
  issued: boolean;
};

function LogoMark() {
  return <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#b8ff4b]/30 bg-[#b8ff4b]/10"><Radar size={20} className="text-[#b8ff4b]" /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b8ff4b] shadow-[0_0_10px_#b8ff4b]" /></span>;
}

export function ValidatorPurchase({ plans, initialPurchase, initialToken }: { plans: Plan[]; initialPurchase?: string; initialToken?: string }) {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Plan["code"]>(plans.find((plan) => plan.featured)?.code || plans[0]?.code || "trial");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [purchaseId, setPurchaseId] = useState(initialPurchase || "");
  const [token, setToken] = useState(initialToken || "");
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!purchaseId) return;
    const stored = window.localStorage.getItem(`validator_purchase_${purchaseId}`) || "";
    const activeToken = token || stored;
    if (!activeToken) return;
    window.localStorage.setItem(`validator_purchase_${purchaseId}`, activeToken);
    if (initialToken) window.history.replaceState({}, "", `/validator/buy?purchase=${encodeURIComponent(purchaseId)}`);

    let stopped = false;
    let timer: number | undefined;
    async function poll() {
      try {
        const response = await fetch(`/api/validator/billing/purchases/${purchaseId}?token=${encodeURIComponent(activeToken)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to retrieve payment");
        if (stopped) return;
        setPurchase(data.purchase);
        setEmail(data.purchase.email);
        if (data.purchase.issued && !key) {
          const claim = await fetch(`/api/validator/billing/purchases/${purchaseId}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: activeToken }),
          });
          const claimed = await claim.json().catch(() => ({}));
          if (!claim.ok) throw new Error(claimed.error || "Unable to issue access key");
          if (!stopped) setKey(claimed.key);
          return;
        }
        if (!["expired", "refunded", "failed"].includes(data.purchase.status)) timer = window.setTimeout(poll, 3000);
      } catch (caught) {
        if (!stopped) setError(caught instanceof Error ? caught.message : "Unable to retrieve payment");
      }
    }
    void poll();
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [initialToken, key, purchaseId, token]);

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/validator/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planCode: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to start checkout");
      window.localStorage.setItem(`validator_purchase_${data.purchaseId}`, data.claimToken);
      if (data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }
      setPurchaseId(data.purchaseId);
      setToken(data.claimToken);
      window.history.replaceState({}, "", `/validator/buy?purchase=${encodeURIComponent(data.purchaseId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start checkout");
    } finally {
      setBusy(false);
    }
  }

  if (purchaseId) {
    const failed = purchase && ["expired", "refunded", "failed"].includes(purchase.status);
    return <main className="validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] px-4 py-8 text-[#eef7ed] sm:px-6 sm:py-12">
      <div className="validator-orb validator-orb-one" /><div className="validator-orb validator-orb-two" />
      <div className="relative mx-auto max-w-2xl validator-reveal">
        <Link href="/validator" className="inline-flex items-center gap-2 text-xs font-medium text-[#71807c] transition hover:text-white"><ArrowLeft size={13} />Back to Signal Desk</Link>
        <section className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1717]/95 shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-xl">
          <div className="border-b border-white/[0.07] p-6 sm:p-8"><div className="flex items-center gap-3"><LogoMark /><div><p className="text-sm font-semibold tracking-[0.08em]">SIGNAL DESK</p><p className="text-[9px] uppercase tracking-[0.18em] text-[#5f6e69]">Secure access delivery</p></div></div></div>
          <div className="p-6 sm:p-8">
            {key ? <div className="validator-reveal"><span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b8ff4b]/25 bg-[#b8ff4b]/10 text-[#b8ff4b]"><KeyRound size={24} /></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">Access issued</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Your workspace is ready.</h1><p className="mt-3 text-sm leading-6 text-[#81908c]">The access key below unlocks {purchase?.planName || "your plan"}. This browser is already signed in, but keep the key somewhere safe for another device.</p><div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#b8ff4b]/20 bg-[#071111] p-4"><code className="min-w-0 flex-1 break-all font-mono text-sm text-[#dfffaa]">{key}</code><button onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#81908c] transition hover:border-[#b8ff4b]/30 hover:text-[#b8ff4b]">{copied ? <Check size={16} /> : <Copy size={16} />}</button></div><Link href="/validator" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3.5 text-sm font-bold text-[#07100d] transition hover:bg-[#ceff82]">Open Signal Desk<ArrowRight size={16} /></Link></div> : failed ? <div><span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff7474]/25 bg-[#ff7474]/10 text-[#ff8585]"><TimerReset size={24} /></span><h1 className="mt-6 text-3xl font-semibold">Payment {purchase?.status}.</h1><p className="mt-3 text-sm text-[#81908c]">No key was issued. Choose a plan again when you are ready.</p><Link href="/validator/buy" className="mt-6 inline-flex rounded-xl bg-[#b8ff4b] px-5 py-3 text-sm font-bold text-[#07100d]">Return to plans</Link></div> : <div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#65e6ff]/20 bg-[#65e6ff]/[0.07] text-[#65e6ff]"><Loader2 size={25} className="animate-spin" /></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#65e6ff]">Payment monitor live</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Waiting for confirmation.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#81908c]">Once OxaPay confirms the transaction, your key will be issued automatically on this screen. You can safely return later in this browser.</p><p className="mt-6 font-mono text-xs text-[#5f6e69]">Status: {purchase?.status || "checking"}</p>{purchase?.paymentUrl && <a href={purchase.paymentUrl} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#b8ff4b] hover:underline">Return to OxaPay<ArrowRight size={14} /></a>}</div>}
            {error && <p className="mt-5 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] p-3 text-sm text-[#ff9b9b]">{error}</p>}
          </div>
        </section>
      </div>
    </main>;
  }

  const current = plans.find((plan) => plan.code === selected);
  return <main className="validator-grid relative min-h-dvh overflow-hidden bg-[#050b0a] text-[#eef7ed]">
    <div className="validator-orb validator-orb-one" /><div className="validator-orb validator-orb-two" />
    <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between validator-reveal"><Link href="/validator" className="flex items-center gap-3"><LogoMark /><div><p className="text-sm font-semibold tracking-[0.08em]">SIGNAL DESK</p><p className="text-[9px] uppercase tracking-[0.18em] text-[#5f6e69]">Access plans</p></div></Link><Link href="/validator" className="inline-flex items-center gap-2 text-xs text-[#71807c] transition hover:text-white"><ArrowLeft size={13} />I have a key</Link></header>
      <section className="mx-auto max-w-3xl pb-10 pt-16 text-center sm:pt-24 validator-reveal"><span className="inline-flex items-center gap-2 rounded-full border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8ff4b]"><Sparkles size={12} />Crypto checkout by OxaPay</span><h1 className="mt-6 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Choose your signal window.</h1><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#81908c] sm:text-base">Start with a limited free trial or unlock uninterrupted Telegram username validation. Payment confirmation and key delivery are automatic.</p></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan, index) => <button key={plan.code} onClick={() => setSelected(plan.code)} style={{ animationDelay: `${index * 80}ms` }} className={`validator-card-in group relative overflow-hidden rounded-[26px] border p-5 text-left transition duration-300 hover:-translate-y-1 ${selected === plan.code ? "border-[#b8ff4b]/45 bg-[#b8ff4b]/[0.07] shadow-[0_18px_60px_rgba(184,255,75,.08)]" : "border-white/[0.08] bg-[#0b1717] hover:border-white/20"}`}>{plan.featured && <span className="absolute right-4 top-4 rounded-full bg-[#b8ff4b] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#07100d]">Recommended</span>}<span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected === plan.code ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "bg-white/[0.04] text-[#71807c]"}`}>{plan.code === "trial" ? <TimerReset size={18} /> : plan.code.includes("lifetime") ? <Infinity size={20} /> : plan.code.includes("year") ? <Crown size={18} /> : <WalletCards size={18} />}</span><p className="mt-5 text-lg font-semibold">{plan.name}</p><p className="mt-1 min-h-10 text-xs leading-5 text-[#65736f]">{plan.tagline}</p><div className="mt-3 flex gap-1.5">{plan.validatorAccess && <span className="rounded-full border border-[#65e6ff]/20 bg-[#65e6ff]/[0.06] px-2 py-1 text-[8px] font-bold uppercase text-[#65e6ff]">Validator</span>}{plan.messagingAccess && <span className="rounded-full border border-[#d8b7ff]/20 bg-[#d8b7ff]/[0.06] px-2 py-1 text-[8px] font-bold uppercase text-[#d8b7ff]">Messaging</span>}</div><p className="mt-5 font-mono text-3xl font-semibold tracking-tight text-white">{plan.priceUsdCents ? `$${(plan.priceUsdCents / 100).toFixed(2)}` : "Free"}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#56645f]">{plan.durationDays ? `${plan.durationDays} days` : "No expiry"}</p><div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4">{plan.features.map((feature) => <p key={feature} className="flex gap-2 text-[11px] leading-5 text-[#8c9a95]"><Check size={12} className="mt-1 shrink-0 text-[#b8ff4b]" />{feature}</p>)}</div></button>)}</section>
      <section className="mx-auto mb-16 mt-6 max-w-2xl rounded-[26px] border border-white/[0.09] bg-[#0b1717]/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6 validator-reveal"><div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#40d6c2]" /><div><h2 className="text-sm font-semibold">Activate {current?.name}</h2><p className="mt-1 text-xs leading-5 text-[#65736f]">Your email identifies your isolated workspace. Paid plans continue to OxaPay; the free trial activates immediately.</p></div></div><label className="mt-5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d7b77]">Delivery email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-[#071111] px-4 py-3 text-sm text-white outline-none transition focus:border-[#b8ff4b]/50 focus:ring-4 focus:ring-[#b8ff4b]/[0.06]" /></label>{error && <p className="mt-3 rounded-xl border border-[#ff7474]/20 bg-[#ff7474]/[0.07] p-3 text-sm text-[#ff9b9b]">{error}</p>}<button onClick={checkout} disabled={busy || !email.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3.5 text-sm font-bold text-[#07100d] transition hover:bg-[#ceff82] active:scale-[0.99] disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}{busy ? "Preparing access..." : current?.priceUsdCents ? `Pay $${(current.priceUsdCents / 100).toFixed(2)} with OxaPay` : "Start free trial"}<ArrowRight size={16} className="ml-auto" /></button></section>
    </div>
  </main>;
}
