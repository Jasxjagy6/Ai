import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTrialConfig } from "@/lib/plans";

const schema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = email === process.env.ADMIN_EMAIL ? "ADMIN" : "USER";

  // Free trial (admin-configurable): new signups start on trial_tier for trial_days
  const trial = await getTrialConfig();
  const subscription =
    trial.days > 0
      ? {
          tier: trial.tier,
          status: "ACTIVE" as const,
          currentPeriodEnd: new Date(Date.now() + trial.days * 24 * 60 * 60 * 1000),
        }
      : { tier: "FREE" as const, status: "ACTIVE" as const };

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      subscription: { create: subscription },
    },
  });

  return NextResponse.json({ ok: true, trialDays: trial.days });
}
