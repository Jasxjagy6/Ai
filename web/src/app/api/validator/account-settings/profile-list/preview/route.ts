import { NextResponse } from "next/server";
import { AccountSettingsError, resolveAccountSettingsTargets } from "@/lib/account-settings";
import { accountSettingsAvatars, uniqueProfileUsername } from "@/lib/account-settings-data";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.listId !== "string" || !body.listId) {
      throw new AccountSettingsError("Choose a profile list", 400, "PROFILE_LIST_REQUIRED");
    }
    const list = await prisma.contactList.findFirst({
      where: { id: body.listId, accountId: account.id, type: "profile" },
      include: { items: { orderBy: [{ addedAt: "asc" }, { id: "asc" }] } },
    });
    if (!list) throw new AccountSettingsError("Profile list not found", 404, "PROFILE_LIST_NOT_FOUND");
    if (!list.items.length) throw new AccountSettingsError("Profile list is empty", 400, "EMPTY_PROFILE_LIST");
    const sessions = await resolveAccountSettingsTargets(account.id, body);
    const flagsValue = body.flags && typeof body.flags === "object" ? body.flags as Record<string, unknown> : {};
    const flags = {
      firstName: flagsValue.firstName !== false,
      lastName: flagsValue.lastName !== false,
      username: flagsValue.username !== false,
      bio: flagsValue.bio !== false,
      profilePhoto: flagsValue.profilePhoto !== false,
    };
    if (!Object.values(flags).some(Boolean)) {
      throw new AccountSettingsError("Select at least one field", 400, "NO_UPDATES_SELECTED");
    }
    const avatars = flags.profilePhoto ? await accountSettingsAvatars() : [];
    const usedUsernames = new Set<string>();
    const assignments = sessions.map((session, index) => {
      const sourceIndex = index % list.items.length;
      const source = list.items[sourceIndex];
      const avatar = avatars.length ? avatars[index % avatars.length] : null;
      const assignment: Record<string, unknown> = {
        sessionId: session.id,
        sessionLabel: session.label,
        sourceIndex,
        repeated: index >= list.items.length,
      };
      if (flags.firstName && source.firstName) assignment.firstName = source.firstName;
      if (flags.lastName) assignment.lastName = source.lastName || "";
      if (flags.username) {
        if (source.username) assignment.username = uniqueProfileUsername(source.username, usedUsernames);
        else {
          assignment.username = "";
          assignment.clearUsername = true;
        }
      }
      if (flags.bio) assignment.bio = source.bio || "";
      if (avatar) {
        assignment.avatarId = avatar.fileName;
        assignment.avatarUrl = avatar.url;
      }
      return assignment;
    });
    return NextResponse.json({
      list: { id: list.id, name: list.name, itemsCount: list.items.length },
      sessionCount: sessions.length,
      repeatsRequired: sessions.length > list.items.length,
      assignments,
    });
  } catch (error) {
    return validatorError(error);
  }
}
