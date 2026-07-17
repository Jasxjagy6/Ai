"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";

type Persona = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  age: number;
  systemPrompt: string;
  chatStyle: string;
  minTier: "FREE" | "PLUS" | "PRO";
  isDefault: boolean;
  active: boolean;
  _count: { media: number; conversations: number; memories: number };
};

type Asset = {
  id: string;
  category: string;
  description: string;
  active: boolean;
};

const CATEGORIES = ["SELFIE", "CASUAL", "MORNING", "NIGHT", "ACTIVITY", "MOOD"];

const EMPTY = {
  slug: "",
  name: "",
  tagline: "",
  age: 24,
  systemPrompt: "",
  chatStyle: "youthful",
  minTier: "FREE" as const,
  isDefault: false,
};

export default function AdminPersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<Persona | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploadCategory, setUploadCategory] = useState("SELFIE");
  const [uploadDesc, setUploadDesc] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/personas");
    if (res.ok) setPersonas((await res.json()).personas);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadAssets(personaId: string) {
    const res = await fetch(`/api/admin/personas/${personaId}/media`);
    if (res.ok) setAssets((await res.json()).assets);
  }

  function select(p: Persona) {
    setSelected(p);
    setCreating(false);
    setDraft({ ...p });
    loadAssets(p.id);
  }

  function startCreate() {
    setSelected(null);
    setCreating(true);
    setDraft(EMPTY);
    setAssets([]);
  }

  async function save() {
    setMsg("");
    const url = creating ? "/api/admin/personas" : `/api/admin/personas/${selected!.id}`;
    const method = creating ? "POST" : "PATCH";
    const body: Record<string, unknown> = { ...draft };
    delete body.id;
    delete body._count;
    delete body.avatarUrl;
    delete body.createdAt;
    delete body.updatedAt;
    if (!creating) delete body.slug;
    if (typeof body.age === "string") body.age = parseInt(body.age as string) || 24;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Save failed");
      return;
    }
    setMsg("Saved ✓");
    setCreating(false);
    load();
    if (data.persona) select({ ...data.persona, _count: selected?._count ?? { media: 0, conversations: 0, memories: 0 } });
  }

  async function remove(p: Persona) {
    if (!confirm(`Delete persona "${p.name}"? Conversations keep their history but lose the persona link.`)) return;
    await fetch(`/api/admin/personas/${p.id}`, { method: "DELETE" });
    if (selected?.id === p.id) setSelected(null);
    load();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const form = new FormData();
    form.append("file", file);
    form.append("category", uploadCategory);
    form.append("description", uploadDesc);
    const res = await fetch(`/api/admin/personas/${selected.id}/media`, { method: "POST", body: form });
    if (res.ok) {
      setUploadDesc("");
      loadAssets(selected.id);
    } else {
      setMsg((await res.json()).error ?? "Upload failed");
    }
    e.target.value = "";
  }

  async function removeAsset(id: string) {
    await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    if (selected) loadAssets(selected.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Personas</h1>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> New persona
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* List */}
        <div className="space-y-2">
          {personas.map((p) => (
            <div
              key={p.id}
              onClick={() => select(p)}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                selected?.id === p.id ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {p.name}
                  {p.isDefault && <span className="ml-1.5 text-[10px] text-accent-strong">DEFAULT</span>}
                  {!p.active && <span className="ml-1.5 text-[10px] text-rose">INACTIVE</span>}
                </p>
                <span className="text-[10px] font-bold text-muted">{p.minTier}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{p.tagline}</p>
              <p className="mt-1 text-[10px] text-muted">
                {p._count.media} photos · {p._count.conversations} chats · {p._count.memories} memories
              </p>
            </div>
          ))}
        </div>

        {/* Editor */}
        {(selected || creating) && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-muted">Name</span>
                <input
                  value={(draft.name as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted">Slug {creating ? "" : "(fixed)"}</span>
                <input
                  value={(draft.slug as string) ?? ""}
                  disabled={!creating}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent disabled:opacity-50"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted">Tagline</span>
                <input
                  value={(draft.tagline as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted">Age (18+)</span>
                <input
                  type="number"
                  min={18}
                  value={(draft.age as number) ?? 24}
                  onChange={(e) => setDraft((d) => ({ ...d, age: parseInt(e.target.value) || 24 }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted">Chat style</span>
                <select
                  value={(draft.chatStyle as string) ?? "youthful"}
                  onChange={(e) => setDraft((d) => ({ ...d, chatStyle: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none"
                >
                  <option value="youthful">Youthful</option>
                  <option value="mature">Mature</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted">Minimum plan</span>
                <select
                  value={(draft.minTier as string) ?? "FREE"}
                  onChange={(e) => setDraft((d) => ({ ...d, minTier: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none"
                >
                  <option value="FREE">FREE</option>
                  <option value="PLUS">PLUS</option>
                  <option value="PRO">PRO</option>
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-muted">System prompt (personality)</span>
              <textarea
                rows={10}
                value={(draft.systemPrompt as string) ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            </label>

            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.isDefault)}
                  onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                />
                Default persona
              </label>
              {!creating && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.active)}
                    onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                  />
                  Active
                </label>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                className="flex items-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Save size={15} /> {creating ? "Create" : "Save"}
              </button>
              {!creating && selected && (
                <button
                  onClick={() => remove(selected)}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-rose"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              {msg && <span className="text-sm text-muted">{msg}</span>}
            </div>

            {/* Media vault */}
            {!creating && selected && (
              <div className="border-t border-border pt-5">
                <h3 className="font-semibold">Photo vault</h3>
                <p className="mt-1 text-xs text-muted">
                  Photos the persona can send when users ask. Categorized so the AI picks
                  contextually (morning/night/selfie/activity). No repeats per conversation.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="rounded-xl border border-border bg-bg px-3 py-2 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Short description (what's in the photo)"
                    className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                  />
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent-strong px-4 py-2 font-semibold text-white">
                    <Upload size={14} /> Upload
                    <input type="file" accept="image/*" onChange={upload} className="hidden" />
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {assets.filter((a) => a.active).map((a) => (
                    <div key={a.id} className="group relative overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/media/${a.id}`} alt={a.description} className="h-28 w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[10px] text-white">
                        {a.category}
                        {a.description && ` · ${a.description.slice(0, 24)}`}
                      </div>
                      <button
                        onClick={() => removeAsset(a.id)}
                        className="absolute right-1.5 top-1.5 hidden rounded-lg bg-black/60 p-1.5 text-white group-hover:block"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {assets.filter((a) => a.active).length === 0 && (
                    <p className="col-span-full py-6 text-center text-xs text-muted">No photos yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
