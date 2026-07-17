"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard, LayoutDashboard, Menu, Settings, Sparkles, Users, Wand2, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AriaAvatar } from "@/components/aria-avatar";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/personas", label: "Personas", icon: Sparkles },
  { href: "/admin/plans", label: "Plans & Billing", icon: CreditCard },
  { href: "/admin/playground", label: "Playground", icon: Wand2 },
  { href: "/admin/settings", label: "AI & Settings", icon: Settings },
];

export function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebar = (
    <>
      <Link href="/" className="flex items-center gap-2 p-5">
        <AriaAvatar size={30} />
        <span className="font-display text-[17px] font-bold tracking-tight">aria</span>
        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-strong">
          ADMIN
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
                active
                  ? "bg-accent-soft font-medium text-accent-strong"
                  : "text-muted hover:bg-card hover:text-text"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border p-4">
        <span className="truncate text-xs text-muted">{adminEmail}</span>
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-bg-soft lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-bg-soft">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted"
            >
              <X size={16} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
          >
            <Menu size={16} />
          </button>
          <span className="font-display text-[15px] font-bold">
            {NAV.find((n) => n.href === pathname)?.label ?? "Admin"}
          </span>
        </div>
        <main className="overflow-x-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
