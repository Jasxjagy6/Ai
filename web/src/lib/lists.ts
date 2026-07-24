import type { ListItem } from "@prisma/client";

export const LIST_TYPES = new Set(["users", "groups", "channels", "profile", "merged"]);
export const MAX_IMPORT_ITEMS = Math.max(1, Number(process.env.LIST_MAX_IMPORT_ITEMS || 500000));

export class ListError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "LIST_ERROR",
  ) {
    super(message);
  }
}

export type CanonicalItem = {
  telegramId: bigint | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  accessHash: bigint | null;
  bio: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Telegram public usernames are 5-32 characters, start with a letter, and
// contain only letters, digits, or underscores. This is the hard boundary for
// anything that may consume a public t.me validation request.
const HANDLE_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const MAX_TELEGRAM_ID = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_INT64 = BigInt("-9223372036854775808");
const MAX_INT64 = BigInt("9223372036854775807");

const HEADER_MAP: Record<string, keyof RawItem> = {
  user_id: "telegramId", userid: "telegramId", id: "telegramId",
  telegram_id: "telegramId", telegramid: "telegramId", tg_id: "telegramId",
  tgid: "telegramId", uid: "telegramId", identifier: "telegramId",
  tg_user_id: "telegramId", tguserid: "telegramId",
  telegram_user_id: "telegramId", telegramuserid: "telegramId",
  username: "username", user_name: "username", uname: "username",
  handle: "username", "@username": "username", "@": "username",
  first_name: "firstName", firstname: "firstName", fname: "firstName",
  name: "firstName", full_name: "firstName", fullname: "firstName",
  display_name: "firstName", displayname: "firstName",
  last_name: "lastName", lastname: "lastName", lname: "lastName", surname: "lastName",
  phone: "phone", phone_number: "phone", phonenumber: "phone",
  mobile: "phone", msisdn: "phone", tel: "phone",
  access_hash: "accessHash", accesshash: "accessHash", hash: "accessHash",
  bio: "bio", about: "bio", description: "bio",
};

type RawItem = {
  telegramId?: unknown;
  username?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  accessHash?: unknown;
  bio?: unknown;
};

function text(raw: unknown, max = 100) {
  if (raw == null) return null;
  const value = String(raw).trim();
  return value ? value.slice(0, max) : null;
}

export function coerceTelegramId(raw: unknown) {
  const value = text(raw, 40);
  if (!value || UUID_RE.test(value) || !/^\d+$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed > BigInt(0) && parsed <= MAX_TELEGRAM_ID ? parsed : null;
  } catch {
    return null;
  }
}

export function coerceAccessHash(raw: unknown) {
  let value = text(raw, 40);
  if (!value) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  if (!/^-?\d+$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed >= MIN_INT64 && parsed <= MAX_INT64 ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeUsername(raw: unknown) {
  if (raw == null) return null;
  let value = String(raw);
  if (!value || /\s/.test(value)) return null;
  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([^/?#]+)(?:[/?#].*)?$/i);
  if (url) value = url[1];
  value = value.replace(/^@+/, "");
  if (!value || UUID_RE.test(value) || !HANDLE_RE.test(value)) return null;
  return value.slice(0, 100);
}

export function canonicalize(
  raw: RawItem,
  options: { allowNameOnly?: boolean; promoteFirstName?: boolean } = {},
): CanonicalItem | null {
  let telegramId = coerceTelegramId(raw.telegramId);
  let username = normalizeUsername(raw.username);
  let firstName = text(raw.firstName);
  const lastName = text(raw.lastName);
  const phoneValue = text(raw.phone, 40)?.replace(/[^\d+]/g, "") || null;
  const phone = phoneValue && phoneValue.length >= 5 ? phoneValue.slice(0, 30) : null;

  if (!telegramId && raw.username != null && /^\d+$/.test(String(raw.username).trim())) {
    telegramId = coerceTelegramId(raw.username);
  }
  if (options.promoteFirstName && !username && firstName && !lastName && /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(firstName)) {
    username = normalizeUsername(firstName);
    if (username) firstName = null;
  }
  if (!telegramId && !username && !phone && !(options.allowNameOnly && firstName)) return null;

  return {
    telegramId,
    username,
    firstName,
    lastName,
    phone,
    accessHash: telegramId ? coerceAccessHash(raw.accessHash) : null,
    bio: text(raw.bio, 70),
  };
}

function splitCsvLine(line: string, separator: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  fields.push(value);
  return fields;
}

function headerKey(value: string) {
  return value.trim().toLowerCase().replace(/["'\s]/g, "");
}

function csvSeparator(line: string) {
  const candidates = [",", ";", "\t"].filter((separator) => line.includes(separator));
  if (!candidates.length) return ",";
  return candidates.sort((a, b) => {
    const score = (separator: string) => {
      const cells = splitCsvLine(line, separator);
      return cells.filter((cell) => HEADER_MAP[headerKey(cell)]).length * 100 + cells.length;
    };
    return score(b) - score(a);
  })[0];
}

function inferCells(cells: string[]): RawItem {
  const raw: RawItem = {};
  const names: string[] = [];
  for (const cellValue of cells) {
    const cell = cellValue.trim();
    if (!cell) continue;
    if (!raw.phone && /^\+\d{5,15}$/.test(cell)) raw.phone = cell;
    else if (!raw.telegramId && /^\d{4,}$/.test(cell)) raw.telegramId = cell;
    else if (!raw.username && /^@?[A-Za-z][A-Za-z0-9_]{2,63}$/.test(cell)) raw.username = cellValue;
    else names.push(cell);
  }
  raw.firstName = names[0];
  raw.lastName = names.slice(1).join(" ") || undefined;
  return raw;
}

function parseCsv(content: string, allowNameOnly: boolean) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const separator = csvSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(headerKey);
  const mapped = headers.map((header) => HEADER_MAP[header]);
  const hasHeader = mapped.some(Boolean);
  const output: CanonicalItem[] = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], separator);
    const raw: RawItem = hasHeader ? {} : inferCells(cells);
    if (hasHeader) {
      mapped.forEach((field, index) => {
        if (field && raw[field] == null && cells[index]?.trim()) raw[field] = cells[index];
      });
    }
    const item = canonicalize(raw, { allowNameOnly });
    if (item) output.push(item);
  }
  return output;
}

function parseJson(content: string, allowNameOnly: boolean) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ListError(`Invalid JSON file: ${error instanceof Error ? error.message : "parse error"}`, 400, "INVALID_JSON");
  }
  let values: unknown[];
  if (Array.isArray(parsed)) values = parsed;
  else if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    values = (["users", "contacts", "data", "items", "members", "entries"]
      .map((key) => object[key])
      .find(Array.isArray) as unknown[] | undefined) ?? [parsed];
  } else values = [];

  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const item = canonicalize({
      telegramId: row.telegram_id ?? row.telegramId ?? row.user_id ?? row.userId ?? row.id ?? row.identifier,
      username: row.username ?? row.user_name ?? row.userName ?? row.handle,
      firstName: row.first_name ?? row.firstName ?? row.name ?? row.full_name ?? row.fullName,
      lastName: row.last_name ?? row.lastName ?? row.surname,
      phone: row.phone ?? row.phone_number ?? row.phoneNumber ?? row.mobile,
      accessHash: row.access_hash ?? row.accessHash ?? row.hash,
      bio: row.bio ?? row.about ?? row.description,
    }, { allowNameOnly });
    return item ? [item] : [];
  });
}

