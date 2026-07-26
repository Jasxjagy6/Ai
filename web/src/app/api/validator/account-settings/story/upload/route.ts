import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { ACCOUNT_SETTINGS_MEDIA_ROOT } from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const MEDIA_TYPES: Record<string, { extension: string; mediaType: "photo" | "video" }> = {
  "image/jpeg": { extension: ".jpg", mediaType: "photo" },
  "image/png": { extension: ".png", mediaType: "photo" },
  "image/webp": { extension: ".webp", mediaType: "photo" },
  "video/mp4": { extension: ".mp4", mediaType: "video" },
  "video/webm": { extension: ".webm", mediaType: "video" },
  "video/quicktime": { extension: ".mov", mediaType: "video" },
};

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const form = await request.formData();
    const file = form.get("media");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo or video" }, { status: 400 });
    const media = MEDIA_TYPES[file.type];
    if (!media) return NextResponse.json({ error: "Story media must be JPG, PNG, WebP, MP4, WebM, or MOV" }, { status: 400 });
    if (!file.size || file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Story media must be 50MB or smaller" }, { status: 400 });
    }
    const directory = path.join(ACCOUNT_SETTINGS_MEDIA_ROOT, account.id);
    await mkdir(directory, { recursive: true });
    const fileName = `story-${Date.now()}-${randomUUID()}${media.extension}`;
    await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    return NextResponse.json({
      mediaPath: `${account.id}/${fileName}`,
      mediaName: file.name,
      mediaType: media.mediaType,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("Story upload failed", error);
    return NextResponse.json({ error: "Story upload failed" }, { status: 500 });
  }
}
