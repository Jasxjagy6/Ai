import { NextResponse } from "next/server";
import { stripeAdapter } from "@/lib/payments/stripe";
import { fulfillPayment, failPayment } from "@/lib/payments";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const event = await stripeAdapter.parseWebhook(body, signature);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  if (event.type === "payment.succeeded") {
    await fulfillPayment(event.providerOrderId, event.providerPayId);
  } else if (event.type === "payment.failed") {
    await failPayment(event.providerOrderId);
  }
  return NextResponse.json({ ok: true });
}