function parseProfileText(content: string) {
  const blocks = content.replace(/\r\n?/g, "\n").split(/^\s*\d+\.\s*$|\n\s*\n+/m);
  return blocks.flatMap((block) => {
    const fields: Record<string, string> = {};
    for (const line of block.split("\n")) {
      const index = line.indexOf(":");
      if (index < 1) continue;
      const key = line.slice(0, index).trim().toLowerCase();
      const value = line.slice(index + 1).trim();
      if (value && fields[key] == null) fields[key] = value;
    }
    const fullName = fields.name || fields["full name"] || "";
    const [firstName, ...last] = fullName.split(/\s+/).filter(Boolean);
    const item = canonicalize({
      username: fields.username || fields.handle,
      firstName,
      lastName: last.join(" "),
      bio: fields.bio || fields.about || fields.description,
    }, { allowNameOnly: true });
    return item ? [item] : [];
  });
}

function parseText(content: string, allowNameOnly: boolean) {
  return content.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return [];
    // A plain whitespace-separated phrase is a person's name, not a username.
    // Delimited rows remain supported because their columns carry structure.
    const delimited = /[,;\t]/.test(line);
    if (!delimited && (/\s/.test(trimmed) || line !== trimmed)) return [];
    const item = canonicalize(inferCells(delimited ? line.split(/[,;\t]/) : [line]), { allowNameOnly });
    return item ? [item] : [];
  });
}

