"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Wrong email or password");
    } else {
      router.push("/chat");
      router.refresh();
    }
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
          <h1 className="text-center font-display text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-text-secondary">Sign in to your account</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
              placeholder="Password"
              className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30"
              style={{ boxShadow: "none" }}
            />
            {error && <p className="text-sm text-error animate-slide-up">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-accent-strong py-3 font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            New here?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline transition-all duration-200">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
