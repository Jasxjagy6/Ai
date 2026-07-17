import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";

/** GET /api/v1/models — OpenAI-compatible model listing. */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if ("error" in auth) {
    return NextResponse.json(
      { error: { type: "invalid_api_key", message: "Missing or invalid API key" } },
      { status: 401 }
    );
  }
  return NextResponse.json({
    object: "list",
    data: [
      {
        id: "aria-1",
        object: "model",
        owned_by: "aria",
        description: "Aria companion model — warm, natural, human-like conversation",
      },
    ],
  });
}
