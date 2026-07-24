"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Compact voice-note player for a chat bubble. Lazy-loads the audio from the
 * message audio endpoint on first play so we don't fetch every note upfront.
 */
export function VoiceNote({ messageId, accent = false }: { messageId: string; accent?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => setDur(a.duration || 0);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    if (!a.src) {
      setLoading(true);
      a.src = `/api/messages/${messageId}/audio`;
    }
    try {
      await a.play();
      setPlaying(true);
    } catch {
      // playback failed (e.g. voice service down)
    } finally {
      setLoading(false);
    }
  }

  const bars = 24;
  return (
    <div className="flex items-center gap-2.5 py-0.5 min-w-[180px]">
      <button
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          accent ? "bg-white/20 text-white hover:bg-white/30" : "bg-accent-strong text-white hover:opacity-90"
        }`}
        aria-label={playing ? "Pause" : "Play voice note"}
      >
        {loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : playing ? (
          <Pause size={15} />
        ) : (
          <Play size={15} className="ml-0.5" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-[2px]">
        {Array.from({ length: bars }).map((_, i) => {
          const active = i / bars <= progress;
          const h = 6 + ((i * 7) % 13);
          return (
            <span
              key={i}
              className={`w-[2px] rounded-full transition-colors ${
                active ? (accent ? "bg-white" : "bg-accent") : accent ? "bg-white/35" : "bg-text-secondary/30"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      {dur > 0 && (
        <span className={`text-[10px] tabular-nums ${accent ? "text-white/70" : "text-text-secondary"}`}>
          {Math.round(dur)}s
        </span>
      )}
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
