import path from "path";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";

/** Root under which all user/persona-generated files live. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

/**
 * Persist bytes under uploads/<subdir>/<random>.<ext> and return the relative
 * path (what we store in the DB). Guards against traversal in `subdir`.
 */
export async function saveUpload(
  subdir: string,
  bytes: Uint8Array | Buffer,
  ext: string
): Promise<string> {
  const safeSub = subdir.replace(/[^a-zA-Z0-9_-]/g, "");
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext.replace(/[^a-z0-9]/gi, "")}`;
  const dir = path.join(UPLOAD_DIR, safeSub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `${safeSub}/${name}`;
}

/** Resolve a stored relative path to an absolute path, or null if it escapes. */
export function resolveUpload(relPath: string): string | null {
  const abs = path.join(UPLOAD_DIR, relPath);
  if (!abs.startsWith(UPLOAD_DIR)) return null;
  return abs;
}

export const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};
