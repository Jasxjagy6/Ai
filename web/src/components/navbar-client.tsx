"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AriaAvatar } from "@/components/aria-avatar";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "API docs" },
  { href: "/changelog", label: "What's new" },
];

const AUTHED_LINKS = [
  { href: "/developers", label: "Developers" },
  { href: "/account", label: "Account" },
];

export function NavbarClient({
  loggedIn,
  isAdmin,
  userName,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
  userName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [...LINKS, ...(loggedIn ? AUTHED_LINKS : []), ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border bg-bg/90 backdrop-blur-xl shadow-sm"
          : "bg-bg/80 backdrop-blur-lg"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-all duration-200 hover:opacity-80">
          <AriaAvatar size={28} />
          <span className="font-display text-[16px] font-bold tracking-tight">aria</span>
        </Link>

        <div className="ml-8 hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-all duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full ${
                pathname === l.href
                  ? "font-medium text-text after:w-full"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {loggedIn ? (
            <Link
              href="/chat"
              className="rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95 sm:px-5"
            >
              Open chat
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl px-3 py-2 text-sm text-text-secondary transition-all duration-200 hover:text-text sm:block"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95 sm:px-5"
              >
                Get started
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text transition-all duration-200 hover:bg-bg-soft md:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-border bg-bg md:hidden animate-slide-down">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-4">
            {links.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-xl px-4 py-3 text-[15px] font-medium transition-all duration-200 ${
                  pathname === l.href
                    ? "bg-accent-soft text-accent"
                    : "hover:bg-bg-soft"
                }`}
                style={{ animation: `slide-up 0.2s ease-out ${0.05 + i * 0.04}s both` }}
              >
                {l.label}
              </Link>
            ))}
            {!loggedIn && (
              <Link href="/login" className="block rounded-xl px-4 py-3 text-[15px] font-medium hover:bg-bg-soft">
                Log in
              </Link>
            )}
            <div className="flex items-center justify-between border-t border-border px-4 pt-5 mt-4">
              <span className="text-sm text-text-secondary">
                {loggedIn ? (userName ? `Signed in as ${userName}` : "Signed in") : "Theme"}
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
