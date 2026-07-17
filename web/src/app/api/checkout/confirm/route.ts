import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";
import { fulfillPayment } from "@/lib/payments";

// Client-side confirmation after the Razorpay widget succeeds.
// The webhook is the source of truth; this endpoint gives instant UX.
const schema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  await fulfillPayment(razorpay_order_id, razorpay_payment_id);
  return NextResponse.json({ ok: true });
}
