"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, X } from "lucide-react";

type Memory = { id: string; fact: string; persona: string; createdAt: string };

export function MemoriesPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/memories");
    if (res.ok) setMemories((await res.json()).memories);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function forget(id: string) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Brain size={18} className="text-accent" /> What your companions remember
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Full transparency: these are the facts your companions have learned about you. Delete any
        of them and they&apos;re forgotten permanently.
      </p>
      <div className="mt-4 space-y-2">
        {memories.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm"
          >
            <span>
              {m.fact} <span className="text-xs text-text-secondary">— {m.persona}</span>
            </span>
            <button
              onClick={() => forget(m.id)}
              className="shrink-0 rounded-lg border border-border p-1.5 text-text-secondary transition hover:text-error"
              title="Forget this"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {memories.length === 0 && (
          <p className="rounded-xl border border-border bg-bg-elevated px-4 py-6 text-center text-sm text-text-secondary">
            Nothing yet — memories build up as you chat
          </p>
        )}
      </div>
    </div>
  );
}
