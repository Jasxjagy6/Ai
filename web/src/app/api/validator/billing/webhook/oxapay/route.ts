import { processOxapayCallback } from "@/lib/validator-billing";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    await processOxapayCallback(rawBody, request.headers.get("hmac") || "");
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("OxaPay validator callback rejected", error);
    return new Response("invalid callback", { status: 400 });
  }
}
