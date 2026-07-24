import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { getUserTier } from "@/lib/usage";
import { getPlan } from "@/lib/plans";
import { MemoriesPanel } from "@/components/memories-panel";

export default async function AccountPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const tier = await getUserTier(user.id);
  const plan = await getPlan(tier);

  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [usage, sub, payments, convoCount] = await Promise.all([
    prisma.usageLog.findUnique({ where: { userId_day: { userId: user.id, day } } }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.conversation.count({ where: { userId: user.id } }),
  ]);

  const used = usage?.messages ?? 0;
  const pct = plan.messagesPerDay === -1 ? 0 : Math.min(100, (used / plan.messagesPerDay) * 100);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">Your account</h1>
        <p className="mt-1 text-text-secondary">{user.email}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-bg-elevated p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">Current plan</p>
              <span className="rounded-lg bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {plan.name}
              </span>
            </div>
            {sub?.currentPeriodEnd && tier !== "FREE" && (
              <p className="mt-2 text-sm text-text-secondary">
                Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {tier === "FREE" ? (
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-xl bg-accent-strong px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Upgrade
              </Link>
            ) : (
              <Link href="/pricing" className="mt-4 inline-block text-sm text-accent hover:underline">
                Change plan &rarr;
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-bg-elevated p-6">
            <p className="text-sm text-text-secondary">Messages today</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {used}
              <span className="text-base font-normal text-text-secondary">
                {" "}/ {plan.messagesPerDay === -1 ? "\u221e" : plan.messagesPerDay}
              </span>
            </p>
            {plan.messagesPerDay !== -1 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-text-secondary">{convoCount} total conversations</p>
          </div>
        </div>

        <h2 className="mt-10 font-display text-lg font-semibold tracking-tight">Payment history</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{p.tier}</td>
                  <td className="px-4 py-3">
                    {p.currency === "INR" ? "\u20B9" : "$"}
                    {(p.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{p.status}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                    No payments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <MemoriesPanel />

        <div className="mt-10 flex gap-3">
          <Link
            href="/developers"
            className="rounded-xl border border-border bg-bg-elevated px-5 py-2.5 text-sm font-semibold transition hover:bg-bg-soft"
          >
            Developer dashboard
          </Link>
          <Link
            href="/chat"
            className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}
