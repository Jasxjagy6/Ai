import type { Metadata } from "next";
import { ValidatorPurchase } from "@/components/validator/validator-purchase";
import { getValidatorPlans, VALIDATOR_PLAN_CODES } from "@/lib/validator-plans";

export const metadata: Metadata = {
  title: "Buy Validator Access | Signal Desk",
  description: "Choose a Signal Desk validator access plan and pay securely with OxaPay.",
};

export default async function ValidatorBuyPage({ searchParams }: { searchParams: Promise<{ purchase?: string; token?: string }> }) {
  const [plans, query] = await Promise.all([getValidatorPlans(), searchParams]);
  return <ValidatorPurchase plans={VALIDATOR_PLAN_CODES.map((code) => plans[code]).filter((plan) => plan.enabled)} initialPurchase={query.purchase} initialToken={query.token} />;
}
