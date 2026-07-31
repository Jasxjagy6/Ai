"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Bell,
  CalendarDays,
  Copy,
  Gauge,
  KeyRound,
  Loader2,
  LogOut,
  Radar,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import type { ValidatorPlan, ValidatorPlanCode } from "@/lib/validator-plans";
import { SignalSelect } from "@/components/validator/signal-select";

type Account = {
  id: string;
  email: string;
  active: boolean;
  currentPlanCode: string | null;
  planExpiresAt: string | null;
  subscriptionActive: boolean;
  referralCode: string | null;
  affiliateRateBps: number | null;
  referralCount: number;
  affiliateDays: number;
  listsCount: number;
  jobsCount: number;
  telegramSessionsCount: number;
  telegramCampaignsCount: number;
  createdAt: string;
  keys: Array<{
    id: string;
    label: string;
    prefix: string;
    rawKey: string | null;
    revoked: boolean;
    lastUsedAt: string | null;
  }>;
};

type Purchase = {
  id: string;
  email: string;
  planName: string;
  durationDays: number | null;
  amountUsdCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

type Update = {
  id: string;
  title: string;
  body: string;
  tag: string;
  published: boolean;
  publishedAt: string;
};

type Dashboard = {
  plans: Record<ValidatorPlanCode, ValidatorPlan>;
  affiliateRateBps: number;
  accounts: Account[];
  purchases: Purchase[];
  updates: Update[];
  totals: {
    accounts: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    operations: number;
  };
  issuedKey?: string;
};

const FIELD =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-[#071111] px-3 py-2.5 text-sm text-white outline-none focus:border-[#b8ff4b]/50";
const PANEL = "rounded-[24px] border border-white/[0.065] bg-[#111311]";
const PLAN_CODES: ValidatorPlanCode[] = ["week", "month", "six_months", "year"];
const TABS = [
  ["overview", "Overview", Gauge],
  ["accounts", "Accounts & keys", Users],
  ["plans", "Subscriptions", WalletCards],
  ["affiliates", "Affiliates", BadgeDollarSign],
  ["updates", "What's new", Bell],
] as const;

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function ValidatorAdmin({ initiallyAuthenticated }: { initiallyAuthenticated: boolean }) {
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [adminKey, setAdminKey] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [issuedKey, setIssuedKey] = useState("");

  async function load() {
    setData(await request<Dashboard>("/api/validator-admin/dashboard"));
  }

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => void load().catch((error) => setMessage(error.message)), 0);
    return () => window.clearTimeout(timer);
  }, [authenticated]);

  async function action(payload: unknown, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await request<Dashboard & { issuedKey?: string }>(
        "/api/validator-admin/dashboard",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setData(result);
      if (result.issuedKey) {
        setIssuedKey(result.issuedKey);
        await navigator.clipboard.writeText(result.issuedKey).catch(() => undefined);
      }
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated)
    return (
      <main className="signal-desk-theme validator-grid flex min-h-dvh items-center justify-center bg-[#050b0a] p-5 text-white">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              await request("/api/validator-admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: adminKey }),
              });
              setAuthenticated(true);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Access denied");
            } finally {
              setBusy(false);
            }
          }}
          className={`${PANEL} w-full max-w-md p-7 shadow-2xl`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8ff4b]/10 text-[#b8ff4b]"><ShieldCheck size={21} /></span>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">Isolated control plane</p>
          <h1 className="mt-2 text-3xl font-semibold">Validator admin</h1>
          <label className="mt-7 block text-[10px] font-bold uppercase tracking-wider text-[#697772]">
            Admin key
            <input autoFocus type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} className={FIELD} />
          </label>
          {message && <p className="mt-3 text-sm text-[#ff8f8f]">{message}</p>}
          <button disabled={busy || !adminKey} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3 text-sm font-bold text-[#07100d] disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Unlock control plane
          </button>
        </form>
      </main>
    );

  if (!data)
    return <main className="signal-desk-theme flex min-h-dvh items-center justify-center bg-[#050b0a] text-[#b8ff4b]"><Loader2 className="animate-spin" /></main>;

  return (
    <div className="signal-desk-theme flex min-h-dvh bg-[#050b0a] text-[#eef7ed]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#07100f] lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]"><Radar size={19} /></span>
          <div><p className="text-sm font-semibold tracking-[0.08em]">SIGNAL DESK</p><p className="text-[9px] uppercase tracking-[0.18em] text-[#596863]">Validator admin</p></div>
        </div>
        <nav className="flex-1 space-y-1 p-3 pt-6">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${tab === id ? "bg-[#b8ff4b]/10 text-[#dfffaa]" : "text-[#788781] hover:bg-white/[0.04] hover:text-white"}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <button onClick={async () => { await fetch("/api/validator-admin/auth", { method: "DELETE" }); setAuthenticated(false); }} className="m-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-[#74837e] hover:text-white"><LogOut size={14} /> Lock admin</button>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">Control plane / {tab}</p><h1 className="mt-2 text-3xl font-semibold capitalize">{tab.replaceAll("_", " ")}</h1></div>
            <SignalSelect value={tab} onChange={(value) => setTab(value as typeof tab)} searchable={false} className="lg:hidden" options={TABS.map(([id, label]) => ({ value: id, label }))} />
          </div>
          {message && <p className="mt-5 rounded-xl border border-[#b8ff4b]/20 p-3 text-sm text-[#dfffaa]">{message}</p>}
          {issuedKey && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] p-4">
              <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">Key copied to clipboard</p><code className="mt-1 block break-all text-xs">{issuedKey}</code></div>
              <button onClick={() => void navigator.clipboard.writeText(issuedKey)}><Copy size={16} /></button>
            </div>
          )}
          <AdminContent tab={tab} data={data} setData={setData} action={action} busy={busy} />
        </div>
      </main>
    </div>
  );
}

