"use client";

import { useCallback, useEffect, useState } from "react";
import { MessagesSquare, Search, X } from "lucide-react";

type ConvoRow = {
  id: string;
  title: string;
  tone: string;
  language: string;
  updatedAt: string;
  user: { email: string };
  persona: { name: string } | null;
  _count: { messages: number };
};

type Transcript = {
  id: string;
  title: string;
  tone: string;
  language: string;
  user: { email: string; name: string | null };
  persona: { name: string } | null;
  messages: { id: string; role: string; content: string; kind: string; mediaId: string | null; imagePath: string | null; createdAt: string }[];
};

export default function AdminConversationsPage() {
  const [rows, setRows] = useState<ConvoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Transcript | null>(null);
  const perPage = 20;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/conversations?q=${encodeURIComponent(q)}&page=${page}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.conversations);
      setTotal(d.total);
    }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  async function openConvo(id: string) {
    const res = await fetch(`/api/admin/conversations/${id}`);
    if (res.ok) setOpen((await res.json()).conversation);
  }

  const pages = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <MessagesSquare size={22} /> Conversations
      </h1>
      <p className="mt-1 text-sm text-text-secondary">Monitor live conversations across all users.</p>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-4 py-2.5">
        <Search size={16} className="text-text-secondary" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by title or user email..."
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Companion</th>
              <th className="px-4 py-3 text-left">Vibe</th>
              <th className="px-4 py-3 text-right">Msgs</th>
              <th className="px-4 py-3 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => openConvo(c.id)}
                className="cursor-pointer border-t border-border hover:bg-bg-soft"
              >
                <td className="px-4 py-3 font-medium">{c.title}</td>
                <td className="px-4 py-3 text-text-secondary">{c.user.email}</td>
                <td className="px-4 py-3">{c.persona?.name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{c.tone} · {c.language}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c._count.messages}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{new Date(c.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-text-secondary">No conversations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Prev</button>
          <span className="text-text-secondary">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Transcript drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-bg">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{open.title}</p>
                <p className="truncate text-xs text-text-secondary">
                  {open.user.email} · {open.persona?.name ?? "—"} · {open.tone}/{open.language}
                </p>
              </div>
              <button onClick={() => setOpen(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated"><X size={16} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {open.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-accent-strong text-white" : "bg-bg-elevated border border-border"}`}>
                    {m.kind === "voice" && <span className="mr-1 text-xs opacity-70">🎙️ voice:</span>}
                    {m.imagePath && <span className="mr-1 text-xs opacity-70">📷 photo:</span>}
                    {m.mediaId && <span className="mr-1 text-xs opacity-70">🖼️ sent photo:</span>}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
