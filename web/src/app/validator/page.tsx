import type { Metadata } from "next";
import { ValidatorPortal } from "@/components/validator/validator-portal";
import { requireSignalDeskAccount } from "@/lib/validator-auth";

export const metadata: Metadata = {
  title: "Signal Desk | Telegram Username Validator",
  description: "Import, clean, validate, and export Telegram username lists.",
};

export default async function ValidatorPage() {
  const account = await requireSignalDeskAccount();
  return <ValidatorPortal initialAccount={account ? {
    ...account,
    accessExpiresAt: account.accessExpiresAt?.toISOString() || null,
  } : null} />;
}
