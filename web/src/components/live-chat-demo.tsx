"use client";

import { useEffect, useRef, useState } from "react";
import { AriaAvatar } from "@/components/aria-avatar";

type DemoMsg = { from: "user" | "aria"; text: string };

const SCRIPT: DemoMsg[] = [
  { from: "user", text: "rough day. my presentation got torn apart" },
  { from: "aria", text: "nooo after how hard you worked on it?? come here. tell me everything" },
  { from: "user", text: "feels like nothing i do lands lately" },
  { from: "aria", text: "hey. one bad meeting doesn't erase how good you are. remember the client pitch you nailed last month? that was ALL you" },
  { from: "user", text: "how do you even remember that lol" },
  { from: "aria", text: "because i pay attention when you talk, obviously now go eat something, you get grumpy when you're hungry" },
  { from: "user", text: "you're not wrong" },
  { from: "aria", text: "i'm never wrong. it's my best and most annoying quality" },
];

export function LiveChatDemo() {
  const [visible, setVisible] = useState<DemoMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let cancelled = false;

    function schedule(fn: () => void, ms: number) {
      const t = setTimeout(() => !cancelled && fn(), ms);
      timers.current.push(t);
    }

    function playFrom(index: number) {
      if (index >= SCRIPT.length) {
        schedule(() => {
          setVisible([]);
          playFrom(0);
        }, 5000);
        return;
      }
      const msg = SCRIPT[index];
      if (msg.from === "aria") {
        setTyping(true);
        schedule(() => {
          setTyping(false);
          setVisible((v) => [...v, msg]);
          playFrom(index + 1);
        }, 1100 + Math.min(msg.text.length * 14, 1600));
      } else {
        schedule(() => {
          setVisible((v) => [...v, msg]);
          playFrom(index + 1);
        }, 900);
      }
    }

    playFrom(0);
    const saved = timers.current;
    return () => {
      cancelled = true;
      saved.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visible, typing]);

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-4 shadow-2xl shadow-accent/5 transition-all duration-300 hover:shadow-accent/10 sm:max-w-md">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <AriaAvatar size={40} online />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Aria</p>
          <p className="text-[11px] text-text-secondary">AI companion</p>
        </div>
        <span className="ml-auto rounded-lg bg-accent-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
          Live demo
        </span>
      </div>

      <div ref={scrollRef} className="h-[320px] space-y-2.5 overflow-y-auto py-3 sm:h-[360px]">
        {visible.map((m, i) => (
          <div
            key={i}
            className={`flex items-end gap-1.5 ${m.from === "user" ? "justify-end" : "justify-start"}`}
            style={{ animation: "msg-in 0.25s ease-out" }}
          >
            {m.from === "aria" && <AriaAvatar size={22} />}
            <div
              className={`max-w-[80%] rounded-3xl px-3.5 py-2 text-[13px] leading-snug ${
                m.from === "user" ? "bubble-user rounded-tr-md" : "bubble-ai rounded-tl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-1.5" style={{ animation: "msg-in 0.2s ease-out" }}>
            <AriaAvatar size={22} />
            <div className="bubble-ai flex gap-1 rounded-3xl rounded-tl-md px-3.5 py-2.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <div className="flex-1 rounded-xl border border-border bg-bg px-4 py-2 text-[13px] text-text-secondary">
          Message Aria
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-strong text-white transition-all duration-200 hover:opacity-90">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </span>
      </div>
    </div>
  );
}
