import { PlanTier, PaymentProvider } from "@prisma/client";
import { getPlans } from "@/lib/plans";

export type CheckoutResult = {
  provider: PaymentProvider;
  /** Razorpay: order id for Checkout.js; Stripe: redirect URL */
  orderId?: string;
  redirectUrl?: string;
  amount: number;
  currency: string;
  keyId?: string; // razorpay public key for the client widget
};

export interface PaymentAdapter {
  provider: PaymentProvider;
  createCheckout(userId: string, tier: PlanTier, email: string): Promise<CheckoutResult>;
  /** Verify a webhook request; return normalized event or null if invalid. */
  parseWebhook(body: string, signature: string): Promise<NormalizedEvent | null>;
}

export type NormalizedEvent =
  | { type: "payment.succeeded"; providerOrderId: string; providerPayId: string }
  | { type: "payment.failed"; providerOrderId: string }
  | { type: "ignored" };

export async function amountFor(tier: PlanTier, currency: "INR" | "USD"): Promise<number> {
  const plan = (await getPlans())[tier];
  return currency === "INR" ? plan.priceInr : plan.priceUsd;
}
