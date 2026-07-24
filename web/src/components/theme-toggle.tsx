"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text transition-all duration-200 hover:scale-110 active:scale-90"
      aria-label="Toggle theme"
    >
      <span className="transition-all duration-300" style={{ transform: mounted ? "rotate(0deg)" : "rotate(90deg)" }}>
        {resolvedTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </span>
    </button>
  );
}
