import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { ACCOUNT_SETTINGS_MEDIA_ROOT } from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm",
  "application/pdf", "application/zip", "application/octet-stream", "text/plain",
]);

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Attachment must be 25MB or smaller" }, { status: 413 });
    if (file.type && !ALLOWED.has(file.type)) return NextResponse.json({ error: "This attachment type is not supported" }, { status: 400 });
    const safeExtension = path.extname(file.name).replace(/[^.A-Za-z0-9]/g, "").slice(0, 12);
    const directory = path.join(ACCOUNT_SETTINGS_MEDIA_ROOT, account.id);
    await mkdir(directory, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID()}${safeExtension}`;
    await writeFile(path.join(directory, storedName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    return NextResponse.json({
      mediaPath: `${account.id}/${storedName}`,
      fileName: file.name.slice(0, 255),
      mimeType: file.type || "application/octet-stream",
    });
  } catch (error) {
    console.error("Telegram client upload failed", error);
    return NextResponse.json({ error: "Attachment upload failed" }, { status: 500 });
  }
}
