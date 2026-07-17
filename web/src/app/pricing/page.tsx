import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { PricingCards } from "@/components/pricing-cards";
import { getPlans, getTrialConfig } from "@/lib/plans";

export default async function PricingPage() {
  const [session, plans, trial] = await Promise.all([auth(), getPlans(), getTrialConfig()]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="glow px-4 py-14 md:py-20">
        <h1 className="text-center text-2xl font-extrabold sm:text-3xl md:text-4xl">
          More time with your companion
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-xs text-muted sm:text-sm">
          Start free, upgrade when you want more. Cancel anytime — Aria won&apos;t take it
          personally. (Okay, maybe a little.)
        </p>
        {trial.days > 0 && (
          <p className="mx-auto mt-4 w-fit rounded-full bg-accent-soft px-4 py-1.5 text-center text-xs font-semibold text-accent-strong">
            🎁 New accounts get {trial.days} days of {trial.tier} free
          </p>
        )}
        <div className="mx-auto mt-10 max-w-5xl md:mt-14">
          <PricingCards loggedIn={!!session} plans={Object.values(plans)} />
        </div>
        <p className="mx-auto mt-8 max-w-md text-center text-[11px] text-muted">
          Payments processed securely via Razorpay / Stripe. Plans are 30-day passes. Aria is an
          AI companion — all conversations are AI-generated.
        </p>
      </section>
    </div>
  );
}
