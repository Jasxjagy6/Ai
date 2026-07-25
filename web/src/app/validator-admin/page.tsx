import type { Metadata } from "next";
import { ValidatorAdmin } from "@/components/validator/validator-admin";
import { requireValidatorAdmin } from "@/lib/validator-admin-auth";

export const metadata: Metadata = {
  title: "Validator Admin | Signal Desk",
  description: "Signal Desk platform administration.",
};

export default async function ValidatorAdminPage() {
  return (
    <ValidatorAdmin initiallyAuthenticated={await requireValidatorAdmin()} />
  );
}
