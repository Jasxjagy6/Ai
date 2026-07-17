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
  const pathname = usePathname();

  // close the mobile menu on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [...LINKS, ...(loggedIn ? AUTHED_LINKS : []), ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <AriaAvatar size={30} />
          <span className="font-display text-[17px] font-bold tracking-tight">aria</span>
        </Link>

        {/* Desktop links */}
        <div className="ml-8 hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition ${
                pathname === l.href ? "font-medium text-text" : "text-muted hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {loggedIn ? (
            <Link
              href="/chat"
              className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5"
            >
              Open chat
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-3 py-2 text-sm text-muted transition hover:text-text sm:block"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5"
              >
                Get started
              </Link>
            </>
          )}
          {/* Mobile menu button */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text md:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay — anchored below the header (the header's
          backdrop-blur makes it the containing block for fixed children). */}
      {open && (
        <div className="absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-border bg-bg md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-xl px-4 py-3 text-[15px] font-medium transition ${
                  pathname === l.href ? "bg-accent-soft text-accent-strong" : "hover:bg-bg-soft"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {!loggedIn && (
              <Link href="/login" className="block rounded-xl px-4 py-3 text-[15px] font-medium hover:bg-bg-soft">
                Log in
              </Link>
            )}
            <div className="flex items-center justify-between border-t border-border px-4 pt-4">
              <span className="text-sm text-muted">
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