function AdminContent({ tab, data, setData, action, busy }: {
  tab: string;
  data: Dashboard;
  setData: React.Dispatch<React.SetStateAction<Dashboard | null>>;
  action: (payload: unknown, success: string) => Promise<void>;
  busy: boolean;
}) {
  const updatePlan = (code: ValidatorPlanCode, field: keyof ValidatorPlan, value: unknown) =>
    setData((current) => current ? { ...current, plans: { ...current.plans, [code]: { ...current.plans[code], [field]: value } } } : current);

  if (tab === "overview") {
    const metrics: Array<[string, number, LucideIcon]> = [
      ["Accounts", data.totals.accounts, Users],
      ["Active subscriptions", data.totals.activeSubscriptions, ShieldCheck],
      ["Expired subscriptions", data.totals.expiredSubscriptions, CalendarDays],
      ["Recorded operations", data.totals.operations, Activity],
    ];
    return (
      <div className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, Icon]) => <div key={label} className={`${PANEL} p-5`}><Icon size={17} className="text-[#b8ff4b]" /><p className="mt-6 font-mono text-3xl font-semibold">{value.toLocaleString()}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#61706b]">{label}</p></div>)}
        </div>
        <section className={`${PANEL} mt-6 overflow-hidden`}><div className="border-b border-white/[0.07] p-5"><h2 className="font-semibold">Recent subscriptions</h2></div><PurchaseTable purchases={data.purchases.slice(0, 15)} /></section>
      </div>
    );
  }

  if (tab === "accounts") return <AccountsAdmin accounts={data.accounts} action={action} busy={busy} />;

  if (tab === "plans")
    return (
      <div className="mt-6">
        <div className="grid gap-4 xl:grid-cols-2">
          {PLAN_CODES.map((code) => {
            const plan = data.plans[code];
            return (
              <section key={code} className={`${PANEL} p-5`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]"><WalletCards size={17} /></span>
                  <div><p className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">{code.replaceAll("_", " ")}</p><h2 className="font-semibold">{plan.name}</h2></div>
                  <label className="ml-auto text-xs text-[#7b8984]"><input type="checkbox" checked={plan.enabled} onChange={(event) => updatePlan(code, "enabled", event.target.checked)} /> Published</label>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Display name" value={plan.name} set={(value) => updatePlan(code, "name", value)} />
                  <Field label="Price in USD cents" type="number" value={plan.priceUsdCents} set={(value) => updatePlan(code, "priceUsdCents", Number(value))} />
                  <Field label="Subscription days" type="number" value={plan.durationDays} set={() => undefined} disabled />
                  <Field label="Tagline" value={plan.tagline} set={(value) => updatePlan(code, "tagline", value)} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-[#7c8a85]"><span className="rounded-lg border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-3 py-2 text-[#b8ff4b]">All features and unlimited usage</span><label><input type="checkbox" checked={plan.featured} onChange={(event) => updatePlan(code, "featured", event.target.checked)} /> Featured</label></div>
              </section>
            );
          })}
        </div>
        <SaveButton busy={busy} onClick={() => action({ action: "save_plans", plans: data.plans }, "Subscription prices saved.")} />
      </div>
    );

  if (tab === "affiliates")
    return (
      <div className="mt-6">
        <section className={`${PANEL} max-w-xl p-5`}>
          <h2 className="font-semibold">Affiliate subscription reward</h2>
          <p className="mt-1 text-xs leading-5 text-[#697772]">Rewards extend the referrer&apos;s subscription by this percentage of the purchased period.</p>
          <Field label="Default reward percentage" type="number" value={data.affiliateRateBps / 100} set={(value) => setData((current) => current ? { ...current, affiliateRateBps: Math.round(Number(value) * 100) } : current)} />
          <SaveButton busy={busy} onClick={() => action({ action: "save_affiliate", affiliateRateBps: data.affiliateRateBps }, "Affiliate reward saved.")} />
        </section>
        <section className={`${PANEL} mt-5 overflow-x-auto`}>
          <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-[#64726d]"><th className="p-4">Partner</th><th>Code</th><th>Referrals</th><th>Days earned</th><th>Custom rate</th></tr></thead><tbody className="divide-y divide-white/[0.06]">
            {data.accounts.filter((account) => account.referralCount || account.affiliateDays).map((account) => <tr key={account.id}><td className="p-4">{account.email}</td><td className="font-mono text-[#b8ff4b]">{account.referralCode}</td><td>{account.referralCount}</td><td>{account.affiliateDays}</td><td><input type="number" defaultValue={(account.affiliateRateBps ?? data.affiliateRateBps) / 100} onBlur={(event) => void action({ action: "account", accountId: account.id, affiliateRateBps: Math.round(Number(event.target.value) * 100) }, "Affiliate rate updated.")} className="w-24 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5" />%</td></tr>)}
          </tbody></table>
        </section>
      </div>
    );

  return <UpdatesAdmin updates={data.updates} action={action} busy={busy} />;
}

function AccountsAdmin({ accounts, action, busy }: { accounts: Account[]; action: (payload: unknown, success: string) => Promise<void>; busy: boolean }) {
  const [email, setEmail] = useState("");
  const [planCode, setPlanCode] = useState<ValidatorPlanCode>("month");
  return (
    <div className="mt-6">
      <section className={`${PANEL} p-5`}>
        <h2 className="font-semibold">Issue subscription key</h2>
        <p className="mt-1 text-xs text-[#697772]">Create a workspace key and activate the selected subscription period.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Email" value={email} set={setEmail} />
          <label className="text-[10px] uppercase tracking-wider text-[#687670]">Subscription<SignalSelect value={planCode} onChange={(value) => setPlanCode(value as ValidatorPlanCode)} searchable={false} className="mt-1.5" options={PLAN_CODES.map((code) => ({ value: code, label: code.replaceAll("_", " ") }))} /></label>
        </div>
        <button disabled={busy || !email} onClick={() => void action({ action: "create_key", email, label: `${planCode.replaceAll("_", " ")} subscription`, planCode }, "Access key created and copied.")} className="mt-4 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d] disabled:opacity-40">Create access key</button>
      </section>
      <div className="mt-5 space-y-4">
        {accounts.map((account) => <AccountCard key={account.id} account={account} action={action} busy={busy} />)}
      </div>
    </div>
  );
}

function AccountCard({ account, action, busy }: { account: Account; action: (payload: unknown, success: string) => Promise<void>; busy: boolean }) {
  const [days, setDays] = useState(30);
  return (
    <section className={`${PANEL} overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{account.email}</p><p className="mt-1 text-[10px] text-[#64726d]">{account.jobsCount + account.telegramCampaignsCount} operations · {account.telegramSessionsCount} Telegram sessions</p></div>
        <div><p className={`text-xs font-semibold ${account.subscriptionActive ? "text-[#b8ff4b]" : "text-[#ff8f8f]"}`}>{account.subscriptionActive ? "Active subscription" : "Expired subscription"}</p><p className="mt-1 text-[10px] text-[#64726d]">{account.currentPlanCode?.replaceAll("_", " ") || "Manual"} · {account.planExpiresAt ? new Date(account.planExpiresAt).toLocaleString() : "No expiry set"}</p></div>
        <div className="flex items-center gap-2"><input type="number" min={1} value={days} onChange={(event) => setDays(Number(event.target.value))} className="w-20 rounded-lg border border-white/10 bg-[#071111] px-2 py-2 text-xs" /><button disabled={busy || days < 1} onClick={() => void action({ action: "account", accountId: account.id, extendDays: days }, `Subscription extended by ${days} days.`)} className="rounded-lg bg-[#b8ff4b] px-3 py-2 text-xs font-bold text-[#07100d]">Extend days</button><button disabled={busy} onClick={() => void action({ action: "account", accountId: account.id, active: !account.active }, account.active ? "Workspace suspended." : "Workspace activated.")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#9aa7a2]">{account.active ? "Suspend" : "Activate"}</button></div>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {account.keys.map((key) => (
          <div key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <KeyRound size={15} className="text-[#b8ff4b]" />
            <div className="min-w-0 flex-1"><p className="text-xs font-medium">{key.label}</p><code className="mt-1 block break-all text-[10px] text-[#788680]">{key.rawKey || key.prefix}</code></div>
            <div className="flex flex-wrap gap-2">
              {key.rawKey ? <button onClick={async () => { await navigator.clipboard.writeText(key.rawKey!); }} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[10px]"><Copy size={12} /> Copy key</button> : <button disabled={busy} onClick={() => void action({ action: "rotate_key", keyId: key.id }, "Key rotated and copied. Previous sessions were signed out.")} className="flex items-center gap-1.5 rounded-lg border border-[#f4ca64]/20 px-3 py-2 text-[10px] text-[#f4ca64]"><RefreshCw size={12} /> Rotate to recover</button>}
              <button disabled={busy} onClick={() => void action({ action: "revoke_key", keyId: key.id, revoked: !key.revoked }, "Key status updated.")} className={`rounded-lg border px-3 py-2 text-[10px] ${key.revoked ? "border-[#b8ff4b]/20 text-[#b8ff4b]" : "border-[#ff7474]/20 text-[#ff8f8f]"}`}>{key.revoked ? "Restore" : "Revoke"}</button>
            </div>
          </div>
        ))}
        {!account.keys.length && <p className="p-4 text-xs text-[#64726d]">No access keys.</p>}
      </div>
    </section>
  );
}

function UpdatesAdmin({ updates, action, busy }: { updates: Update[]; action: (payload: unknown, success: string) => Promise<void>; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("Update");
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className={`${PANEL} p-5`}><h2 className="font-semibold">Publish project update</h2><Field label="Title" value={title} set={setTitle} /><Field label="Tag" value={tag} set={setTag} /><label className="mt-3 block text-[10px] uppercase tracking-wider text-[#687670]">Announcement<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} className={FIELD} /></label><button disabled={busy || !title || !body} onClick={() => void action({ action: "create_update", title, body, tag, published: true }, "Update published.")} className="mt-4 flex items-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d]"><Bell size={14} /> Publish update</button></section>
      <div className="space-y-3">{updates.map((item) => <article key={item.id} className={`${PANEL} p-5`}><div className="flex items-start gap-3"><div className="flex-1"><span className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">{item.tag}</span><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7d8b86]">{item.body}</p></div><button onClick={() => void action({ action: "delete_update", id: item.id }, "Update deleted.")} className="text-[#ff8585]"><Trash2 size={15} /></button></div></article>)}</div>
    </div>
  );
}

function Field({ label, value, set, type = "text", disabled = false }: { label: string; value: string | number; set: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block text-[10px] uppercase tracking-wider text-[#687670]">{label}<input type={type} value={value} disabled={disabled} onChange={(event) => set(event.target.value)} className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-50`} /></label>;
}

function SaveButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return <button disabled={busy} onClick={onClick} className="mt-5 flex items-center gap-2 rounded-xl bg-[#b8ff4b] px-5 py-3 text-sm font-bold text-[#07100d] disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes</button>;
}

function PurchaseTable({ purchases }: { purchases: Purchase[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-[#64726d]"><th className="p-4">Customer</th><th>Subscription</th><th>Period</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{purchases.map((purchase) => <tr key={purchase.id}><td className="p-4">{purchase.email}</td><td>{purchase.planName}</td><td>{purchase.durationDays || 0} days</td><td>${(purchase.amountUsdCents / 100).toFixed(2)}</td><td className="capitalize">{purchase.status}</td><td>{new Date(purchase.paidAt || purchase.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
  );
}
