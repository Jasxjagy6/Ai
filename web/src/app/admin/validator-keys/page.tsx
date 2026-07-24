"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";

type KeyRecord = {
  id: string;
  label: string;
  prefix: string;
  revoked: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  validatorAccess: boolean;
  messagingAccess: boolean;
  requestLimit: number | null;
  requestsUsed: number;
  sessionLimit: number | null;
  messageLimit: number | null;
  messagesUsed: number;
};

type Account = {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
  listsCount: number;
  jobsCount: number;
  telegramSessionsCount: number;
  telegramCampaignsCount: number;
  keys: KeyRecord[];
};

export default function ValidatorKeysPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("Primary key");
  const [expiry, setExpiry] = useState("");
  const [validatorAccess, setValidatorAccess] = useState(true);
  const [messagingAccess, setMessagingAccess] = useState(false);
  const [requestLimit, setRequestLimit] = useState("");
  const [sessionLimit, setSessionLimit] = useState("");
  const [messageLimit, setMessageLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ key: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/validator-keys");
    if (response.ok) setAccounts((await response.json()).accounts || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const response = await fetch("/api/admin/validator-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        label,
        expiresInDays: expiry ? Number(expiry) : null,
        validatorAccess,
        messagingAccess,
        requestLimit: requestLimit ? Number(requestLimit) : null,
        sessionLimit: sessionLimit ? Number(sessionLimit) : null,
        messageLimit: messageLimit ? Number(messageLimit) : null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setCreating(false);
    if (!response.ok) {
      setError(data.error || "Unable to create access key");
      return;
    }
    setRevealed({ key: data.key, email: data.account.email });
    setEmail("");
    setLabel("Primary key");
    setExpiry("");
    setValidatorAccess(true);
    setMessagingAccess(false);
    setRequestLimit("");
    setSessionLimit("");
    setMessageLimit("");
    void load();
  }

  async function updateKey(id: string, patch: Partial<Pick<KeyRecord, "revoked" | "validatorAccess" | "messagingAccess" | "requestLimit" | "sessionLimit" | "messageLimit">>) {
    setError("");
    const response = await fetch(`/api/admin/validator-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Unable to update access key");
    void load();
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this key and sign out every validator session for its account?")) return;
    await fetch(`/api/admin/validator-keys/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Validator access</h1>
          <p className="mt-1 text-sm text-text-secondary">Issue isolated keys for the Telegram validator. A key is shown once and never stored in plaintext.</p>
        </div>
        <span className="text-xs text-text-secondary">{accounts.length} validator accounts</span>
      </div>

      <form onSubmit={createKey} className="mt-6 grid gap-3 rounded-2xl border border-border bg-bg-elevated p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_auto] xl:items-end">
        <label className="text-xs font-medium text-text-secondary">
          Account email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@example.com" className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent" />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Key label
          <input required value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent" />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Expires in days
          <input type="number" min={1} max={3650} value={expiry} onChange={(event) => setExpiry(event.target.value)} placeholder="Never" className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent" />
        </label>
        <button disabled={creating} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Issue key
        </button>
        <div className="grid gap-3 rounded-xl border border-border bg-bg p-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary"><input type="checkbox" checked={validatorAccess} onChange={(event) => setValidatorAccess(event.target.checked)} className="accent-accent" />Validator access</label>
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary"><input type="checkbox" checked={messagingAccess} onChange={(event) => setMessagingAccess(event.target.checked)} className="accent-accent" />Messaging access</label>
          <label className="text-xs text-text-secondary">Username checks<input type="number" min={1} value={requestLimit} onChange={(event) => setRequestLimit(event.target.value)} placeholder="Unlimited" className="mt-1 w-full rounded-lg border border-border bg-bg-elevated px-2.5 py-2 text-xs outline-none focus:border-accent" /></label>
          <label className="text-xs text-text-secondary">Telegram sessions<input type="number" min={1} value={sessionLimit} onChange={(event) => setSessionLimit(event.target.value)} placeholder="Unlimited" className="mt-1 w-full rounded-lg border border-border bg-bg-elevated px-2.5 py-2 text-xs outline-none focus:border-accent" /></label>
          <label className="text-xs text-text-secondary">DM allowance<input type="number" min={1} value={messageLimit} onChange={(event) => setMessageLimit(event.target.value)} placeholder="Unlimited" className="mt-1 w-full rounded-lg border border-border bg-bg-elevated px-2.5 py-2 text-xs outline-none focus:border-accent" /></label>
        </div>
        {error && <p className="text-sm text-error sm:col-span-2 xl:col-span-4">{error}</p>}
      </form>

      <div className="mt-5 space-y-3">
        {accounts.map((account) => (
          <section key={account.id} className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{account.email}</p>
                <p className="text-xs text-text-secondary">{account.listsCount} lists · {account.jobsCount} validation jobs · {account.telegramSessionsCount} Telegram sessions · {account.telegramCampaignsCount} campaigns</p>
              </div>
              <span className="text-xs text-text-secondary">Created {new Date(account.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="divide-y divide-border">
              {account.keys.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${key.revoked ? "bg-error/10 text-error" : "bg-accent-soft text-accent"}`}><KeyRound size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{key.label}</p>
                      <code className="rounded bg-bg-soft px-1.5 py-0.5 text-[11px] text-text-secondary">{key.prefix}</code>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${key.revoked ? "bg-error/10 text-error" : "bg-green-500/10 text-green-500"}`}>{key.revoked ? "Revoked" : "Active"}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"} · Expires {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "never"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                      <button onClick={() => updateKey(key.id, { validatorAccess: !key.validatorAccess })} className={`rounded-full border px-2 py-1 ${key.validatorAccess ? "border-accent/25 bg-accent-soft text-accent" : "border-border text-text-secondary"}`}>Validator {key.validatorAccess ? "on" : "off"}</button>
                      <button onClick={() => updateKey(key.id, { messagingAccess: !key.messagingAccess })} className={`rounded-full border px-2 py-1 ${key.messagingAccess ? "border-green-500/25 bg-green-500/10 text-green-500" : "border-border text-text-secondary"}`}>Messaging {key.messagingAccess ? "on" : "off"}</button>
                      <span className="rounded-full border border-border px-2 py-1 text-text-secondary">Checks {key.requestsUsed.toLocaleString()} / {key.requestLimit?.toLocaleString() || "unlimited"}</span>
                      <span className="rounded-full border border-border px-2 py-1 text-text-secondary">Sessions {key.sessionLimit?.toLocaleString() || "unlimited"}</span>
                      <span className="rounded-full border border-border px-2 py-1 text-text-secondary">DMs {key.messagesUsed.toLocaleString()} / {key.messageLimit?.toLocaleString() || "unlimited"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateKey(key.id, { revoked: !key.revoked })} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text">
                      {key.revoked ? <RotateCcw size={13} /> : <X size={13} />} {key.revoked ? "Restore" : "Revoke"}
                    </button>
                    <button onClick={() => deleteKey(key.id)} title="Delete key" className="rounded-lg border border-border p-2 text-text-secondary transition hover:text-error"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!accounts.length && <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-text-secondary">No validator access has been issued yet.</div>}
      </div>

      {revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-bg-elevated p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500/10 text-green-500"><KeyRound size={20} /></div>
            <h2 className="mt-4 text-xl font-bold">Access key created</h2>
            <p className="mt-1 text-sm text-text-secondary">Send this key securely to {revealed.email}. It will not be shown again.</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-bg p-3">
              <code className="min-w-0 flex-1 break-all text-sm text-accent">{revealed.key}</code>
              <button onClick={async () => { await navigator.clipboard.writeText(revealed.key); setCopied(true); }} className="shrink-0 rounded-lg border border-border p-2 text-text-secondary hover:text-text">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <button onClick={() => { setRevealed(null); setCopied(false); }} className="mt-5 w-full rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white">I saved the key</button>
          </div>
        </div>
      )}
    </div>
  );
}
