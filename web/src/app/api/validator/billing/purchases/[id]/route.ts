import { NextResponse } from "next/server";
import { getValidatorPurchase } from "@/lib/validator-billing";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";
  const purchase = await getValidatorPurchase(id, token, true);
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  return NextResponse.json({ purchase });
}
