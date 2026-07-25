import { NextResponse } from "next/server";
import {
  clearValidatorAdminSession,
  createValidatorAdminSession,
  requireValidatorAdmin,
} from "@/lib/validator-admin-auth";

export async function GET() {
  return (await requireValidatorAdmin())
    ? NextResponse.json({ authenticated: true })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key || !(await createValidatorAdminSession(key)))
    return NextResponse.json(
      { error: "Invalid validator admin key" },
      { status: 401 },
    );
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  await clearValidatorAdminSession();
  return NextResponse.json({ ok: true });
}
