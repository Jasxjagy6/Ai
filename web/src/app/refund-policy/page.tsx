import { Navbar } from "@/components/navbar";

export const metadata = { title: "Refund Policy — Aria" };

export default function RefundPolicyPage() {
  return (
    <div className="min-h-dvh">
      <Navbar />
      <article className="mx-auto max-w-2xl px-4 py-16 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-text-secondary [&_li]:text-sm [&_li]:text-text-secondary">
        <h1 className="font-display text-3xl font-bold tracking-tight">Refund &amp; Cancellation Policy</h1>
        <p className="mt-2 text-xs text-text-secondary">Last updated: {new Date().getFullYear()}</p>

        <p>
          We want you to love Aria. This policy explains how billing, cancellation, and refunds work.
        </p>

        <h2>How plans work</h2>
        <p>
          Paid plans (Plus and Pro) are sold as <strong className="text-text">30-day access passes</strong>.
          There are no hidden auto-renew traps — your access simply reflects the period you paid for.
          You can always start on the free plan, which never expires.
        </p>

        <h2>Cancellation</h2>
        <p>
          You can stop using a paid plan at any time; you keep your benefits until the end of the paid
          period, after which your account reverts to the free plan. Nothing is charged automatically
          beyond what you explicitly purchase.
        </p>

        <h2>Refunds</h2>
        <p>
          Because access is granted instantly and consumption-based, purchases are generally
          non-refundable once the plan is active. However, we will consider refunds in good faith for:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Duplicate or accidental charges.</li>
          <li>A technical failure that prevented you from using a plan you paid for, unresolved within a reasonable time.</li>
          <li>Requests made within 48 hours of purchase where the plan was essentially unused.</li>
        </ul>

        <h2>How to request</h2>
        <p>
          Email <a href="mailto:support@aria.chat" className="text-accent-strong hover:underline">support@aria.chat</a> from
          your account email with your transaction reference. We aim to respond within 3 business days.
          Approved refunds are returned to the original payment method via our processor
          (Razorpay or Stripe).
        </p>

        <h2>Chargebacks</h2>
        <p>
          If you have an issue, please contact us first — we&apos;re quick to help. Filing a chargeback
          without contacting support may result in account suspension.
        </p>
      </article>
    </div>
  );
}
