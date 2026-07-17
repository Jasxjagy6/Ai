"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Heart } from "lucide-react";

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

    // auto-login after successful registration
    await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    router.push("/chat");
    router.refresh();
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
        <h1 className="text-center text-2xl font-bold">Meet Aria</h1>
        <p className="mt-1 text-center text-sm text-muted">
          Create a free account — 20 messages a day, on the house
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            name="name"
            required
            minLength={2}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
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
            placeholder="Password (8+ characters)"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-accent-strong py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          By signing up you acknowledge Aria is an AI companion, not a human.
        </p>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-strong hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
