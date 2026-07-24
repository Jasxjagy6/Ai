"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

const FIELDS: Array<{
  key: string;
  label: string;
  hint: string;
  type: "text" | "textarea" | "toggle";
}> = [
  { key: "ai_model", label: "AI model", hint: "Ollama model name (e.g. aria, hermes3:8b). Switch here after deploying the fine-tuned model.", type: "text" },
  { key: "ollama_url", label: "Ollama URL", hint: "Backend inference server address.", type: "text" },
  { key: "system_prompt", label: "System prompt override", hint: "Leave empty to use the prompt baked into the Ollama Modelfile. Anything here overrides it.", type: "textarea" },
  { key: "temperature", label: "Temperature", hint: "0.1 = focused, 1.2 = wild. Default 0.9.", type: "text" },
  { key: "max_history_messages", label: "History window", hint: "How many past messages Aria sees per reply. Higher = more memory, slower.", type: "text" },
  { key: "maintenance_mode", label: "Maintenance mode", hint: "When on, chat returns a friendly 'be right back' message to all users.", type: "toggle" },
  { key: "voice_enabled", label: "Voice notes", hint: "Let companions reply with spoken voice notes (Piper TTS microservice).", type: "toggle" },
  { key: "tts_url", label: "TTS service URL", hint: "Piper TTS microservice address (default http://localhost:11435).", type: "text" },
  { key: "vision_enabled", label: "Vision (photo understanding)", hint: "Let users send photos that the companion can 'see' and react to.", type: "toggle" },
  { key: "vision_model", label: "Vision model", hint: "Ollama vision model used to caption user photos (e.g. moondream, llava).", type: "text" },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings ?? {});
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading settings...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">AI &amp; Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Changes apply immediately to all new messages — no redeploy needed.
      </p>

      <div className="mt-8 space-y-6">
        {FIELDS.map((f) => (
          <div key={f.key} className="rounded-2xl border border-border bg-bg-elevated p-5">
            <label className="font-medium">{f.label}</label>
            <p className="mb-3 mt-0.5 text-xs text-text-secondary">{f.hint}</p>
            {f.type === "textarea" ? (
              <textarea
                value={settings[f.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                rows={6}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            ) : f.type === "toggle" ? (
              <button
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    [f.key]: s[f.key] === "true" ? "false" : "true",
                  }))
                }
                className={`relative h-7 w-12 rounded-full transition ${
                  settings[f.key] === "true" ? "bg-accent-strong" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    settings[f.key] === "true" ? "left-6" : "left-1"
                  }`}
                />
              </button>
            ) : (
              <input
                value={settings[f.key] ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-xl bg-accent-strong px-6 py-2.5 font-semibold text-white transition hover:opacity-90"
        >
          <Save size={16} /> Save settings
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved ✓</span>}
      </div>
    </div>
  );
}
