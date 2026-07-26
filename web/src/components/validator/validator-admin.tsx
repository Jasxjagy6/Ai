"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Bell,
  Coins,
  Copy,
  Gauge,
  KeyRound,
  Loader2,
  LogOut,
  Radar,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import type { ValidatorPlan, ValidatorPlanCode } from "@/lib/validator-plans";
import type {
  ValidatorCreditSettings,
  ValidatorTaskCode,
} from "@/lib/validator-credits";
import { SignalSelect } from "@/components/validator/signal-select";

type Account = {
  id: string;
  email: string;
  active: boolean;
  creditsBalance: number;
  creditsPurchased: number;
  creditsSpent: number;
  currentPlanCode: string | null;
  planExpiresAt: string | null;
  referralCode: string | null;
  affiliateRateBps: number | null;
  referralCount: number;
  affiliateCredits: number;
  listsCount: number;
  jobsCount: number;
  telegramSessionsCount: number;
  telegramCampaignsCount: number;
  createdAt: string;
  keys: Array<{
    id: string;
    label: string;
    prefix: string;
    revoked: boolean;
    expiresAt: string | null;
    lastUsedAt: string | null;
  }>;
};
type Purchase = {
  id: string;
  email: string;
  planName: string;
  purchaseType: string;
  creditsAmount: number;
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
  creditSettings: ValidatorCreditSettings;
  accounts: Account[];
  purchases: Purchase[];
  updates: Update[];
  totals: {
    _count: number;
    _sum: {
      creditsBalance: number | null;
      creditsPurchased: number | null;
      creditsSpent: number | null;
    };
  };
  issuedKey?: string;
};

const FIELD =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-[#071111] px-3 py-2.5 text-sm text-white outline-none focus:border-[#b8ff4b]/50";
const PANEL = "rounded-[24px] border border-white/[0.065] bg-[#111311]";
const PLAN_CODES: ValidatorPlanCode[] = ["basic", "pro", "vip", "enterprise"];
const TABS = [
  ["overview", "Overview", Gauge],
  ["accounts", "Accounts", Users],
  ["plans", "Plans", WalletCards],
  ["pricing", "Credit pricing", Coins],
  ["affiliates", "Affiliates", BadgeDollarSign],
  ["updates", "What's new", Bell],
] as const;

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function ValidatorAdmin({
  initiallyAuthenticated,
}: {
  initiallyAuthenticated: boolean;
}) {
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
    const timer = window.setTimeout(() => {
      void load().catch((error) => setMessage(error.message));
    }, 0);
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
        await navigator.clipboard
          .writeText(result.issuedKey)
          .catch(() => undefined);
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
              setMessage(
                error instanceof Error ? error.message : "Access denied",
              );
            } finally {
              setBusy(false);
            }
          }}
          className={`${PANEL} w-full max-w-md p-7 shadow-2xl`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
            <ShieldCheck size={21} />
          </span>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
            Isolated control plane
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Validator admin</h1>
          <p className="mt-2 text-sm leading-6 text-[#7b8a85]">
            This console uses a dedicated environment key and is completely
            separate from Aria administration.
          </p>
          <label className="mt-7 block text-[10px] font-bold uppercase tracking-wider text-[#697772]">
            Admin key
            <input
              autoFocus
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              className={FIELD}
            />
          </label>
          {message && <p className="mt-3 text-sm text-[#ff8f8f]">{message}</p>}
          <button
            disabled={busy || !adminKey}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-3 text-sm font-bold text-[#07100d] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <KeyRound size={15} />
            )}
            Unlock control plane
          </button>
        </form>
      </main>
    );
  if (!data)
    return (
      <main className="signal-desk-theme flex min-h-dvh items-center justify-center bg-[#050b0a] text-[#b8ff4b]">
        <Loader2 className="animate-spin" />
      </main>
    );

  return (
    <div className="signal-desk-theme flex min-h-dvh bg-[#050b0a] text-[#eef7ed]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#07100f] lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
            <Radar size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.08em]">
              SIGNAL DESK
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#596863]">
              Validator admin
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3 pt-6">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${tab === id ? "bg-[#b8ff4b]/10 text-[#dfffaa]" : "text-[#788781] hover:bg-white/[0.04] hover:text-white"}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={async () => {
            await fetch("/api/validator-admin/auth", { method: "DELETE" });
            setAuthenticated(false);
          }}
          className="m-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-[#74837e] hover:text-white"
        >
          <LogOut size={14} />
          Lock admin
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8ff4b]">
                Control plane / {tab}
              </p>
              <h1 className="mt-2 text-3xl font-semibold capitalize">
                {tab.replaceAll("_", " ")}
              </h1>
            </div>
            <SignalSelect
              value={tab}
              onChange={(value) => setTab(value as typeof tab)}
              placeholder="Admin section"
              searchable={false}
              className="lg:hidden"
              options={TABS.map(([id, label]) => ({ value: id, label }))}
            />
          </div>
          {message && (
            <p
              className={`mt-5 rounded-xl border p-3 text-sm ${message.includes("failed") || message.includes("Invalid") ? "border-[#ff7474]/20 text-[#ff9b9b]" : "border-[#b8ff4b]/20 text-[#dfffaa]"}`}
            >
              {message}
            </p>
          )}
          {issuedKey && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                  New key copied to clipboard
                </p>
                <code className="mt-1 block break-all text-xs">
                  {issuedKey}
                </code>
              </div>
              <button
                onClick={() => void navigator.clipboard.writeText(issuedKey)}
              >
                <Copy size={16} />
              </button>
            </div>
          )}
          <AdminContent
            tab={tab}
            data={data}
            setData={setData}
            action={action}
            busy={busy}
          />
        </div>
      </main>
    </div>
  );
}

