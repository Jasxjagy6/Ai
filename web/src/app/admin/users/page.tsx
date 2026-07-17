"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Search, ShieldCheck, Trash2, UserCheck } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  banned: boolean;
  createdAt: string;
  subscription: { tier: string; status: string; currentPeriodEnd: string | null } | null;
  _count: { conversations: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 25;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Delete ${email} and ALL their data? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by email or name..."
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-muted">{total} users</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Chats</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name ?? "—"}{" "}
                    {u.role === "ADMIN" && (
                      <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong">
                        ADMIN
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.subscription?.tier ?? "FREE"}
                    onChange={(e) => patch(u.id, { tier: e.target.value })}
                    className="rounded-lg border border-border bg-bg px-2 py-1 text-xs outline-none"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PLUS">PLUS</option>
                    <option value="PRO">PRO</option>
                  </select>
                </td>
                <td className="px-4 py-3">{u._count.conversations}</td>
                <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {u.banned ? (
                    <span className="rounded-full bg-rose/15 px-2 py-0.5 text-xs font-medium text-rose">Banned</span>
                  ) : (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      title={u.banned ? "Unban" : "Ban"}
                      onClick={() => patch(u.id, { banned: !u.banned })}
                      className="rounded-lg border border-border p-1.5 text-muted transition hover:text-rose"
                    >
                      {u.banned ? <UserCheck size={14} /> : <Ban size={14} />}
                    </button>
                    <button
                      title={u.role === "ADMIN" ? "Demote to user" : "Promote to admin"}
                      onClick={() => patch(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                      className="rounded-lg border border-border p-1.5 text-muted transition hover:text-accent"
                    >
                      <ShieldCheck size={14} />
                    </button>
                    <button
                      title="Delete user"
                      onClick={() => remove(u.id, u.email)}
                      className="rounded-lg border border-border p-1.5 text-muted transition hover:text-rose"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > perPage && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {Math.ceil(total / perPage)}
          </span>
          <button
            disabled={page >= Math.ceil(total / perPage)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
