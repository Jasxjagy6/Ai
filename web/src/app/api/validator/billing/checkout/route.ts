import { NextResponse } from "next/server";
import { z } from "zod";
import {
  startValidatorPlanPurchase,
  startValidatorTopup,
} from "@/lib/validator-billing";
import { requireSignalDeskAccount } from "@/lib/validator-auth";

const schema = z.object({
  type: z.enum(["plan", "topup"]).default("plan"),
  email: z.string().email().max(254).optional(),
  planCode: z.enum(["basic", "pro", "vip", "enterprise"]).optional(),
  packCode: z.string().trim().max(40).optional(),
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
    const checkout =
      parsed.data.type === "topup"
        ? await (async () => {
            const account = await requireSignalDeskAccount();
            if (!account) throw new Error("Sign in before adding credits");
            if (!parsed.data.packCode) throw new Error("Choose a credit pack");
            return startValidatorTopup(
              account,
              parsed.data.packCode,
              publicOrigin(request),
            );
          })()
        : await (async () => {
            if (!parsed.data.email || !parsed.data.planCode)
              throw new Error("Enter an email and choose a plan");
            return startValidatorPlanPurchase(
              parsed.data.email,
              parsed.data.planCode,
              publicOrigin(request),
              parsed.data.referralCode,
            );
          })();
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
