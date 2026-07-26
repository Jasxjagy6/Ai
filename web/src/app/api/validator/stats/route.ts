import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized } from "@/lib/validator-api";

function dashboardRange(request: Request) {
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") || "30d";
  const now = new Date();
  let from: Date;
  let to = now;
  if (preset === "custom") {
    from = new Date(url.searchParams.get("from") || "");
    to = new Date(url.searchParams.get("to") || "");
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
      throw new Error("Choose a valid custom date range");
    }
    to.setHours(23, 59, 59, 999);
  } else {
    const milliseconds = preset === "24h" ? 86_400_000 : preset === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
    from = new Date(now.getTime() - milliseconds);
  }
  const maximumStart = new Date(now.getTime() - 366 * 86_400_000);
  if (from < maximumStart) from = maximumStart;
  if (to > now) to = now;
  return { preset, from, to };
}

export async function GET(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  let range: ReturnType<typeof dashboardRange>;
  try {
    range = dashboardRange(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date range" }, { status: 400 });
  }
  const dateFilter = { gte: range.from, lte: range.to };
  const rawDates = Prisma.sql`AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}`;

  const [
    jobStats,
    listStats,
    recentJobs,
    dailyActivity,
    sessionStats,
    campaignStats,
    recentCampaigns,
    recentAccountJobs,
    aiCampaigns,
    dailyMessages,
    dailyCredits,
    creditTotals,
    activeSessions,
    cleanSessions,
  ] = await Promise.all([
    prisma.linkFilterJob.groupBy({
      by: ["status"],
      where: { accountId: account.id, createdAt: dateFilter },
      _count: { id: true },
      _sum: { totalCount: true, validCount: true, invalidCount: true, failedCount: true, totalRequests: true },
    }),
    prisma.contactList.findMany({
      where: { accountId: account.id },
      select: { id: true, type: true, itemsCount: true, source: true },
    }),
    prisma.linkFilterJob.findMany({
      where: { accountId: account.id, createdAt: dateFilter },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true, status: true, validCount: true, invalidCount: true, failedCount: true,
        totalCount: true, totalRequests: true, createdAt: true, finishedAt: true, sourceListName: true,
      },
    }),
    prisma.$queryRaw<Array<{ date: Date; total: bigint; valid: bigint; invalid: bigint }>>(Prisma.sql`
      SELECT DATE("createdAt") AS date, COUNT(*)::int AS total,
        COALESCE(SUM("validCount"), 0)::int AS valid,
        COALESCE(SUM("invalidCount"), 0)::int AS invalid
      FROM "LinkFilterJob" WHERE "accountId" = ${account.id} ${rawDates}
      GROUP BY DATE("createdAt") ORDER BY date ASC
    `),
    prisma.telegramSession.aggregate({
      where: { accountId: account.id },
      _count: { id: true },
      _sum: { messagesSent: true, repliesReceived: true },
    }),
    prisma.telegramCampaign.groupBy({
      by: ["status"],
      where: { accountId: account.id, createdAt: dateFilter },
      _count: { id: true },
      _sum: { sentCount: true, failedCount: true, repliedCount: true, totalCount: true },
    }),
    prisma.telegramCampaign.findMany({
      where: { accountId: account.id, createdAt: dateFilter },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true, name: true, status: true, sentCount: true, failedCount: true,
        repliedCount: true, totalCount: true, createdAt: true, finishedAt: true,
      },
    }),
    prisma.telegramAccountSettingsBatch.findMany({
      where: { accountId: account.id, createdAt: dateFilter },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true, kind: true, status: true, succeededCount: true, failedCount: true,
        totalCount: true, createdAt: true, finishedAt: true,
      },
    }),
    prisma.aiCampaign.findMany({
      where: { accountId: account.id, createdAt: dateFilter },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true, name: true, status: true, messagesSent: true, failedCount: true,
        messagesReceived: true, startedAt: true, stoppedAt: true, createdAt: true,
      },
    }),
    prisma.$queryRaw<Array<{ date: Date; runs: bigint; sent: bigint; failed: bigint; replied: bigint }>>(Prisma.sql`
      SELECT DATE("createdAt") AS date, COUNT(*)::int AS runs,
        COALESCE(SUM("sentCount"), 0)::int AS sent,
        COALESCE(SUM("failedCount"), 0)::int AS failed,
        COALESCE(SUM("repliedCount"), 0)::int AS replied
      FROM "TelegramCampaign" WHERE "accountId" = ${account.id} ${rawDates}
      GROUP BY DATE("createdAt") ORDER BY date ASC
    `),
    prisma.$queryRaw<Array<{ date: Date; credits: bigint }>>(Prisma.sql`
      SELECT DATE("createdAt") AS date, ABS(COALESCE(SUM(amount), 0))::int AS credits
      FROM "ValidatorCreditTransaction"
      WHERE "accountId" = ${account.id} AND amount < 0 ${rawDates}
      GROUP BY DATE("createdAt") ORDER BY date ASC
    `),
    prisma.validatorCreditTransaction.aggregate({
      where: { accountId: account.id, createdAt: dateFilter, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.telegramSession.count({ where: { accountId: account.id, status: "active", isLoggedIn: true } }),
    prisma.telegramSession.count({ where: { accountId: account.id, spamStatus: "clean" } }),
  ]);

  const totalJobs = jobStats.reduce((sum, row) => sum + row._count.id, 0);
  const totalValid = jobStats.reduce((sum, row) => sum + (row._sum.validCount || 0), 0);
  const totalInvalid = jobStats.reduce((sum, row) => sum + (row._sum.invalidCount || 0), 0);
  const totalFailed = jobStats.reduce((sum, row) => sum + (row._sum.failedCount || 0), 0);
  const totalProcessed = totalValid + totalInvalid + totalFailed;
  const totalRequests = jobStats.reduce((sum, row) => sum + (row._sum.totalRequests || 0), 0);
  const successRate = totalProcessed ? Math.round((totalValid / totalProcessed) * 100) : 0;
  const listTypeCounts = listStats.reduce<Record<string, number>>((result, list) => {
    result[list.type] = (result[list.type] || 0) + 1;
    return result;
  }, {});
  const campaignByStatus = Object.fromEntries(campaignStats.map((row) => [row.status, row._count.id]));
  const campaignTotals = campaignStats.reduce(
    (totals, row) => ({
      runs: totals.runs + row._count.id,
      sent: totals.sent + (row._sum.sentCount || 0),
      failed: totals.failed + (row._sum.failedCount || 0),
      replied: totals.replied + (row._sum.repliedCount || 0),
      targets: totals.targets + (row._sum.totalCount || 0),
    }),
    { runs: 0, sent: 0, failed: 0, replied: 0, targets: 0 },
  );
  const periodCreditsUsed = Math.abs(creditTotals._sum.amount || 0);
  const completedRuns =
    (jobStats.find((row) => row.status === "completed")?._count.id || 0) +
    (campaignStats.find((row) => row.status === "completed")?._count.id || 0) +
    recentAccountJobs.filter((job) => job.status === "completed").length +
    aiCampaigns.filter((campaign) => ["stopped", "expired"].includes(campaign.status)).length;

  return NextResponse.json({
    range: { preset: range.preset, from: range.from, to: range.to },
    totalJobs,
    totalValid,
    totalInvalid,
    totalFailed,
    totalProcessed,
    totalRequests,
    successRate,
    completedRuns,
    credits: {
      balance: account.creditsBalance,
      purchased: account.creditsPurchased,
      spent: periodCreditsUsed,
      usagePercent: account.creditsPurchased
        ? Math.min(100, Math.round((periodCreditsUsed / account.creditsPurchased) * 100))
        : 0,
      daily: dailyCredits.map((row) => ({ date: row.date.toISOString().slice(0, 10), credits: Number(row.credits) })),
    },
    byStatus: Object.fromEntries(jobStats.map((row) => [row.status, row._count.id])),
    lists: {
      total: listStats.length,
      totalItems: listStats.reduce((sum, list) => sum + list.itemsCount, 0),
      byType: listTypeCounts,
    },
    recentJobs,
    daily: dailyActivity.map((row) => ({ date: row.date.toISOString().slice(0, 10), total: Number(row.total), valid: Number(row.valid), invalid: Number(row.invalid) })),
    sessions: {
      total: sessionStats._count.id,
      active: activeSessions,
      inactive: sessionStats._count.id - activeSessions,
      clean: cleanSessions,
      messagesSent: campaignTotals.sent + aiCampaigns.reduce((sum, campaign) => sum + campaign.messagesSent, 0),
      repliesReceived: campaignTotals.replied + aiCampaigns.reduce((sum, campaign) => sum + campaign.messagesReceived, 0),
    },
    messaging: {
      ...campaignTotals,
      successRate: campaignTotals.sent + campaignTotals.failed
        ? Math.round((campaignTotals.sent / (campaignTotals.sent + campaignTotals.failed)) * 100)
        : 0,
      byStatus: campaignByStatus,
      recent: recentCampaigns,
      daily: dailyMessages.map((row) => ({ date: row.date.toISOString().slice(0, 10), runs: Number(row.runs), sent: Number(row.sent), failed: Number(row.failed), replied: Number(row.replied) })),
    },
    recentActivity: [
      ...recentJobs.map((job) => ({ id: job.id, kind: "validator", name: job.sourceListName, status: job.status, succeeded: job.validCount, failed: job.failedCount, total: job.totalCount, createdAt: job.createdAt, finishedAt: job.finishedAt })),
      ...recentCampaigns.map((campaign) => ({ id: campaign.id, kind: "message_run", name: campaign.name, status: campaign.status, succeeded: campaign.sentCount, failed: campaign.failedCount, total: campaign.totalCount, createdAt: campaign.createdAt, finishedAt: campaign.finishedAt })),
      ...recentAccountJobs.map((job) => ({ id: job.id, kind: "account_settings", name: job.kind.replaceAll("_", " "), status: job.status, succeeded: job.succeededCount, failed: job.failedCount, total: job.totalCount, createdAt: job.createdAt, finishedAt: job.finishedAt })),
      ...aiCampaigns.map((campaign) => ({ id: campaign.id, kind: "ai_campaign", name: campaign.name, status: campaign.status, succeeded: campaign.messagesSent, failed: campaign.failedCount, total: campaign.messagesReceived, createdAt: campaign.createdAt, finishedAt: campaign.stoppedAt })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 20),
  });
}
