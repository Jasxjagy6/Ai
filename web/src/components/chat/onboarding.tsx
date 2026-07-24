"use client";

import { useEffect, useState } from "react";
import { Mic, Eye, Smile, Sparkles, X, ArrowRight } from "lucide-react";
import { AriaAvatar } from "@/components/aria-avatar";

const KEY = "aria_onboarded_v1";

const STEPS = [
  {
    icon: Sparkles,
    title: "Meet your companion",
    body: "Aria remembers you, teases you, and genuinely cares how your day went. She's clearly AI — and wonderfully human to talk to.",
  },
  {
    icon: Mic,
    title: "Hear her voice",
    body: "Tap the mic to get a spoken voice-note reply, or hit 'Play voice' on any message to hear it out loud.",
  },
  {
    icon: Eye,
    title: "Show her things",
    body: "Send a photo with the image button — she'll actually see what's in it and react like a friend would.",
  },
  {
    icon: Smile,
    title: "Set the vibe",
    body: "Use the vibe and language pickers up top to shift how she talks — funny, flirty, deep — in any language you like.",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch { /* ignore */ }
  }, []);

  function done() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={done} />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-bg-elevated p-6 shadow-2xl animate-scale-in">
        <button onClick={done} className="absolute right-4 top-4 text-text-secondary hover:text-text"><X size={16} /></button>
        <div className="flex flex-col items-center text-center">
          <AriaAvatar size={56} online />
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <s.icon size={22} />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-tight">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={done} className="text-sm text-text-secondary hover:text-text">Skip</button>
          <button
            onClick={() => (last ? done() : setStep((s) => s + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {last ? "Start chatting" : "Next"} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
