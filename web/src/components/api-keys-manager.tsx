"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";

type Key = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  requestsWeek: number;
};

export function ApiKeysManager() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (res.ok) setKeys((await res.json()).keys);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create key");
      return;
    }
    setNewKey(data.key);
    setName("");
    load();
  }

  async function revoke(id: string, keyName: string) {
    if (!confirm(`Revoke "${keyName}"? Apps using it will stop working immediately.`)) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
  }

  async function copy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound size={18} className="text-accent" /> API keys
      </h2>

      {newKey && (
        <div className="mt-4 rounded-2xl border border-accent/50 bg-accent-soft p-5">
          <p className="text-sm font-semibold">Your new API key — copy it now, it won&apos;t be shown again:</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-bg px-3 py-2 text-xs">{newKey}</code>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-2 text-xs font-semibold text-white"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-xs text-text-secondary hover:text-text">
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Key name (e.g. my-telegram-bot)"
          className="flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none transition focus:border-accent"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="flex items-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={15} /> Create key
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Requests (7d)</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3 text-right">Revoke</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3">
                  <code className="text-xs text-text-secondary">{k.prefix}</code>
                </td>
                <td className="px-4 py-3">{k.requestsWeek.toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => revoke(k.id, k.name)}
                    className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:text-error"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  No API keys yet — create your first one above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
