import { NextResponse } from "next/server";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { fulfillPayment, failPayment } from "@/lib/payments";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const event = await razorpayAdapter.parseWebhook(body, signature);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  if (event.type === "payment.succeeded") {
    await fulfillPayment(event.providerOrderId, event.providerPayId);
  } else if (event.type === "payment.failed") {
    await failPayment(event.providerOrderId);
  }
  return NextResponse.json({ ok: true });
}