export function parseListContent(content: string, filename: string, mimeType: string, type: string) {
  const source = content.replace(/^\uFEFF/, "");
  const trimmed = source.trim();
  if (!trimmed) throw new ListError("The uploaded file is empty", 400, "EMPTY_FILE");
  let items: CanonicalItem[];
  if (type === "profile" && !trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    items = parseProfileText(source);
  } else if (trimmed.startsWith("[") || trimmed.startsWith("{") || /json/i.test(mimeType) || /\.json$/i.test(filename)) {
    items = parseJson(trimmed, type === "profile");
  } else {
    const first = trimmed.split(/\r?\n/, 1)[0];
    const looksCsv = /\.(?:csv|tsv)$/i.test(filename) || /csv|tab-separated/i.test(mimeType) || [",", ";", "\t"].some((separator) => {
      if (!first.includes(separator)) return false;
      return splitCsvLine(first, separator).some((cell) => HEADER_MAP[headerKey(cell)]);
    });
    items = looksCsv ? parseCsv(source, type === "profile") : parseText(source, type === "profile");
  }
  if (!items.length) throw new ListError("No valid entries were found in the uploaded file", 400, "NO_VALID_ENTRIES");
  if (items.length > MAX_IMPORT_ITEMS) {
    throw new ListError(`Imports support at most ${MAX_IMPORT_ITEMS.toLocaleString()} valid rows`, 400, "IMPORT_TOO_LARGE");
  }
  return deduplicateItems(items);
}

export function itemKey(item: CanonicalItem) {
  if (item.telegramId) return `id:${item.telegramId}`;
  if (item.username) return `username:${item.username.toLowerCase()}`;
  if (item.phone) return `phone:${item.phone}`;
  return null;
}

export function deduplicateItems(items: CanonicalItem[]) {
  const seen = new Set<string>();
  const unique: CanonicalItem[] = [];
  let duplicates = 0;
  for (const item of items) {
    const key = itemKey(item);
    if (key && seen.has(key)) {
      duplicates++;
      continue;
    }
    if (key) seen.add(key);
    unique.push(item);
  }
  return { items: unique, duplicates, parsed: items.length };
}

export function dbItemData(item: CanonicalItem, listId: string) {
  return { listId, ...item };
}

export function serializeItem(item: ListItem) {
  return {
    id: item.id,
    telegramId: item.telegramId?.toString() ?? null,
    username: item.username,
    firstName: item.firstName,
    lastName: item.lastName,
    phone: item.phone,
    accessHash: item.accessHash?.toString() ?? null,
    bio: item.bio,
    addedAt: item.addedAt,
  };
}

export function csvEscape(value: unknown) {
  if (value == null) return "";
  const string = String(value);
  return /[,"\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

export function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "list";
}

export function canonicalFromStored(item: Pick<ListItem, "telegramId" | "username" | "firstName" | "lastName" | "phone" | "accessHash" | "bio">) {
  return canonicalize(item, { allowNameOnly: true });
}

export function rawItem(value: unknown): RawItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return {
    telegramId: item.telegramId ?? item.telegram_id ?? item.userId ?? item.user_id,
    username: item.username,
    firstName: item.firstName ?? item.first_name,
    lastName: item.lastName ?? item.last_name,
    phone: item.phone,
    accessHash: item.accessHash ?? item.access_hash,
    bio: item.bio,
  };
}

export function isHandle(value: string | null) {
  return !!value && HANDLE_RE.test(value);
}
