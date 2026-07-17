import Razorpay from "razorpay";
import crypto from "crypto";
import { PlanTier } from "@prisma/client";
import { PaymentAdapter, CheckoutResult, NormalizedEvent, amountFor } from "./types";

function client() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export const razorpayAdapter: PaymentAdapter = {
  provider: "RAZORPAY",

  async createCheckout(userId: string, tier: PlanTier): Promise<CheckoutResult> {
    const amount = await amountFor(tier, "INR");
    const order = await client().orders.create({
      amount,
      currency: "INR",
      notes: { userId, tier },
    });
    return {
      provider: "RAZORPAY",
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  },

  async parseWebhook(body: string, signature: string): Promise<NormalizedEvent | null> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const event = JSON.parse(body);
    if (event.event === "payment.captured") {
      const p = event.payload.payment.entity;
      return {
        type: "payment.succeeded",
        providerOrderId: p.order_id,
        providerPayId: p.id,
      };
    }
    if (event.event === "payment.failed") {
      const p = event.payload.payment.entity;
      return { type: "payment.failed", providerOrderId: p.order_id };
    }
    return { type: "ignored" };
  },
};

/** Client-side checkout callback verification (payment page flow). */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
