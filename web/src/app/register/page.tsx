"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="glow absolute inset-0 pointer-events-none" />
      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="rounded-2xl border border-border bg-bg-elevated p-8 shadow-xl transition-all duration-300 hover:shadow-accent/5">
          <Link href="/" className="mb-6 flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-80">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Sparkles size={16} />
            </span>
          </Link>
          <h1 className="text-center font-display text-xl font-bold tracking-tight">Meet Aria</h1>
          <p className="mt-1 text-center text-sm text-text-secondary">
            Create a free account — 20 messages a day, on the house
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              name="name"
              required
              minLength={2}
              placeholder="Your name"
              className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30"
              style={{ boxShadow: "none" }}
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30"
              style={{ boxShadow: "none" }}
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ characters)"
              className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30"
              style={{ boxShadow: "none" }}
            />
            {error && <p className="text-sm text-error animate-slide-up">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-accent-strong py-3 font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs leading-relaxed text-text-secondary">
            By signing up you acknowledge Aria is an AI companion, not a human.
          </p>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline transition-all duration-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
