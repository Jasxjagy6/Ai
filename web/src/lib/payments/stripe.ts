import Stripe from "stripe";
import { PlanTier } from "@prisma/client";
import { getPlans } from "@/lib/plans";
import { PaymentAdapter, CheckoutResult, NormalizedEvent, amountFor } from "./types";

function client() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const stripeAdapter: PaymentAdapter = {
  provider: "STRIPE",

  async createCheckout(userId: string, tier: PlanTier, email: string): Promise<CheckoutResult> {
    const amount = await amountFor(tier, "USD");
    const plans = await getPlans();
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const session = await client().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: `Aria ${plans[tier].name} — 1 month` },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, tier },
      success_url: `${base}/chat?upgraded=1`,
      cancel_url: `${base}/pricing?canceled=1`,
    });
    return {
      provider: "STRIPE",
      orderId: session.id,
      redirectUrl: session.url ?? undefined,
      amount,
      currency: "USD",
    };
  },

  async parseWebhook(body: string, signature: string): Promise<NormalizedEvent | null> {
    let event: Stripe.Event;
    try {
      event = client().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      return null;
    }
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      return {
        type: "payment.succeeded",
        providerOrderId: s.id,
        providerPayId: (s.payment_intent as string) ?? s.id,
      };
    }
    if (event.type === "checkout.session.expired") {
      const s = event.data.object as Stripe.Checkout.Session;
      return { type: "payment.failed", providerOrderId: s.id };
    }
    return { type: "ignored" };
  },
};
