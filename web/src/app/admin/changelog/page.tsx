"use client";

import { useEffect, useState } from "react";
import { Newspaper, Plus, Trash2 } from "lucide-react";

type Entry = {
  id: string;
  title: string;
  body: string;
  tag: string;
  published: boolean;
  createdAt: string;
};

const TAGS = ["New", "Improved", "Fixed", "Security"] as const;
const TAG_COLOR: Record<string, string> = {
  New: "bg-green-500/15 text-green-600 dark:text-green-400",
  Improved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Fixed: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Security: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState({ title: "", body: "", tag: "New" as string, published: true });
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/changelog");
    if (res.ok) setEntries((await res.json()).entries);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setMsg("");
    const res = await fetch("/api/admin/changelog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      setDraft({ title: "", body: "", tag: "New", published: true });
      setMsg("Published ✓");
      load();
      setTimeout(() => setMsg(""), 2000);
    } else {
      const d = await res.json();
      setMsg(d.error ?? "Failed");
    }
  }

  async function togglePublish(e: Entry) {
    await fetch(`/api/admin/changelog/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !e.published }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/admin/changelog/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Newspaper size={22} /> Changelog
      </h1>
      <p className="mt-1 text-sm text-text-secondary">Post product updates shown on the public /changelog page.</p>

      {/* Composer */}
      <div className="mt-6 rounded-2xl border border-border bg-bg-elevated p-5">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Update title"
          className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="What changed?"
          rows={3}
          className="mt-3 w-full resize-y rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none"
          >
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
            Published
          </label>
          <button
            onClick={create}
            disabled={!draft.title.trim() || !draft.body.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={15} /> Publish
          </button>
          {msg && <span className="text-sm text-accent">{msg}</span>}
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-bg-elevated p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${TAG_COLOR[e.tag]}`}>{e.tag}</span>
                  <h3 className="font-semibold">{e.title}</h3>
                  {!e.published && <span className="text-[11px] text-text-secondary">(draft)</span>}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-secondary">{e.body}</p>
                <p className="mt-2 text-[11px] text-text-secondary">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => togglePublish(e)} className="rounded-lg px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-soft">
                  {e.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => remove(e.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-error"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-text-secondary">No entries yet.</p>}
      </div>
    </div>
  );
}
