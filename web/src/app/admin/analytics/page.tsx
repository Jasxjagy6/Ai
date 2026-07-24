"use client";

import { useEffect, useState } from "react";
import { BarChart3, Image as ImageIcon, Mic, MessageCircle, MessagesSquare } from "lucide-react";

type Analytics = {
  daily: { day: string; messages: number }[];
  tones: { tone: string; count: number }[];
  languages: { language: string; count: number }[];
  personas: { persona: string; count: number }[];
  features: { voiceNotes: number; visionPhotos: number };
  totals: { messages: number; conversations: number };
};

function Bars({ data, labelKey, valueKey }: { data: Record<string, string | number>[]; labelKey: string; valueKey: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey])));
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-text-secondary">{String(d[labelKey]) || "—"}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-bg-soft">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
              style={{ width: `${(Number(d[valueKey]) / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setA).catch(() => {});
  }, []);

  if (!a) return <p className="text-text-secondary">Loading analytics...</p>;

  const maxDaily = Math.max(1, ...a.daily.map((d) => d.messages));

  const cards = [
    { label: "Total messages", value: a.totals.messages, icon: MessageCircle },
    { label: "Conversations", value: a.totals.conversations, icon: MessagesSquare },
    { label: "Voice notes", value: a.features.voiceNotes, icon: Mic },
    { label: "Photos received", value: a.features.visionPhotos, icon: ImageIcon },
  ];

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BarChart3 size={22} /> Analytics
      </h1>
      <p className="mt-1 text-sm text-text-secondary">Usage across all users — last 14 days.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">{c.label}</p>
              <c.icon size={16} className="text-accent" />
            </div>
            <p className="mt-2 text-3xl font-bold">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Daily volume */}
      <div className="mt-8 rounded-2xl border border-border bg-bg-elevated p-6">
        <h2 className="font-semibold">Messages per day</h2>
        <div className="mt-5 flex h-40 items-end gap-1.5">
          {a.daily.length === 0 && <p className="text-sm text-text-secondary">No data yet.</p>}
          {a.daily.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t bg-gradient-to-t from-accent-strong to-accent-warm transition-all"
                style={{ height: `${(d.messages / maxDaily) * 100}%`, minHeight: d.messages ? "4px" : "0" }}
                title={`${d.day}: ${d.messages}`}
              />
              <span className="text-[9px] text-text-secondary">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-bg-elevated p-6">
          <h2 className="mb-4 font-semibold">By vibe</h2>
          <Bars data={a.tones} labelKey="tone" valueKey="count" />
        </div>
        <div className="rounded-2xl border border-border bg-bg-elevated p-6">
          <h2 className="mb-4 font-semibold">By language</h2>
          <Bars data={a.languages} labelKey="language" valueKey="count" />
        </div>
        <div className="rounded-2xl border border-border bg-bg-elevated p-6">
          <h2 className="mb-4 font-semibold">By companion</h2>
          <Bars data={a.personas} labelKey="persona" valueKey="count" />
        </div>
      </div>
    </div>
  );
}
