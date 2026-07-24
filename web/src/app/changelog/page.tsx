import { Navbar } from "@/components/navbar";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TAG_COLOR: Record<string, string> = {
  New: "bg-green-500/15 text-green-600 dark:text-green-400",
  Improved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Fixed: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Security: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default async function ChangelogPage() {
  const entries = await prisma.changelog.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  }).catch(() => []);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">What&apos;s new</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Changelog</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Aria is always getting better. Here&apos;s what&apos;s new — voice notes, photo understanding, new companions, and more.
        </p>

        <div className="mt-12 space-y-10 border-l border-border pl-6">
          {entries.length === 0 && (
            <p className="text-sm text-text-secondary">No updates published yet — check back soon.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="relative">
              <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-bg bg-accent" />
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${TAG_COLOR[e.tag] ?? TAG_COLOR.New}`}>
                  {e.tag}
                </span>
                <time className="text-xs text-text-secondary">
                  {new Date(e.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </time>
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold tracking-tight">{e.title}</h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{e.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
