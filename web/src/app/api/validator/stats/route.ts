import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized } from "@/lib/validator-api";

export async function GET() {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();

  const [
    jobStats,
    listStats,
    recentJobs,
    dailyActivity,
  ] = await Promise.all([
    prisma.linkFilterJob.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { totalCount: true, validCount: true, invalidCount: true, failedCount: true, totalRequests: true },
    }),
    prisma.contactList.findMany({
      where: { accountId: account.id },
      select: { id: true, type: true, itemsCount: true, source: true },
    }),
    prisma.linkFilterJob.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        validCount: true,
        invalidCount: true,
        failedCount: true,
        totalCount: true,
        totalRequests: true,
        createdAt: true,
        finishedAt: true,
        sourceListName: true,
      },
    }),
    prisma.$queryRaw<Array<{ date: string; total: bigint; valid: bigint; invalid: bigint }>>`
      SELECT
        DATE("createdAt") AS date,
        COUNT(*)::int AS total,
        COALESCE(SUM("validCount"), 0)::int AS valid,
        COALESCE(SUM("invalidCount"), 0)::int AS invalid
      FROM "LinkFilterJob"
      WHERE "accountId" = ${account.id}
        AND "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const totalJobs = jobStats.reduce((sum, row) => sum + row._count.id, 0);
  const totalValid = jobStats.reduce((sum, row) => sum + (row._sum.validCount ?? 0), 0);
  const totalInvalid = jobStats.reduce((sum, row) => sum + (row._sum.invalidCount ?? 0), 0);
  const totalFailed = jobStats.reduce((sum, row) => sum + (row._sum.failedCount ?? 0), 0);
  const totalProcessed = totalValid + totalInvalid + totalFailed;
  const totalRequests = jobStats.reduce((sum, row) => sum + (row._sum.totalRequests ?? 0), 0);
  const successRate = totalProcessed > 0 ? Math.round((totalValid / totalProcessed) * 100) : 0;

  const listTypeCounts = listStats.reduce<Record<string, number>>((acc, list) => {
    acc[list.type] = (acc[list.type] || 0) + 1;
    return acc;
  }, {});
  const totalItems = listStats.reduce((sum, list) => sum + list.itemsCount, 0);

  const byStatus = Object.fromEntries(
    jobStats.map((row) => [row.status, row._count.id]),
  );

  return NextResponse.json({
    totalJobs,
    totalValid,
    totalInvalid,
    totalFailed,
    totalProcessed,
    totalRequests,
    successRate,
    byStatus,
    lists: {
      total: listStats.length,
      totalItems,
      byType: listTypeCounts,
    },
    recentJobs,
    daily: dailyActivity.map((row) => ({
      date: row.date,
      total: Number(row.total),
      valid: Number(row.valid),
      invalid: Number(row.invalid),
    })),
  });
}