function AdminContent({
  tab,
  data,
  setData,
  action,
  busy,
}: {
  tab: string;
  data: Dashboard;
  setData: React.Dispatch<React.SetStateAction<Dashboard | null>>;
  action: (payload: unknown, success: string) => Promise<void>;
  busy: boolean;
}) {
  const updatePlan = (
    code: ValidatorPlanCode,
    field: keyof ValidatorPlan,
    value: unknown,
  ) =>
    setData((current) =>
      current
        ? {
            ...current,
            plans: {
              ...current.plans,
              [code]: { ...current.plans[code], [field]: value },
            },
          }
        : current,
    );
  const updateTask = (code: ValidatorTaskCode, field: string, value: unknown) =>
    setData((current) =>
      current
        ? {
            ...current,
            creditSettings: {
              ...current.creditSettings,
              tasks: {
                ...current.creditSettings.tasks,
                [code]: {
                  ...current.creditSettings.tasks[code],
                  [field]: value,
                },
              },
            },
          }
        : current,
    );
  if (tab === "overview") {
    const metrics: Array<[string, number, LucideIcon]> = [
      ["Accounts", data.totals._count, Users],
      ["Available credits", data.totals._sum.creditsBalance || 0, Coins],
      ["Credits issued", data.totals._sum.creditsPurchased || 0, Activity],
      ["Credits consumed", data.totals._sum.creditsSpent || 0, Gauge],
    ];
    return (
      <div className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, Icon]) => (
            <div key={label} className={`${PANEL} p-5`}>
              <Icon size={17} className="text-[#b8ff4b]" />
              <p className="mt-6 font-mono text-3xl font-semibold">
                {value.toLocaleString()}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#61706b]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <section className={`${PANEL} mt-6 overflow-hidden`}>
          <div className="border-b border-white/[0.07] p-5">
            <h2 className="font-semibold">Recent deposits</h2>
          </div>
          <PurchaseTable purchases={data.purchases.slice(0, 15)} />
        </section>
      </div>
    );
  }
  if (tab === "accounts")
    return (
      <AccountsAdmin accounts={data.accounts} action={action} busy={busy} />
    );
  if (tab === "plans")
    return (
      <div className="mt-6">
        <div className="grid gap-4 xl:grid-cols-2">
          {PLAN_CODES.map((code) => {
            const plan = data.plans[code];
            return (
              <section key={code} className={`${PANEL} p-5`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]">
                    <WalletCards size={17} />
                  </span>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                      {code}
                    </p>
                    <h2 className="font-semibold">{plan.name}</h2>
                  </div>
                  <label className="ml-auto text-xs text-[#7b8984]">
                    <input
                      type="checkbox"
                      checked={plan.enabled}
                      onChange={(event) =>
                        updatePlan(code, "enabled", event.target.checked)
                      }
                    />{" "}
                    Published
                  </label>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Name"
                    value={plan.name}
                    set={(value) => updatePlan(code, "name", value)}
                  />
                  <Field
                    label="Price in cents"
                    type="number"
                    value={plan.priceUsdCents}
                    set={(value) =>
                      updatePlan(code, "priceUsdCents", Number(value))
                    }
                  />
                  <Field
                    label="Duration days"
                    type="number"
                    value={plan.durationDays ?? ""}
                    set={(value) =>
                      updatePlan(
                        code,
                        "durationDays",
                        value ? Number(value) : null,
                      )
                    }
                  />
                  <Field
                    label="Included credits"
                    type="number"
                    value={plan.creditsIncluded}
                    set={(value) =>
                      updatePlan(code, "creditsIncluded", Number(value))
                    }
                  />
                  <Field
                    label="Tagline"
                    value={plan.tagline}
                    set={(value) => updatePlan(code, "tagline", value)}
                  />
                </div>
                <label className="mt-3 block text-[10px] uppercase tracking-wider text-[#687670]">
                  Features
                  <textarea
                    value={plan.features.join("\n")}
                    onChange={(event) =>
                      updatePlan(
                        code,
                        "features",
                        event.target.value.split("\n").filter(Boolean),
                      )
                    }
                    rows={4}
                    className={FIELD}
                  />
                </label>
                <div className="mt-3 flex items-center gap-4 text-xs text-[#7c8a85]">
                  <span className="rounded-lg border border-[#b8ff4b]/20 bg-[#b8ff4b]/[0.06] px-3 py-2 text-[#b8ff4b]">
                    All features · unlimited fleet · credit-based usage
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      checked={plan.featured}
                      onChange={(event) =>
                        updatePlan(code, "featured", event.target.checked)
                      }
                    />{" "}
                    Featured
                  </label>
                </div>
              </section>
            );
          })}
        </div>
        <SaveButton
          busy={busy}
          onClick={() =>
            action(
              { action: "save_plans", plans: data.plans },
              "Plans saved and published.",
            )
          }
        />
      </div>
    );
  if (tab === "pricing")
    return (
      <div className="mt-6">
        <section className={`${PANEL} p-5`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Credits per USD for rewards"
              type="number"
              value={data.creditSettings.creditsPerUsd}
              set={(value) =>
                setData((current) =>
                  current
                    ? {
                        ...current,
                        creditSettings: {
                          ...current.creditSettings,
                          creditsPerUsd: Number(value),
                        },
                      }
                    : current,
                )
              }
            />
            <Field
              label="Default affiliate reward %"
              type="number"
              value={data.creditSettings.affiliateRateBps / 100}
              set={(value) =>
                setData((current) =>
                  current
                    ? {
                        ...current,
                        creditSettings: {
                          ...current.creditSettings,
                          affiliateRateBps: Math.round(Number(value) * 100),
                        },
                      }
                    : current,
                )
              }
            />
          </div>
        </section>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {Object.entries(data.creditSettings.tasks).map(([code, price]) => (
            <section key={code} className={`${PANEL} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                    {code}
                  </p>
                  <h2 className="font-semibold">{price.label}</h2>
                </div>
                <input
                  type="checkbox"
                  checked={price.enabled}
                  onChange={(event) =>
                    updateTask(
                      code as ValidatorTaskCode,
                      "enabled",
                      event.target.checked,
                    )
                  }
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field
                  label="Base credits"
                  type="number"
                  value={price.baseCost}
                  set={(value) =>
                    updateTask(
                      code as ValidatorTaskCode,
                      "baseCost",
                      Number(value),
                    )
                  }
                />
                <Field
                  label="Credits per unit"
                  type="number"
                  value={price.itemCost}
                  set={(value) =>
                    updateTask(
                      code as ValidatorTaskCode,
                      "itemCost",
                      Number(value),
                    )
                  }
                />
                <Field
                  label="Rows / attempts per unit"
                  type="number"
                  value={price.itemUnit}
                  set={(value) =>
                    updateTask(
                      code as ValidatorTaskCode,
                      "itemUnit",
                      Number(value),
                    )
                  }
                />
                <Field
                  label="Per selected session"
                  type="number"
                  value={price.sessionCost}
                  set={(value) =>
                    updateTask(
                      code as ValidatorTaskCode,
                      "sessionCost",
                      Number(value),
                    )
                  }
                />
              </div>
            </section>
          ))}
        </div>
        <h2 className="mt-8 text-lg font-semibold">Top-up packs</h2>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {data.creditSettings.topups.map((pack, index) => (
            <section key={pack.code} className={`${PANEL} p-5`}>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Code"
                  value={pack.code}
                  set={(value) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            creditSettings: {
                              ...current.creditSettings,
                              topups: current.creditSettings.topups.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, code: String(value) }
                                    : item,
                              ),
                            },
                          }
                        : current,
                    )
                  }
                />
                <Field
                  label="Name"
                  value={pack.name}
                  set={(value) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            creditSettings: {
                              ...current.creditSettings,
                              topups: current.creditSettings.topups.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: String(value) }
                                    : item,
                              ),
                            },
                          }
                        : current,
                    )
                  }
                />
                <Field
                  label="Credits"
                  type="number"
                  value={pack.credits}
                  set={(value) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            creditSettings: {
                              ...current.creditSettings,
                              topups: current.creditSettings.topups.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, credits: Number(value) }
                                    : item,
                              ),
                            },
                          }
                        : current,
                    )
                  }
                />
                <Field
                  label="Price cents"
                  type="number"
                  value={pack.priceUsdCents}
                  set={(value) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            creditSettings: {
                              ...current.creditSettings,
                              topups: current.creditSettings.topups.map(
                                (item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, priceUsdCents: Number(value) }
                                    : item,
                              ),
                            },
                          }
                        : current,
                    )
                  }
                />
              </div>
            </section>
          ))}
        </div>
        <SaveButton
          busy={busy}
          onClick={() =>
            action(
              { action: "save_credits", settings: data.creditSettings },
              "Credit pricing and packs saved.",
            )
          }
        />
      </div>
    );
  if (tab === "affiliates")
    return (
      <div className="mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "Referred users",
              data.accounts.reduce((sum, item) => sum + item.referralCount, 0),
            ],
            [
              "Rewards issued",
              data.accounts.reduce(
                (sum, item) => sum + item.affiliateCredits,
                0,
              ),
            ],
            [
              "Default reward",
              `${data.creditSettings.affiliateRateBps / 100}%`,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className={`${PANEL} p-5`}>
              <p className="font-mono text-3xl font-semibold text-[#b8ff4b]">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#66746f]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <section className={`${PANEL} mt-5 overflow-x-auto`}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-[#64726d]">
                <th className="p-4">Partner</th>
                <th>Code</th>
                <th>Referrals</th>
                <th>Credits earned</th>
                <th>Custom rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.accounts
                .filter(
                  (account) =>
                    account.referralCount || account.affiliateCredits,
                )
                .map((account) => (
                  <tr key={account.id}>
                    <td className="p-4">{account.email}</td>
                    <td className="font-mono text-[#b8ff4b]">
                      {account.referralCode}
                    </td>
                    <td>{account.referralCount}</td>
                    <td>{account.affiliateCredits.toLocaleString()}</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={
                          (account.affiliateRateBps ??
                            data.creditSettings.affiliateRateBps) / 100
                        }
                        onBlur={(event) =>
                          void action(
                            {
                              action: "account",
                              accountId: account.id,
                              affiliateRateBps: Math.round(
                                Number(event.target.value) * 100,
                              ),
                            },
                            "Affiliate rate updated.",
                          )
                        }
                        className="w-24 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5"
                      />
                      %
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  return <UpdatesAdmin updates={data.updates} action={action} busy={busy} />;
}

function AccountsAdmin({
  accounts,
  action,
  busy,
}: {
  accounts: Account[];
  action: (payload: unknown, success: string) => Promise<void>;
  busy: boolean;
}) {
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState(2500);
  const [planCode, setPlanCode] = useState<ValidatorPlanCode>("basic");
  const [days, setDays] = useState(30);
  return (
    <div className="mt-6">
      <section className={`${PANEL} p-5`}>
        <h2 className="font-semibold">Issue access key</h2>
        <p className="mt-1 text-xs text-[#697772]">
          Create or reactivate a workspace, assign credits, and generate a
          one-time key.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Email" value={email} set={setEmail} />
          <label className="text-[10px] uppercase tracking-wider text-[#687670]">
            Plan
            <SignalSelect
              value={planCode}
              onChange={(value) => setPlanCode(value as ValidatorPlanCode)}
              placeholder="Plan"
              searchable={false}
              className="mt-1.5 capitalize"
              options={PLAN_CODES.map((code) => ({ value: code, label: code }))}
            />
          </label>
          <Field
            label="Included credits"
            type="number"
            value={credits}
            set={(value) => setCredits(Number(value))}
          />
          <Field
            label="Expiry days"
            type="number"
            value={days}
            set={(value) => setDays(Number(value))}
          />
        </div>
        <button
          disabled={busy || !email}
          onClick={() =>
            void action(
              {
                action: "create_key",
                email,
                label: `${planCode} access`,
                planCode,
                expiresInDays: days || null,
                credits,
                validatorAccess: true,
                messagingAccess: true,
                sessionLimit: null,
              },
              "Access key created and copied.",
            )
          }
          className="mt-4 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d]"
        >
          Create access key
        </button>
      </section>
      <section className={`${PANEL} mt-5 overflow-x-auto`}>
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-[#64726d]">
              <th className="p-4">Workspace</th>
              <th>Plan</th>
              <th>Credits</th>
              <th>Activity</th>
              <th>Affiliate</th>
              <th>Adjust</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="p-4">
                  <p className="font-medium">{account.email}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#64726d]">
                    {account.keys[0]?.prefix || "No key"}
                  </p>
                </td>
                <td>
                  {account.currentPlanCode || "manual"}
                  <p className="text-[10px] text-[#64726d]">
                    {account.planExpiresAt
                      ? new Date(account.planExpiresAt).toLocaleDateString()
                      : "No expiry"}
                  </p>
                </td>
                <td className="font-mono text-[#b8ff4b]">
                  {account.creditsBalance.toLocaleString()}
                  <p className="text-[10px] text-[#64726d]">
                    spent {account.creditsSpent.toLocaleString()}
                  </p>
                </td>
                <td className="text-xs text-[#87948f]">
                  {account.jobsCount} runs / {account.telegramCampaignsCount}{" "}
                  campaigns
                  <br />
                  {account.telegramSessionsCount} sessions
                </td>
                <td>
                  {account.referralCount} users
                  <p className="text-[10px] text-[#64726d]">
                    {account.affiliateCredits.toLocaleString()} credits
                  </p>
                </td>
                <td>
                  <input
                    type="number"
                    placeholder="+/- credits"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const value = Number(event.currentTarget.value);
                        if (value)
                          void action(
                            {
                              action: "account",
                              accountId: account.id,
                              creditAdjustment: value,
                            },
                            "Balance adjusted.",
                          );
                        event.currentTarget.value = "";
                      }
                    }}
                    className="w-28 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5 text-xs"
                  />
                </td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        {
                          action: "account",
                          accountId: account.id,
                          active: !account.active,
                        },
                        account.active
                          ? "Workspace suspended."
                          : "Workspace activated.",
                      )
                    }
                    className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${account.active ? "border-[#b8ff4b]/20 text-[#b8ff4b]" : "border-[#ff7474]/20 text-[#ff8f8f]"}`}
                  >
                    {account.active ? "Active" : "Suspended"}
                  </button>
                  {account.keys[0] && (
                    <button
                      onClick={() =>
                        void action(
                          {
                            action: "revoke_key",
                            keyId: account.keys[0].id,
                            revoked: !account.keys[0].revoked,
                          },
                          "Key status updated.",
                        )
                      }
                      className="ml-2 text-[9px] text-[#788680]"
                    >
                      {account.keys[0].revoked ? "Restore key" : "Revoke key"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function UpdatesAdmin({
  updates,
  action,
  busy,
}: {
  updates: Update[];
  action: (payload: unknown, success: string) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("Update");
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className={`${PANEL} p-5`}>
        <h2 className="font-semibold">Publish project update</h2>
        <Field label="Title" value={title} set={setTitle} />
        <Field label="Tag" value={tag} set={setTag} />
        <label className="mt-3 block text-[10px] uppercase tracking-wider text-[#687670]">
          Announcement
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            className={FIELD}
          />
        </label>
        <button
          disabled={busy || !title || !body}
          onClick={() =>
            void action(
              { action: "create_update", title, body, tag, published: true },
              "Update published to every workspace.",
            )
          }
          className="mt-4 flex items-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-sm font-bold text-[#07100d]"
        >
          <Bell size={14} />
          Publish update
        </button>
      </section>
      <div className="space-y-3">
        {updates.map((item) => (
          <article key={item.id} className={`${PANEL} p-5`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#b8ff4b]">
                  {item.tag}
                </span>
                <h3 className="mt-1 font-semibold">{item.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7d8b86]">
                  {item.body}
                </p>
              </div>
              <button
                onClick={() =>
                  void action(
                    { action: "delete_update", id: item.id },
                    "Update deleted.",
                  )
                }
                className="text-[#ff8585]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: string | number;
  set: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-[10px] uppercase tracking-wider text-[#687670]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
        className={FIELD}
      />
    </label>
  );
}
function SaveButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className="mt-5 flex items-center gap-2 rounded-xl bg-[#b8ff4b] px-5 py-3 text-sm font-bold text-[#07100d] disabled:opacity-40"
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <Save size={15} />
      )}
      Save changes
    </button>
  );
}
function PurchaseTable({ purchases }: { purchases: Purchase[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-wider text-[#64726d]">
            <th className="p-4">Customer</th>
            <th>Product</th>
            <th>Credits</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {purchases.map((purchase) => (
            <tr key={purchase.id}>
              <td className="p-4">{purchase.email}</td>
              <td>
                {purchase.planName}
                <p className="text-[9px] uppercase text-[#63716c]">
                  {purchase.purchaseType}
                </p>
              </td>
              <td>{purchase.creditsAmount.toLocaleString()}</td>
              <td>${(purchase.amountUsdCents / 100).toFixed(2)}</td>
              <td className="uppercase text-[#b8ff4b]">{purchase.status}</td>
              <td className="text-xs text-[#71807c]">
                {new Date(purchase.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
