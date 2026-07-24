import { Navbar } from "@/components/navbar";
import Link from "next/link";

export const metadata = { title: "Terms of Service — Aria" };

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <Navbar />
      <article className="mx-auto max-w-2xl px-4 py-16 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-text-secondary [&_li]:text-sm [&_li]:text-text-secondary">
        <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-xs text-text-secondary">Last updated: {new Date().getFullYear()}</p>

        <p>
          Welcome to Aria. By creating an account or using our website, chat, or API (the
          &ldquo;Service&rdquo;), you agree to these Terms. Please read them carefully.
        </p>

        <h2>1. What Aria is</h2>
        <p>
          Aria is an <strong className="text-text">artificial intelligence companion</strong>. Every
          message, voice note, and photo response is AI-generated. Aria is not a real person, not a
          licensed professional, and not a substitute for human relationships or professional
          (medical, legal, financial, or mental-health) advice.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old to use Aria. By using the Service you represent that you
          meet this requirement and that your use complies with the laws of your jurisdiction.
        </p>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Use the Service to harass, harm, or deceive others.</li>
          <li>Attempt to make the AI produce sexual content involving minors, or any illegal content.</li>
          <li>Represent AI-generated messages as coming from a real human to deceive a third party.</li>
          <li>Reverse-engineer, scrape, or abuse the API beyond your plan&apos;s limits.</li>
          <li>Resell or redistribute the Service without written permission.</li>
        </ul>

        <h2>4. Subscriptions &amp; billing</h2>
        <p>
          Paid plans are sold as 30-day access passes. Pricing is shown at checkout. See our{" "}
          <Link href="/refund-policy" className="text-accent-strong hover:underline">Refund Policy</Link>{" "}
          for cancellation and refund terms.
        </p>

        <h2>5. Your content &amp; privacy</h2>
        <p>
          Conversations are stored to give your companion memory. We never sell your data. See our{" "}
          <Link href="/privacy-policy" className="text-accent-strong hover:underline">Privacy Policy</Link>.
          You can delete any conversation or remembered fact at any time.
        </p>

        <h2>6. Disclaimers</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. AI output may be
          inaccurate or inappropriate; use your judgment. If you are in crisis, contact local
          emergency services or a helpline — Aria is not an emergency service.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Aria and its operators are not liable for indirect,
          incidental, or consequential damages arising from your use of the Service.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these Terms. Continued use after changes means you accept the revised Terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions? Email <a href="mailto:support@aria.chat" className="text-accent-strong hover:underline">support@aria.chat</a>.
        </p>
      </article>
    </div>
  );
}
