import { NextResponse } from "next/server";
import { ListError } from "@/lib/lists";
import { TelegramControlError } from "@/lib/telegram-control";
import { AccountSettingsError } from "@/lib/account-settings";

export function validatorError(error: unknown) {
  if (error instanceof ListError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof TelegramControlError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AccountSettingsError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("Validator API error", error);
  return NextResponse.json({ error: "The validator could not complete this request" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Validator access required" }, { status: 401 });
}

export function messagingUnauthorized() {
  return NextResponse.json({ error: "Messaging access required", code: "MESSAGING_ACCESS_REQUIRED" }, { status: 403 });
}
