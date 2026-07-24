import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canonicalFromStored,
  canonicalize,
  csvEscape,
  dbItemData,
  deduplicateItems,
  itemKey,
  ListError,
  rawItem,
  safeFilename,
  serializeItem,
  type CanonicalItem,
} from "@/lib/lists";

const BATCH_SIZE = 2000;

async function ownedList(accountId: string, listId: string) {
  const list = await prisma.contactList.findFirst({ where: { id: listId, accountId } });
  if (!list) throw new ListError("List not found", 404, "LIST_NOT_FOUND");
  return list;
}

async function createManyItems(listId: string, items: CanonicalItem[]) {
  let inserted = 0;
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const result = await prisma.listItem.createMany({
      data: items.slice(offset, offset + BATCH_SIZE).map((item) => dbItemData(item, listId)),
    });
    inserted += result.count;
  }
  return inserted;
}

export async function importList(
  accountId: string,
  name: string,
  type: string,
  source: string,
  parsed: { items: CanonicalItem[]; duplicates: number; parsed: number },
) {
  const list = await prisma.contactList.create({
    data: { accountId, name, type, source, itemsCount: 0 },
  });
  try {
    const totalImported = await createManyItems(list.id, parsed.items);
    await prisma.contactList.update({ where: { id: list.id }, data: { itemsCount: totalImported } });
    return {
      listId: list.id,
      listName: list.name,
      totalImported,
      totalDuplicate: parsed.duplicates,
      totalParsed: parsed.parsed,
    };
  } catch (error) {
    await prisma.contactList.delete({ where: { id: list.id } }).catch(() => undefined);
    throw error;
  }
}

