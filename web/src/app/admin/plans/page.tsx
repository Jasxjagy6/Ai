"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

type PlanDraft = {
  name: string;
  tagline: string;
  priceInr: number;
  priceUsd: number;
  messagesPerDay: number;
  apiRequestsPerDay: number;
  apiKeysAllowed: number;
  features: string[];
};

type Trial = { days: number; tier: "PLUS" | "PRO" };

const TIERS = ["FREE", "PLUS", "PRO"] as const;

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Record<string, PlanDraft> | null>(null);
  const [trial, setTrial] = useState<Trial>({ days: 0, tier: "PLUS" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d) => {
        setPlans(d.plans);
        setTrial(d.trial);
      });
  }, []);

  function set(tier: string, field: keyof PlanDraft, value: unknown) {
    setPlans((p) => (p ? { ...p, [tier]: { ...p[tier], [field]: value } } : p));
  }

  async function save() {
    if (!plans) return;
    setMsg("");
    const res = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans, trial }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Save failed");
      return;
    }
    setMsg("Saved ✓ — live immediately");
    setTimeout(() => setMsg(""), 3000);
  }

  if (!plans) return <p className="text-muted">Loading plans...</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Plans &amp; Billing</h1>
      <p className="mt-1 text-sm text-muted">
        Prices, limits, and trial settings. Changes apply instantly to the pricing page, checkout,
        and quota enforcement — no redeploy.
      </p>

      {/* Trial config */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Free trial for new signups</h2>
        <p className="mt-0.5 text-xs text-muted">
          0 days = no trial. Otherwise every new account starts with the chosen plan for N days.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted">Days:</span>
            <input
              type="number"
              min={0}
              max={90}
              value={trial.days}
              onChange={(e) => setTrial((t) => ({ ...t, days: parseInt(e.target.value) || 0 }))}
              className="w-20 rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">Trial plan:</span>
            <select
              value={trial.tier}
              onChange={(e) => setTrial((t) => ({ ...t, tier: e.target.value as Trial["tier"] }))}
              className="rounded-xl border border-border bg-bg px-3 py-2 outline-none"
            >
              <option value="PLUS">PLUS</option>
              <option value="PRO">PRO</option>
            </select>
          </label>
        </div>
      </div>

      {/* Per-plan editors */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const p = plans[tier];
          return (
            <div key={tier} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">{tier}</p>
              <div className="mt-3 space-y-3 text-sm">
                <label className="block">
                  <span className="text-xs text-muted">Display name</span>
                  <input
                    value={p.name}
                    onChange={(e) => set(tier, "name", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Tagline</span>
                  <input
                    value={p.tagline}
                    onChange={(e) => set(tier, "tagline", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-muted">Price ₹ (paise)</span>
                    <input
                      type="number"
                      min={0}
                      value={p.priceInr}
                      onChange={(e) => set(tier, "priceInr", parseInt(e.target.value) || 0)}
                      className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Price $ (cents)</span>
                    <input
                      type="number"
                      min={0}
                      value={p.priceUsd}
                      onChange={(e) => set(tier, "priceUsd", parseInt(e.target.value) || 0)}
                      className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted">
                  Showing as: ₹{(p.priceInr / 100).toFixed(0)} / ${(p.priceUsd / 100).toFixed(2)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-muted">Msgs/day (-1 = ∞)</span>
                    <input
                      type="number"
                      min={-1}
                      value={p.messagesPerDay}
                      onChange={(e) => set(tier, "messagesPerDay", parseInt(e.target.value) ?? 0)}
                      className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">API req/day</span>
                    <input
                      type="number"
                      min={-1}
                      value={p.apiRequestsPerDay}
                      onChange={(e) => set(tier, "apiRequestsPerDay", parseInt(e.target.value) ?? 0)}
                      className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-muted">API keys allowed</span>
                  <input
                    type="number"
                    min={0}
                    value={p.apiKeysAllowed}
                    onChange={(e) => set(tier, "apiKeysAllowed", parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Features (one per line)</span>
                  <textarea
                    rows={5}
                    value={p.features.join("\n")}
                    onChange={(e) =>
                      set(tier, "features", e.target.value.split("\n").filter(Boolean))
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-xl bg-accent-strong px-6 py-2.5 font-semibold text-white transition hover:opacity-90"
        >
          <Save size={16} /> Save plans
        </button>
        {msg && <span className="text-sm text-green-600 dark:text-green-400">{msg}</span>}
      </div>
    </div>
  );
}
