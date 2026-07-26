import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  AccountSettingsError,
  queueAccountSettingsBatch,
  resolveAccountSettingsTargets,
  validateMediaToken,
} from "@/lib/account-settings";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized, validatorError } from "@/lib/validator-api";

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new AccountSettingsError("Invalid request", 400, "INVALID_REQUEST");
    const flags = body.updateFlags && typeof body.updateFlags === "object"
      ? body.updateFlags as Record<string, unknown>
      : {};
    const modes = body.fieldModes && typeof body.fieldModes === "object"
      ? body.fieldModes as Record<string, unknown>
      : {};
    const updateFlags = {
      firstName: flags.firstName === true,
      lastName: flags.lastName === true,
      username: flags.username === true,
      bio: flags.bio === true,
      profilePhoto: flags.profilePhoto === true,
    };
    if (!Object.values(updateFlags).some(Boolean)) {
      throw new AccountSettingsError("Select at least one field to update", 400, "NO_UPDATES_SELECTED");
    }
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "") : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    const fieldModes = {
      firstName: "set",
      lastName: modes.lastName === "remove" ? "remove" : "set",
      username: modes.username === "remove" ? "remove" : "set",
      bio: modes.bio === "remove" ? "remove" : "set",
      profilePhoto: modes.profilePhoto === "remove" ? "remove" : "set",
    };
    if (updateFlags.firstName && !firstName) {
      throw new AccountSettingsError("First name cannot be empty", 400, "FIRST_NAME_REQUIRED");
    }
    if (firstName.length > 64 || lastName.length > 64) {
      throw new AccountSettingsError("Names must be 64 characters or fewer", 400, "NAME_TOO_LONG");
    }
    if (updateFlags.username && fieldModes.username === "set" && !USERNAME_RE.test(username)) {
      throw new AccountSettingsError("Username must be 5-32 characters, start with a letter, and use only letters, digits, or underscores", 400, "INVALID_USERNAME");
    }
    if (bio.length > 70) throw new AccountSettingsError("Bio must be 70 characters or fewer", 400, "BIO_TOO_LONG");

    const profilePhotoPath = updateFlags.profilePhoto && fieldModes.profilePhoto === "set"
      ? await validateMediaToken(account.id, body.profilePhotoPath)
      : undefined;
    const sessions = await resolveAccountSettingsTargets(account.id, body);
    const payload = {
      firstName,
      lastName,
      username,
      bio,
      profilePhotoPath,
      updateFlags,
      fieldModes,
    } as Prisma.InputJsonValue;
    const batch = await queueAccountSettingsBatch(
      account.id,
      "profile_update",
      sessions.map((session, position) => ({
        sessionId: session.id,
        action: "update_profile" as const,
        position,
        payload,
      })),
      { source: "manual" },
    );
    return NextResponse.json({ batch, batchId: batch.id }, { status: 202 });
  } catch (error) {
    return validatorError(error);
  }
}
