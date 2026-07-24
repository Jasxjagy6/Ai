"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, Loader2, Save, ShieldCheck } from "lucide-react";

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
  planName: string;
  planCode: string;
  amountUsdCents: number;
  status: string;
  providerTrackId: string | null;
  paidAt: string | null;
  claimedAt: string | null;
  createdAt: string;
};

const CODES: Plan["code"][] = ["trial", "month", "year", "lifetime", "messaging_month", "messaging_year", "messaging_lifetime"];
const FIELD = "mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent";

export default function ValidatorPlansPage() {
  const [plans, setPlans] = useState<Record<Plan["code"], Plan> | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/validator-plans").then((response) => response.json()).then((data) => {
      setPlans(data.plans);
      setPurchases(data.purchases || []);
    });
  }, []);

  function update(code: Plan["code"], field: keyof Plan, value: unknown) {
    setPlans((current) => current ? { ...current, [code]: { ...current[code], [field]: value } } : current);
  }

  async function save() {
    if (!plans) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/validator-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "Unable to save plans");
    setPlans(data.plans);
    setMessage("Validator plans saved and live.");
  }

  if (!plans) return <p className="text-sm text-text-secondary">Loading validator plans...</p>;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold">Validator Plans</h1><p className="mt-1 text-sm text-text-secondary">Control OxaPay pricing, access length, quotas, and storefront availability.</p></div>
        <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save plans</button>
      </div>
      {message && <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${message.includes("saved") ? "border-success/20 bg-success/5 text-success" : "border-error/20 bg-error/5 text-error"}`}>{message}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {CODES.map((code) => {
          const plan = plans[code];
          return <section key={code} className="rounded-2xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><CircleDollarSign size={18} /></span><div><p className="text-xs font-bold uppercase tracking-wider text-accent">{code}</p><h2 className="font-semibold">{plan.name}</h2></div><label className="ml-auto flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={plan.enabled} onChange={(event) => update(code, "enabled", event.target.checked)} className="accent-accent" />Published</label></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-secondary">Display name<input value={plan.name} onChange={(event) => update(code, "name", event.target.value)} className={FIELD} /></label>
              <label className="text-xs text-text-secondary">Price USD (cents)<input type="number" min={0} disabled={code === "trial"} value={plan.priceUsdCents} onChange={(event) => update(code, "priceUsdCents", Number(event.target.value) || 0)} className={FIELD} /></label>
              <label className="text-xs text-text-secondary">Access days (blank = lifetime)<input type="number" min={1} value={plan.durationDays ?? ""} onChange={(event) => update(code, "durationDays", event.target.value ? Number(event.target.value) : null)} className={FIELD} /></label>
              <label className="text-xs text-text-secondary">Username checks (blank = unlimited)<input type="number" min={1} value={plan.requestLimit ?? ""} onChange={(event) => update(code, "requestLimit", event.target.value ? Number(event.target.value) : null)} className={FIELD} /></label>
              <label className="text-xs text-text-secondary">Session limit<input type="number" min={1} value={plan.sessionLimit ?? ""} onChange={(event) => update(code, "sessionLimit", event.target.value ? Number(event.target.value) : null)} className={FIELD} /></label>
              <label className="text-xs text-text-secondary">DM allowance<input type="number" min={1} value={plan.messageLimit ?? ""} onChange={(event) => update(code, "messageLimit", event.target.value ? Number(event.target.value) : null)} className={FIELD} /></label>
            </div>
            <label className="mt-3 block text-xs text-text-secondary">Tagline<input value={plan.tagline} onChange={(event) => update(code, "tagline", event.target.value)} className={FIELD} /></label>
            <label className="mt-3 block text-xs text-text-secondary">Features, one per line<textarea rows={4} value={plan.features.join("\n")} onChange={(event) => update(code, "features", event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} className={FIELD} /></label>
            <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={plan.featured} onChange={(event) => update(code, "featured", event.target.checked)} className="accent-accent" />Highlight this plan as recommended</label>
            <div className="mt-3 flex flex-wrap gap-4 rounded-xl border border-border bg-bg p-3"><label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={plan.validatorAccess} onChange={(event) => update(code, "validatorAccess", event.target.checked)} className="accent-accent" />Validator access</label><label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={plan.messagingAccess} onChange={(event) => update(code, "messagingAccess", event.target.checked)} className="accent-accent" />Messaging access</label></div>
          </section>;
        })}
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold">Recent validator purchases</h2><p className="text-xs text-text-secondary">OxaPay invoices and free-trial claims</p></div><ShieldCheck size={17} className="text-success" /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-text-secondary"><th className="px-5 py-3">Customer</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Created</th><th className="px-5 py-3">Track ID</th></tr></thead><tbody className="divide-y divide-border">{purchases.map((purchase) => <tr key={purchase.id}><td className="px-5 py-3 font-medium">{purchase.email}</td><td className="px-3 py-3">{purchase.planName}</td><td className="px-3 py-3">{purchase.amountUsdCents ? `$${(purchase.amountUsdCents / 100).toFixed(2)}` : "Free"}</td><td className="px-3 py-3"><span className="rounded-full bg-accent-soft px-2 py-1 text-[10px] font-bold uppercase text-accent">{purchase.status}</span></td><td className="px-3 py-3 text-text-secondary">{new Date(purchase.createdAt).toLocaleString()}</td><td className="px-5 py-3 font-mono text-xs text-text-secondary">{purchase.providerTrackId || "-"}</td></tr>)}</tbody></table></div>
        {!purchases.length && <p className="p-10 text-center text-sm text-text-secondary">No validator purchases yet.</p>}
      </section>
    </div>
  );
}
