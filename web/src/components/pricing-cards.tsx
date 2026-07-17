"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PricingCards({ loggedIn, plans }: { loggedIn: boolean; plans: Plan[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function buy(plan: Plan) {
    if (!loggedIn) {
      router.push("/register");
      return;
    }
    setBusy(plan.tier);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: plan.tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Could not load payment window");

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Aria",
        description: `Aria ${plan.name} — 30 days`,
        order_id: data.orderId,
        theme: { color: "#9333ea" },
        handler: async (response: Record<string, string>) => {
          const confirm = await fetch("/api/checkout/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (confirm.ok) {
            router.push("/chat?upgraded=1");
            router.refresh();
          } else {
            setError("Payment verification failed — contact support if you were charged.");
          }
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && <p className="mb-5 text-center text-sm text-rose">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3 md:gap-5">
        {plans.map((plan) => {
          const highlight = plan.tier === "PLUS";
          return (
            <div
              key={plan.tier}
              className={`relative rounded-3xl border p-6 sm:p-7 ${
                highlight
                  ? "border-accent bg-card shadow-xl shadow-accent/10 md:scale-[1.03]"
                  : "border-border bg-card"
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-strong px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-base font-semibold">{plan.name}</h3>
              <p className="text-xs text-muted">{plan.tagline}</p>
              <p className="mt-3 text-3xl font-extrabold sm:text-4xl">
                {plan.priceInr === 0 ? "Free" : `₹${plan.priceInr / 100}`}
                {plan.priceInr !== 0 && (
                  <span className="text-sm font-normal text-muted"> /month</span>
                )}
              </p>
              <ul className="mt-5 space-y-2 text-xs sm:text-sm">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-accent" strokeWidth={3} />
                    {feat}
                  </li>
                ))}
              </ul>
              {plan.tier === "FREE" ? (
                <button
                  onClick={() => router.push(loggedIn ? "/chat" : "/register")}
                  className="mt-6 block w-full rounded-full border border-border py-2.5 text-center text-sm font-semibold transition hover:bg-bg-soft"
                >
                  {loggedIn ? "Open chat" : "Start free"}
                </button>
              ) : (
                <button
                  onClick={() => buy(plan)}
                  disabled={busy !== null}
                  className={`mt-6 block w-full rounded-full py-2.5 text-center text-sm font-semibold transition disabled:opacity-50 ${
                    highlight
                      ? "bg-accent-strong text-white hover:opacity-90"
                      : "border border-border hover:bg-bg-soft"
                  }`}
                >
                  {busy === plan.tier ? "Opening checkout..." : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
