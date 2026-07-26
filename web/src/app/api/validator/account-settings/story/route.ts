import { NextResponse } from "next/server";
import {
  AccountSettingsError,
  queueAccountSettingsBatch,
  resolveAccountSettingsTargets,
  validateMediaToken,
} from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const PERIODS = new Set([21600, 43200, 86400, 172800]);
const PRIVACY = new Set(["everyone", "contacts", "close_friends"]);

export async function GET(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const limit = Math.max(1, Math.min(100, Number(new URL(request.url).searchParams.get("limit")) || 20));
  const batches = await prisma.telegramAccountSettingsBatch.findMany({
    where: { accountId: account.id, kind: "story" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new AccountSettingsError("Invalid story request", 400, "INVALID_REQUEST");
    const mediaPath = await validateMediaToken(account.id, body.mediaPath, "story");
    if (body.mediaType !== "photo" && body.mediaType !== "video") {
      throw new AccountSettingsError("Choose valid story media", 400, "INVALID_MEDIA_TYPE");
    }
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
    if (linkUrl) {
      let link: URL;
      try { link = new URL(linkUrl); } catch { throw new AccountSettingsError("Enter a valid story link", 400, "INVALID_LINK"); }
      if (link.protocol !== "http:" && link.protocol !== "https:") {
        throw new AccountSettingsError("Story link must use http or https", 400, "INVALID_LINK");
      }
    }
    if (caption.length + linkUrl.length + (caption && linkUrl ? 1 : 0) > 2048) {
      throw new AccountSettingsError("Story caption and link must total 2,048 characters or fewer", 400, "CAPTION_TOO_LONG");
    }
    const privacy = typeof body.privacy === "string" && PRIVACY.has(body.privacy) ? body.privacy : "everyone";
    const periodSeconds = PERIODS.has(Number(body.periodSeconds)) ? Number(body.periodSeconds) : 86400;
    const sessions = await resolveAccountSettingsTargets(account.id, body);
    const payload = {
      mediaPath,
      mediaName: typeof body.mediaName === "string" ? body.mediaName.slice(0, 255) : null,
      mediaType: body.mediaType,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      caption,
      linkUrl,
      privacy,
      periodSeconds,
      pinToProfile: body.pinToProfile === true,
    };
    const batch = await queueAccountSettingsBatch(
      account.id,
      "story",
      sessions.map((session, position) => ({
        sessionId: session.id,
        action: "send_story" as const,
        position,
        payload,
      })),
      { mediaName: payload.mediaName, mediaType: payload.mediaType, caption, privacy, periodSeconds },
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
