import { NextResponse } from "next/server";
import { clearValidatorSession, createValidatorSession, getSignalDeskAccount } from "@/lib/validator-auth";

export async function GET() {
  const account = await getSignalDeskAccount();
  return account
    ? NextResponse.json({ authenticated: true, account })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key || key.length > 200) return NextResponse.json({ error: "Enter a valid access key" }, { status: 400 });
  const account = await createValidatorSession(key);
  if (!account) return NextResponse.json({ error: "This access key is invalid or revoked" }, { status: 401 });
  return NextResponse.json({ authenticated: true, account });
}

export async function DELETE() {
  await clearValidatorSession();
  return NextResponse.json({ ok: true });
}
