"use client";

import { useEffect, useState } from "react";
import { IndianRupee, MessageCircle, TrendingUp, Users } from "lucide-react";

type Stats = {
  totalUsers: number;
  newUsersWeek: number;
  activeSubs: number;
  totalRevenue: number;
  messagesToday: number;
  apiRequestsToday: number;
  recentPayments: Array<{
    id: string;
    email: string;
    amount: number;
    currency: string;
    tier: string;
    status: string;
    createdAt: string;
  }>;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <p className="text-muted">Loading dashboard...</p>;

  const cards = [
    { label: "Total users", value: stats.totalUsers, sub: `+${stats.newUsersWeek} this week`, icon: Users },
    { label: "Active paid subs", value: stats.activeSubs, sub: "PLUS + PRO", icon: TrendingUp },
    {
      label: "Total revenue",
      value: `₹${(stats.totalRevenue / 100).toLocaleString("en-IN")}`,
      sub: "all time (paid)",
      icon: IndianRupee,
    },
    { label: "Messages today", value: stats.messagesToday, sub: "web chat", icon: MessageCircle },
    { label: "API requests today", value: stats.apiRequestsToday, sub: "developer API", icon: MessageCircle },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{c.label}</p>
              <c.icon size={16} className="text-accent" />
            </div>
            <p className="mt-2 text-3xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.sub}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Recent payments</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentPayments.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3">{p.tier}</td>
                <td className="px-4 py-3">
                  {p.currency === "INR" ? "₹" : "$"}
                  {(p.amount / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "PAID"
                        ? "bg-green-500/15 text-green-600 dark:text-green-400"
                        : p.status === "CREATED"
                          ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                          : "bg-rose/15 text-rose"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {stats.recentPayments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No payments yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
