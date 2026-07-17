import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startCheckout } from "@/lib/payments";

const schema = z.object({ tier: z.enum(["PLUS", "PRO"]) });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  try {
    const checkout = await startCheckout(user.id, user.email!, parsed.data.tier);
    return NextResponse.json(checkout);
  } catch (e) {
    console.error("checkout error", e);
    return NextResponse.json({ error: "Payment provider not configured" }, { status: 500 });
  }
}
