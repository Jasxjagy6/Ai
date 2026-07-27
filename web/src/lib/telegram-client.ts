import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptTelegramData } from "@/lib/telegram-crypto";

export class TelegramClientError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "TELEGRAM_CLIENT_ERROR",
  ) {
    super(message);
  }
}

const chatId = z.union([z.string().trim().min(1).max(40), z.number().int()]);
const messageId = z.number().int().positive();
const empty = z.object({}).default({});

export const telegramClientCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bootstrap"), payload: empty.optional() }),
  z.object({
    kind: z.literal("dialogs"),
    payload: z.object({ limit: z.number().int().min(1).max(500).default(200) }),
  }),
  z.object({
    kind: z.literal("messages"),
    payload: z.object({
      chatId,
      limit: z.number().int().min(1).max(100).default(50),
      offsetId: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({
    kind: z.literal("send_message"),
    payload: z.object({
      chatId,
      text: z.string().trim().min(1).max(4096),
      replyToMessageId: messageId.optional(),
    }),
  }),
  z.object({
    kind: z.literal("edit_message"),
    payload: z.object({
      chatId,
      messageId,
      text: z.string().trim().min(1).max(4096),
    }),
  }),
  z.object({
    kind: z.literal("delete_messages"),
    payload: z.object({
      chatId,
      messageIds: z.array(messageId).min(1).max(100),
      revoke: z.boolean().default(true),
    }),
  }),
  z.object({
    kind: z.literal("forward_messages"),
    payload: z.object({
      chatId,
      fromChatId: chatId,
      messageIds: z.array(messageId).min(1).max(100),
    }),
  }),
  z.object({
    kind: z.literal("read_history"),
    payload: z.object({
      chatId,
      maxId: z.number().int().nonnegative().default(0),
    }),
  }),
  z.object({
    kind: z.literal("search_messages"),
    payload: z.object({
      chatId,
      query: z.string().trim().min(1).max(200),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  }),
  z.object({
    kind: z.literal("pinned_messages"),
    payload: z.object({
      chatId,
      limit: z.number().int().min(1).max(100).default(50),
    }),
  }),
  z.object({
    kind: z.literal("pin_message"),
    payload: z.object({
      chatId,
      messageId,
      disableNotification: z.boolean().default(false),
    }),
  }),
  z.object({
    kind: z.literal("unpin_message"),
    payload: z.object({ chatId, messageId }),
  }),
  z.object({
    kind: z.literal("unpin_all_messages"),
    payload: z.object({ chatId }),
  }),
  z.object({
    kind: z.literal("react_message"),
    payload: z.object({ chatId, messageId, emoji: z.string().trim().max(16) }),
  }),
  z.object({ kind: z.literal("chat"), payload: z.object({ chatId }) }),
  z.object({ kind: z.literal("contacts"), payload: empty.optional() }),
  z.object({
    kind: z.literal("add_contact"),
    payload: z.object({
      userId: chatId,
      firstName: z.string().trim().min(1).max(64),
      lastName: z.string().trim().max(64).default(""),
      phone: z.string().trim().max(30).default(""),
    }),
  }),
  z.object({
    kind: z.literal("delete_contacts"),
    payload: z.object({ userIds: z.array(chatId).min(1).max(100) }),
  }),
  z.object({
    kind: z.enum(["block_user", "unblock_user"]),
    payload: z.object({ userId: chatId }),
  }),
  z.object({
    kind: z.literal("peer_notify"),
    payload: z.object({
      chatId,
      muted: z.boolean().optional(),
      muteUntilSeconds: z.number().int().min(0).max(31_536_000).default(0),
    }),
  }),
  z.object({
    kind: z.literal("common_chats"),
    payload: z.object({
      userId: chatId,
      limit: z.number().int().min(1).max(100).default(100),
    }),
  }),
  z.object({
    kind: z.literal("chat_members"),
    payload: z.object({
      chatId,
      query: z.string().trim().max(64).default(""),
      limit: z.number().int().min(1).max(200).default(100),
      filter: z
        .enum([
          "search",
          "recent",
          "administrators",
          "bots",
          "restricted",
          "banned",
        ])
        .default("search"),
    }),
  }),
  z.object({
    kind: z.literal("add_chat_member"),
    payload: z.object({ chatId, userId: chatId }),
  }),
  z.object({
    kind: z.literal("remove_chat_member"),
    payload: z.object({
      chatId,
      userId: chatId,
      ban: z.boolean().default(false),
    }),
  }),
  z.object({
    kind: z.literal("set_chat_admin"),
    payload: z.object({ chatId, userId: chatId, admin: z.boolean() }),
  }),
  z.object({
    kind: z.literal("update_chat"),
    payload: z
      .object({
        chatId,
        title: z.string().trim().min(1).max(128).optional(),
        bio: z.string().trim().max(255).optional(),
      })
      .refine(
        (value) => value.title !== undefined || value.bio !== undefined,
        "Choose a chat field to update",
      ),
  }),
  z.object({
    kind: z.literal("set_chat_photo"),
    payload: z.object({ chatId, mediaPath: z.string().min(1).max(500) }),
  }),
  z.object({ kind: z.literal("settings"), payload: empty.optional() }),
  z.object({
    kind: z.literal("update_notify"),
    payload: z.object({
      scope: z.enum(["users", "chats", "broadcasts"]),
      muted: z.boolean().optional(),
      showPreviews: z.boolean().optional(),
      silent: z.boolean().optional(),
    }),
  }),
  z.object({
    kind: z.literal("update_privacy"),
    payload: z.object({
      key: z.enum([
        "statusTimestamp",
        "profilePhoto",
        "phoneNumber",
        "phoneCall",
        "forwards",
        "chatInvite",
        "voiceMessages",
      ]),
      value: z.enum(["everybody", "contacts", "nobody"]),
    }),
  }),
  z.object({
    kind: z.literal("password"),
    payload: z.discriminatedUnion("action", [
      z.object({
        action: z.literal("enable"),
        newPassword: z.string().min(6).max(256),
        hint: z.string().max(100).default(""),
        email: z.string().email().max(254).optional().or(z.literal("")),
      }),
      z.object({
        action: z.literal("change"),
        currentPassword: z.string().min(1).max(256),
        newPassword: z.string().min(6).max(256),
        hint: z.string().max(100).default(""),
      }),
      z.object({
        action: z.literal("disable"),
        currentPassword: z.string().min(1).max(256),
      }),
    ]),
  }),
  z.object({
    kind: z.literal("reset_authorization"),
    payload: z.object({ hash: z.string().regex(/^-?\d+$/) }),
  }),
  z.object({
    kind: z.literal("reset_other_authorizations"),
    payload: empty.optional(),
  }),
  z.object({
    kind: z.literal("authorization_ttl"),
    payload: z.object({ days: z.number().int().min(1).max(365) }),
  }),
  z.object({
    kind: z.literal("update_profile"),
    payload: z.object({
      firstName: z.string().trim().min(1).max(64),
      lastName: z.string().trim().max(64).default(""),
      bio: z.string().trim().max(70).default(""),
    }),
  }),
  z.object({
    kind: z.literal("set_username"),
    payload: z.object({ username: z.string().trim().max(32) }),
  }),
  z.object({
    kind: z.literal("set_profile_photo"),
    payload: z.object({ mediaPath: z.string().min(1).max(500) }),
  }),
  z.object({
    kind: z.literal("send_media"),
    payload: z.object({
      chatId,
      mediaPath: z.string().min(1).max(500),
      mediaType: z.enum(["photo", "video", "audio", "voice", "document"]),
      caption: z.string().max(2048).default(""),
      fileName: z.string().max(255).default("attachment"),
      replyToMessageId: messageId.optional(),
    }),
  }),
  z.object({
    kind: z.literal("download_media"),
    payload: z.object({ chatId, messageId }),
  }),
  z.object({
    kind: z.enum(["archive_chat", "unarchive_chat", "leave_chat"]),
    payload: z.object({ chatId }),
  }),
  z.object({
    kind: z.literal("clear_chat"),
    payload: z.object({ chatId, revoke: z.boolean().default(false) }),
  }),
]);

export async function queueTelegramClientCommand(
  accountId: string,
  sessionId: string,
  input: z.infer<typeof telegramClientCommandSchema>,
) {
  const session = await prisma.telegramSession.findFirst({
    where: { id: sessionId, accountId },
    select: { id: true, status: true, isLoggedIn: true },
  });
  if (!session)
    throw new TelegramClientError(
      "Telegram session not found",
      404,
      "SESSION_NOT_FOUND",
    );
  if (session.status !== "active" || !session.isLoggedIn) {
    throw new TelegramClientError(
      "This Telegram session is not active and logged in",
      409,
      "SESSION_NOT_CONNECTED",
    );
  }
  await prisma.telegramClientCommand
    .deleteMany({
      where: { accountId, expiresAt: { lt: new Date() } },
    })
    .catch(() => undefined);
  const queuedCount = await prisma.telegramClientCommand.count({
    where: { accountId, status: { in: ["pending", "processing"] } },
  });
  if (queuedCount >= 50) {
    throw new TelegramClientError(
      "Too many Telegram client operations are queued. Wait for the current operations to finish.",
      429,
      "CLIENT_QUEUE_FULL",
    );
  }
  const sourcePayload = (input.payload || {}) as Record<string, unknown>;
  const payload = { ...sourcePayload };
  if (input.kind === "password") {
    if (typeof sourcePayload.currentPassword === "string") {
      payload.currentPasswordEncrypted = encryptTelegramData(
        sourcePayload.currentPassword,
      );
      delete payload.currentPassword;
    }
    if (typeof sourcePayload.newPassword === "string") {
      payload.newPasswordEncrypted = encryptTelegramData(
        sourcePayload.newPassword,
      );
      delete payload.newPassword;
    }
  }
  return prisma.telegramClientCommand.create({
    data: {
      accountId,
      sessionId,
      kind: input.kind,
      payload: payload as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    omit: { payload: true, resultData: true },
  });
}

export function telegramClientError(error: unknown) {
  if (error instanceof TelegramClientError) return error;
  return new TelegramClientError(
    error instanceof Error ? error.message : "Telegram client request failed",
    500,
    "TELEGRAM_CLIENT_ERROR",
  );
}
