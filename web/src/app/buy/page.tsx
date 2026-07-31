import type { Metadata } from "next";
import { ValidatorPurchase } from "@/components/validator/validator-purchase";
import { getValidatorPlans, VALIDATOR_PLAN_CODES } from "@/lib/validator-plans";

export const metadata: Metadata = {
  title: "Subscriptions | Signal Desk",
  description: "Choose a Signal Desk subscription period.",
};

export default async function BuyPage({
  searchParams,
}: {
  searchParams: Promise<{
    purchase?: string;
    token?: string;
    plan?: string;
    ref?: string;
  }>;
}) {
  const [plans, query] = await Promise.all([getValidatorPlans(), searchParams]);
  return (
    <ValidatorPurchase
      plans={VALIDATOR_PLAN_CODES.map((code) => plans[code]).filter(
        (plan) => plan.enabled,
      )}
      initialPurchase={query.purchase}
      initialToken={query.token}
      initialPlan={query.plan}
      initialReferral={query.ref}
    />
  );
}
