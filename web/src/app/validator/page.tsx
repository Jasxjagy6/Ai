import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Signal Desk | Telegram Username Validator",
  description: "Import, clean, validate, and export Telegram username lists.",
};

export default function ValidatorPage() {
  redirect(
    `${process.env.VALIDATOR_PUBLIC_URL || "http://localhost:3100"}/workspace`,
  );
}
