import { NextResponse } from "next/server";
import { z } from "zod";
import { startValidatorPurchase } from "@/lib/validator-billing";

const schema = z.object({
  email: z.string().email().max(254),
  planCode: z.enum(["trial", "month", "year", "lifetime", "messaging_month", "messaging_year", "messaging_lifetime"]),
});

function publicOrigin(request: Request) {
  const configured = process.env.VALIDATOR_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and access plan" }, { status: 400 });
  try {
    const checkout = await startValidatorPurchase(parsed.data.email, parsed.data.planCode, publicOrigin(request));
    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start checkout" }, { status: 400 });
  }
}