export async function listLists(accountId: string, input: URLSearchParams) {
  const page = Math.max(1, Number(input.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(input.get("limit")) || 20));
  const search = input.get("search")?.trim() || "";
  const sortMap = {
    createdAt: "createdAt",
    created_at: "createdAt",
    name: "name",
    itemsCount: "itemsCount",
    items_count: "itemsCount",
    type: "type",
  } as const;
  const requestedSort = input.get("sort") || "createdAt";
  const sort = sortMap[requestedSort as keyof typeof sortMap] || "createdAt";
  const order = input.get("order")?.toLowerCase() === "asc" ? "asc" : "desc";
  const where: Prisma.ContactListWhereInput = {
    accountId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };
  const [lists, total] = await Promise.all([
    prisma.contactList.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contactList.count({ where }),
  ]);
  return {
    lists,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

export async function getList(accountId: string, listId: string) {
  return ownedList(accountId, listId);
}

export async function getItems(accountId: string, listId: string, input: URLSearchParams) {
  await ownedList(accountId, listId);
  const page = Math.max(1, Number(input.get("page")) || 1);
  const limit = Math.max(1, Math.min(200, Number(input.get("limit")) || 20));
  const search = input.get("search")?.trim() || "";
  const where: Prisma.ListItemWhereInput = {
    listId,
    ...(search ? {
      OR: [
        { username: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.listItem.findMany({
      where,
      orderBy: [{ addedAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listItem.count({ where }),
  ]);
  return {
    items: items.map(serializeItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

export async function renameList(accountId: string, listId: string, name: string) {
  await ownedList(accountId, listId);
  return prisma.contactList.update({ where: { id: listId }, data: { name } });
}

export async function deleteList(accountId: string, listId: string) {
  const list = await ownedList(accountId, listId);
  const active = await prisma.linkFilterJob.findFirst({
    where: { accountId, resultListId: listId, status: { in: ["pending", "running"] } },
    select: { id: true },
  });
  if (active) {
    throw new ListError(
      `This list is receiving results from active link job ${active.id}. Cancel it before deleting the list.`,
      409,
      "LIST_USED_BY_ACTIVE_JOB",
    );
  }
  await prisma.contactList.delete({ where: { id: listId } });
  return { success: true, listId, deletedItems: list.itemsCount };
}

export async function addItems(accountId: string, listId: string, values: unknown[]) {
  const list = await ownedList(accountId, listId);
  const canonical: CanonicalItem[] = [];
  let invalid = 0;
  for (const value of values) {
    const raw = rawItem(value);
    const item = raw ? canonicalize(raw, { allowNameOnly: list.type === "profile" }) : null;
    if (item) canonical.push(item);
    else invalid++;
  }
  if (!canonical.length) throw new ListError("No valid items were supplied", 400, "NO_VALID_ITEMS");

  const existing = await prisma.listItem.findMany({ where: { listId } });
  const seen = new Set(existing.map(canonicalFromStored).filter(Boolean).map((item) => itemKey(item!)).filter(Boolean));
  const unique: CanonicalItem[] = [];
  let duplicates = 0;
  for (const item of canonical) {
    const key = itemKey(item);
    if (key && seen.has(key)) duplicates++;
    else {
      if (key) seen.add(key);
      unique.push(item);
    }
  }
  const totalAdded = await createManyItems(listId, unique);
  const itemsCount = await prisma.listItem.count({ where: { listId } });
  await prisma.contactList.update({ where: { id: listId }, data: { itemsCount } });
  return {
    success: true,
    listId,
    totalSubmitted: values.length,
    totalAdded,
    totalDuplicates: duplicates,
    totalInvalid: invalid,
  };
}

export async function removeItems(accountId: string, listId: string, itemIds: string[]) {
  await ownedList(accountId, listId);
  const result = await prisma.listItem.deleteMany({ where: { listId, id: { in: itemIds } } });
  const remainingCount = await prisma.listItem.count({ where: { listId } });
  await prisma.contactList.update({ where: { id: listId }, data: { itemsCount: remainingCount } });
  return { success: true, listId, removedCount: result.count, remainingCount };
}

export async function mergeLists(accountId: string, listIds: string[], name: string) {
  const uniqueIds = [...new Set(listIds)];
  if (uniqueIds.length < 2) throw new ListError("Select at least two lists", 400, "INSUFFICIENT_LISTS");
  const lists = await prisma.contactList.findMany({ where: { accountId, id: { in: uniqueIds } } });
  if (lists.length !== uniqueIds.length) throw new ListError("One or more lists were not found", 404, "LIST_NOT_FOUND");

  const all: CanonicalItem[] = [];
  for (const listId of uniqueIds) {
    const items = await prisma.listItem.findMany({ where: { listId }, orderBy: [{ addedAt: "asc" }, { id: "asc" }] });
    for (const item of items) {
      const canonical = canonicalFromStored(item);
      if (canonical) all.push(canonical);
    }
  }
  const deduped = deduplicateItems(all);
  const list = await prisma.contactList.create({
    data: { accountId, name, type: "merged", source: "merge", itemsCount: 0 },
  });
  try {
    const totalItems = await createManyItems(list.id, deduped.items);
    await prisma.contactList.update({ where: { id: list.id }, data: { itemsCount: totalItems } });
    return {
      listId: list.id,
      listName: list.name,
      totalItems,
      totalDuplicates: deduped.duplicates,
      sourceListCount: uniqueIds.length,
    };
  } catch (error) {
    await prisma.contactList.delete({ where: { id: list.id } }).catch(() => undefined);
    throw error;
  }
}

export async function deduplicateList(accountId: string, listId: string) {
  await ownedList(accountId, listId);
  const items = await prisma.listItem.findMany({ where: { listId }, orderBy: [{ addedAt: "asc" }, { id: "asc" }] });
  const seen = new Set<string>();
  const remove: string[] = [];
  for (const stored of items) {
    const item = canonicalFromStored(stored);
    const key = item && itemKey(item);
    if (key && seen.has(key)) remove.push(stored.id);
    else if (key) seen.add(key);
  }
  for (let offset = 0; offset < remove.length; offset += 5000) {
    await prisma.listItem.deleteMany({ where: { listId, id: { in: remove.slice(offset, offset + 5000) } } });
  }
  const totalAfter = items.length - remove.length;
  await prisma.contactList.update({ where: { id: listId }, data: { itemsCount: totalAfter } });
  return { listId, totalBefore: items.length, totalAfter, duplicatesRemoved: remove.length };
}

export async function normalizeList(accountId: string, listId: string) {
  const list = await ownedList(accountId, listId);
  const items = await prisma.listItem.findMany({ where: { listId } });
  let updated = 0;
  const remove: string[] = [];
  const changes: Array<{ id: string; item: CanonicalItem }> = [];
  for (const stored of items) {
    const item = canonicalize(stored, {
      allowNameOnly: list.type === "profile",
      promoteFirstName: list.type !== "profile",
    });
    if (!item) {
      remove.push(stored.id);
      continue;
    }
    const changed =
      stored.telegramId !== item.telegramId || stored.username !== item.username ||
      stored.firstName !== item.firstName || stored.lastName !== item.lastName ||
      stored.phone !== item.phone || stored.accessHash !== item.accessHash || stored.bio !== item.bio;
    if (changed) changes.push({ id: stored.id, item });
  }
  for (let offset = 0; offset < changes.length; offset += 200) {
    const batch = changes.slice(offset, offset + 200);
    await prisma.$transaction(batch.map(({ id, item }) => prisma.listItem.update({ where: { id }, data: item })));
    updated += batch.length;
  }
  for (let offset = 0; offset < remove.length; offset += 5000) {
    await prisma.listItem.deleteMany({ where: { listId, id: { in: remove.slice(offset, offset + 5000) } } });
  }
  const totalAfter = await prisma.listItem.count({ where: { listId } });
  await prisma.contactList.update({ where: { id: listId }, data: { itemsCount: totalAfter } });
  return {
    listId,
    listName: list.name,
    totalScanned: items.length,
    updated,
    removed: remove.length,
    totalAfter,
  };
}

export async function normalizeAll(accountId: string) {
  const lists = await prisma.contactList.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  const results: Array<Record<string, unknown>> = [];
  let succeeded = 0;
  let failed = 0;
  let totalScanned = 0;
  let updated = 0;
  let removed = 0;
  for (const list of lists) {
    try {
      const result = await normalizeList(accountId, list.id);
      succeeded++;
      totalScanned += result.totalScanned;
      updated += result.updated;
      removed += result.removed;
      results.push({ ...result, success: true });
    } catch (error) {
      failed++;
      results.push({ listId: list.id, listName: list.name, success: false, error: error instanceof Error ? error.message : "Normalize failed" });
    }
  }
  return { totalLists: lists.length, succeeded, failed, totalScanned, updated, removed, results };
}

export async function listStats(accountId: string, listId: string) {
  const list = await ownedList(accountId, listId);
  const [totalItems, uniqueIdRows, withUsername, withPhone, withFirstName] = await Promise.all([
    prisma.listItem.count({ where: { listId } }),
    prisma.listItem.findMany({ where: { listId, telegramId: { not: null } }, distinct: ["telegramId"], select: { telegramId: true } }),
    prisma.listItem.count({ where: { listId, username: { not: null } } }),
    prisma.listItem.count({ where: { listId, phone: { not: null } } }),
    prisma.listItem.count({ where: { listId, firstName: { not: null } } }),
  ]);
  return {
    listId,
    listName: list.name,
    listType: list.type,
    totalItems,
    uniqueUsers: uniqueIdRows.length,
    withUsername,
    withPhone,
    withFirstName,
    usernamePercentage: totalItems ? Math.round((withUsername / totalItems) * 10000) / 100 : 0,
    phonePercentage: totalItems ? Math.round((withPhone / totalItems) * 10000) / 100 : 0,
    source: list.source,
    createdAt: list.createdAt,
  };
}

export async function exportList(accountId: string, listId: string, format: string) {
  const list = await ownedList(accountId, listId);
  if (!["csv", "json", "txt"].includes(format)) throw new ListError("Format must be csv, json, or txt", 400, "INVALID_FORMAT");
  const items = await prisma.listItem.findMany({ where: { listId }, orderBy: [{ addedAt: "asc" }, { id: "asc" }] });
  let content: string;
  let mimeType: string;
  if (format === "csv") {
    const rows = [["user_id", "username", "first_name", "last_name", "phone", "access_hash", "bio"].join(",")];
    for (const item of items) {
      rows.push([
        item.telegramId, item.username, item.firstName, item.lastName, item.phone, item.accessHash, item.bio,
      ].map(csvEscape).join(","));
    }
    content = rows.join("\r\n");
    mimeType = "text/csv; charset=utf-8";
  } else if (format === "json") {
    content = JSON.stringify(items.map((item) => ({
      user_id: item.telegramId?.toString() ?? null,
      username: item.username,
      first_name: item.firstName,
      last_name: item.lastName,
      phone: item.phone,
      access_hash: item.accessHash?.toString() ?? null,
      bio: item.bio,
    })), null, 2);
    mimeType = "application/json; charset=utf-8";
  } else {
    content = items.map((item) => item.username ? `@${item.username}` : item.phone || item.telegramId?.toString() || "").filter(Boolean).join("\n");
    mimeType = "text/plain; charset=utf-8";
  }
  return { content, filename: `${safeFilename(list.name)}.${format}`, mimeType };
}
