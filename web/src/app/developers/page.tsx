import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { getUserTier } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export default async function DevelopersPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const tier = await getUserTier(user.id);
  const plan = await getPlan(tier);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold">Developer dashboard</h1>
        <p className="mt-2 text-muted">
          Integrate Aria into your own apps with our OpenAI-compatible API.{" "}
          <Link href="/docs" className="font-medium text-accent-strong hover:underline">
            Read the docs →
          </Link>
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted">Your plan</p>
            <p className="mt-1 text-2xl font-bold">{plan.name}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted">API requests / day</p>
            <p className="mt-1 text-2xl font-bold">
              {plan.apiRequestsPerDay === -1 ? "Unlimited" : plan.apiRequestsPerDay.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted">API keys allowed</p>
            <p className="mt-1 text-2xl font-bold">{plan.apiKeysAllowed}</p>
          </div>
        </div>

        <ApiKeysManager />

        <div className="mt-10 rounded-2xl border border-border bg-bg-soft p-6">
          <h2 className="font-semibold">Quick start</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[#16121f] p-4 text-xs leading-relaxed text-[#e2d9f3]">
{`curl https://YOUR_DOMAIN/api/v1/chat/completions \\
  -H "Authorization: Bearer aria_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "hey aria!"}
    ]
  }'`}
          </pre>
          <p className="mt-3 text-xs text-muted">
            The API is OpenAI-compatible — any OpenAI SDK works by changing the base URL.
          </p>
        </div>
      </div>
    </div>
  );
}
