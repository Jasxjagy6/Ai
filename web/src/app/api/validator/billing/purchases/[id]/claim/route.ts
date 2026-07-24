import { NextResponse } from "next/server";
import { claimValidatorPurchase } from "@/lib/validator-billing";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const result = await claimValidatorPurchase(id, token);
  if (!result) return NextResponse.json({ error: "Payment is not confirmed yet" }, { status: 409 });
  return NextResponse.json(result);
}
