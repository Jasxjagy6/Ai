import type { Metadata } from "next";
import { ValidatorPortal } from "@/components/validator/validator-portal";
import { getSignalDeskAccount } from "@/lib/validator-auth";

export const metadata: Metadata = {
  title: "Workspace | Signal Desk",
  description: "Telegram validation and messaging operations.",
};

export default async function WorkspacePage() {
  const account = await getSignalDeskAccount();
  return (
    <ValidatorPortal
      initialAccount={
        account
          ? {
              ...account,
              accessExpiresAt: account.accessExpiresAt?.toISOString() || null,
            }
          : null
      }
    />
  );
}
