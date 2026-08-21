import { NextResponse } from "next/server";
import { z } from "zod";
import {
  startValidatorPlanPurchase,
} from "@/lib/validator-billing";
import { getSignalDeskAccount } from "@/lib/validator-auth";

const schema = z.object({
  type: z.literal("plan").default("plan"),
  email: z.string().email().max(254).optional(),
  planCode: z.enum(["week", "month", "six_months", "year"]),
  referralCode: z.string().trim().max(20).optional(),
});

function publicOrigin(request: Request) {
  const configured = process.env.VALIDATOR_PUBLIC_URL?.trim().replace(
    /\/$/,
    "",
  );
  if (configured) return configured;
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ||
    new URL(request.url).protocol.replace(":", "");
  return forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter valid checkout details" },
      { status: 400 },
    );
  try {
    const account = await getSignalDeskAccount();
    if (!account && !parsed.data.email)
      throw new Error("Enter an email and choose a subscription");
    const checkout = await startValidatorPlanPurchase(
      parsed.data.email || account?.email || "",
      parsed.data.planCode,
      publicOrigin(request),
      parsed.data.referralCode,
      account,
    );
    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start checkout",
      },
      { status: 400 },
    );
  }
}
