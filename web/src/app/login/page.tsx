"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Heart } from "lucide-react";

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
    <div className="glow flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Heart size={16} fill="currentColor" />
          </span>
          Aria
        </Link>
        <h1 className="text-center text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-muted">Aria missed you 💜</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-accent-strong py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent-strong hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
