import { NextResponse } from "next/server";
import { getValidatorPlans, VALIDATOR_PLAN_CODES } from "@/lib/validator-plans";

export async function GET() {
  const plans = await getValidatorPlans();
  return NextResponse.json({ plans: VALIDATOR_PLAN_CODES.map((code) => plans[code]).filter((plan) => plan.enabled) });
}
