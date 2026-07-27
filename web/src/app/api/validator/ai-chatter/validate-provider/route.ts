import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAiProvider } from "@/lib/ai-chatter";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const schema = z.object({
  provider: z.enum(["capitalbot", "cupidbot"]),
  secret: z.string().trim().min(8).max(1000),
});

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.aiChatAccess) {
    return NextResponse.json(
      { error: "AI Chatter is not included in this plan" },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid provider credential" }, { status: 400 });
  }
  try {
    const result = await validateAiProvider(parsed.data.provider, parsed.data.secret);
    return result.valid
      ? NextResponse.json({ valid: true, catalog: result.catalog })
      : NextResponse.json(
          { error: result.error || "Provider rejected this credential" },
          { status: 422 },
        );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provider validation failed" },
      { status: 502 },
    );
  }
}
