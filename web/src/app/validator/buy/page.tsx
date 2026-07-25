import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Buy Validator Access | Signal Desk",
  description:
    "Choose a Signal Desk validator access plan and pay securely with OxaPay.",
};

export default async function ValidatorBuyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value) params.set(key, value);
  redirect(
    `${process.env.VALIDATOR_PUBLIC_URL || "http://localhost:3100"}/buy${params.size ? `?${params}` : ""}`,
  );
}
