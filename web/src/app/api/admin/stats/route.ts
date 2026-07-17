import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, newUsersWeek, activeSubs, paidRevenue, messagesToday, apiToday, recentPayments] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.subscription.count({ where: { status: "ACTIVE", tier: { not: "FREE" } } }),
      prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.usageLog.aggregate({ where: { day: dayStart }, _sum: { messages: true } }),
      prisma.apiUsage.aggregate({ where: { day: dayStart }, _sum: { requests: true } }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { email: true } } },
      }),
    ]);

  return NextResponse.json({
    totalUsers,
    newUsersWeek,
    activeSubs,
    totalRevenue: paidRevenue._sum.amount ?? 0,
    messagesToday: messagesToday._sum.messages ?? 0,
    apiRequestsToday: apiToday._sum.requests ?? 0,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      email: p.user.email,
      amount: p.amount,
      currency: p.currency,
      tier: p.tier,
      status: p.status,
      createdAt: p.createdAt,
    })),
  });
}
