"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";

/** "Be the first to know" email capture (landing + footer). */
export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className={`flex items-center gap-2 text-sm ${compact ? "" : "justify-center"} text-accent`}>
        <Check size={16} /> You&apos;re on the list — we&apos;ll be in touch 💜
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`flex gap-2 ${compact ? "" : "mx-auto max-w-sm"}`}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? "..." : <>Notify me <Send size={14} /></>}
      </button>
    </form>
  );
}
