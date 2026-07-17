import { PaymentProvider, PlanTier, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { razorpayAdapter } from "./razorpay";
import { stripeAdapter } from "./stripe";
import { PaymentAdapter } from "./types";

export function getAdapter(provider?: PaymentProvider): PaymentAdapter {
  const chosen = provider ?? (process.env.PAYMENT_PROVIDER === "stripe" ? "STRIPE" : "RAZORPAY");
  return chosen === "STRIPE" ? stripeAdapter : razorpayAdapter;
}

/** Create a checkout + pending Payment row. */
export async function startCheckout(userId: string, email: string, tier: PlanTier) {
  if (tier === "FREE") throw new Error("Cannot checkout the free plan");
  const adapter = getAdapter();
  const checkout = await adapter.createCheckout(userId, tier, email);

  await prisma.payment.create({
    data: {
      userId,
      provider: adapter.provider,
      providerOrderId: checkout.orderId!,
      amount: checkout.amount,
      currency: checkout.currency,
      tier,
      status: "CREATED",
    },
  });

  return checkout;
}

/** Mark a payment paid and activate/extend the subscription for 30 days. */
export async function fulfillPayment(providerOrderId: string, providerPayId: string) {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId } });
  if (!payment || payment.status === "PAID") return payment; // idempotent

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.payment.update({
      where: { providerOrderId },
      data: { status: "PAID" as PaymentStatus, providerPayId },
    }),
    prisma.subscription.upsert({
      where: { userId: payment.userId },
      update: {
        tier: payment.tier,
        status: "ACTIVE",
        provider: payment.provider,
        currentPeriodEnd: periodEnd,
      },
      create: {
        userId: payment.userId,
        tier: payment.tier,
        status: "ACTIVE",
        provider: payment.provider,
        currentPeriodEnd: periodEnd,
      },
    }),
  ]);

  return prisma.payment.findUnique({ where: { providerOrderId } });
}

export async function failPayment(providerOrderId: string) {
  await prisma.payment.updateMany({
    where: { providerOrderId, status: "CREATED" },
    data: { status: "FAILED" },
  });
}
