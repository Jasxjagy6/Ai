import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { ACCOUNT_SETTINGS_MEDIA_ROOT } from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo" }, { status: 400 });
    const extension = IMAGE_TYPES[file.type];
    if (!extension) return NextResponse.json({ error: "Photo must be JPG, PNG, or WebP" }, { status: 400 });
    if (!file.size || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo must be 5MB or smaller" }, { status: 400 });
    }
    const directory = path.join(ACCOUNT_SETTINGS_MEDIA_ROOT, account.id);
    await mkdir(directory, { recursive: true });
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    return NextResponse.json({ filePath: `${account.id}/${fileName}`, fileName: file.name });
  } catch (error) {
    console.error("Account-settings photo upload failed", error);
    return NextResponse.json({ error: "Photo upload failed" }, { status: 500 });
  }
}
