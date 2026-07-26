"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SignalSelectOption = {
  value: string;
  label: string;
  description?: string | null;
  disabled?: boolean;
};

type Placement =
  | { mobile: true }
  | {
      mobile: false;
      left: number;
      width: number;
      maxHeight: number;
      top?: number;
      bottom?: number;
    };

export function SignalSelect({
  value,
  onChange,
  options,
  placeholder = "Choose an option",
  disabled = false,
  className = "",
  accent = "#b8ff4b",
  searchable,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SignalSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  accent?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const selected = options.find((option) => option.value === value);
  const filtered = deferredQuery
    ? options.filter((option) =>
        `${option.label} ${option.description || ""}`
          .toLowerCase()
          .includes(deferredQuery),
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeForLayoutChange = () => setOpen(false);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", closeForLayoutChange);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", closeForLayoutChange);
    };
  }, [open]);

  const showSearch = searchable ?? options.length > 7;

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (open) {
      setOpen(false);
      return;
    }
    setQuery("");
    if (window.innerWidth < 640) {
      setPlacement({ mobile: true });
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const roomBelow = window.innerHeight - rect.bottom - 12;
      const openAbove = roomBelow < 260 && rect.top > roomBelow;
      setPlacement({
        mobile: false,
        left,
        width,
        maxHeight: Math.min(380, openAbove ? rect.top - 12 : roomBelow),
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl border border-white/10 bg-[#071111] px-3.5 py-2.5 text-left text-sm text-[#eef7ed] outline-none transition hover:border-white/20 focus:border-[#b8ff4b]/45 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-[#e5ece9]" : "text-[#61706d]"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#64736e] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && placement &&
        createPortal(
          <div className="fixed inset-0 z-[180]" onMouseDown={() => setOpen(false)}>
            <section
              role="listbox"
              aria-label={placeholder}
              onMouseDown={(event) => event.stopPropagation()}
              className={`fixed overflow-hidden rounded-2xl border border-white/10 bg-[#0b1513] shadow-[0_24px_80px_rgba(0,0,0,.72)] validator-modal-in ${placement.mobile ? "inset-x-3 bottom-3 max-h-[72dvh]" : ""}`}
              style={
                placement.mobile
                  ? undefined
                  : {
                      left: placement.left,
                      width: placement.width,
                      maxHeight: placement.maxHeight,
                      top: placement.top,
                      bottom: placement.bottom,
                    }
              }
            >
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#788680]">
                  {placeholder}
                </span>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#63716c] hover:bg-white/5 hover:text-white" aria-label="Close options">
                  <X size={14} />
                </button>
              </div>
              {showSearch && (
                <div className="border-b border-white/[0.07] p-2.5">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#60706b]" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search options..."
                      className="w-full rounded-xl border border-white/[0.08] bg-[#07100f] py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#53615d] focus:border-white/20"
                    />
                  </div>
                </div>
              )}
              <div className="max-h-[min(360px,60dvh)] overflow-y-auto p-1.5">
                {filtered.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value || "__empty"}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={option.disabled}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-white/10 bg-white/[0.055]" : "border-transparent hover:bg-white/[0.035]"}`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold"
                        style={{
                          borderColor: `${accent}35`,
                          background: active ? accent : `${accent}10`,
                          color: active ? "#07100d" : accent,
                        }}
                      >
                        {active ? <Check size={13} /> : option.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#dce7e3]">{option.label}</span>
                        {option.description && <span className="mt-1 block text-[9px] leading-4 text-[#60706b]">{option.description}</span>}
                      </span>
                    </button>
                  );
                })}
                {!filtered.length && <p className="px-3 py-10 text-center text-xs text-[#60706b]">No matching options.</p>}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
