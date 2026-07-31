import asyncio
import base64
import hashlib
import json
import logging
import mimetypes
import os
import re
import sqlite3
import struct
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

import asyncpg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from hydrogram import Client, enums, filters, raw, types, utils
from hydrogram.errors import (
    AuthKeyDuplicated, AuthKeyUnregistered, FloodWait, PeerFlood,
    SessionPasswordNeeded, SessionRevoked, UserDeactivated, UserDeactivatedBan,
)
from hydrogram.handlers import MessageHandler


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("telegram-worker")
POLL_SECONDS = max(0.25, float(os.getenv("TELEGRAM_WORKER_POLL_SECONDS", "1")))
SPAM_CHECK_MAX_AGE_DAYS = max(1, int(os.getenv("TELEGRAM_SPAM_CHECK_MAX_AGE_DAYS", "7")))
WARMUP_MIN_GAP_MINUTES = max(5, int(os.getenv("TELEGRAM_WARMUP_MIN_GAP_MINUTES", "30")))
WARMUP_DELAY_MIN_SECONDS = max(0.0, float(os.getenv("TELEGRAM_WARMUP_DELAY_MIN_SECONDS", "4")))
WARMUP_DELAY_MAX_SECONDS = max(WARMUP_DELAY_MIN_SECONDS, float(os.getenv("TELEGRAM_WARMUP_DELAY_MAX_SECONDS", "12")))
SESSION_DEAD_ERRORS = (AuthKeyDuplicated, AuthKeyUnregistered, SessionRevoked, UserDeactivated, UserDeactivatedBan)
AI_RECONCILE_SECONDS = max(2.0, float(os.getenv("AI_RECONCILE_SECONDS", "5")))
AI_JOB_CONCURRENCY = max(1, min(10, int(os.getenv("AI_JOB_CONCURRENCY", "3"))))
AI_CATCHUP_MAX_CHATS = max(1, min(200, int(os.getenv("AI_CATCHUP_MAX_CHATS", "60"))))
AI_CATCHUP_DIALOG_LIMIT = max(1, min(500, int(os.getenv("AI_CATCHUP_DIALOG_LIMIT", "200"))))
AI_CATCHUP_HOURS = max(1, min(168, int(os.getenv("AI_CATCHUP_HOURS", "24"))))
AI_CAPITALBOT_ENDPOINT = os.getenv("CAPITALBOT_ENDPOINT_URL", "https://api.capitalbot.ai/generateResponse")
AI_CUPIDBOT_ENDPOINT = os.getenv("CUPIDBOT_ENDPOINT_URL", "https://chat-api.cupidbotofm.ai/api/generateChatResponse")
AI_CLIENTS = {}
AI_CATCHUP_TASKS = set()
AI_BUSY_SESSIONS = set()
AI_TRANSIENT_CLIENTS = {}
INTERACTIVE_CLIENTS = {}
CLIENT_COMMAND_LOCKS = {}
CLIENT_COMMAND_CONCURRENCY = max(1, min(16, int(os.getenv("TELEGRAM_CLIENT_COMMAND_CONCURRENCY", "8"))))
ACCOUNT_SETTINGS_CONCURRENCY = max(1, min(16, int(os.getenv("ACCOUNT_SETTINGS_CONCURRENCY", "8"))))
DRAFT_SESSION_CONCURRENCY = max(1, min(16, int(os.getenv("TELEGRAM_DRAFT_CONCURRENCY", "8"))))
CAMPAIGN_CONCURRENCY = max(1, min(4, int(os.getenv("TELEGRAM_CAMPAIGN_CONCURRENCY", "1"))))
CLEAR_HISTORY_DIALOG_LIMIT = max(100, min(10000, int(os.getenv("CLEAR_HISTORY_DIALOG_LIMIT", "3000"))))
CLEAR_HISTORY_MAX_FLOOD_SECONDS = max(0, min(60, int(os.getenv("CLEAR_HISTORY_MAX_FLOOD_SECONDS", "15"))))
MIN_BIGINT = -(2 ** 63)
MAX_BIGINT = 2 ** 63 - 1


def data_key() -> bytes:
    source = os.getenv("TELEGRAM_DATA_KEY") or os.getenv("VALIDATOR_KEY_SECRET") or os.getenv("AUTH_SECRET")
    if not source or len(source) < 24:
        raise RuntimeError("TELEGRAM_DATA_KEY must be configured with at least 24 characters")
    return hashlib.sha256(f"signal-desk-telegram:{source}".encode()).digest()


KEY = data_key()


def b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def decrypt(value: str) -> bytes:
    version, iv, payload, tag = value.split(".")
    if version != "v1":
        raise ValueError("Unsupported encrypted data version")
    return AESGCM(KEY).decrypt(b64decode(iv), b64decode(payload) + b64decode(tag), None)


def encrypt(value: bytes | str) -> str:
    raw = value.encode() if isinstance(value, str) else value
    iv = os.urandom(12)
    encrypted = AESGCM(KEY).encrypt(iv, raw, None)
    payload, tag = encrypted[:-16], encrypted[-16:]
    encode = lambda part: base64.urlsafe_b64encode(part).decode().rstrip("=")
    return f"v1.{encode(iv)}.{encode(payload)}.{encode(tag)}"


def fingerprint(value: bytes | str) -> str:
    raw = value.encode() if isinstance(value, str) else value
    return hashlib.sha256(raw).hexdigest()


class SessionAuthorizationError(Exception):
    pass


SESSION_DEAD_ERRORS += (SessionAuthorizationError,)


class SubscriptionRequiredError(PermissionError):
    pass


def error_code(error: Exception) -> str:
    name = re.sub(r"(?<!^)(?=[A-Z])", "_", error.__class__.__name__)
    return name.upper()[:100]


def random_between(minimum: float, maximum: float) -> float:
    return minimum + (maximum - minimum) * (int.from_bytes(os.urandom(2), "big") / 65535)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def session_daily_limit(session, now=None):
    now = now or utc_now()
    started = as_utc(session.get("warmupStartedAt") or session.get("createdAt")) or now
    age_days = max(0, (now - started).total_seconds() / 86400)
    standard = session.get("warmupMode") == "standard"
    if age_days < 1:
        return 10 if standard else 5
    if age_days < 2:
        return 20 if standard else 10
    if age_days < 3:
        return 40 if standard else 20
    if age_days < 7:
        return 80 if standard else 40
    if not standard and age_days < 14:
        return 80
    return None


def session_safety_reason(session, now=None):
    now = now or utc_now()
    status = session.get("spamStatus") or "unknown"
    if status == "frozen":
        return "Telegram marked this account frozen"
    if status == "limited":
        limit_until = as_utc(session.get("spamLimitUntil"))
        return "Spam limit expired; recheck @SpamBot" if limit_until and limit_until <= now else "Account is limited by Telegram"
    if status != "clean":
        return "A clean @SpamBot check is required"
    checked_at = as_utc(session.get("spamCheckedAt"))
    if not checked_at or checked_at <= now - timedelta(days=SPAM_CHECK_MAX_AGE_DAYS):
        return "Spam status is stale"
    if float(session.get("riskScore") or 0) >= 70:
        return "Session risk score is too high"
    cooldown_until = as_utc(session.get("healthCooldownUntil"))
    if cooldown_until and cooldown_until > now:
        return "Session is cooling down"
    reset_at = as_utc(session.get("dailyMessagesResetAt"))
    daily_sent = int(session.get("dailyMessagesSent") or 0) if reset_at and reset_at.date() == now.date() else 0
    daily_limit = session_daily_limit(session, now)
    if daily_limit is not None and daily_sent >= daily_limit:
        return f"Daily warmup limit of {daily_limit} messages reached"
    return None


async def behavior_log(pool, record, action, *, campaign_id=None, target=None, succeeded=True,
                       severity="info", error=None, details=None):
    await pool.execute('''INSERT INTO "TelegramBehaviorLog"
      (id, "accountId", "sessionId", "campaignId", action, target, succeeded, severity,
       "errorCode", "errorMessage", details, "performedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW())''',
      f"tgb_{uuid.uuid4().hex}", record["accountId"], record.get("id"), campaign_id,
      action, str(target)[:220] if target is not None else None, succeeded, severity,
      error_code(error) if error else None, str(error)[:2000] if error else None,
      json.dumps(details) if details is not None else None)


async def record_session_signal(pool, session, campaign_id, error, wait=0):
    code = error_code(error)
    if isinstance(error, FloodWait):
        cooldown = max(1, int(wait or getattr(error, "value", 0) or 1))
        await pool.execute('''UPDATE "TelegramSession" SET "consecutiveFloodWaits" = "consecutiveFloodWaits" + 1,
          "lastFloodSeconds" = $2, "lastFloodAt" = NOW(), "healthCooldownUntil" = NOW() + ($2 * INTERVAL '1 second'),
          "riskScore" = LEAST(100, "riskScore" + CASE WHEN $2 >= 30 THEN 8 ELSE 3 END),
          "lastErrorCode" = $3, "lastErrorMessage" = $4, "updatedAt" = NOW() WHERE id = $1''',
          session["id"], cooldown, code, str(error)[:2000])
        await behavior_log(pool, session, "flood_wait", campaign_id=campaign_id, succeeded=False,
                           severity="warning", error=error, details={"waitSeconds": cooldown})
        return "cooldown"
    if isinstance(error, PeerFlood):
        await pool.execute('''UPDATE "TelegramSession" SET "spamStatus" = 'unknown', "spamCheckRequested" = TRUE,
          "spamCheckClaimedAt" = NULL, "healthCooldownUntil" = NOW() + INTERVAL '24 hours',
          "riskScore" = LEAST(100, "riskScore" + 35), "lastErrorCode" = $2,
          "lastErrorMessage" = $3, "updatedAt" = NOW() WHERE id = $1''', session["id"], code, str(error)[:2000])
        await behavior_log(pool, session, "peer_flood", campaign_id=campaign_id, succeeded=False,
                           severity="critical", error=error)
        return "retire"
    if isinstance(error, SESSION_DEAD_ERRORS):
        await pool.execute('''UPDATE "TelegramSession" SET status = 'error', "isLoggedIn" = FALSE,
          "riskScore" = 100, "lastErrorCode" = $2, "lastErrorMessage" = $3, "updatedAt" = NOW()
          WHERE id = $1''', session["id"], code, str(error)[:2000])
        await behavior_log(pool, session, "session_revoked", campaign_id=campaign_id, succeeded=False,
                           severity="critical", error=error)
        return "retire"
    return "target_error"


def identity_kwargs(value) -> dict:
    identity = value if isinstance(value, dict) else json.loads(value or "{}")
    allowed = ("device_model", "system_version", "app_version", "lang_code")
    return {key: str(identity[key]) for key in allowed if identity.get(key)}


def json_value(value) -> dict:
    return value if isinstance(value, dict) else json.loads(value or "{}")


def json_list(value) -> list:
    if isinstance(value, list):
        return value
    parsed = json.loads(value or "[]")
    return parsed if isinstance(parsed, list) else []


def proxy_value(encrypted: str | None) -> dict | None:
    if not encrypted:
        return None
    parsed = urlparse(decrypt(encrypted).decode())
    if parsed.scheme not in {"socks4", "socks5", "http"} or not parsed.hostname or not parsed.port:
        raise ValueError("Proxy must be an http, socks4, or socks5 URL")
    value = {"scheme": parsed.scheme, "hostname": parsed.hostname, "port": parsed.port}
    if parsed.username:
        value["username"] = unquote(parsed.username)
    if parsed.password:
        value["password"] = unquote(parsed.password)
    return value


def pack_hydrogram(dc_id: int, api_id: int, auth_key: bytes, user_id: int = 1, is_bot: bool = False, test_mode: bool = False) -> str:
    if len(auth_key) != 256:
        raise ValueError(f"Telegram auth key must be 256 bytes, got {len(auth_key)}")
    packed = struct.pack(">BI?256sQ?", dc_id, api_id, test_mode, auth_key, user_id, is_bot)
    return base64.urlsafe_b64encode(packed).decode().rstrip("=")


def sqlite_session(raw: bytes, api_id: int) -> str:
    connection = sqlite3.connect(":memory:")
    try:
        connection.deserialize(raw)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(sessions)")}
        row = connection.execute("SELECT * FROM sessions LIMIT 1").fetchone()
        if not row:
            raise ValueError("Session database is empty")
        values = dict(zip([item[0] for item in connection.execute("SELECT * FROM sessions LIMIT 0").description], row))
        auth_key = values.get("auth_key")
        if not auth_key:
            raise ValueError("Session database does not contain an auth key")
        return pack_hydrogram(
            int(values.get("dc_id") or 2),
            int(values.get("api_id") or api_id),
            bytes(auth_key),
            int(values.get("user_id") or 1),
            bool(values.get("is_bot") or False),
            bool(values.get("test_mode") or False),
        )
    finally:
        connection.close()


def external_string_session(value: str, api_id: int) -> str:
    if not value.startswith("1"):
        decoded = b64decode(value)
        if len(decoded) != struct.calcsize(">BI?256sQ?"):
            raise ValueError("Unsupported Hydrogram session string")
        dc_id, _, test_mode, auth_key, user_id, is_bot = struct.unpack(">BI?256sQ?", decoded)
        return pack_hydrogram(dc_id, api_id, auth_key, user_id, is_bot, test_mode)
    payload = b64decode(value[1:])
    if len(payload) == 263:
        dc_id, auth_key = payload[0], payload[7:263]
    elif len(payload) == 275:
        dc_id, auth_key = payload[0], payload[19:275]
    else:
        address_length = struct.unpack(">H", payload[1:3])[0] if len(payload) >= 3 else 0
        offset = 3 + address_length + 2
        if not 7 <= address_length <= 45 or len(payload) != offset + 256:
            raise ValueError("Unsupported Telethon or GramJS session string")
        dc_id, auth_key = payload[0], payload[offset:]
    return pack_hydrogram(dc_id, api_id, auth_key)


def canonical_session(raw: bytes, session_format: str, api_id: int) -> str:
    if session_format == "sqlite":
        return sqlite_session(raw, api_id)
    return external_string_session(raw.decode().strip(), api_id)


def client_for(record, session_string: str | None = None, updates: bool = False) -> Client:
    proxy_enabled = record.get("proxyEnabled", bool(record.get("proxyEncrypted")))
    anti_detect = record.get("antiDetectEnabled", True)
    return Client(
        f"signal-desk-{record['id']}",
        api_id=record["apiId"],
        api_hash=decrypt(record["apiHashEncrypted"]).decode(),
        session_string=session_string,
        in_memory=True,
        no_updates=not updates,
        workers=1,
        proxy=proxy_value(record.get("proxyEncrypted")) if proxy_enabled else None,
        **identity_kwargs(record.get("deviceIdentity")) if anti_detect else {},
    )


async def disconnect(client: Client | None) -> None:
    for entry in INTERACTIVE_CLIENTS.values():
        if entry["client"] is client:
            entry["lastUsed"] = utc_now()
            return
    for client_key, entry in list(AI_CLIENTS.items()):
        if entry["client"] is not client:
            continue
        entry["leases"] = max(0, int(entry.get("leases", 0)) - 1)
        if entry.get("stopRequested") and entry["leases"] == 0:
            AI_CLIENTS.pop(client_key, None)
            with suppress(Exception):
                await client.stop()
            with suppress(Exception):
                await entry["pool"].execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = 'stopped',
                  "lastHeartbeatAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', entry["record"]["membershipId"])
        return
    transient = next((entry for entry in AI_TRANSIENT_CLIENTS.values()
                      if entry["client"] is client), None) if client else None
    if transient:
        transient["leases"] = max(0, int(transient.get("leases", 0)) - 1)
        if transient["leases"]:
            return
        AI_TRANSIENT_CLIENTS.pop(transient["sessionId"], None)
    if client and client.is_connected:
        with suppress(Exception):
            await client.disconnect()


async def with_session_lock(session_id, operation):
    lock = CLIENT_COMMAND_LOCKS.setdefault(session_id, asyncio.Lock())
    async with lock:
        return await operation()


async def profile_details(client: Client, me) -> dict:
    bio = None
    avatar = None
    with suppress(Exception):
        chat = await client.get_chat(me.id)
        bio = getattr(chat, "bio", None)
    photo = getattr(me, "photo", None)
    file_id = getattr(photo, "big_file_id", None) or getattr(photo, "small_file_id", None)
    if file_id:
        with suppress(Exception):
            downloaded = await asyncio.wait_for(
                client.download_media(file_id, in_memory=True), timeout=15
            )
            avatar = downloaded.getvalue() if hasattr(downloaded, "getvalue") else None
            if avatar and len(avatar) > 2 * 1024 * 1024:
                avatar = None
    return {
        "bio": str(bio)[:255] if bio else None,
        "avatar": avatar,
        "avatarMime": "image/jpeg" if avatar else None,
        "isPremium": bool(getattr(me, "is_premium", False)),
        "isVerified": bool(getattr(me, "is_verified", False)),
        "isRestricted": bool(getattr(me, "is_restricted", False)),
    }


async def profile(client: Client):
    me = await client.get_me()
    await client.storage.user_id(me.id)
    await client.storage.is_bot(bool(me.is_bot))
    session_string = await client.export_session_string()
    return me, session_string, await profile_details(client, me)


async def pending_session(client: Client) -> str:
    return pack_hydrogram(
        await client.storage.dc_id(),
        await client.storage.api_id(),
        await client.storage.auth_key(),
        0,
        False,
        bool(await client.storage.test_mode()),
    )


async def claim_session(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''
            SELECT s.*, c."apiId", c."apiHashEncrypted",
              account.active AS "accountActive", account."planExpiresAt"
            FROM "TelegramSession" s
            JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
            JOIN "ValidatorAccount" account ON account.id = s."accountId"
            WHERE s.status = 'queued_validation' AND account.active = TRUE
              AND account."planExpiresAt" > NOW()
            ORDER BY s."createdAt" ASC
            FOR UPDATE OF s SKIP LOCKED LIMIT 1
        ''')
        if row:
            await connection.execute('UPDATE "TelegramSession" SET status = \'validating\', "updatedAt" = NOW() WHERE id = $1', row["id"])
        return dict(row) if row else None


async def validate_session(pool, record):
    client = None
    try:
        if (not record["accountActive"] or not record.get("planExpiresAt")
                or as_utc(record["planExpiresAt"]) <= utc_now()):
            raise SubscriptionRequiredError("Workspace subscription is not active")
        raw = decrypt(record["sessionDataEncrypted"])
        session_string = canonical_session(raw, record["sessionFormat"], record["apiId"])
        client = client_for(record, session_string)
        authorized = await asyncio.wait_for(client.connect(), timeout=45)
        if not authorized:
            raise SessionAuthorizationError("Telegram session is not authorized or has been revoked")
        me, session_string, details = await asyncio.wait_for(profile(client), timeout=30)
        await pool.execute('''
            UPDATE "TelegramSession" SET status = 'active', "isLoggedIn" = TRUE,
              phone = $2, username = $3, "firstName" = $4, "lastName" = $5, "telegramUserId" = $6,
              "sessionDataEncrypted" = $7, "sessionFingerprint" = $8, "sessionFormat" = 'hydrogram_string',
              "profileBio" = $9, "avatarData" = $10, "avatarMime" = $11,
              "isPremium" = $12, "isVerified" = $13, "isRestricted" = $14,
              "profileSyncedAt" = NOW(), "profileSyncRequested" = FALSE, "profileSyncClaimedAt" = NULL,
              "lastErrorCode" = NULL, "lastErrorMessage" = NULL, "lastLoginAt" = NOW(),
              "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1
        ''', record["id"], me.phone_number, me.username, me.first_name, me.last_name, me.id,
            encrypt(session_string), fingerprint(session_string), details["bio"], details["avatar"],
            details["avatarMime"], details["isPremium"], details["isVerified"], details["isRestricted"])
        log.info("Validated Telegram session %s", record["id"])
    except Exception as error:
        log.warning("Session %s validation failed: %s", record["id"], error)
        await pool.execute('''UPDATE "TelegramSession" SET status = 'error', "isLoggedIn" = FALSE,
            "lastErrorCode" = $2, "lastErrorMessage" = $3, "updatedAt" = NOW() WHERE id = $1''',
            record["id"], error_code(error), str(error)[:2000])
    finally:
        await disconnect(client)


async def claim_profile_sync(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted"
          FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
          JOIN "ValidatorAccount" account ON account.id = s."accountId"
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE AND s."profileSyncRequested" = TRUE
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
            AND (s."profileSyncClaimedAt" IS NULL OR s."profileSyncClaimedAt" < NOW() - INTERVAL '10 minutes')
          ORDER BY s."profileSyncedAt" ASC NULLS FIRST, s."createdAt" ASC
          FOR UPDATE OF s SKIP LOCKED LIMIT 1''')
        if row:
            await connection.execute('''UPDATE "TelegramSession" SET "profileSyncClaimedAt" = NOW(),
              "updatedAt" = NOW() WHERE id = $1''', row["id"])
        return dict(row) if row else None


async def sync_profile(pool, record):
    client = None
    try:
        client = await open_campaign_client(record)
        me = await asyncio.wait_for(client.get_me(), timeout=30)
        details = await profile_details(client, me)
        await pool.execute('''UPDATE "TelegramSession" SET phone = $2, username = $3,
          "firstName" = $4, "lastName" = $5, "telegramUserId" = $6, "profileBio" = $7,
          "avatarData" = $8, "avatarMime" = $9, "isPremium" = $10, "isVerified" = $11,
          "isRestricted" = $12, "profileSyncedAt" = NOW(), "profileSyncRequested" = FALSE,
          "profileSyncClaimedAt" = NULL, "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
          record["id"], me.phone_number, me.username, me.first_name, me.last_name, me.id,
          details["bio"], details["avatar"], details["avatarMime"], details["isPremium"],
          details["isVerified"], details["isRestricted"])
        log.info("Synced Telegram profile %s", record["id"])
    except Exception as error:
        await pool.execute('''UPDATE "TelegramSession" SET "profileSyncRequested" = FALSE,
          "profileSyncClaimedAt" = NULL, "lastErrorCode" = $2, "lastErrorMessage" = $3,
          "updatedAt" = NOW() WHERE id = $1''', record["id"], error_code(error), str(error)[:2000])
        log.warning("Profile sync %s failed: %s", record["id"], error)
    finally:
        await disconnect(client)


async def claim_flow(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''
            SELECT f.*, c."apiId", c."apiHashEncrypted", k.revoked,
              account.active AS "accountActive",
              account."planExpiresAt"
            FROM "TelegramLoginFlow" f
            JOIN "TelegramApiCredential" c ON c.id = f."credentialId"
            JOIN "ValidatorAccount" account ON account.id = f."accountId"
            LEFT JOIN "ValidatorAccessKey" k ON k.id = f."accessKeyId"
            WHERE f.status IN ('queued_send_code', 'queued_sign_in', 'queued_password')
              AND account.active = TRUE AND account."planExpiresAt" > NOW()
            ORDER BY f."createdAt" ASC FOR UPDATE OF f SKIP LOCKED LIMIT 1
        ''')
        if not row:
            return None
        status = {"queued_send_code": "sending_code", "queued_sign_in": "signing_in", "queued_password": "checking_password"}[row["status"]]
        await connection.execute('UPDATE "TelegramLoginFlow" SET status = $2, "updatedAt" = NOW() WHERE id = $1', row["id"], status)
        result = dict(row)
        result["claimed_status"] = status
        return result


async def finish_login(pool, record, client, me):
    session_string = await client.export_session_string()
    details = await profile_details(client, me)
    encrypted = encrypt(session_string)
    session_id = f"tgs_{uuid.uuid4().hex}"
    async with pool.acquire() as connection, connection.transaction():
        await connection.execute('''
            INSERT INTO "TelegramSession" (id, "accountId", "credentialId", label, phone, username,
              "firstName", "lastName", "telegramUserId", "sessionDataEncrypted", "sessionFingerprint",
              "profileBio", "avatarData", "avatarMime", "isPremium", "isVerified", "isRestricted",
              "sessionFormat", status, "isLoggedIn", "hasTwoFactor", "deviceIdentity", "proxyEncrypted",
              "proxyEnabled", "profileSyncedAt", "profileSyncRequested", "lastLoginAt", "lastActiveAt", "createdAt", "updatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
              'hydrogram_string','active',TRUE,$18,$19,$20,$21,NOW(),FALSE,NOW(),NOW(),NOW(),NOW())
        ''', session_id, record["accountId"], record["credentialId"], record["label"], me.phone_number,
            me.username, me.first_name, me.last_name, me.id, encrypted, fingerprint(session_string),
            details["bio"], details["avatar"], details["avatarMime"], details["isPremium"],
            details["isVerified"], details["isRestricted"], record["claimed_status"] == "checking_password",
            record["deviceIdentity"], record["proxyEncrypted"], bool(record["proxyEncrypted"]))
        await connection.execute('''UPDATE "TelegramLoginFlow" SET status = 'completed', "sessionId" = $2,
          "codeEncrypted" = NULL, "passwordEncrypted" = NULL, "phoneCodeHashEncrypted" = NULL,
          "sessionDataEncrypted" = NULL, "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW()
          WHERE id = $1''', record["id"], session_id)
    log.info("Completed Telegram login %s", record["id"])


async def process_flow(pool, record):
    client = None
    try:
        now = utc_now()
        if (not record["accessKeyId"] or record["revoked"] or not record["accountActive"]
                or not record.get("planExpiresAt") or as_utc(record["planExpiresAt"]) <= now):
            raise SubscriptionRequiredError("Messaging access is no longer active")
        if as_utc(record["expiresAt"]) <= now:
            raise TimeoutError("Telegram login attempt expired")

        if record["claimed_status"] == "sending_code":
            client = client_for(record)
            await asyncio.wait_for(client.connect(), timeout=45)
            sent = await asyncio.wait_for(client.send_code(record["phone"]), timeout=30)
            session_string = await pending_session(client)
            await pool.execute('''UPDATE "TelegramLoginFlow" SET status = 'awaiting_code',
              "phoneCodeHashEncrypted" = $2, "sessionDataEncrypted" = $3, "errorCode" = NULL,
              "errorMessage" = NULL, "updatedAt" = NOW() WHERE id = $1''', record["id"],
              encrypt(sent.phone_code_hash), encrypt(session_string))
            return

        session_string = decrypt(record["sessionDataEncrypted"]).decode()
        client = client_for(record, session_string)
        await asyncio.wait_for(client.connect(), timeout=45)
        if record["claimed_status"] == "signing_in":
            try:
                me = await asyncio.wait_for(client.sign_in(
                    record["phone"], decrypt(record["phoneCodeHashEncrypted"]).decode(), decrypt(record["codeEncrypted"]).decode()
                ), timeout=30)
            except SessionPasswordNeeded:
                session_string = await pending_session(client)
                await pool.execute('''UPDATE "TelegramLoginFlow" SET status = 'awaiting_password',
                  "sessionDataEncrypted" = $2, "codeEncrypted" = NULL, "errorCode" = NULL,
                  "errorMessage" = NULL, "updatedAt" = NOW() WHERE id = $1''', record["id"], encrypt(session_string))
                return
            if not me:
                raise ValueError("This phone number requires Telegram sign-up, which is not supported")
        else:
            me = await asyncio.wait_for(client.check_password(decrypt(record["passwordEncrypted"]).decode()), timeout=30)
        await client.storage.user_id(me.id)
        await client.storage.is_bot(bool(me.is_bot))
        await finish_login(pool, record, client, me)
    except Exception as error:
        log.warning("Login flow %s failed: %s", record["id"], error)
        await pool.execute('''UPDATE "TelegramLoginFlow" SET status = 'failed', "errorCode" = $2,
          "errorMessage" = $3, "codeEncrypted" = NULL, "passwordEncrypted" = NULL,
          "phoneCodeHashEncrypted" = NULL, "sessionDataEncrypted" = NULL, "updatedAt" = NOW() WHERE id = $1''',
          record["id"], error_code(error), str(error)[:2000])
    finally:
        await disconnect(client)


async def claim_campaign(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''
            SELECT c.*, k.revoked AS "keyRevoked",
              account.active AS "accountActive", account."planExpiresAt"
            FROM "TelegramCampaign" c
            JOIN "ValidatorAccount" account ON account.id = c."accountId"
            LEFT JOIN "ValidatorAccessKey" k ON k.id = c."accessKeyId"
            WHERE c.status IN ('pending','paused_subscription')
              AND account.active = TRUE AND account."planExpiresAt" > NOW()
            ORDER BY c."createdAt" ASC FOR UPDATE OF c SKIP LOCKED LIMIT 1
        ''')
        if row:
            await connection.execute('''UPDATE "TelegramCampaign" SET status = 'running',
              "startedAt" = COALESCE("startedAt", NOW()), "lastProgressAt" = NOW() WHERE id = $1''', row["id"])
            await connection.execute('''UPDATE "TelegramCampaignSession" SET status = 'pending',
              "lastErrorCode" = NULL, "lastErrorMessage" = NULL
              WHERE "campaignId" = $1 AND status = 'paused_subscription' ''', row["id"])
        return dict(row) if row else None


async def campaign_sessions(pool, campaign_id):
    rows = await pool.fetch('''
        SELECT s.*, c."apiId", c."apiHashEncrypted", cs.position
        FROM "TelegramCampaignSession" cs
        JOIN "TelegramSession" s ON s.id = cs."sessionId"
        JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
        WHERE cs."campaignId" = $1 AND s.status = 'active' AND s."isLoggedIn" = TRUE
        ORDER BY cs.position ASC
    ''', campaign_id)
    return [dict(row) for row in rows]


async def open_campaign_client(record):
    interactive = INTERACTIVE_CLIENTS.get(record["id"])
    if interactive and interactive["client"].is_connected:
        interactive["lastUsed"] = utc_now()
        return interactive["client"]
    for _ in range(100):
        shared = next((entry for entry in AI_CLIENTS.values()
                       if entry["record"]["id"] == record["id"] and entry["client"].is_connected), None)
        if shared:
            shared["leases"] = int(shared.get("leases", 0)) + 1
            return shared["client"]
        transient = AI_TRANSIENT_CLIENTS.get(record["id"])
        if transient and transient["client"].is_connected:
            transient["leases"] = int(transient.get("leases", 0)) + 1
            return transient["client"]
        if record["id"] not in AI_BUSY_SESSIONS:
            break
        await asyncio.sleep(0.5)
    if record["id"] in AI_BUSY_SESSIONS:
        raise TimeoutError("Telegram session is busy")
    AI_BUSY_SESSIONS.add(record["id"])
    try:
        session_string = canonical_session(decrypt(record["sessionDataEncrypted"]), record["sessionFormat"], record["apiId"])
        client = client_for(record, session_string)
        authorized = await asyncio.wait_for(client.connect(), timeout=45)
        if not authorized:
            await disconnect(client)
            raise SessionAuthorizationError("Telegram session is no longer authorized or has been revoked")
        AI_TRANSIENT_CLIENTS[record["id"]] = {
            "client": client, "sessionId": record["id"], "leases": 1,
        }
        return client
    except Exception:
        with suppress(Exception):
            await disconnect(client)
        raise
    finally:
        AI_BUSY_SESSIONS.discard(record["id"])


async def claim_spam_check(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted"
          FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
          JOIN "ValidatorAccount" account ON account.id = s."accountId"
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
            AND (s."spamCheckRequested" = TRUE OR s."spamCheckedAt" IS NULL
              OR s."spamCheckedAt" < NOW() - ($1 * INTERVAL '1 day'))
            AND (s."spamCheckClaimedAt" IS NULL OR s."spamCheckClaimedAt" < NOW() - INTERVAL '6 hours')
          ORDER BY s."spamCheckRequested" DESC, s."spamCheckedAt" ASC NULLS FIRST
          FOR UPDATE OF s SKIP LOCKED LIMIT 1''', SPAM_CHECK_MAX_AGE_DAYS)
        if row:
            await connection.execute('''UPDATE "TelegramSession" SET "spamCheckClaimedAt" = NOW(),
              "spamCheckRequested" = FALSE, "updatedAt" = NOW() WHERE id = $1''', row["id"])
        return dict(row) if row else None


def spam_status(text):
    value = str(text or "")
    if any(re.search(pattern, value, re.I) for pattern in (
        r"free as a bird", r"no limits are currently applied", r"don'?t have any limits",
        r"you'?re free", r"good news", r"no restrictions",
    )):
        return "clean"
    if any(re.search(pattern, value, re.I) for pattern in (
        r"account was blocked for violations", r"account (?:is|was|has been) frozen", r"account freeze(?:n|d)?",
    )):
        return "frozen"
    if any(re.search(pattern, value, re.I) for pattern in (
        r"account is now limited until", r"account is limited", r"while the account is limited",
        r"anti-spam systems", r"not be able to send messages to people",
    )):
        return "limited"
    return "unknown"


def spam_limit_until(text):
    match = re.search(r"(?:limited until|automatically released on)\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+UTC", str(text or ""), re.I)
    if not match:
        return None
    months = {name.lower(): index for index, name in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}
    try:
        return datetime(int(match.group(3)), months[match.group(2).lower()], int(match.group(1)),
                        int(match.group(4)), int(match.group(5)))
    except (KeyError, ValueError):
        return None


async def process_spam_check(pool, record):
    client = None
    try:
        client = await open_campaign_client(record)
        sent = await asyncio.wait_for(client.send_message("SpamBot", "/start"), timeout=45)
        reply = None
        for _ in range(5):
            await asyncio.sleep(2)
            async for message in client.get_chat_history("SpamBot", limit=5):
                if not message.outgoing and message.id > sent.id:
                    reply = message
                    break
            if reply:
                break
        if not reply:
            raise TimeoutError("@SpamBot did not reply")
        text = (reply.text or reply.caption or "").strip()
        status = spam_status(text)
        limit_until = spam_limit_until(text) if status == "limited" else None
        risk = {"clean": 0, "unknown": 25, "limited": 75, "frozen": 100}[status]
        await pool.execute('''UPDATE "TelegramSession" SET "spamStatus" = $2::varchar(30), "spamLimitUntil" = $3,
          "spamCheckedAt" = NOW(), "spamStatusMessage" = $4,
          "spamCheckRequested" = ($2::text = 'unknown'),
          "spamCheckClaimedAt" = CASE WHEN $2::text = 'unknown' THEN NOW() ELSE NULL END,
          "riskScore" = CASE WHEN $2::text = 'clean'
            THEN LEAST("riskScore", 20) ELSE GREATEST("riskScore", $5) END,
          "lastErrorCode" = NULL, "lastErrorMessage" = NULL, "updatedAt" = NOW() WHERE id = $1''',
          record["id"], status, limit_until, text[:4000], risk)
        await behavior_log(pool, record, "spam_check", target="@SpamBot", severity="warning" if status != "clean" else "info",
                           details={"status": status, "limitUntil": limit_until.isoformat() if limit_until else None})
        log.info("Spam check %s: %s", record["id"], status)
    except Exception as error:
        log.warning("Spam check %s failed: %s", record["id"], error)
        if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
            await record_session_signal(pool, record, None, error)
            if isinstance(error, PeerFlood):
                await pool.execute('''UPDATE "TelegramSession" SET "spamCheckRequested" = TRUE,
                  "spamCheckClaimedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', record["id"])
        else:
            await pool.execute('''UPDATE "TelegramSession" SET "spamStatus" = 'unknown',
              "lastErrorCode" = $2, "lastErrorMessage" = $3, "updatedAt" = NOW() WHERE id = $1''',
              record["id"], error_code(error), str(error)[:2000])
            await behavior_log(pool, record, "spam_check", target="@SpamBot", succeeded=False,
                               severity="warning", error=error)
    finally:
        await disconnect(client)


async def claim_warmup(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted"
          FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
          JOIN "ValidatorAccount" account ON account.id = s."accountId"
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE AND s."warmupEnabled" = TRUE
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
            AND s."warmupMode" <> 'off' AND s."spamStatus" <> 'frozen' AND s."riskScore" < 70
            AND (s."healthCooldownUntil" IS NULL OR s."healthCooldownUntil" <= NOW())
            AND (s."warmupRequested" = TRUE OR s."lastWarmupAt" IS NULL
              OR s."lastWarmupAt" < NOW() - ($1 * INTERVAL '1 minute'))
            AND (s."warmupClaimedAt" IS NULL OR s."warmupClaimedAt" < NOW() - INTERVAL '30 minutes')
          ORDER BY s."warmupRequested" DESC, s."lastWarmupAt" ASC NULLS FIRST
          FOR UPDATE OF s SKIP LOCKED LIMIT 1''', WARMUP_MIN_GAP_MINUTES)
        if row:
            await connection.execute('''UPDATE "TelegramSession" SET "warmupClaimedAt" = NOW(),
              "warmupRequested" = FALSE, "updatedAt" = NOW() WHERE id = $1''', row["id"])
        return dict(row) if row else None


async def process_warmup(pool, record):
    client = None
    action = "ping"
    target = None
    details = None
    try:
        client = await open_campaign_client(record)
        dialogs = None
        actions = ["ping", "fetch_dialogs", "read_random"]
        if record.get("warmupMode") == "standard" and record.get("spamStatus") == "clean" and utc_now() - as_utc(record["warmupStartedAt"]) >= timedelta(hours=48):
            actions.extend(["set_typing", "react_random"])
        action = actions[int.from_bytes(os.urandom(2), "big") % len(actions)]
        if action == "ping":
            me = await client.get_me()
            target, details = "self", {"telegramUserId": str(me.id)}
        else:
            dialogs = [dialog async for dialog in client.get_dialogs(limit=30)]
            if action == "fetch_dialogs":
                target, details = "dialogs", {"count": len(dialogs)}
            elif action == "read_random":
                candidates = [dialog for dialog in dialogs if dialog.unread_messages_count > 0 and dialog.top_message]
                if candidates:
                    dialog = candidates[int.from_bytes(os.urandom(2), "big") % len(candidates)]
                    target = str(dialog.chat.id)
                    await client.read_chat_history(dialog.chat.id, dialog.top_message.id)
                    details = {"messageId": str(dialog.top_message.id)}
                else:
                    target, details = "none", {"reason": "nothing_unread"}
            elif action == "set_typing":
                if not dialogs:
                    target, details = "none", {"reason": "no_dialogs"}
                else:
                    dialog = dialogs[int.from_bytes(os.urandom(2), "big") % len(dialogs)]
                    target = str(dialog.chat.id)
                    await client.send_chat_action(dialog.chat.id, enums.ChatAction.TYPING)
                    await asyncio.sleep(1)
                    await client.send_chat_action(dialog.chat.id, enums.ChatAction.CANCEL)
            elif action == "react_random":
                candidates = [dialog for dialog in dialogs if dialog.top_message and not dialog.top_message.outgoing]
                if candidates:
                    dialog = candidates[int.from_bytes(os.urandom(2), "big") % len(candidates)]
                    emoji = ("\U0001f44d", "\U0001f525", "\u2764\ufe0f", "\U0001f44f")[int.from_bytes(os.urandom(2), "big") % 4]
                    target = str(dialog.chat.id)
                    await client.send_reaction(dialog.chat.id, dialog.top_message.id, emoji)
                    details = {"messageId": str(dialog.top_message.id), "reaction": emoji}
                else:
                    target, details = "none", {"reason": "no_incoming_messages"}
        complete_days = 7 if record.get("warmupMode") == "standard" else 14
        await pool.execute('''UPDATE "TelegramSession" SET "lastWarmupAt" = NOW(),
          "warmupActions" = "warmupActions" + 1, "warmupRequested" = FALSE, "warmupClaimedAt" = NULL,
          "warmupCompletedAt" = CASE WHEN "warmupCompletedAt" IS NULL
            AND "warmupStartedAt" <= NOW() - ($2 * INTERVAL '1 day') THEN NOW() ELSE "warmupCompletedAt" END,
          "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', record["id"], complete_days)
        await behavior_log(pool, record, f"warmup_{action}", target=target, details=details)
        log.info("Warmup %s: %s", record["id"], action)
    except Exception as error:
        log.warning("Warmup %s failed: %s", record["id"], error)
        if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
            await record_session_signal(pool, record, None, error)
        await pool.execute('''UPDATE "TelegramSession" SET "lastWarmupAt" = NOW(), "warmupRequested" = FALSE,
          "warmupClaimedAt" = NULL, "lastErrorCode" = $2, "lastErrorMessage" = $3, "updatedAt" = NOW()
          WHERE id = $1''', record["id"], error_code(error), str(error)[:2000])
        await behavior_log(pool, record, f"warmup_{action}", target=target, succeeded=False,
                           severity="warning", error=error)
    finally:
        await disconnect(client)


async def target_for(client, recipient):
    target_input = str(recipient["targetInput"] or "")
    if re.match(r"^(?:https?://)?(?:www\.)?t(?:elegram)?\.(?:me|dog)/(?:joinchat/|\+)[A-Za-z0-9_-]+/?$", target_input, re.I):
        chat = await client.join_chat(target_input)
        return chat.id
    if recipient["username"]:
        return recipient["username"]
    if recipient["telegramId"] and recipient["accessHash"]:
        await client.storage.update_peers([(
            recipient["telegramId"], recipient["accessHash"], "user", None, recipient["phone"]
        )])
        return recipient["telegramId"]
    if recipient["telegramId"]:
        return recipient["telegramId"]
    if recipient["phone"]:
        return recipient["phone"]
    return recipient["targetInput"]


def parse_mode(value):
    return {"text": enums.ParseMode.DISABLED, "markdown": enums.ParseMode.MARKDOWN, "html": enums.ParseMode.HTML}.get(value, enums.ParseMode.DISABLED)


async def settle_campaign_quota(pool, campaign_id):
    async with pool.acquire() as connection, connection.transaction():
        campaign = await connection.fetchrow('''SELECT "accessKeyId", "reservedMessages", "sentCount",
          "quotaSettled"
          FROM "TelegramCampaign" WHERE id = $1 FOR UPDATE''', campaign_id)
        if not campaign:
            return
        refund = max(0, campaign["reservedMessages"] - campaign["sentCount"])
        if not campaign["quotaSettled"] and campaign["accessKeyId"] and refund:
            await connection.execute('''UPDATE "ValidatorAccessKey" SET "messagesUsed" = GREATEST(0, "messagesUsed" - $2)
              WHERE id = $1''', campaign["accessKeyId"], refund)
        await connection.execute('''UPDATE "TelegramCampaign" SET "quotaSettled" = TRUE,
          "creditsSettled" = TRUE WHERE id = $1''', campaign_id)


async def process_campaign(pool, campaign):
    clients = {}
    sessions = []
    retired_sessions = set()
    paused_for_subscription = False
    configuration = json_value(campaign["configuration"])
    min_delay = max(0.0, float(configuration.get("minDelaySeconds", 3)))
    max_delay = max(min_delay, float(configuration.get("maxDelaySeconds", 8)))
    max_flood = max(0, int(configuration.get("maxFloodWaitSeconds", 120)))
    pacing_mode = configuration.get("pacingMode", "auto")
    burst = max(1, min(500, int(configuration.get("perSessionBurst", 5))))
    cooldown_min = max(0.0, float(configuration.get("cooldownSecondsMin", 15)))
    cooldown_max = max(cooldown_min, float(configuration.get("cooldownSecondsMax", 30)))
    burst_counts = {}
    daily_remaining = {}
    try:
        if campaign.get("cancelRequested"):
            pending = await pool.fetchval('SELECT COUNT(*) FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1 AND status = \'pending\'', campaign["id"])
            await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'skipped',
              "errorCode" = 'CAMPAIGN_CANCELLED', "errorMessage" = 'Campaign cancelled before delivery started',
              "updatedAt" = NOW() WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"])
            await pool.execute('''UPDATE "TelegramCampaign" SET status = 'cancelled', "skippedCount" = "skippedCount" + $2,
              "processedCount" = "processedCount" + $2, "finishedAt" = NOW(), "replyTrackingStatus" = 'cancelled',
              "lastProgressAt" = NOW() WHERE id = $1''', campaign["id"], pending)
            return
        now = utc_now()
        if (not campaign.get("accessKeyId") or campaign.get("keyRevoked")
                or not campaign.get("accountActive") or not campaign.get("planExpiresAt")
                or as_utc(campaign["planExpiresAt"]) <= now):
            raise SubscriptionRequiredError("Messaging access is no longer active")
        sessions = await campaign_sessions(pool, campaign["id"])
        if not sessions:
            raise ValueError("No active Telegram sessions remain")
        safe_sessions = []
        for session in sessions:
            reason = session_safety_reason(session, now)
            if not reason:
                safe_sessions.append(session)
                continue
            await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'blocked',
              "lastErrorCode" = 'SESSION_SAFETY_BLOCK', "lastErrorMessage" = $3, "retiredAt" = NOW()
              WHERE "campaignId" = $1 AND "sessionId" = $2''', campaign["id"], session["id"], reason)
            await behavior_log(pool, session, "safety_block", campaign_id=campaign["id"], succeeded=False,
                               severity="warning", details={"reason": reason})
        sessions = safe_sessions
        if not sessions:
            raise PermissionError("No selected sessions pass spam, health, and warmup safety checks")
        for session in sessions:
            try:
                clients[session["id"]] = await with_session_lock(
                    session["id"], lambda: open_campaign_client(session)
                )
            except Exception as error:
                signal = await record_session_signal(pool, session, campaign["id"], error)
                await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'error', "lastErrorCode" = $3,
                  "lastErrorMessage" = $4, "retiredAt" = NOW() WHERE "campaignId" = $1 AND "sessionId" = $2''',
                  campaign["id"], session["id"], error_code(error), str(error)[:2000])
                if signal != "retire":
                    unauthorized = "NO LONGER AUTHORIZED" in str(error).upper()
                    await pool.execute('''UPDATE "TelegramSession" SET status = CASE WHEN $4 THEN 'error' ELSE status END,
                      "isLoggedIn" = CASE WHEN $4 THEN FALSE ELSE "isLoggedIn" END,
                      "healthCooldownUntil" = CASE WHEN $4 THEN "healthCooldownUntil" ELSE NOW() + INTERVAL '15 minutes' END,
                      "riskScore" = LEAST(100, "riskScore" + 5), "lastErrorCode" = $2,
                      "lastErrorMessage" = $3, "updatedAt" = NOW() WHERE id = $1''',
                      session["id"], error_code(error), str(error)[:2000], unauthorized)
                    await behavior_log(pool, session, "client_connect", campaign_id=campaign["id"], succeeded=False,
                                       severity="warning", error=error)
        if not clients:
            raise ValueError("All selected Telegram sessions failed to connect")

        rows = await pool.fetch('''SELECT * FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1
          AND status = 'pending' ORDER BY "createdAt" ASC, id ASC''', campaign["id"])
        session_ids = [session["id"] for session in sessions if session["id"] in clients]
        session_records = {session["id"]: session for session in sessions}
        for session in sessions:
            limit = session_daily_limit(session, now)
            reset_at = as_utc(session.get("dailyMessagesResetAt"))
            sent_today = int(session.get("dailyMessagesSent") or 0) if reset_at and reset_at.date() == now.date() else 0
            daily_remaining[session["id"]] = None if limit is None else max(0, limit - sent_today)
        if pacing_mode == "auto":
            ratio = len(rows) / max(1, len(session_ids))
            if len(rows) <= 50:
                burst, cooldown_min, cooldown_max, min_delay, max_delay = max(1, int(-(-ratio // 1))), 0, 30, 1, 4
            elif ratio <= 50:
                burst, cooldown_min, cooldown_max, min_delay, max_delay = max(1, int(-(-ratio // 1))), 30, 60, 2, 6
            elif ratio <= 200:
                burst, cooldown_min, cooldown_max, min_delay, max_delay = 50, 60, 180, 2, 6
            else:
                burst, cooldown_min, cooldown_max, min_delay, max_delay = 100, 60, 180, 3, 8
        await behavior_log(pool, sessions[0], "campaign_pacing", campaign_id=campaign["id"], details={
            "mode": pacing_mode, "perSessionBurst": burst, "cooldownSecondsMin": cooldown_min,
            "cooldownSecondsMax": cooldown_max, "minDelaySeconds": min_delay, "maxDelaySeconds": max_delay,
        })

        async def is_cancelled():
            state = await pool.fetchrow('SELECT "cancelRequested", status FROM "TelegramCampaign" WHERE id = $1', campaign["id"])
            return not state or state["cancelRequested"]

        async def ensure_subscription_active():
            active = await pool.fetchval('''SELECT EXISTS(SELECT 1 FROM "ValidatorAccount"
              WHERE id = $1 AND active = TRUE AND "planExpiresAt" > NOW())''', campaign["accountId"])
            if not active:
                raise SubscriptionRequiredError("Workspace subscription expired while the campaign was running")

        async def deliver(recipient, choices):
            attempts = 0
            last_error = None
            last_code = None
            last_session_id = recipient["sessionId"] if campaign["mode"] in {"fanout", "split"} else None
            session_failure = False
            for session_id in choices:
                if not session_id or session_id not in clients or session_id in retired_sessions:
                    continue
                if daily_remaining.get(session_id) == 0:
                    retired_sessions.add(session_id)
                    last_session_id = session_id
                    last_code = "DAILY_WARMUP_LIMIT"
                    last_error = "Daily warmup message limit reached"
                    session_failure = True
                    await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'warmup_limit',
                      "lastErrorCode" = 'DAILY_WARMUP_LIMIT', "lastErrorMessage" = 'Daily warmup message limit reached',
                      "retiredAt" = NOW() WHERE "campaignId" = $1 AND "sessionId" = $2''', campaign["id"], session_id)
                    await behavior_log(pool, session_records[session_id], "daily_warmup_limit", campaign_id=campaign["id"],
                                       succeeded=False, severity="warning", details={"limit": session_daily_limit(session_records[session_id], now)})
                    continue
                last_session_id = session_id
                flood_retried = False
                while True:
                    attempts += 1
                    try:
                        await ensure_subscription_active()
                        lock = CLIENT_COMMAND_LOCKS.setdefault(session_id, asyncio.Lock())
                        async with lock:
                            message = await asyncio.wait_for(clients[session_id].send_message(
                                await target_for(clients[session_id], recipient), campaign["message"], parse_mode=parse_mode(campaign["parseMode"])
                            ), timeout=45)
                        if not message:
                            raise ValueError("Telegram returned no sent message")
                        await pool.execute('''UPDATE "TelegramCampaignRecipient" SET "sessionId" = $2, status = 'sent',
                          attempts = attempts + $3, "messageId" = $4, "peerId" = $5, "sentAt" = NOW(), "updatedAt" = NOW(),
                          "errorCode" = NULL, "errorMessage" = NULL WHERE id = $1''', recipient["id"], session_id,
                          attempts, message.id, getattr(message.chat, "id", None))
                        await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'active', "sentCount" = "sentCount" + 1
                          WHERE "campaignId" = $1 AND "sessionId" = $2''', campaign["id"], session_id)
                        await pool.execute('''UPDATE "TelegramSession" SET "messagesSent" = "messagesSent" + 1,
                          "dailyMessagesSent" = CASE WHEN "dailyMessagesResetAt"::date < CURRENT_DATE
                            THEN 1 ELSE "dailyMessagesSent" + 1 END,
                          "dailyMessagesResetAt" = CASE WHEN "dailyMessagesResetAt"::date < CURRENT_DATE
                            THEN NOW() ELSE "dailyMessagesResetAt" END,
                          "consecutiveSendFailures" = 0, "consecutiveFloodWaits" = 0,
                          "riskScore" = GREATEST(0, "riskScore" - 0.1),
                          "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', session_id)
                        await pool.execute('''UPDATE "TelegramCampaign" SET "processedCount" = "processedCount" + 1,
                          "sentCount" = "sentCount" + 1, "currentTarget" = $2, "lastProgressAt" = NOW() WHERE id = $1''',
                          campaign["id"], recipient["targetInput"])
                        if daily_remaining[session_id] is not None:
                            daily_remaining[session_id] = max(0, daily_remaining[session_id] - 1)
                        return session_id
                    except SubscriptionRequiredError:
                        raise
                    except FloodWait as error:
                        last_error, last_code = str(error), error_code(error)
                        wait = int(getattr(error, "value", 0) or 0)
                        await record_session_signal(pool, session_records[session_id], campaign["id"], error, wait)
                        if wait <= max_flood and not flood_retried:
                            flood_retried = True
                            await asyncio.sleep(wait)
                            continue
                        retired_sessions.add(session_id)
                        session_failure = True
                        await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'flood_wait',
                          "lastErrorCode" = $3, "lastErrorMessage" = $4, "retiredAt" = NOW()
                          WHERE "campaignId" = $1 AND "sessionId" = $2''',
                          campaign["id"], session_id, last_code, last_error[:2000])
                    except Exception as error:
                        last_error, last_code = str(error), error_code(error)
                        signal = await record_session_signal(pool, session_records[session_id], campaign["id"], error)
                        if signal == "retire":
                            retired_sessions.add(session_id)
                            session_failure = True
                            await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'error',
                              "lastErrorCode" = $3, "lastErrorMessage" = $4, "retiredAt" = NOW()
                              WHERE "campaignId" = $1 AND "sessionId" = $2''',
                              campaign["id"], session_id, last_code, last_error[:2000])
                    break
            if session_failure and campaign["mode"] == "parallel" and any(
                session_id not in retired_sessions for session_id in session_ids
            ):
                await pool.execute('''UPDATE "TelegramCampaignRecipient" SET "sessionId" = NULL,
                  attempts = attempts + $2, "errorCode" = $3, "errorMessage" = $4, "updatedAt" = NOW()
                  WHERE id = $1 AND status = 'pending' ''', recipient["id"], attempts,
                  last_code or "SESSION_RETIRED", (last_error or "Session retired; target requeued")[:2000])
                return "requeue"
            await pool.execute('''UPDATE "TelegramCampaignRecipient" SET "sessionId" = $2, status = 'failed',
              attempts = attempts + $3, "errorCode" = $4, "errorMessage" = $5, "updatedAt" = NOW() WHERE id = $1''',
              recipient["id"], last_session_id, attempts, last_code or "NO_ACTIVE_SESSION",
              (last_error or "No active session could send this message")[:2000])
            if last_session_id and attempts:
                await pool.execute('''UPDATE "TelegramCampaignSession" SET "failedCount" = "failedCount" + 1
                  WHERE "campaignId" = $1 AND "sessionId" = $2''', campaign["id"], last_session_id)
                health = await pool.fetchrow('''UPDATE "TelegramSession" SET
                  "consecutiveSendFailures" = "consecutiveSendFailures" + 1,
                  "riskScore" = LEAST(100, "riskScore" + CASE WHEN "consecutiveSendFailures" >= 24 THEN 10 ELSE 0.25 END),
                  "healthCooldownUntil" = CASE WHEN "consecutiveSendFailures" >= 24
                    THEN NOW() + INTERVAL '6 hours' ELSE "healthCooldownUntil" END, "updatedAt" = NOW() WHERE id = $1
                  RETURNING "consecutiveSendFailures"''',
                  last_session_id)
                if health and health["consecutiveSendFailures"] >= 25:
                    retired_sessions.add(last_session_id)
                    await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'health_cooldown',
                      "lastErrorCode" = 'CONSECUTIVE_SEND_FAILURES',
                      "lastErrorMessage" = 'Session retired after 25 consecutive send failures', "retiredAt" = NOW()
                      WHERE "campaignId" = $1 AND "sessionId" = $2''', campaign["id"], last_session_id)
                    await behavior_log(pool, session_records[last_session_id], "consecutive_send_failures",
                                       campaign_id=campaign["id"], succeeded=False, severity="warning",
                                       details={"count": health["consecutiveSendFailures"], "cooldownHours": 6})
            await pool.execute('''UPDATE "TelegramCampaign" SET "processedCount" = "processedCount" + 1,
              "failedCount" = "failedCount" + 1, "currentTarget" = $2, "lastProgressAt" = NOW() WHERE id = $1''',
              campaign["id"], recipient["targetInput"])
            return None

        async def pace(session_id, allow_cooldown=True):
            if min_delay or max_delay:
                await asyncio.sleep(random_between(min_delay, max_delay))
            if not session_id:
                return
            burst_counts[session_id] = burst_counts.get(session_id, 0) + 1
            if burst_counts[session_id] >= burst:
                burst_counts[session_id] = 0
                if allow_cooldown and (cooldown_min or cooldown_max):
                    seconds = random_between(cooldown_min, cooldown_max)
                    await behavior_log(pool, session_records[session_id], "burst_cooldown", campaign_id=campaign["id"],
                                       details={"seconds": round(seconds, 3), "burst": burst})
                    await asyncio.sleep(seconds)

        if campaign["mode"] == "parallel":
            queue = asyncio.Queue()
            for row in rows:
                queue.put_nowait(dict(row))

            async def parallel_worker(session_id):
                while True:
                    if session_id in retired_sessions or await is_cancelled():
                        return
                    await ensure_subscription_active()
                    try:
                        recipient = queue.get_nowait()
                    except asyncio.QueueEmpty:
                        return
                    try:
                        sent_session_id = await deliver(recipient, [session_id])
                        if sent_session_id == "requeue":
                            queue.put_nowait(recipient)
                            return
                        await pace(sent_session_id or session_id, not queue.empty())
                    finally:
                        queue.task_done()

            async with asyncio.TaskGroup() as workers:
                for session_id in session_ids:
                    workers.create_task(parallel_worker(session_id))
        elif campaign["mode"] == "split":
            rows_by_session = {session_id: [] for session_id in session_ids}
            for row in rows:
                if row["sessionId"] in rows_by_session:
                    rows_by_session[row["sessionId"]].append(dict(row))

            async def split_worker(session_id):
                assigned_rows = rows_by_session[session_id]
                for row_index, recipient in enumerate(assigned_rows):
                    if session_id in retired_sessions or await is_cancelled():
                        return
                    await ensure_subscription_active()
                    sent_session_id = await deliver(recipient, [session_id])
                    await pace(sent_session_id or session_id, row_index < len(assigned_rows) - 1)

            async with asyncio.TaskGroup() as workers:
                for session_id in session_ids:
                    if rows_by_session[session_id]:
                        workers.create_task(split_worker(session_id))
        else:
            cursor = 0
            for row_index, raw_recipient in enumerate(rows):
                recipient = dict(raw_recipient)
                if await is_cancelled():
                    break
                await ensure_subscription_active()
                assigned = recipient["sessionId"] if recipient["sessionId"] in clients else None
                choices = [recipient["sessionId"]] if campaign["mode"] in {"fanout", "split"} else ([assigned] if assigned else session_ids[cursor:] + session_ids[:cursor])
                sent_session_id = await deliver(recipient, choices)
                if sent_session_id:
                    cursor = (session_ids.index(sent_session_id) + 1) % len(session_ids)
                await pace(sent_session_id or assigned, row_index < len(rows) - 1)

        current = await pool.fetchrow('SELECT * FROM "TelegramCampaign" WHERE id = $1', campaign["id"])
        pending = await pool.fetchval('SELECT COUNT(*) FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1 AND status = \'pending\'', campaign["id"])
        if current["cancelRequested"]:
            await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'skipped', "errorCode" = 'CAMPAIGN_CANCELLED',
              "errorMessage" = 'Campaign cancelled before this target was processed', "updatedAt" = NOW()
              WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"])
            await pool.execute('''UPDATE "TelegramCampaign" SET status = 'cancelled', "skippedCount" = "skippedCount" + $2,
              "processedCount" = "processedCount" + $2, "finishedAt" = NOW(), "currentTarget" = NULL,
              "replyTrackingStatus" = 'cancelled', "lastProgressAt" = NOW() WHERE id = $1''', campaign["id"], pending)
            await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'cancelled'
              WHERE "campaignId" = $1 AND status IN ('pending', 'active')''', campaign["id"])
        else:
            if pending:
                await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'failed',
                  "errorCode" = 'NO_ELIGIBLE_SESSION', "errorMessage" = 'All eligible sessions retired before this target was processed',
                  "updatedAt" = NOW() WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"])
                await pool.execute('''UPDATE "TelegramCampaign" SET "failedCount" = "failedCount" + $2,
                  "processedCount" = "processedCount" + $2 WHERE id = $1''', campaign["id"], pending)
                current = await pool.fetchrow('SELECT * FROM "TelegramCampaign" WHERE id = $1', campaign["id"])
            track = bool(current["trackReplies"] and current["sentCount"] > 0 and current["targetType"] == "users")
            reply_until = (utc_now() + timedelta(hours=current["replyWindowHours"])).replace(tzinfo=None) if track else None
            await pool.execute('''UPDATE "TelegramCampaign" SET status = 'completed', "finishedAt" = NOW(),
              "currentTarget" = NULL, "replyTrackingStatus" = $2, "replyTrackingUntil" = $3,
              "lastProgressAt" = NOW() WHERE id = $1''', campaign["id"], "tracking" if track else "disabled", reply_until)
            await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'completed'
              WHERE "campaignId" = $1 AND status IN ('pending', 'active')''', campaign["id"])
    except SubscriptionRequiredError as error:
        paused_for_subscription = True
        log.info("Campaign %s paused for subscription renewal", campaign["id"])
        await pool.execute('''UPDATE "TelegramCampaign" SET status = 'paused_subscription',
          "errorMessage" = $2, "currentTarget" = NULL, "lastProgressAt" = NOW()
          WHERE id = $1''', campaign["id"], str(error)[:2000])
        await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'paused_subscription',
          "lastErrorCode" = 'SUBSCRIPTION_REQUIRED', "lastErrorMessage" = $2
          WHERE "campaignId" = $1 AND status IN ('pending', 'active')''', campaign["id"], str(error)[:2000])
    except Exception as error:
        log.exception("Campaign %s failed", campaign["id"])
        pending = await pool.fetchval('SELECT COUNT(*) FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1 AND status = \'pending\'', campaign["id"])
        await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'skipped', "errorCode" = 'CAMPAIGN_FAILED',
          "errorMessage" = $2, "updatedAt" = NOW() WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"], str(error)[:2000])
        await pool.execute('''UPDATE "TelegramCampaign" SET status = 'failed', "skippedCount" = "skippedCount" + $2,
          "processedCount" = "processedCount" + $2, "errorMessage" = $3, "finishedAt" = NOW(),
          "replyTrackingStatus" = 'failed', "lastProgressAt" = NOW() WHERE id = $1''', campaign["id"], pending, str(error)[:2000])
        await pool.execute('''UPDATE "TelegramCampaignSession" SET status = 'failed',
          "lastErrorCode" = COALESCE("lastErrorCode", 'CAMPAIGN_FAILED'),
          "lastErrorMessage" = COALESCE("lastErrorMessage", $2)
          WHERE "campaignId" = $1 AND status IN ('pending', 'active')''', campaign["id"], str(error)[:2000])
    finally:
        for client in clients.values():
            await disconnect(client)
        if not paused_for_subscription:
            await settle_campaign_quota(pool, campaign["id"])


async def claim_reply_scan(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT campaign.* FROM "TelegramCampaign" campaign
          JOIN "ValidatorAccount" account ON account.id = campaign."accountId"
          WHERE campaign."replyTrackingStatus" = 'tracking' AND campaign."replyTrackingUntil" > NOW()
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
            AND (campaign."replyTrackingLastScanAt" IS NULL
              OR campaign."replyTrackingLastScanAt" < NOW() - INTERVAL '2 minutes')
          ORDER BY COALESCE(campaign."replyTrackingLastScanAt", campaign."finishedAt") ASC
          FOR UPDATE OF campaign SKIP LOCKED LIMIT 1''')
        if row:
            await connection.execute('UPDATE "TelegramCampaign" SET "replyTrackingLastScanAt" = NOW() WHERE id = $1', row["id"])
        return dict(row) if row else None


async def scan_replies(pool, campaign):
    clients = {}
    try:
        sessions = await campaign_sessions(pool, campaign["id"])
        recipients = await pool.fetch('''SELECT * FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1
          AND status = 'sent' AND replied = FALSE
          ORDER BY "lastCheckedAt" ASC NULLS FIRST, "sentAt" ASC LIMIT 1000''', campaign["id"])
        by_session = {}
        for row in recipients:
            by_session.setdefault(row["sessionId"], []).append(dict(row))
        for session in sessions:
            pending = by_session.get(session["id"])
            if not pending:
                continue
            try:
                client = clients[session["id"]] = await with_session_lock(
                    session["id"], lambda: open_campaign_client(session)
                )
                for recipient in pending:
                    try:
                        next_sent_at = await pool.fetchval('''SELECT "sentAt" FROM "TelegramCampaignRecipient"
                          WHERE "sessionId" = $1 AND "peerId" = $2 AND status = 'sent'
                            AND "sentAt" > $3 ORDER BY "sentAt" ASC, id ASC LIMIT 1''',
                          session["id"], recipient["peerId"], recipient["sentAt"])

                        async def find_reply():
                            target = recipient.get("peerId") or await target_for(client, recipient)
                            reply = None
                            sent_at = as_utc(recipient.get("sentAt"))
                            next_at = as_utc(next_sent_at)
                            async for message in client.get_chat_history(target, limit=500):
                                message_at = as_utc(getattr(message, "date", None))
                                if sent_at and message_at and message_at < sent_at:
                                    break
                                if (message.id == recipient["messageId"] or message.outgoing
                                        or not message_at or not sent_at or message_at < sent_at):
                                    continue
                                reply_to_id = getattr(message, "reply_to_message_id", None)
                                if reply_to_id:
                                    if reply_to_id == recipient["messageId"]:
                                        return message
                                    continue
                                if next_at is None or message_at < next_at:
                                    reply = message
                            return reply

                        message = await with_session_lock(session["id"], find_reply)
                        if message:
                            preview = (message.text or message.caption or "[media]")[:500]
                            updated = await pool.execute('''UPDATE "TelegramCampaignRecipient" SET replied = TRUE,
                              "repliedAt" = $2, "replyMessageId" = $3, "replyPreview" = $4, "lastCheckedAt" = NOW(),
                              "updatedAt" = NOW() WHERE id = $1 AND replied = FALSE''', recipient["id"],
                              as_utc(message.date).replace(tzinfo=None), message.id, preview)
                            if updated.endswith("1"):
                                await pool.execute('UPDATE "TelegramCampaign" SET "repliedCount" = "repliedCount" + 1 WHERE id = $1', campaign["id"])
                                await pool.execute('UPDATE "TelegramSession" SET "repliesReceived" = "repliesReceived" + 1 WHERE id = $1', session["id"])
                    except Exception as error:
                        log.info("Reply check failed for recipient %s: %s", recipient["id"], error)
                    finally:
                        await pool.execute('UPDATE "TelegramCampaignRecipient" SET "lastCheckedAt" = NOW() WHERE id = $1', recipient["id"])
            except Exception as error:
                log.warning("Reply session %s failed: %s", session["id"], error)
                await pool.execute('''UPDATE "TelegramCampaignRecipient" SET "lastCheckedAt" = NOW()
                  WHERE id = ANY($1::text[])''', [recipient["id"] for recipient in pending])
        if as_utc(campaign["replyTrackingUntil"]) <= utc_now():
            await pool.execute('UPDATE "TelegramCampaign" SET "replyTrackingStatus" = \'completed\' WHERE id = $1', campaign["id"])
    finally:
        for client in clients.values():
            await disconnect(client)


def scheduled_candidate(value: str, target_type="users"):
    target = str(value or "").strip()
    if not target or len(target) > 220:
        return None
    if target_type == "groups" and re.match(r"^(?:https?://)?(?:www\.)?t(?:elegram)?\.(?:me|dog)/(?:joinchat/|\+)[A-Za-z0-9_-]+/?$", target, re.I):
        normalized = re.sub(r"^https?://", "", target, flags=re.I)
        normalized = re.sub(r"^www\.", "", normalized, flags=re.I).lower().rstrip("/")
        invite_key = hashlib.sha256(normalized.encode()).hexdigest()
        return {"targetKey": f"invite:{invite_key}", "targetInput": target}
    match = re.match(r"^(?:https?://)?(?:www\.)?t(?:elegram)?\.(?:me|dog)/([A-Za-z][A-Za-z0-9_]{4,31})/?$", target, re.I)
    username = (match.group(1) if match else target.lstrip("@")).strip()
    if re.match(r"^[A-Za-z][A-Za-z0-9_]{4,31}$", username):
        return {"targetKey": f"username:{username.lower()}", "targetInput": target, "username": username}
    if re.match(r"^-?\d{5,20}$", target):
        telegram_id = int(target)
        if MIN_BIGINT <= telegram_id <= MAX_BIGINT:
            return {"targetKey": f"id:{target}", "targetInput": target, "telegramId": telegram_id}
    return None


async def claim_schedule(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, k.revoked AS "keyRevoked",
          account.active AS "accountActive",
          account."planExpiresAt"
          FROM "TelegramMessageSchedule" s
          JOIN "ValidatorAccount" account ON account.id = s."accountId"
          LEFT JOIN "ValidatorAccessKey" k ON k.id = s."accessKeyId"
          WHERE s.status IN ('active','paused_access') AND s."nextRunAt" <= NOW()
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
          ORDER BY s."nextRunAt" ASC FOR UPDATE OF s SKIP LOCKED LIMIT 1''')
        if not row:
            return None
        await connection.execute('''UPDATE "TelegramMessageSchedule"
          SET "nextRunAt" = NOW() + ("intervalMinutes" * INTERVAL '1 minute'), "updatedAt" = NOW()
          WHERE id = $1''', row["id"])
        return dict(row)


async def materialize_schedule(pool, schedule):
    try:
        now = utc_now()
        if (not schedule.get("accessKeyId") or schedule.get("keyRevoked")
                or not schedule.get("accountActive") or not schedule.get("planExpiresAt")
                or as_utc(schedule["planExpiresAt"]) <= now):
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_access\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        session_ids = json.loads(schedule["sessionIds"]) if isinstance(schedule["sessionIds"], str) else schedule["sessionIds"]
        session_ids = list(dict.fromkeys(str(value) for value in (session_ids or [])))
        active_rows = await pool.fetch('''SELECT * FROM "TelegramSession" WHERE "accountId" = $1
          AND id = ANY($2::text[]) AND status = 'active' AND "isLoggedIn" = TRUE''', schedule["accountId"], session_ids)
        active_rows = [dict(row) for row in active_rows]
        active_ids = {row["id"] for row in active_rows}
        if not session_ids or len(active_ids) != len(session_ids):
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_sessions\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        blocked = [(row, session_safety_reason(row)) for row in active_rows if session_safety_reason(row)]
        if blocked:
            for session, reason in blocked:
                await behavior_log(pool, session, "schedule_safety_block", succeeded=False, severity="warning",
                                   details={"scheduleId": schedule["id"], "reason": reason})
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_safety\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        active_rows = [row for row in active_rows if not session_safety_reason(row)]
        active_ids = {row["id"] for row in active_rows}
        session_ids = [session_id for session_id in session_ids if session_id in active_ids]
        if not session_ids:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_safety\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return

        candidates = {}
        if schedule["sourceListId"]:
            rows = await pool.fetch('''SELECT "telegramId", username, "accessHash", phone, "firstName", "lastName"
              FROM "ListItem" WHERE "listId" = $1 ORDER BY "addedAt" ASC, id ASC LIMIT 200001''', schedule["sourceListId"])
            if len(rows) > 200000:
                await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
                return
            for row in rows:
                username = str(row["username"] or "").lstrip("@").strip()
                candidate = None
                if re.match(r"^[A-Za-z][A-Za-z0-9_]{4,31}$", username):
                    candidate = {
                        "targetKey": f"username:{username.lower()}", "targetInput": f"@{username}",
                        "username": username, "telegramId": row["telegramId"], "accessHash": row["accessHash"],
                        "phone": row["phone"], "displayName": " ".join(filter(None, [row["firstName"], row["lastName"]])) or None,
                    }
                elif row["telegramId"]:
                    candidate = {
                        "targetKey": f"id:{row['telegramId']}", "targetInput": str(row["telegramId"]),
                        "telegramId": row["telegramId"], "accessHash": row["accessHash"], "phone": row["phone"],
                        "displayName": " ".join(filter(None, [row["firstName"], row["lastName"]])) or None,
                    }
                if candidate:
                    candidates[candidate["targetKey"]] = candidate
        manual_targets = json.loads(schedule["manualTargets"]) if isinstance(schedule["manualTargets"], str) else schedule["manualTargets"]
        for value in manual_targets or []:
            candidate = scheduled_candidate(value, schedule["targetType"])
            if candidate:
                candidates[candidate["targetKey"]] = candidate
        if not candidates:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        if schedule["targetType"] == "users" and schedule["mode"] == "fanout" and len(candidates) > 50:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return

        transmissions = []
        if schedule["mode"] == "fanout":
            for candidate in candidates.values():
                for session_id in session_ids:
                    transmissions.append({**candidate, "targetKey": f"{candidate['targetKey']}:session:{session_id}", "sessionId": session_id})
        elif schedule["mode"] == "split":
            values = list(candidates.values())
            split_configuration = json_value(schedule["configuration"])
            quota = max(1, int(split_configuration.get("perSessionQuota", 10)))
            effective_quota = max(quota, -(-len(values) // len(session_ids)))
            for index, candidate in enumerate(values):
                transmissions.append({**candidate, "sessionId": session_ids[min(len(session_ids) - 1, index // effective_quota)]})
        else:
            for index, candidate in enumerate(candidates.values()):
                transmissions.append({**candidate, "sessionId": None if schedule["mode"] == "failover" else session_ids[index % len(session_ids)]})
        if len(transmissions) > 200000:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        capacities = {row["id"]: session_daily_limit(row) for row in active_rows}
        daily_sent = {
            row["id"]: int(row.get("dailyMessagesSent") or 0)
            if as_utc(row.get("dailyMessagesResetAt")) and as_utc(row["dailyMessagesResetAt"]).date() == utc_now().date() else 0
            for row in active_rows
        }
        if schedule["mode"] in {"failover", "parallel"}:
            finite = [capacities[session_id] - daily_sent[session_id] for session_id in session_ids if capacities[session_id] is not None]
            capacity = None if len(finite) != len(session_ids) else sum(max(0, value) for value in finite)
            over_capacity = capacity is not None and len(transmissions) > capacity
        else:
            assigned = {}
            for transmission in transmissions:
                assigned[transmission["sessionId"]] = assigned.get(transmission["sessionId"], 0) + 1
            over_capacity = any(
                capacities[session_id] is not None
                and count > max(0, capacities[session_id] - daily_sent[session_id])
                for session_id, count in assigned.items()
            )
        if over_capacity:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_safety\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return

        campaign_id = f"tgc_{uuid.uuid4().hex}"
        configuration = json_value(schedule["configuration"])
        track_replies = bool(configuration.pop("trackReplies", True)) and schedule["targetType"] == "users"
        reply_window = max(1, min(168, int(configuration.pop("replyWindowHours", 24))))
        assigned_counts = {}
        for transmission in transmissions:
            session_id = transmission.get("sessionId")
            if session_id:
                assigned_counts[session_id] = assigned_counts.get(session_id, 0) + 1
        async with pool.acquire() as connection, connection.transaction():
            key = await connection.fetchrow('''SELECT key.revoked,
              account.active AS "accountActive", account."planExpiresAt"
              FROM "ValidatorAccessKey" key
              JOIN "ValidatorAccount" account ON account.id = key."accountId"
              WHERE key.id = $1 AND account.id = $2 FOR UPDATE OF key, account''',
              schedule["accessKeyId"], schedule["accountId"])
            if (not key or key["revoked"]
                    or not key["accountActive"] or not key["planExpiresAt"]
                    or as_utc(key["planExpiresAt"]) <= utc_now()):
                await connection.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_access\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
                return
            await connection.execute('''UPDATE "ValidatorAccessKey" SET "messagesUsed" = "messagesUsed" + $2
              WHERE id = $1''', schedule["accessKeyId"], len(transmissions))
            await connection.execute('''INSERT INTO "TelegramCampaign"
              (id, "accountId", "accessKeyId", "sourceListId", "scheduleId", name, "targetType", mode,
               message, "parseMode", status, "totalCount", "sessionCount", "reservedMessages", "reservedCredits",
                "creditItemCost", configuration, "trackReplies", "replyWindowHours", "createdAt", "lastProgressAt")
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$11,0,0,$13::jsonb,$14,$15,NOW(),NOW())''',
              campaign_id, schedule["accountId"], schedule["accessKeyId"], schedule["sourceListId"], schedule["id"],
              schedule["name"], schedule["targetType"], schedule["mode"], schedule["message"], schedule["parseMode"],
              len(transmissions), len(session_ids), json.dumps(configuration), track_replies, reply_window)
            await connection.executemany('''INSERT INTO "TelegramCampaignSession"
              ("campaignId", "sessionId", position, "assignedCount") VALUES ($1,$2,$3,$4)''',
              [(campaign_id, session_id, position, assigned_counts.get(session_id, 0)) for position, session_id in enumerate(session_ids)])
            await connection.executemany('''INSERT INTO "TelegramCampaignRecipient"
              (id, "campaignId", "sessionId", "targetKey", "targetInput", username, "telegramId", "accessHash",
               phone, "displayName", status, "createdAt", "updatedAt")
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW(),NOW())''', [
                (f"tgr_{uuid.uuid4().hex}", campaign_id, candidate.get("sessionId"), candidate["targetKey"],
                 candidate["targetInput"], candidate.get("username"), candidate.get("telegramId"),
                 candidate.get("accessHash"), candidate.get("phone"), candidate.get("displayName"))
                for candidate in transmissions
              ])
            await connection.execute('''UPDATE "TelegramMessageSchedule" SET "runCount" = "runCount" + 1,
              status = 'active', "lastRunAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', schedule["id"])
        log.info("Materialized schedule %s as campaign %s", schedule["id"], campaign_id)
    except Exception:
        log.exception("Schedule %s failed to materialize", schedule["id"])
        await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])


class AiProviderError(Exception):
    def __init__(self, message, status=None, data=None):
        super().__init__(message)
        self.status = status
        self.data = data
        self.transient = status is None or status == 429 or (status is not None and status >= 500)


def ai_config(account_config, session_config):
    account = json_value(account_config)
    session = json_value(session_config)
    merged = {**account, **session}
    account_capitalbot = json_value(account.get("capitalbot"))
    merged["capitalbot"] = {
        **account_capitalbot,
        **json_value(session.get("capitalbot")),
        "detectLanguage": False,
        "language": str(account_capitalbot.get("language") or "English"),
    }
    merged["cupidbot"] = {**json_value(account.get("cupidbot")), **json_value(session.get("cupidbot"))}
    merged["provider"] = str(merged.get("provider") or "capitalbot").lower()
    merged["replyDelayMs"] = max(0, min(60000, int(merged.get("replyDelayMs", 3000))))
    merged["replyDelayJitterMs"] = max(0, min(60000, int(merged.get("replyDelayJitterMs", 2000))))
    merged["memoryMessageLimit"] = max(10, min(200, int(merged.get("memoryMessageLimit", 100))))
    return merged


def _request_json_sync(url, body):
    payload = json.dumps(body).encode()
    request = Request(url, payload, {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}, method="POST")
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read().decode()
            return response.status, json.loads(raw) if raw.strip() else None
    except HTTPError as error:
        raw = error.read().decode(errors="replace")
        try:
            data = json.loads(raw) if raw.strip() else None
        except json.JSONDecodeError:
            data = {"message": raw[:2000]}
        return error.code, data


async def ai_provider_request(url, body):
    last_error = None
    for attempt in range(3):
        try:
            status, data = await asyncio.to_thread(_request_json_sync, url, body)
            if status == 200 and data is not None:
                return data
            last_error = AiProviderError(
                f"Provider returned HTTP {status}: {json.dumps(data)[:1000]}", status, data
            )
            if not last_error.transient:
                raise last_error
        except AiProviderError:
            raise
        except Exception as error:
            last_error = AiProviderError(str(error))
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)
    raise last_error or AiProviderError("Provider request failed")


def capitalbot_category(data):
    categories = (
        ("underage", "underage"), ("aiCreditOver", "ai_credit_over"),
        ("timewaste", "timewaste"), ("tierFiltered", "tier_filtered"),
        ("genderFiltered", "gender_filtered"), ("messagedAlready", "messaged_already"),
        ("internalAccount", "internal_account"), ("ignored", "ignored"),
        ("ppvExhausted", "ppv_exhausted"), ("chatCooldown", "chat_cooldown"),
    )
    return next((category for field, category in categories if data.get(field)), None)


async def generate_ai_reply(provider, credential, config, session, recipient, messages, is_followup):
    secret = decrypt(credential["secretEncrypted"]).decode()
    if provider == "capitalbot":
        options = json_value(config.get("capitalbot"))
        peer_id = str(recipient.get("id") or "unknown")
        history = [{
            "role": "user" if item.get("isIncoming") else "assistant",
            "content": str(item.get("msg") or ""),
            "timestamp": int(int(item.get("timestamp") or int(datetime.now().timestamp() * 1000)) / 1000),
        } for item in messages[-55:]]
        uid_input = f"{credential['id']}_{session['id']}_{peer_id}"
        user_id = hashlib.sha256(uid_input.encode()).hexdigest()[:24]
        body = {
            "licensekey": secret,
            "modelId": credential.get("modelId") or options.get("modelId") or 43,
            "presetId": credential.get("presetId") or options.get("presetId") or 88,
            "accountId": f"{credential['id']}:{session['id']}",
            "platform": "Telegram",
            "conversationSource": "Telegram",
            "detectLanguage": False,
            "language": str(options.get("language") or "English"),
            "userInfos": {"useridentifier": f"v2_{user_id}"},
            "chatHistory": history,
        }
        for target, source in (("name", "name"), ("username", "username"), ("location", "location")):
            if recipient.get(source):
                body["userInfos"][target] = recipient[source]
        if session.get("firstName") or session.get("lastName"):
            body["modelName"] = " ".join(filter(None, [session.get("firstName"), session.get("lastName")]))
        for field in (
            "city", "modelName", "modelAge", "chattingStyle", "appearance", "hobbies", "ctaInfo",
            "dayTimeActivity", "nightTimeActivity", "photoRate", "interestLevel", "phaseGoal",
            "matchLocation", "timezone", "outfit", "livePhotoSource", "audio", "video",
            "image", "affiliate",
        ):
            if options.get(field) is not None:
                body[field] = options[field]
        data = await ai_provider_request(AI_CAPITALBOT_ENDPOINT, body)
        content = data.get("content") if isinstance(data.get("content"), list) else []
        text = "\n".join(str(item.get("content")) for item in content if item.get("type") == "text" and item.get("content")) or None
        return {
            "text": text, "category": capitalbot_category(data), "didConvert": bool(data.get("converted")),
            "meta": {"contentTypes": [item.get("type") for item in content], "converted": bool(data.get("converted"))},
        }

    options = json_value(config.get("cupidbot"))
    response_language = str(options.get("responseLanguage") or "English")
    response_language_code = {
        "English": "en", "Italian": "it", "Spanish": "es", "French": "fr",
        "German": "de", "Portuguese": "pt", "Dutch": "nl",
    }.get(response_language, "en")
    confirmed_index = -1
    for index, item in enumerate(messages):
        if not item.get("isIncoming") and item.get("confirmed") is True:
            confirmed_index = index
    exchange = [] if is_followup else messages[confirmed_index + 1:]
    payload_messages = [{
        "id": str(item.get("id") or item.get("telegramMessageId") or ""),
        "timestamp": int(int(item.get("timestamp") or int(datetime.now().timestamp() * 1000)) / 1000),
        "msg": str(item.get("msg") or ""),
        "isIncoming": bool(item.get("isIncoming")),
        "medias": [],
    } for item in exchange]
    model_name = " ".join(filter(None, [session.get("firstName"), session.get("lastName")])) or options.get("name") or "Model"
    body = {
        "accessToken": secret, "version": "0.19.0", "manifestVersion": "0.19.0", "isAPI": True,
        "app": "telegram", "brand": options.get("brand", "cupidbotofm"), "product": options.get("product", "ofm-tg"),
        "isOF": options.get("isOF", True), "isFemale": True,
        "accountID": f"{credential['id']}:{session['id']}",
        "platformSource": "telegram", "responseLanguageCode": response_language_code,
        "responseLanguage": response_language.lower(),
        "isFollowUp": is_followup, "name": model_name, "age": options.get("age", 25),
        "userInfo": options.get("userInfo", f"Your name is {model_name}. You are friendly and engaging."),
        "city": options.get("city") or recipient.get("location") or "New York",
        "ctaInfo": options.get("ctaInfo", "Page subscription details will be provided later"),
        "chooseRandomCTA": False, "useDefaultSettings": True, "showAdvancedSettings": False,
        "ctaData": options.get("ctaData", [{"platform": "onlyfans", "cta": "check my link"}]),
        "settingDayInfo": options.get("settingDayInfo", "Just lounging around, waiting for a reply"),
        "settingNightInfo": options.get("settingNightInfo", "Just winding down, waiting for a reply"),
        "chatStyle": options.get("chatStyle", "youth"),
        "recipient": {key: str(recipient.get(key) or "") for key in ("id", "name", "username", "bio", "location")},
        "messages": payload_messages,
    }
    data = await ai_provider_request(AI_CUPIDBOT_ENDPOINT, body)
    option = None
    if isinstance(data.get("options"), list) and data["options"] and isinstance(data["options"][0], list) and data["options"][0]:
        option = data["options"][0][0]
    return {
        "text": option.get("msg") if isinstance(option, dict) else None,
        "category": data.get("category"), "didConvert": bool(data.get("didConvert")),
        "meta": {"category": data.get("category"), "didConvert": bool(data.get("didConvert")), "rateLimit": data.get("rateLimit")},
    }


AI_GHOSTING = {
    "underage", "timewaste", "tier_filtered", "gender_filtered", "ppv_exhausted", "isTmpGhosted",
    "stopMessaging", "wordSpam", "promptSpam", "charSpam", "glitchedText", "tooLong", "filteredGender",
    "filteredTier", "botRecipient", "ghostAfterMassMessage",
}
AI_NOT_OUR_TURN = {
    "messaged_already", "internal_account", "ignored", "chat_cooldown", "ai_credit_over", "notOurTurn",
    "messagingFromAnotherAccount",
}


async def append_ai_message(connection, record, peer_id, item, recipient=None, limit=100):
    row = await connection.fetchrow('''SELECT id, messages FROM "AiChatMemory"
      WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3 FOR UPDATE''',
      record["campaignId"], record["id"], peer_id)
    messages = json_list(row["messages"]) if row else []
    message_id = str(item.get("telegramMessageId") or item.get("id") or "")
    if message_id and any(str(value.get("telegramMessageId") or value.get("id") or "") == message_id for value in messages):
        return False
    messages = (messages + [item])[-limit:]
    incoming_at = utc_now().replace(tzinfo=None) if item.get("isIncoming") else None
    outgoing_at = utc_now().replace(tzinfo=None) if not item.get("isIncoming") else None
    if row:
        await connection.execute('''UPDATE "AiChatMemory" SET messages = $2::jsonb,
          recipient = COALESCE($3::jsonb, recipient), "lastIncomingAt" = COALESCE($4, "lastIncomingAt"),
          "lastOutgoingAt" = COALESCE($5, "lastOutgoingAt"),
          reengage = CASE WHEN $4 IS NULL THEN reengage ELSE '{}'::jsonb END, "updatedAt" = NOW()
          WHERE id = $1''', row["id"], json.dumps(messages), json.dumps(recipient) if recipient else None,
          incoming_at, outgoing_at)
    else:
        await connection.execute('''INSERT INTO "AiChatMemory"
          (id, "campaignId", "accountId", "sessionId", "peerId", recipient, messages,
           "lastIncomingAt", "lastOutgoingAt", "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,NOW(),NOW())''',
          f"aim_{uuid.uuid4().hex}", record["campaignId"], record["accountId"], record["id"],
          peer_id, json.dumps(recipient) if recipient else None, json.dumps(messages), incoming_at, outgoing_at)
    return True


async def ingest_ai_message(pool, record, message):
    user = getattr(message, "from_user", None)
    chat = getattr(message, "chat", None)
    if not user or getattr(user, "is_bot", False) or getattr(user, "is_self", False) or int(user.id) == 777000:
        return
    text = (getattr(message, "text", None) or getattr(message, "caption", None) or "").strip()
    if not text and not getattr(message, "media", None):
        return
    peer_id = int(user.id)
    recipient = {
        "id": str(peer_id), "name": " ".join(filter(None, [user.first_name, user.last_name])),
        "username": user.username or "", "bio": "", "location": "",
    }
    settings = await pool.fetchrow('''SELECT c.config AS "campaignConfig", c.status
      FROM "AiCampaignSession" membership JOIN "AiCampaign" c ON c.id = membership."campaignId"
      JOIN "ValidatorAccount" account ON account.id = c."accountId"
      LEFT JOIN "AiChatSetting" chat ON chat."campaignId" = c.id
        AND chat."sessionId" = membership."sessionId" AND chat."peerId" = $3
      WHERE membership.id = $1 AND membership."activeSessionId" = $2
        AND c.status IN ('starting','running') AND account.active = TRUE
        AND account."planExpiresAt" > NOW() AND COALESCE(chat.enabled, TRUE) = TRUE''',
      record["membershipId"], record["id"], peer_id)
    if not settings:
        return
    config = ai_config(settings["campaignConfig"], None)
    timestamp = getattr(message, "date", None)
    timestamp_ms = int(as_utc(timestamp).timestamp() * 1000) if timestamp else int(datetime.now().timestamp() * 1000)
    item = {
        "id": f"tg-{message.id}", "telegramMessageId": int(message.id), "timestamp": timestamp_ms,
        "msg": text or "[media]", "isIncoming": True, "medias": [],
    }
    delay_ms = config["replyDelayMs"] + int(random_between(0, config["replyDelayJitterMs"]))
    run_after = (utc_now() + timedelta(milliseconds=delay_ms)).replace(tzinfo=None)
    async with pool.acquire() as connection, connection.transaction():
        appended = await append_ai_message(connection, record, peer_id, item, recipient, config["memoryMessageLimit"])
        if not appended:
            return
        await connection.execute('''UPDATE "AiCampaign" SET "messagesReceived" = "messagesReceived" + 1,
          "updatedAt" = NOW() WHERE id = $1''', record["campaignId"])
        pending = await connection.fetchrow('''SELECT id FROM "AiChatJob" WHERE "campaignId" = $1
          AND "sessionId" = $2 AND "peerId" = $3 AND status = 'pending'
          ORDER BY "createdAt" DESC FOR UPDATE LIMIT 1''', record["campaignId"], record["id"], peer_id)
        if pending:
            await connection.execute('''UPDATE "AiChatJob" SET "incomingMsgId" = $2, "requestPayload" = $3::jsonb,
              "runAfter" = $4, "updatedAt" = NOW() WHERE id = $1''', pending["id"], int(message.id),
              json.dumps({"incomingText": item["msg"], "recipient": recipient}), run_after)
        else:
            await connection.execute('''INSERT INTO "AiChatJob"
              (id, "campaignId", "accountId", "sessionId", "peerId", "incomingMsgId", status,
               "requestPayload", "runAfter", "createdAt", "updatedAt")
              VALUES ($1,$2,$3,$4,$5,$6,'pending',$7::jsonb,$8,NOW(),NOW())
              ON CONFLICT ("campaignId", "sessionId", "incomingMsgId") DO NOTHING''',
              f"aij_{uuid.uuid4().hex}", record["campaignId"], record["accountId"], record["id"], peer_id, int(message.id),
              json.dumps({"incomingText": item["msg"], "recipient": recipient}), run_after)
    await pool.execute('UPDATE "TelegramSession" SET "repliesReceived" = "repliesReceived" + 1, "lastActiveAt" = NOW() WHERE id = $1', record["id"])


async def run_ai_catchup(pool, record, client):
    try:
        cutoff = utc_now() - timedelta(hours=AI_CATCHUP_HOURS)
        enqueued = 0
        async for dialog in client.get_dialogs(limit=AI_CATCHUP_DIALOG_LIMIT):
            if enqueued >= AI_CATCHUP_MAX_CHATS:
                break
            chat = dialog.chat
            message = dialog.top_message
            if not chat or getattr(chat, "type", None) != enums.ChatType.PRIVATE or getattr(chat, "is_bot", False):
                continue
            if not message or message.outgoing or not message.date or as_utc(message.date) < cutoff:
                continue
            before = await pool.fetchval('''SELECT COUNT(*) FROM "AiChatJob"
              WHERE "campaignId" = $1 AND "sessionId" = $2''', record["campaignId"], record["id"])
            await ingest_ai_message(pool, record, message)
            after = await pool.fetchval('''SELECT COUNT(*) FROM "AiChatJob"
              WHERE "campaignId" = $1 AND "sessionId" = $2''', record["campaignId"], record["id"])
            if after > before:
                enqueued += 1
                await asyncio.sleep(0.5)
        log.info("AI catch-up %s enqueued=%s", record["id"], enqueued)
    except Exception as error:
        log.warning("AI catch-up %s failed: %s", record["id"], error)
    finally:
        await pool.execute('''UPDATE "AiCampaignSession" SET "catchupRequested" = FALSE,
          "catchupClaimedAt" = NULL, "updatedAt" = NOW() WHERE id = $1''', record["membershipId"])


async def start_ai_client(pool, record):
    if record["id"] in AI_BUSY_SESSIONS:
        return
    AI_BUSY_SESSIONS.add(record["id"])
    client = None
    try:
        session_string = canonical_session(decrypt(record["sessionDataEncrypted"]), record["sessionFormat"], record["apiId"])
        client = client_for(record, session_string, updates=True)

        async def incoming(_client, message):
            try:
                await ingest_ai_message(pool, record, message)
            except Exception:
                log.exception("AI incoming handler failed for %s", record["id"])

        client.add_handler(MessageHandler(incoming, filters.private & filters.incoming))
        await asyncio.wait_for(client.start(), timeout=60)
        client_key = f"{record['campaignId']}:{record['id']}"
        AI_CLIENTS[client_key] = {
            "client": client, "record": record, "pool": pool, "leases": 0,
            "stopRequested": False, "disconnectedAt": None,
        }
        await pool.execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = 'listening',
          "lastConnectedAt" = NOW(), "lastHeartbeatAt" = NOW(), "lastError" = NULL, "updatedAt" = NOW()
          WHERE id = $1''', record["membershipId"])
        await pool.execute('''UPDATE "AiCampaign" SET status = 'running', "lastError" = NULL,
          "updatedAt" = NOW() WHERE id = $1 AND status = 'starting' ''', record["campaignId"])
        log.info("AI listener started for campaign=%s session=%s", record["campaignId"], record["id"])
        if record.get("catchupRequested"):
            task = asyncio.create_task(run_ai_catchup(pool, record, client), name=f"catchup:{client_key}")
            AI_CATCHUP_TASKS.add(task)
            task.add_done_callback(AI_CATCHUP_TASKS.discard)
    except Exception as error:
        await disconnect(client)
        await pool.execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = 'error', "lastError" = $2,
          "lastHeartbeatAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', record["membershipId"], str(error)[:2000])
        await pool.execute('''UPDATE "AiCampaign" SET "lastError" = $2, "updatedAt" = NOW()
          WHERE id = $1''', record["campaignId"], str(error)[:2000])
        log.warning("AI listener campaign=%s session=%s failed: %s", record["campaignId"], record["id"], error)
    finally:
        AI_BUSY_SESSIONS.discard(record["id"])


async def stop_ai_client(pool, client_key, status="stopped"):
    entry = AI_CLIENTS.get(client_key)
    if entry:
        if int(entry.get("leases", 0)) > 0:
            entry["stopRequested"] = True
            status = "stopping"
        else:
            AI_CLIENTS.pop(client_key, None)
            with suppress(Exception):
                await entry["client"].stop()
        await pool.execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = $2,
          "lastHeartbeatAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', entry["record"]["membershipId"], status)


async def reconcile_ai_campaigns(pool):
    async with pool.acquire() as connection, connection.transaction():
        terminal_ids = await connection.fetch('''UPDATE "AiCampaign" SET
          status = 'expired', "stoppedAt" = NOW(),
          "lastError" = 'Campaign duration completed', "updatedAt" = NOW()
          WHERE status IN ('starting','running','subscription_paused','credit_grace')
            AND "endsAt" IS NOT NULL AND "endsAt" <= NOW()
          RETURNING id''')
        ids = [row["id"] for row in terminal_ids]
        if ids:
            await connection.execute('''UPDATE "AiCampaignSession" SET "activeSessionId" = NULL,
              "runtimeStatus" = 'stopping', "updatedAt" = NOW() WHERE "campaignId" = ANY($1::text[])''', ids)
            await connection.execute('''UPDATE "AiChatJob" SET status = 'cancelled',
              "errorCode" = 'CAMPAIGN_ENDED', "errorMessage" = 'Campaign is no longer active',
              "finishedAt" = NOW(), "updatedAt" = NOW()
              WHERE "campaignId" = ANY($1::text[]) AND status = 'pending' ''', ids)

        paused_ids = await connection.fetch('''UPDATE "AiCampaign" campaign SET status = 'subscription_paused',
          "creditGraceStartedAt" = NULL, "creditGraceEndsAt" = NULL,
          "lastError" = 'AI replies paused until the workspace subscription is renewed', "updatedAt" = NOW()
          FROM "ValidatorAccount" account WHERE account.id = campaign."accountId"
            AND campaign.status IN ('starting','running','credit_grace')
            AND (account.active = FALSE OR account."planExpiresAt" IS NULL
              OR account."planExpiresAt" <= NOW()) RETURNING campaign.id''')
        paused = [row["id"] for row in paused_ids]
        if paused:
            await connection.execute('''UPDATE "AiCampaignSession" SET
              "runtimeStatus" = 'stopping', "updatedAt" = NOW()
              WHERE "campaignId" = ANY($1::text[])''', paused)
        await connection.execute('''UPDATE "AiCampaign" campaign SET status = 'running',
          "creditGraceStartedAt" = NULL, "creditGraceEndsAt" = NULL, "lastError" = NULL,
          "updatedAt" = NOW() FROM "ValidatorAccount" account
          WHERE account.id = campaign."accountId"
            AND campaign.status IN ('subscription_paused','credit_grace')
            AND account.active = TRUE AND account."planExpiresAt" > NOW()''')


async def reconcile_ai_clients(pool):
    await reconcile_ai_campaigns(pool)
    rows = await pool.fetch('''SELECT s.*, credential."apiId", credential."apiHashEncrypted",
        membership.id AS "membershipId", membership."campaignId", membership."catchupRequested",
        campaign.config AS "campaignConfig", campaign.status AS "campaignStatus"
      FROM "AiCampaignSession" membership
      JOIN "AiCampaign" campaign ON campaign.id = membership."campaignId"
      JOIN "ValidatorAccount" account ON account.id = campaign."accountId"
      JOIN "TelegramSession" s ON s.id = membership."sessionId"
      JOIN "TelegramApiCredential" credential ON credential.id = s."credentialId"
      WHERE membership."activeSessionId" = s.id
        AND campaign.status IN ('starting','running') AND account.active = TRUE
        AND account."planExpiresAt" > NOW()
        AND s.status = 'active' AND s."isLoggedIn" = TRUE AND s."spamStatus" <> 'frozen'
        AND (membership."runtimeStatus" <> 'error' OR membership."lastHeartbeatAt" IS NULL
          OR membership."lastHeartbeatAt" < NOW() - INTERVAL '1 minute')''')
    wanted = {f"{row['campaignId']}:{row['id']}": dict(row) for row in rows}
    log.info("AI reconcile: wanted=%d busy=%d connected=%d", len(wanted), len(AI_BUSY_SESSIONS), len(AI_CLIENTS))
    now = asyncio.get_running_loop().time()
    for client_key in list(AI_CLIENTS):
        entry = AI_CLIENTS[client_key]
        if client_key not in wanted:
            await stop_ai_client(pool, client_key)
            continue
        entry["stopRequested"] = False
        if entry["client"].is_connected:
            entry["disconnectedAt"] = None
            continue
        if entry.get("disconnectedAt") is None:
            entry["disconnectedAt"] = now
            continue
        if now - entry["disconnectedAt"] >= max(30, AI_RECONCILE_SECONDS * 3):
            await stop_ai_client(pool, client_key, "error")
    connected_memberships = [entry["record"]["membershipId"] for entry in AI_CLIENTS.values()]
    if connected_memberships:
        await pool.execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = 'stopped',
          "lastHeartbeatAt" = NOW(), "updatedAt" = NOW()
          WHERE "activeSessionId" IS NULL AND "runtimeStatus" = 'stopping'
            AND NOT (id = ANY($1::text[]))''', connected_memberships)
    else:
        await pool.execute('''UPDATE "AiCampaignSession" SET "runtimeStatus" = 'stopped',
          "lastHeartbeatAt" = NOW(), "updatedAt" = NOW()
          WHERE "activeSessionId" IS NULL AND "runtimeStatus" = 'stopping' ''')
    for client_key, record in wanted.items():
        session_id = record["id"]
        if (session_id in AI_BUSY_SESSIONS or session_id in AI_TRANSIENT_CLIENTS
                or session_id in INTERACTIVE_CLIENTS):
            continue
        if any(entry["record"]["id"] == session_id for entry in AI_CLIENTS.values() if entry["record"]["campaignId"] != record["campaignId"]):
            continue
        if client_key not in AI_CLIENTS:
            await start_ai_client(pool, record)
        else:
            await pool.execute('''UPDATE "AiCampaignSession" SET "lastHeartbeatAt" = NOW()
              WHERE id = $1''', record["membershipId"])
            if record.get("catchupRequested") and not any(
                task.get_name() == f"catchup:{client_key}" for task in AI_CATCHUP_TASKS if not task.done()
            ):
                task = asyncio.create_task(run_ai_catchup(pool, record, AI_CLIENTS[client_key]["client"]), name=f"catchup:{client_key}")
                AI_CATCHUP_TASKS.add(task)
                task.add_done_callback(AI_CATCHUP_TASKS.discard)


async def claim_ai_job(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT job.* FROM "AiChatJob" job
          JOIN "AiCampaign" campaign ON campaign.id = job."campaignId"
          JOIN "ValidatorAccount" account ON account.id = campaign."accountId"
          WHERE job.status = 'pending' AND job."runAfter" <= NOW()
            AND campaign.status IN ('starting','running')
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
          AND NOT EXISTS (SELECT 1 FROM "AiChatJob" active WHERE active.status = 'processing'
            AND active."campaignId" = job."campaignId" AND active."sessionId" = job."sessionId"
            AND active."peerId" = job."peerId")
          ORDER BY job."runAfter", job."createdAt" FOR UPDATE OF job SKIP LOCKED LIMIT 1''')
        if row:
            await connection.execute('''UPDATE "AiChatJob" SET status = 'processing', attempts = attempts + 1,
              "claimedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', row["id"])
        return dict(row) if row else None


async def ai_log(pool, job, provider, status, *, response=None, text=None, category=None, outgoing_id=None, error=None):
    request = json_value(job.get("requestPayload"))
    await pool.execute('''INSERT INTO "AiResponseLog"
      (id, "campaignId", "accountId", "sessionId", "jobId", "peerId", "incomingMsgId", "outgoingMsgId", provider,
       status, category, "incomingText", "responseText", "isFollowUp", "didConvert", "errorCode",
       "errorMessage", "providerMeta", "createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,NOW())''',
      f"ail_{uuid.uuid4().hex}", job["campaignId"], job["accountId"], job["sessionId"], job["id"], job["peerId"],
      job.get("incomingMsgId"), outgoing_id, provider, status, category, request.get("incomingText"), text,
      bool(job.get("isFollowUp")), bool(response and response.get("didConvert")), error_code(error) if error else None,
      str(error)[:2000] if error else None, json.dumps(response.get("meta")) if response else None)


async def finish_ai_job(pool, job, status, result=None, error=None, retry=False):
    if retry and int(job["attempts"] or 0) + 1 < int(job["maxAttempts"] or 3):
        delay = 2 ** int(job["attempts"] or 0)
        await pool.execute('''UPDATE "AiChatJob" SET status = 'pending', "runAfter" = NOW() + ($2 * INTERVAL '1 second'),
          "errorCode" = $3, "errorMessage" = $4, "claimedAt" = NULL, "updatedAt" = NOW() WHERE id = $1''',
          job["id"], delay, error_code(error), str(error)[:2000])
        return
    await pool.execute('''UPDATE "AiChatJob" SET status = $2, "resultPayload" = $3::jsonb,
      "errorCode" = $4, "errorMessage" = $5, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
      job["id"], status, json.dumps(result) if result else None, error_code(error) if error else None,
      str(error)[:2000] if error else None)


async def defer_ai_job_for_subscription(pool, job):
    await pool.execute('''UPDATE "AiCampaign" SET status = 'subscription_paused',
      "lastError" = 'AI replies paused until the workspace subscription is renewed',
      "updatedAt" = NOW() WHERE id = $1 AND status IN ('starting','running')''', job["campaignId"])
    await pool.execute('''UPDATE "AiChatJob" SET status = 'pending',
      attempts = GREATEST(0, attempts - 1), "runAfter" = NOW() + INTERVAL '1 minute',
      "claimedAt" = NULL, "errorCode" = 'SUBSCRIPTION_REQUIRED',
      "errorMessage" = 'Waiting for workspace subscription renewal', "updatedAt" = NOW()
      WHERE id = $1''', job["id"])


async def cancel_covered_ai_jobs(pool, job, incoming_id):
    if incoming_id is None:
        return
    await pool.execute('''UPDATE "AiChatJob" SET status = 'cancelled', "finishedAt" = NOW(),
      "resultPayload" = '{"reason":"coalesced_into_previous_reply"}'::jsonb, "updatedAt" = NOW()
      WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3 AND status = 'pending'
        AND "incomingMsgId" IS NOT NULL AND "incomingMsgId" <= $4''',
      job["campaignId"], job["sessionId"], job["peerId"], incoming_id)


async def confirm_ai_outgoing_messages(pool, job):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT id, messages FROM "AiChatMemory"
          WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3 FOR UPDATE''',
          job["campaignId"], job["sessionId"], job["peerId"])
        if not row:
            return
        messages = [
            {**item, "confirmed": True} if not item.get("isIncoming") else item
            for item in json_list(row["messages"])
        ]
        await connection.execute('UPDATE "AiChatMemory" SET messages = $2::jsonb, "updatedAt" = NOW() WHERE id = $1',
          row["id"], json.dumps(messages))


async def process_ai_job(pool, job):
    provider = "capitalbot"
    try:
        context = await pool.fetchrow('''SELECT j.*, s.label, s."firstName", s."lastName", s.username,
          s.status AS "sessionStatus", s."isLoggedIn", s."spamStatus",
          membership.id AS "membershipId", membership."activeSessionId",
          campaign.status AS "campaignStatus", campaign.config AS "campaignConfig",
          campaign.provider, campaign."secretEncrypted", campaign."credentialValid",
          campaign."modelId", campaign."presetId", account.active AS "accountActive",
          account."planExpiresAt"
          FROM "AiChatJob" j JOIN "TelegramSession" s ON s.id = j."sessionId"
          JOIN "AiCampaign" campaign ON campaign.id = j."campaignId"
          JOIN "ValidatorAccount" account ON account.id = campaign."accountId"
          JOIN "AiCampaignSession" membership ON membership."campaignId" = campaign.id
            AND membership."sessionId" = j."sessionId" WHERE j.id = $1''', job["id"])
        if (not context or not context["accountActive"] or not context["planExpiresAt"]
                or as_utc(context["planExpiresAt"]) <= utc_now()):
            await defer_ai_job_for_subscription(pool, job)
            return
        if not context or context["campaignStatus"] not in ("starting", "running") or not context["activeSessionId"]:
            await finish_ai_job(pool, job, "cancelled")
            return
        if context["sessionStatus"] != "active" or not context["isLoggedIn"] or context["spamStatus"] == "frozen":
            raise RuntimeError("AI session is not available")
        chat_enabled = await pool.fetchval('''SELECT enabled FROM "AiChatSetting"
          WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3''',
          job["campaignId"], job["sessionId"], job["peerId"])
        if chat_enabled is False:
            await finish_ai_job(pool, job, "cancelled")
            return
        config = ai_config(context["campaignConfig"], None)
        provider = str(context["provider"])
        if not context["credentialValid"]:
            raise ValueError(f"No valid {provider} credential is configured")
        credential = {
            "id": job["campaignId"], "secretEncrypted": context["secretEncrypted"],
            "modelId": context["modelId"], "presetId": context["presetId"],
        }
        memory = await pool.fetchrow('''SELECT * FROM "AiChatMemory" WHERE "campaignId" = $1
          AND "sessionId" = $2 AND "peerId" = $3''', job["campaignId"], job["sessionId"], job["peerId"])
        if not memory:
            raise ValueError("Conversation memory is empty")
        messages = json_list(memory["messages"])[-config["memoryMessageLimit"]:]
        recipient = json_value(memory["recipient"])
        covered_incoming_id = max(
            (int(item["telegramMessageId"]) for item in messages
             if item.get("isIncoming") and item.get("telegramMessageId") is not None),
            default=None,
        )
        telegram_session = {
            **dict(context),
            "id": context["sessionId"],
        }
        response = await generate_ai_reply(
            provider, credential, config, telegram_session, recipient, messages, bool(job["isFollowUp"])
        )
        await cancel_covered_ai_jobs(pool, job, covered_incoming_id)
        if provider == "cupidbot":
            await confirm_ai_outgoing_messages(pool, job)
        category = response.get("category")
        if category in AI_NOT_OUR_TURN:
            await ai_log(pool, job, provider, "not_our_turn", response=response, category=category)
            await finish_ai_job(pool, job, "not_our_turn", response)
            return
        if category in AI_GHOSTING:
            await pool.execute('''UPDATE "AiChatMemory" SET "conversationState" = 'ghosted', "lastCategory" = $4,
              "updatedAt" = NOW() WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3''',
              job["campaignId"], job["sessionId"], job["peerId"], category)
            await ai_log(pool, job, provider, "ghosting", response=response, category=category)
            await finish_ai_job(pool, job, "ghosting", response)
            return
        text = str(response.get("text") or "").strip()
        if not text:
            status = "converted" if response.get("didConvert") else "no_reply"
            await ai_log(pool, job, provider, status, response=response, category=category)
            await finish_ai_job(pool, job, status, response)
            return
        latest_memory = await pool.fetchval('''SELECT messages FROM "AiChatMemory"
          WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3''',
          job["campaignId"], job["sessionId"], job["peerId"])
        latest_incoming_id = max(
            (int(item["telegramMessageId"]) for item in json_list(latest_memory)
             if item.get("isIncoming") and item.get("telegramMessageId") is not None),
            default=None,
        )
        if covered_incoming_id is not None and latest_incoming_id is not None and latest_incoming_id > covered_incoming_id:
            await ai_log(pool, job, provider, "superseded", response=response, text=text, category=category)
            await finish_ai_job(pool, job, "superseded", {**response, "reason": "newer_incoming_message"})
            return
        client_key = f"{job['campaignId']}:{job['sessionId']}"
        entry = AI_CLIENTS.get(client_key)
        if not entry or not entry["client"].is_connected:
            raise ConnectionError("AI listener is not connected")
        still_active = await pool.fetchval('''SELECT EXISTS(
          SELECT 1 FROM "AiCampaign" campaign JOIN "AiCampaignSession" membership
            ON membership."campaignId" = campaign.id
          WHERE campaign.id = $1 AND campaign.status IN ('starting','running')
            AND membership."sessionId" = $2 AND membership."activeSessionId" = $2)''',
          job["campaignId"], job["sessionId"])
        if not still_active:
            await finish_ai_job(pool, job, "cancelled")
            return
        subscription_active = await pool.fetchval('''SELECT EXISTS(SELECT 1 FROM "ValidatorAccount"
          WHERE id = $1 AND active = TRUE AND "planExpiresAt" > NOW())''', job["accountId"])
        if not subscription_active:
            await defer_ai_job_for_subscription(pool, job)
            return
        sent = await with_session_lock(job["sessionId"], lambda: asyncio.wait_for(
            entry["client"].send_message(int(job["peerId"]), text, parse_mode=enums.ParseMode.DISABLED), timeout=45
        ))
        outgoing = {
            "id": f"tg-ai-{sent.id}", "telegramMessageId": int(sent.id),
            "timestamp": int(datetime.now().timestamp() * 1000), "msg": text, "isIncoming": False,
            "medias": [], "confirmed": False,
        }
        async with pool.acquire() as connection, connection.transaction():
            current = await connection.fetchrow('''SELECT id, messages FROM "AiChatMemory"
              WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3 FOR UPDATE''',
              job["campaignId"], job["sessionId"], job["peerId"])
            stored = json_list(current["messages"])
            if provider == "cupidbot":
                stored = [{**item, "confirmed": True} if not item.get("isIncoming") else item for item in stored]
            stored = (stored + [outgoing])[-config["memoryMessageLimit"]:]
            await connection.execute('''UPDATE "AiChatMemory" SET messages = $2::jsonb, "conversationState" = 'active',
              "lastCategory" = $3, "lastOutgoingAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
              current["id"], json.dumps(stored), category)
            await connection.execute('''UPDATE "TelegramSession" SET "messagesSent" = "messagesSent" + 1,
              "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', job["sessionId"])
            await connection.execute('''UPDATE "AiCampaign" SET "messagesSent" = "messagesSent" + 1,
              "lastError" = NULL, "updatedAt" = NOW() WHERE id = $1''', job["campaignId"])
        await ai_log(pool, job, provider, "sent", response=response, text=text, category=category, outgoing_id=int(sent.id))
        await finish_ai_job(pool, job, "sent", {**response, "text": text, "outgoingMessageId": int(sent.id)})
    except Exception as error:
        campaign_status = await pool.fetchval('SELECT status FROM "AiCampaign" WHERE id = $1', job["campaignId"])
        if campaign_status not in ("starting", "running"):
            await finish_ai_job(pool, job, "cancelled", error=error)
            return
        retry = isinstance(error, (ConnectionError, TimeoutError, FloodWait)) or (isinstance(error, AiProviderError) and error.transient)
        if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
            session = AI_CLIENTS.get(f"{job['campaignId']}:{job['sessionId']}", {}).get("record")
            if session:
                await record_session_signal(pool, session, job["campaignId"], error, getattr(error, "value", 0))
        await ai_log(pool, job, provider, "failed", error=error)
        await finish_ai_job(pool, job, "failed", error=error, retry=retry)
        if not retry or int(job["attempts"] or 0) + 1 >= int(job["maxAttempts"] or 3):
            await pool.execute('''UPDATE "AiCampaign" SET "failedCount" = "failedCount" + 1,
              "lastError" = $2, "updatedAt" = NOW() WHERE id = $1''', job["campaignId"], str(error)[:2000])
        log.warning("AI job %s failed: %s", job["id"], error)


async def ai_job_worker(pool):
    while True:
        job = await claim_ai_job(pool)
        if job:
            await process_ai_job(pool, job)
        else:
            await asyncio.sleep(0.5)


async def scan_ai_reengagement(pool):
    rows = await pool.fetch('''SELECT m.* FROM "AiChatMemory" m
      JOIN "AiCampaign" campaign ON campaign.id = m."campaignId"
      JOIN "ValidatorAccount" account ON account.id = campaign."accountId"
      JOIN "AiCampaignSession" membership ON membership."campaignId" = m."campaignId"
        AND membership."sessionId" = m."sessionId"
      LEFT JOIN "AiChatSetting" cs ON cs."campaignId" = m."campaignId"
        AND cs."sessionId" = m."sessionId" AND cs."peerId" = m."peerId"
      WHERE campaign.status IN ('starting','running') AND campaign."reengageEnabled" = TRUE
        AND account.active = TRUE AND account."planExpiresAt" > NOW()
        AND membership."activeSessionId" = m."sessionId" AND COALESCE(cs.enabled, TRUE) = TRUE
        AND m."conversationState" = 'active' AND m."lastOutgoingAt" > NOW() - INTERVAL '24 hours'
        AND m."lastOutgoingAt" < NOW() - INTERVAL '30 minutes'
        AND NOT EXISTS (SELECT 1 FROM "AiChatJob" j WHERE j."campaignId" = m."campaignId"
          AND j."sessionId" = m."sessionId" AND j."peerId" = m."peerId"
          AND j.status IN ('pending','processing')) ORDER BY m."lastOutgoingAt" LIMIT 8''')
    for row in rows:
        messages = json_list(row["messages"])
        if not messages or messages[-1].get("isIncoming"):
            continue
        state = json_value(row["reengage"])
        count = int(state.get("count", 0))
        if count >= 3:
            continue
        wait_minutes = float(
            state.get("waitMinutes")
            or (random_between(30, 60) if count == 0 else random_between(120, 240))
        )
        reference = datetime.fromtimestamp(float(state.get("lastNudgeAt", 0)) / 1000, timezone.utc) if state.get("lastNudgeAt") else as_utc(row["lastOutgoingAt"])
        if utc_now() - reference < timedelta(minutes=wait_minutes):
            if not state.get("waitMinutes"):
                await pool.execute('UPDATE "AiChatMemory" SET reengage = $2::jsonb WHERE id = $1', row["id"], json.dumps({**state, "waitMinutes": wait_minutes}))
            continue
        await pool.execute('''INSERT INTO "AiChatJob"
          (id, "campaignId", "accountId", "sessionId", "peerId", status, "isFollowUp",
           "requestPayload", "runAfter", "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,'pending',TRUE,$6::jsonb,NOW(),NOW(),NOW())''',
          f"aij_{uuid.uuid4().hex}", row["campaignId"], row["accountId"], row["sessionId"], row["peerId"],
          json.dumps({"incomingText": None, "recipient": row["recipient"]}))
        await pool.execute('''UPDATE "AiChatMemory" SET reengage = $2::jsonb WHERE id = $1''', row["id"], json.dumps({
          "count": count + 1, "lastNudgeAt": int(datetime.now().timestamp() * 1000), "waitMinutes": random_between(120, 240),
        }))
        await asyncio.sleep(3)


async def ai_runtime(pool):
    workers = [asyncio.create_task(ai_job_worker(pool), name=f"ai-job-{index}") for index in range(AI_JOB_CONCURRENCY)]
    last_reconcile = datetime.min.replace(tzinfo=timezone.utc)
    last_reengage = datetime.min.replace(tzinfo=timezone.utc)
    try:
        await pool.execute('''UPDATE "AiChatJob" SET status = 'pending', "claimedAt" = NULL,
          "runAfter" = NOW(), "updatedAt" = NOW() WHERE status = 'processing' ''')
        await pool.execute('''UPDATE "AiChatJob" job SET status = 'cancelled',
          "errorCode" = 'CAMPAIGN_INACTIVE', "errorMessage" = 'Campaign is no longer active',
          "finishedAt" = NOW(), "updatedAt" = NOW() FROM "AiCampaign" campaign
          WHERE campaign.id = job."campaignId"
            AND campaign.status NOT IN ('starting','running','subscription_paused','credit_grace')
            AND job.status = 'pending' ''')
        while True:
            now = utc_now()
            if (now - last_reconcile).total_seconds() >= AI_RECONCILE_SECONDS:
                await reconcile_ai_clients(pool)
                last_reconcile = now
            if (now - last_reengage).total_seconds() >= 300:
                await scan_ai_reengagement(pool)
                last_reengage = now
            await asyncio.sleep(1)
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        for task in list(AI_CATCHUP_TASKS):
            task.cancel()
        await asyncio.gather(*AI_CATCHUP_TASKS, return_exceptions=True)
        for session_id in list(AI_CLIENTS):
            await stop_ai_client(pool, session_id)


def iso_time(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return as_utc(value).isoformat()
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, timezone.utc).isoformat()
    return str(value)


def enum_name(value):
    return str(getattr(value, "value", value) or "").lower()


def peer_value(value):
    text = str(value)
    return int(text) if text.lstrip("-").isdigit() else text


def user_view(user):
    if not user:
        return None
    return {
        "id": str(user.id),
        "firstName": getattr(user, "first_name", None),
        "lastName": getattr(user, "last_name", None),
        "username": getattr(user, "username", None),
        "phone": getattr(user, "phone_number", None),
        "isSelf": bool(getattr(user, "is_self", False)),
        "isContact": bool(getattr(user, "is_contact", False)),
        "isBot": bool(getattr(user, "is_bot", False)),
        "isPremium": bool(getattr(user, "is_premium", False)),
        "isVerified": bool(getattr(user, "is_verified", False)),
        "isRestricted": bool(getattr(user, "is_restricted", False)),
        "status": enum_name(getattr(user, "status", None)) or None,
        "lastOnlineAt": iso_time(getattr(user, "last_online_date", None)),
    }


def chat_view(chat):
    if not chat:
        return None
    title = getattr(chat, "title", None) or " ".join(filter(None, (
        getattr(chat, "first_name", None), getattr(chat, "last_name", None)
    ))) or getattr(chat, "username", None) or str(chat.id)
    return {
        "id": str(chat.id),
        "type": enum_name(getattr(chat, "type", None)) or "unknown",
        "title": title,
        "firstName": getattr(chat, "first_name", None),
        "lastName": getattr(chat, "last_name", None),
        "username": getattr(chat, "username", None),
        "bio": getattr(chat, "bio", None) or getattr(chat, "description", None),
        "membersCount": getattr(chat, "members_count", None),
        "isVerified": bool(getattr(chat, "is_verified", False)),
        "isRestricted": bool(getattr(chat, "is_restricted", False)),
        "isCreator": bool(getattr(chat, "is_creator", False)),
        "isScam": bool(getattr(chat, "is_scam", False)),
        "isFake": bool(getattr(chat, "is_fake", False)),
        "hasProtectedContent": bool(getattr(chat, "has_protected_content", False)),
    }


def media_view(message):
    kind = enum_name(getattr(message, "media", None)) or None
    media = None
    for name in ("photo", "video", "animation", "audio", "voice", "video_note", "document", "sticker"):
        value = getattr(message, name, None)
        if value is not None:
            media = value
            kind = kind or name
            break
    if not media:
        return None
    return {
        "kind": kind,
        "fileName": getattr(media, "file_name", None),
        "mimeType": getattr(media, "mime_type", None),
        "fileSize": getattr(media, "file_size", None),
        "duration": getattr(media, "duration", None),
        "width": getattr(media, "width", None),
        "height": getattr(media, "height", None),
        "emoji": getattr(media, "emoji", None),
    }


def message_view(message):
    if not message:
        return None
    sender = user_view(getattr(message, "from_user", None))
    sender_chat = chat_view(getattr(message, "sender_chat", None))
    return {
        "id": int(message.id),
        "chatId": str(message.chat.id) if getattr(message, "chat", None) else None,
        "text": str(getattr(message, "text", None) or getattr(message, "caption", None) or ""),
        "date": iso_time(getattr(message, "date", None)),
        "editDate": iso_time(getattr(message, "edit_date", None)),
        "outgoing": bool(getattr(message, "outgoing", False)),
        "replyToMessageId": getattr(message, "reply_to_message_id", None),
        "views": getattr(message, "views", None),
        "forwards": getattr(message, "forwards", None),
        "sender": sender,
        "senderChat": sender_chat,
        "media": media_view(message),
        "service": enum_name(getattr(message, "service", None)) or None,
    }


def member_view(member):
    return {
        "user": user_view(getattr(member, "user", None)),
        "status": enum_name(getattr(member, "status", None)) or "member",
        "customTitle": getattr(member, "custom_title", None),
        "joinedAt": iso_time(getattr(member, "joined_date", None)),
        "untilAt": iso_time(getattr(member, "until_date", None)),
        "canBeEdited": bool(getattr(member, "can_be_edited", False)),
    }


def dialog_view(dialog):
    return {
        "chat": chat_view(dialog.chat),
        "topMessage": message_view(dialog.top_message),
        "unreadCount": int(dialog.unread_messages_count or 0),
        "unreadMentions": int(dialog.unread_mentions_count or 0),
        "unreadMark": bool(dialog.unread_mark),
        "pinned": bool(dialog.is_pinned),
    }


def raw_input_peer(peer, users, chats):
    if isinstance(peer, raw.types.PeerUser):
        user = users.get(peer.user_id)
        return raw.types.InputPeerUser(user_id=peer.user_id, access_hash=int(getattr(user, "access_hash", 0) or 0))
    if isinstance(peer, raw.types.PeerChat):
        return raw.types.InputPeerChat(chat_id=peer.chat_id)
    channel = chats.get(peer.channel_id)
    return raw.types.InputPeerChannel(channel_id=peer.channel_id, access_hash=int(getattr(channel, "access_hash", 0) or 0))


async def safe_dialogs(client, limit=0):
    current = 0
    total = int(limit or ((1 << 31) - 1))
    page_limit = min(100, total)
    offset_date = 0
    offset_id = 0
    offset_peer = raw.types.InputPeerEmpty()
    previous_offset = None
    while current < total:
        response = await client.invoke(raw.functions.messages.GetDialogs(
            offset_date=offset_date, offset_id=offset_id, offset_peer=offset_peer,
            limit=min(page_limit, total - current), hash=0,
        ), sleep_threshold=60)
        raw_dialogs = [item for item in (getattr(response, "dialogs", None) or [])
                       if isinstance(item, raw.types.Dialog)]
        if not raw_dialogs:
            return
        users = {item.id: item for item in (getattr(response, "users", None) or [])}
        chats = {item.id: item for item in (getattr(response, "chats", None) or [])}
        messages = {}
        raw_messages = []
        for message in (getattr(response, "messages", None) or []):
            if isinstance(message, raw.types.MessageEmpty):
                continue
            raw_messages.append(message)
            try:
                messages[utils.get_peer_id(message.peer_id)] = await types.Message._parse(
                    client=client, message=message, users=users, chats=chats
                )
            except Exception as error:
                log.debug("Skipping malformed Telegram dialog message: %s", error)
        for raw_dialog in raw_dialogs:
            try:
                dialog = types.Dialog._parse(client, raw_dialog, messages, users, chats)
            except Exception as error:
                log.info("Skipping inaccessible Telegram dialog %s: %s",
                         utils.get_peer_id(raw_dialog.peer), error)
                continue
            if not dialog.chat:
                continue
            yield dialog
            current += 1
            if current >= total:
                return
        last = raw_dialogs[-1]
        offset_id = int(last.top_message or 0)
        peer_id = utils.get_peer_id(last.peer)
        top = next((message for message in raw_messages
                    if utils.get_peer_id(message.peer_id) == peer_id and int(message.id) == offset_id), None)
        top_date = getattr(top, "date", None) if top else None
        offset_date = int(top_date) if isinstance(top_date, (int, float)) else utils.datetime_to_timestamp(top_date) if top_date else 0
        offset_peer = raw_input_peer(last.peer, users, chats)
        next_offset = (offset_date, offset_id, peer_id)
        if next_offset == previous_offset or len(raw_dialogs) < page_limit:
            return
        previous_offset = next_offset


async def interactive_client(record):
    session_id = record.get("sessionId") or record["id"]
    shared = next((entry for entry in AI_CLIENTS.values()
                   if entry["record"]["id"] == session_id and entry["client"].is_connected), None)
    if shared:
        return shared["client"]
    transient = AI_TRANSIENT_CLIENTS.pop(session_id, None)
    if transient and transient["client"].is_connected:
        INTERACTIVE_CLIENTS[session_id] = {
            "client": transient["client"], "lastUsed": utc_now(),
        }
        return transient["client"]
    entry = INTERACTIVE_CLIENTS.get(session_id)
    if entry and entry["client"].is_connected:
        entry["lastUsed"] = utc_now()
        return entry["client"]
    if entry:
        with suppress(Exception):
            await entry["client"].disconnect()
        INTERACTIVE_CLIENTS.pop(session_id, None)
    session_string = canonical_session(
        decrypt(record["sessionDataEncrypted"]), record["sessionFormat"], record["apiId"]
    )
    client = client_for({**record, "id": session_id}, session_string)
    authorized = await asyncio.wait_for(client.connect(), timeout=45)
    if not authorized:
        await disconnect(client)
        raise ValueError("Telegram session is no longer authorized")
    INTERACTIVE_CLIENTS[session_id] = {"client": client, "lastUsed": utc_now()}
    return client


async def close_stale_interactive_clients():
    cutoff = utc_now() - timedelta(minutes=3)
    for session_id, entry in list(INTERACTIVE_CLIENTS.items()):
        lock = CLIENT_COMMAND_LOCKS.get(session_id)
        if entry["lastUsed"] >= cutoff or (lock and lock.locked()):
            continue
        INTERACTIVE_CLIENTS.pop(session_id, None)
        with suppress(Exception):
            await entry["client"].disconnect()


async def claim_client_command(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT command.*, s."credentialId", s."sessionDataEncrypted",
          s."sessionFormat", s.status AS "sessionStatus", s."isLoggedIn", s."deviceIdentity",
          s."proxyEncrypted", s."proxyEnabled", s."antiDetectEnabled", c."apiId", c."apiHashEncrypted",
          account.active AS "accountActive", account."planExpiresAt"
          FROM "TelegramClientCommand" command
          JOIN "TelegramSession" s ON s.id = command."sessionId"
          JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
          JOIN "ValidatorAccount" account ON account.id = command."accountId"
          WHERE command.status = 'pending' AND command."expiresAt" > NOW()
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
          ORDER BY command."createdAt" FOR UPDATE OF command SKIP LOCKED LIMIT 1''')
        if not row:
            return None
        await connection.execute('''UPDATE "TelegramClientCommand" SET status = 'processing', attempts = attempts + 1,
          "claimedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', row["id"])
        return dict(row)


PRIVACY_KEYS = {
    "statusTimestamp": raw.types.InputPrivacyKeyStatusTimestamp,
    "profilePhoto": raw.types.InputPrivacyKeyProfilePhoto,
    "phoneNumber": raw.types.InputPrivacyKeyPhoneNumber,
    "phoneCall": raw.types.InputPrivacyKeyPhoneCall,
    "forwards": raw.types.InputPrivacyKeyForwards,
    "chatInvite": raw.types.InputPrivacyKeyChatInvite,
    "voiceMessages": raw.types.InputPrivacyKeyVoiceMessages,
}
NOTIFY_SCOPES = {
    "users": raw.types.InputNotifyUsers,
    "chats": raw.types.InputNotifyChats,
    "broadcasts": raw.types.InputNotifyBroadcasts,
}
MEMBER_FILTERS = {
    "search": enums.ChatMembersFilter.SEARCH,
    "recent": enums.ChatMembersFilter.RECENT,
    "administrators": enums.ChatMembersFilter.ADMINISTRATORS,
    "bots": enums.ChatMembersFilter.BOTS,
    "restricted": enums.ChatMembersFilter.RESTRICTED,
    "banned": enums.ChatMembersFilter.BANNED,
}


def peer_notify_view(value):
    mute_until = int(getattr(value, "mute_until", 0) or 0)
    return {
        "muted": bool(mute_until and mute_until > int(datetime.now().timestamp())),
        "muteUntil": mute_until,
        "showPreviews": getattr(value, "show_previews", None) is not False,
        "silent": bool(getattr(value, "silent", False)),
    }


async def settings_view(client):
    notifications = {}
    for key, factory in NOTIFY_SCOPES.items():
        value = await client.invoke(raw.functions.account.GetNotifySettings(peer=factory()))
        notifications[key] = {
            "muted": bool(getattr(value, "mute_until", 0) and getattr(value, "mute_until", 0) > int(datetime.now().timestamp())),
            "muteUntil": getattr(value, "mute_until", 0) or 0,
            "showPreviews": getattr(value, "show_previews", None) is not False,
            "silent": bool(getattr(value, "silent", False)),
        }
    privacy = {}
    for key, factory in PRIVACY_KEYS.items():
        value = await client.invoke(raw.functions.account.GetPrivacy(key=factory()))
        names = [rule.__class__.__name__ for rule in (getattr(value, "rules", None) or [])]
        privacy[key] = "nobody" if "PrivacyValueDisallowAll" in names else "contacts" if "PrivacyValueAllowContacts" in names else "everybody"
    authorizations = await client.invoke(raw.functions.account.GetAuthorizations())
    password = await client.invoke(raw.functions.account.GetPassword())
    return {
        "notifications": notifications,
        "privacy": privacy,
        "password": {
            "hasPassword": bool(getattr(password, "has_password", False)),
            "hint": getattr(password, "hint", None),
            "hasRecovery": bool(getattr(password, "has_recovery", False)),
            "emailPattern": getattr(password, "email_unconfirmed_pattern", None),
        },
        "authorizationTtlDays": int(getattr(authorizations, "authorization_ttl_days", 0) or 0),
        "authorizations": [{
            "hash": str(item.hash), "current": bool(item.current), "deviceModel": item.device_model,
            "platform": item.platform, "systemVersion": item.system_version, "appName": item.app_name,
            "appVersion": item.app_version, "ip": item.ip, "country": item.country, "region": item.region,
            "createdAt": iso_time(item.date_created), "activeAt": iso_time(item.date_active),
        } for item in (getattr(authorizations, "authorizations", None) or [])],
    }


async def with_short_flood_retry(operation):
    try:
        return await operation()
    except FloodWait as error:
        wait = int(getattr(error, "value", 0) or 0)
        if wait <= 0 or wait > CLEAR_HISTORY_MAX_FLOOD_SECONDS:
            raise
        await asyncio.sleep(wait + 0.25)
        return await operation()


def input_channel(peer):
    if isinstance(peer, raw.types.InputChannel):
        return peer
    if isinstance(peer, raw.types.InputPeerChannel):
        return raw.types.InputChannel(channel_id=peer.channel_id, access_hash=peer.access_hash)
    raise ValueError("Telegram did not return a channel access hash")


async def clear_one_dialog(client, chat, revoke=False, remove_dialog=True):
    peer = await client.resolve_peer(chat.id)
    chat_type = getattr(chat, "type", None)
    is_private = chat_type in (enums.ChatType.PRIVATE, enums.ChatType.BOT)
    is_bot = chat_type == enums.ChatType.BOT
    is_group = chat_type == enums.ChatType.GROUP
    is_channel = chat_type in (enums.ChatType.SUPERGROUP, enums.ChatType.CHANNEL)
    cleared = left = deleted = blocked = False
    warnings = []
    if is_channel:
        channel = input_channel(peer)
        try:
            await with_short_flood_retry(lambda: client.invoke(raw.functions.channels.DeleteHistory(
                channel=channel, max_id=0, for_everyone=revoke
            )))
            cleared = True
        except Exception as error:
            warnings.append({"stage": "clear_history", "code": error_code(error), "error": str(error)[:300]})
        if remove_dialog:
            if revoke and bool(getattr(chat, "is_creator", False)):
                try:
                    await with_short_flood_retry(lambda: client.invoke(raw.functions.channels.DeleteChannel(channel=channel)))
                    deleted = True
                except Exception as error:
                    warnings.append({"stage": "delete_channel", "code": error_code(error), "error": str(error)[:300]})
            if not deleted:
                await with_short_flood_retry(lambda: client.invoke(raw.functions.channels.LeaveChannel(channel=channel)))
                left = True
    elif is_group:
        await with_short_flood_retry(lambda: client.invoke(raw.functions.messages.DeleteHistory(
            peer=peer, max_id=0, just_clear=True, revoke=revoke
        )))
        cleared = True
        if remove_dialog:
            chat_id = getattr(peer, "chat_id", abs(int(chat.id)))
            if revoke and bool(getattr(chat, "is_creator", False)):
                try:
                    await with_short_flood_retry(lambda: client.invoke(raw.functions.messages.DeleteChat(chat_id=chat_id)))
                    deleted = True
                except Exception as error:
                    warnings.append({"stage": "delete_group", "code": error_code(error), "error": str(error)[:300]})
            if not deleted:
                await with_short_flood_retry(lambda: client.invoke(raw.functions.messages.DeleteChatUser(
                    chat_id=chat_id, user_id=raw.types.InputUserSelf(), revoke_history=revoke
                )))
                left = True
    elif is_private:
        await with_short_flood_retry(lambda: client.invoke(raw.functions.messages.DeleteHistory(
            peer=peer, max_id=0, just_clear=False if is_bot else not revoke, revoke=revoke
        )))
        cleared = True
        deleted = bool(is_bot and remove_dialog)
        if is_bot and remove_dialog:
            with suppress(Exception):
                await client.invoke(raw.functions.contacts.Block(id=peer))
                blocked = True
    else:
        raise ValueError(f"Unsupported Telegram chat type: {chat_type}")
    return {
        "chatId": str(chat.id), "title": chat_view(chat)["title"], "type": enum_name(chat_type),
        "ok": True, "action": "deleted" if deleted else "left" if left else "cleared",
        "cleared": cleared, "left": left, "deleted": deleted, "blocked": blocked,
        "warnings": warnings,
    }


async def execute_client_command(pool, command):
    lock = CLIENT_COMMAND_LOCKS.setdefault(command["sessionId"], asyncio.Lock())
    async with lock:
        if (not command["accountActive"] or not command.get("planExpiresAt")
                or as_utc(command["planExpiresAt"]) <= utc_now()):
            raise SubscriptionRequiredError("Workspace subscription is not active")
        if command["sessionStatus"] != "active" or not command["isLoggedIn"]:
            raise ValueError("Telegram session is not active and logged in")
        client = await interactive_client(command)
        payload = json_value(command.get("payload"))
        kind = command["kind"]
        result = None
        result_data = None
        result_mime = None
        result_name = None
        if kind == "bootstrap":
            me = await client.get_me()
            dialogs = [dialog_view(item) async for item in safe_dialogs(client, limit=200)]
            result = {"me": user_view(me), "dialogs": dialogs}
        elif kind == "dialogs":
            result = {"dialogs": [dialog_view(item) async for item in safe_dialogs(client, limit=int(payload.get("limit") or 200))]}
        elif kind == "messages":
            messages = [message_view(item) async for item in client.get_chat_history(
                int(payload["chatId"]), limit=int(payload.get("limit") or 50), offset_id=int(payload.get("offsetId") or 0)
            )]
            result = {"messages": list(reversed(messages))}
        elif kind == "send_message":
            sent = await client.send_message(int(payload["chatId"]), payload["text"], parse_mode=enums.ParseMode.DISABLED,
                reply_to_message_id=payload.get("replyToMessageId"))
            result = {"message": message_view(sent)}
            await pool.execute('''UPDATE "TelegramSession" SET "messagesSent" = "messagesSent" + 1,
              "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', command["sessionId"])
        elif kind == "edit_message":
            value = await client.edit_message_text(int(payload["chatId"]), int(payload["messageId"]), payload["text"], parse_mode=enums.ParseMode.DISABLED)
            result = {"message": message_view(value)}
        elif kind == "delete_messages":
            count = await client.delete_messages(int(payload["chatId"]), payload["messageIds"], revoke=bool(payload.get("revoke", True)))
            result = {"deleted": int(count or 0), "messageIds": payload["messageIds"]}
        elif kind == "forward_messages":
            value = await client.forward_messages(int(payload["chatId"]), int(payload["fromChatId"]), payload["messageIds"])
            values = value if isinstance(value, list) else [value]
            result = {"messages": [message_view(item) for item in values if item]}
        elif kind == "read_history":
            result = {"read": bool(await client.read_chat_history(int(payload["chatId"]), int(payload.get("maxId") or 0)))}
        elif kind == "search_messages":
            result = {"messages": [message_view(item) async for item in client.search_messages(
                int(payload["chatId"]), payload["query"], limit=int(payload.get("limit") or 50)
            )]}
        elif kind == "pinned_messages":
            result = {"messages": [message_view(item) async for item in client.search_messages(
                int(payload["chatId"]), filter=enums.MessagesFilter.PINNED,
                limit=int(payload.get("limit") or 50)
            )]}
        elif kind == "pin_message":
            await client.pin_chat_message(
                int(payload["chatId"]), int(payload["messageId"]),
                disable_notification=bool(payload.get("disableNotification")),
            )
            result = {"ok": True}
        elif kind == "unpin_message":
            result = {"ok": bool(await client.unpin_chat_message(
                int(payload["chatId"]), int(payload["messageId"])
            ))}
        elif kind == "unpin_all_messages":
            result = {"ok": bool(await client.unpin_all_chat_messages(int(payload["chatId"]))) }
        elif kind == "react_message":
            result = {"ok": bool(await client.send_reaction(
                int(payload["chatId"]), int(payload["messageId"]), payload.get("emoji") or ""
            ))}
        elif kind == "chat":
            result = {"chat": chat_view(await client.get_chat(int(payload["chatId"])))}
        elif kind == "contacts":
            result = {"contacts": [user_view(item) for item in await client.get_contacts()]}
        elif kind == "add_contact":
            user_id = peer_value(payload["userId"])
            await client.add_contact(user_id, payload["firstName"], payload.get("lastName", ""), payload.get("phone", ""))
            result = {"contact": user_view(await client.get_users(user_id))}
        elif kind == "delete_contacts":
            await client.delete_contacts([peer_value(item) for item in payload["userIds"]])
            result = {"deleted": len(payload["userIds"])}
        elif kind in ("block_user", "unblock_user"):
            operation = client.block_user if kind == "block_user" else client.unblock_user
            result = {"ok": bool(await operation(int(payload["userId"])))}
        elif kind == "peer_notify":
            peer = await client.resolve_peer(int(payload["chatId"]))
            notify_peer = raw.types.InputNotifyPeer(peer=peer)
            if "muted" in payload:
                mute_until = int(datetime.now().timestamp()) + int(payload.get("muteUntilSeconds") or 0)
                if payload["muted"] and not payload.get("muteUntilSeconds"):
                    mute_until = 2147483647
                await client.invoke(raw.functions.account.UpdateNotifySettings(
                    peer=notify_peer,
                    settings=raw.types.InputPeerNotifySettings(
                        mute_until=mute_until if payload["muted"] else 0
                    ),
                ))
            value = await client.invoke(raw.functions.account.GetNotifySettings(peer=notify_peer))
            result = {"notification": peer_notify_view(value)}
        elif kind == "common_chats":
            chats = await client.get_common_chats(peer_value(payload["userId"]))
            result = {"chats": [chat_view(item) for item in chats[:int(payload.get("limit") or 100)]]}
        elif kind == "chat_members":
            members = [member_view(item) async for item in client.get_chat_members(
                int(payload["chatId"]), query=payload.get("query") or "",
                limit=int(payload.get("limit") or 100),
                filter=MEMBER_FILTERS.get(payload.get("filter"), enums.ChatMembersFilter.SEARCH),
            )]
            result = {"members": members}
        elif kind == "add_chat_member":
            result = {"ok": bool(await client.add_chat_members(
                int(payload["chatId"]), peer_value(payload["userId"])
            ))}
        elif kind == "remove_chat_member":
            await client.ban_chat_member(int(payload["chatId"]), peer_value(payload["userId"]))
            if not payload.get("ban"):
                await client.unban_chat_member(int(payload["chatId"]), peer_value(payload["userId"]))
            result = {"ok": True}
        elif kind == "set_chat_admin":
            admin = bool(payload["admin"])
            privileges = types.ChatPrivileges(
                can_manage_chat=admin, can_delete_messages=admin,
                can_restrict_members=admin, can_change_info=admin,
                can_invite_users=admin, can_pin_messages=admin,
                can_manage_video_chats=admin, can_manage_topics=admin,
            )
            result = {"ok": bool(await client.promote_chat_member(
                int(payload["chatId"]), peer_value(payload["userId"]), privileges=privileges
            ))}
        elif kind == "update_chat":
            chat_id = int(payload["chatId"])
            if "title" in payload:
                await client.set_chat_title(chat_id, payload["title"])
            if "bio" in payload:
                await client.set_chat_description(chat_id, payload["bio"])
            result = {"chat": chat_view(await client.get_chat(chat_id))}
        elif kind == "set_chat_photo":
            await client.set_chat_photo(
                int(payload["chatId"]),
                photo=account_settings_media_path(command["accountId"], payload["mediaPath"]),
            )
            result = {"ok": True}
        elif kind == "settings":
            result = await settings_view(client)
        elif kind == "update_notify":
            settings = raw.types.InputPeerNotifySettings(
                show_previews=payload.get("showPreviews"), silent=payload.get("silent"),
                mute_until=(2147483647 if payload.get("muted") else 0) if "muted" in payload else None,
            )
            await client.invoke(raw.functions.account.UpdateNotifySettings(peer=NOTIFY_SCOPES[payload["scope"]](), settings=settings))
            result = await settings_view(client)
        elif kind == "update_privacy":
            rule = {"everybody": raw.types.InputPrivacyValueAllowAll, "contacts": raw.types.InputPrivacyValueAllowContacts,
                    "nobody": raw.types.InputPrivacyValueDisallowAll}[payload["value"]]()
            await client.invoke(raw.functions.account.SetPrivacy(key=PRIVACY_KEYS[payload["key"]](), rules=[rule]))
            result = await settings_view(client)
        elif kind == "password":
            action = payload["action"]
            current = decrypt(payload["currentPasswordEncrypted"]).decode() if payload.get("currentPasswordEncrypted") else ""
            new = decrypt(payload["newPasswordEncrypted"]).decode() if payload.get("newPasswordEncrypted") else ""
            if action == "enable":
                await client.enable_cloud_password(new, payload.get("hint", ""), payload.get("email") or None)
            elif action == "change":
                await client.change_cloud_password(current, new, payload.get("hint", ""))
            else:
                await client.remove_cloud_password(current)
            result = await settings_view(client)
        elif kind == "reset_authorization":
            await client.invoke(raw.functions.account.ResetAuthorization(hash=int(payload["hash"])))
            result = await settings_view(client)
        elif kind == "reset_other_authorizations":
            await client.invoke(raw.functions.auth.ResetAuthorizations())
            result = await settings_view(client)
        elif kind == "authorization_ttl":
            await client.invoke(raw.functions.account.SetAuthorizationTTL(authorization_ttl_days=int(payload["days"])))
            result = await settings_view(client)
        elif kind == "update_profile":
            await client.update_profile(payload["firstName"], payload.get("lastName", ""), payload.get("bio", ""))
            result = {"me": user_view(await client.get_me())}
        elif kind == "set_username":
            await client.set_username(payload.get("username") or None)
            result = {"me": user_view(await client.get_me())}
        elif kind == "set_profile_photo":
            await client.set_profile_photo(photo=account_settings_media_path(command["accountId"], payload["mediaPath"]))
            result = {"ok": True}
        elif kind == "send_media":
            path = account_settings_media_path(command["accountId"], payload["mediaPath"])
            common = {"caption": payload.get("caption", ""), "parse_mode": enums.ParseMode.DISABLED,
                      "reply_to_message_id": payload.get("replyToMessageId")}
            media_type = payload["mediaType"]
            if media_type == "photo":
                sent = await client.send_photo(int(payload["chatId"]), path, **common)
            elif media_type == "video":
                sent = await client.send_video(int(payload["chatId"]), path, file_name=payload.get("fileName"), **common)
            elif media_type == "audio":
                sent = await client.send_audio(int(payload["chatId"]), path, file_name=payload.get("fileName"), **common)
            elif media_type == "voice":
                sent = await client.send_voice(int(payload["chatId"]), path, **common)
            else:
                sent = await client.send_document(int(payload["chatId"]), path, file_name=payload.get("fileName"), **common)
            result = {"message": message_view(sent)}
        elif kind == "download_media":
            message = await client.get_messages(int(payload["chatId"]), int(payload["messageId"]))
            downloaded = await client.download_media(message, in_memory=True)
            if not downloaded:
                raise FileNotFoundError("Telegram media is no longer available")
            result_data = downloaded.getvalue()
            if len(result_data) > 25 * 1024 * 1024:
                raise ValueError("Telegram media is larger than the 25MB client limit")
            media = media_view(message) or {}
            result_name = media.get("fileName") or f"telegram-{message.id}"
            result_mime = media.get("mimeType") or mimetypes.guess_type(result_name)[0] or "application/octet-stream"
            result = {"messageId": int(message.id), "size": len(result_data)}
        elif kind in ("archive_chat", "unarchive_chat"):
            operation = client.archive_chats if kind == "archive_chat" else client.unarchive_chats
            result = {"ok": bool(await operation(int(payload["chatId"])))}
        elif kind == "leave_chat":
            await client.leave_chat(int(payload["chatId"]))
            result = {"ok": True}
        elif kind == "clear_chat":
            chat = await client.get_chat(int(payload["chatId"]))
            result = await clear_one_dialog(client, chat, bool(payload.get("revoke")), remove_dialog=False)
        else:
            raise ValueError(f"Unsupported Telegram client command: {kind}")
        await pool.execute('''UPDATE "TelegramClientCommand" SET status = 'completed', payload = NULL,
          result = $2::jsonb, "resultData" = $3, "resultMime" = $4, "resultName" = $5,
          "errorCode" = NULL, "errorMessage" = NULL, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
          command["id"], json.dumps(result or {}), result_data, result_mime, result_name)


async def client_command_worker(pool):
    while True:
        command = await claim_client_command(pool)
        if not command:
            await asyncio.sleep(0.35)
            continue
        try:
            await execute_client_command(pool, command)
        except Exception as error:
            log.warning("Telegram client command %s failed: %s", command["id"], error)
            if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
                with suppress(Exception):
                    await record_session_signal(pool, {**command, "id": command["sessionId"]}, None, error, getattr(error, "value", 0))
            await pool.execute('''UPDATE "TelegramClientCommand" SET status = 'failed', payload = NULL,
              "errorCode" = $2, "errorMessage" = $3, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
              command["id"], error_code(error), str(error)[:2000])


async def client_command_runtime(pool):
    await pool.execute('''UPDATE "TelegramClientCommand" SET status = 'pending', "claimedAt" = NULL,
      "updatedAt" = NOW() WHERE status = 'processing' ''')
    workers = [asyncio.create_task(client_command_worker(pool), name=f"telegram-client-{index}")
               for index in range(CLIENT_COMMAND_CONCURRENCY)]
    try:
        while True:
            await pool.execute('''UPDATE "TelegramClientCommand" SET status = 'expired', payload = NULL,
              "errorCode" = 'EXPIRED', "errorMessage" = 'Command expired before processing',
              "finishedAt" = NOW(), "updatedAt" = NOW() WHERE status = 'pending' AND "expiresAt" <= NOW()''')
            await pool.execute('''DELETE FROM "TelegramClientCommand" WHERE "expiresAt" < NOW() - INTERVAL '1 hour' ''')
            await close_stale_interactive_clients()
            await asyncio.sleep(15)
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        for entry in list(INTERACTIVE_CLIENTS.values()):
            with suppress(Exception):
                await entry["client"].disconnect()
        INTERACTIVE_CLIENTS.clear()


async def account_settings_tables_exist(pool):
    return bool(await pool.fetchval('''SELECT to_regclass('public."TelegramAccountSettingsJob"')'''))


async def sync_account_settings_batch(pool, batch_id):
    await pool.execute('''WITH counts AS (
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('completed','failed','skipped','cancelled'))::int AS processed,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status IN ('skipped','cancelled'))::int AS skipped,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM "TelegramAccountSettingsJob" WHERE "batchId" = $1
      ) UPDATE "TelegramAccountSettingsBatch" b SET
        "totalCount" = counts.total, "processedCount" = counts.processed,
        "succeededCount" = counts.succeeded, "failedCount" = counts.failed,
        "skippedCount" = counts.skipped,
        status = CASE
          WHEN counts.processed = counts.total AND b."cancelRequested" THEN 'cancelled'
          WHEN counts.processed = counts.total AND counts.succeeded = 0 AND counts.failed > 0 THEN 'failed'
          WHEN counts.processed = counts.total THEN 'completed'
          WHEN counts.processing > 0 OR counts.processed > 0 THEN 'running'
          ELSE 'pending' END,
        "startedAt" = CASE WHEN counts.processing > 0 OR counts.processed > 0
          THEN COALESCE(b."startedAt", NOW()) ELSE b."startedAt" END,
        "finishedAt" = CASE WHEN counts.processed = counts.total THEN COALESCE(b."finishedAt", NOW()) ELSE NULL END,
        "updatedAt" = NOW()
      FROM counts WHERE b.id = $1''', batch_id)


async def recover_account_settings_jobs(pool):
    if not await account_settings_tables_exist(pool):
        return
    batch_ids = await pool.fetch('''UPDATE "TelegramAccountSettingsJob" SET status = 'pending',
      "claimedAt" = NULL, "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW()
      WHERE status = 'processing' RETURNING "batchId"''')
    for batch_id in {row["batchId"] for row in batch_ids}:
        await sync_account_settings_batch(pool, batch_id)


async def claim_account_settings_job(pool):
    if not await account_settings_tables_exist(pool):
        return None
    cancelled = await pool.fetch('''UPDATE "TelegramAccountSettingsJob" j
      SET status = 'cancelled', "result" = '{"skipReason":"cancelled"}'::jsonb,
        "errorCode" = 'CANCELLED', "errorMessage" = 'Cancelled before processing',
        "finishedAt" = NOW(), "updatedAt" = NOW()
      FROM "TelegramAccountSettingsBatch" b WHERE b.id = j."batchId"
        AND b."cancelRequested" = TRUE AND j.status = 'pending' RETURNING j."batchId"''')
    for batch_id in {item["batchId"] for item in cancelled}:
        await sync_account_settings_batch(pool, batch_id)
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT j.* FROM "TelegramAccountSettingsJob" j
          JOIN "TelegramAccountSettingsBatch" b ON b.id = j."batchId"
          JOIN "ValidatorAccount" account ON account.id = j."accountId"
          WHERE j.status = 'pending' AND b."cancelRequested" = FALSE
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
          ORDER BY j."createdAt", j.position FOR UPDATE OF j SKIP LOCKED LIMIT 1''')
        if not row:
            return None
        await connection.execute('''UPDATE "TelegramAccountSettingsJob" SET status = 'processing',
          attempts = attempts + 1, "claimedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', row["id"])
        await connection.execute('''UPDATE "TelegramAccountSettingsBatch" SET status = 'running',
          "startedAt" = COALESCE("startedAt", NOW()), "updatedAt" = NOW() WHERE id = $1''', row["batchId"])
        return dict(row)


def account_settings_media_path(account_id, token):
    if not isinstance(token, str) or not token:
        raise ValueError("Account-settings media is missing")
    normalized = token.replace("\\", "/").lstrip("/")
    if normalized.startswith("avatars/"):
        root = ACCOUNT_SETTINGS_AVATAR_ROOT
        relative = normalized[len("avatars/"):]
    else:
        if not normalized.startswith(f"{account_id}/"):
            raise PermissionError("Account-settings media does not belong to this account")
        root = ACCOUNT_SETTINGS_MEDIA_ROOT
        relative = normalized
    resolved = os.path.realpath(os.path.join(root, relative))
    if os.path.commonpath([root, resolved]) != root or not os.path.isfile(resolved):
        raise FileNotFoundError("Account-settings media was not found")
    return resolved


async def delete_profile_photos(client):
    deleted = 0
    while True:
        photos = await client.invoke(raw.functions.photos.GetUserPhotos(
            user_id=raw.types.InputUserSelf(), offset=0, max_id=0, limit=100
        ))
        values = list(getattr(photos, "photos", []) or [])
        if not values:
            break
        ids = [raw.types.InputPhoto(id=photo.id, access_hash=photo.access_hash,
          file_reference=photo.file_reference) for photo in values]
        for index in range(0, len(ids), 30):
            await client.invoke(raw.functions.photos.DeletePhotos(id=ids[index:index + 30]))
        deleted += len(ids)
        if len(values) < 100:
            break
    return deleted


async def upload_profile_photo(client, account_id, token):
    path = account_settings_media_path(account_id, token)
    uploaded = await client.save_file(path)
    await client.invoke(raw.functions.photos.UploadProfilePhoto(file=uploaded))
    return os.path.basename(path)


async def send_account_story(client, account_id, payload):
    me = await client.get_me()
    if not bool(getattr(me, "is_premium", False)):
        return "skipped", {"skipReason": "not_premium"}
    peer = raw.types.InputPeerSelf()
    if not await client.invoke(raw.functions.stories.CanSendStory(peer=peer)):
        return "skipped", {"skipReason": "story_limit"}
    media_path = account_settings_media_path(account_id, payload.get("mediaPath"))
    uploaded = await client.save_file(media_path)
    if payload.get("mediaType") == "video":
        media = raw.types.InputMediaUploadedDocument(
            file=uploaded, mime_type=payload.get("mimeType") or "video/mp4",
            attributes=[
                raw.types.DocumentAttributeVideo(duration=0, w=720, h=1280, supports_streaming=True),
                raw.types.DocumentAttributeFilename(file_name=os.path.basename(media_path)),
            ],
        )
    else:
        media = raw.types.InputMediaUploadedPhoto(file=uploaded)
    privacy = {
        "contacts": raw.types.InputPrivacyValueAllowContacts,
        "close_friends": raw.types.InputPrivacyValueAllowCloseFriends,
    }.get(payload.get("privacy"), raw.types.InputPrivacyValueAllowAll)()
    caption = str(payload.get("caption") or "")
    link = str(payload.get("linkUrl") or "")
    entities = None
    if link:
        caption = f"{caption}\n{link}" if caption else link
        entities = [raw.types.MessageEntityTextUrl(
            offset=len(caption) - len(link), length=len(link), url=link
        )]
    result = await client.invoke(raw.functions.stories.SendStory(
        peer=peer, media=media, privacy_rules=[privacy], random_id=int.from_bytes(os.urandom(8), "big", signed=True),
        pinned=bool(payload.get("pinToProfile")), caption=caption or None, entities=entities,
        period=int(payload.get("periodSeconds") or 86400),
    ))
    return "completed", {"success": True, "updates": result.__class__.__name__}


async def clear_session_history(pool, job, record, client, payload):
    revoke = bool(payload.get("revoke"))
    concurrency = max(1, min(16, int(payload.get("concurrency") or 8)))
    await pool.execute('''UPDATE "TelegramAccountSettingsJob" SET result = $2::jsonb,
      "updatedAt" = NOW() WHERE id = $1''', job["id"], json.dumps({
        "stage": "scanning", "total": 0, "processed": 0, "succeeded": 0, "failed": 0,
        "cleared": 0, "left": 0, "deleted": 0, "blocked": 0, "revoke": revoke, "results": [],
    }))
    dialogs = []
    async for dialog in safe_dialogs(client, limit=CLEAR_HISTORY_DIALOG_LIMIT):
        if dialog and dialog.chat:
            dialogs.append(dialog)
    state = {
        "stage": "running", "total": len(dialogs), "processed": 0, "succeeded": 0, "failed": 0,
        "cleared": 0, "left": 0, "deleted": 0, "blocked": 0, "revoke": revoke, "results": [],
        "currentTitle": None,
    }
    await pool.execute('''UPDATE "TelegramAccountSettingsJob" SET result = $2::jsonb,
      "updatedAt" = NOW() WHERE id = $1''', job["id"], json.dumps(state))
    next_index = 0
    progress_lock = asyncio.Lock()
    last_flush = datetime.min.replace(tzinfo=timezone.utc)

    async def flush(force=False):
        nonlocal last_flush
        now = utc_now()
        if not force and state["processed"] % 10 and (now - last_flush).total_seconds() < 0.75:
            return
        last_flush = now
        await pool.execute('''UPDATE "TelegramAccountSettingsJob" SET result = $2::jsonb,
          "updatedAt" = NOW() WHERE id = $1''', job["id"], json.dumps(state))

    async def run_dialog(dialog):
        chat = dialog.chat
        try:
            value = await clear_one_dialog(client, chat, revoke=revoke, remove_dialog=True)
        except Exception as error:
            value = {
                "chatId": str(chat.id), "title": chat_view(chat)["title"],
                "type": enum_name(getattr(chat, "type", None)), "ok": False,
                "action": None, "cleared": False, "left": False, "deleted": False,
                "blocked": False, "errorCode": error_code(error), "error": str(error)[:500],
            }
        async with progress_lock:
            state["processed"] += 1
            state["succeeded" if value["ok"] else "failed"] += 1
            for key in ("cleared", "left", "deleted", "blocked"):
                state[key] += int(bool(value.get(key)))
            state["currentTitle"] = value.get("title")
            state["results"] = ([value] + state["results"])[:250]
            await flush()

    async def worker():
        nonlocal next_index
        while True:
            index = next_index
            next_index += 1
            if index >= len(dialogs):
                return
            if index % 8 == 0:
                cancelled = await pool.fetchval('''SELECT "cancelRequested" FROM "TelegramAccountSettingsBatch"
                  WHERE id = $1''', job["batchId"])
                if cancelled:
                    return
            await run_dialog(dialogs[index])

    if dialogs:
        await asyncio.gather(*(worker() for _ in range(min(concurrency, len(dialogs)))))
    cancelled = bool(await pool.fetchval('''SELECT "cancelRequested" FROM "TelegramAccountSettingsBatch"
      WHERE id = $1''', job["batchId"]))
    state["stage"] = "cancelled" if cancelled and state["processed"] < state["total"] else "completed"
    state["currentTitle"] = None
    await flush(force=True)
    return ("cancelled" if state["stage"] == "cancelled" else "completed"), state


async def finish_account_settings_job(pool, job, status, result=None, error=None):
    await pool.execute('''UPDATE "TelegramAccountSettingsJob" SET status = $2, "result" = $3::jsonb,
      "errorCode" = $4, "errorMessage" = $5, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
      job["id"], status, json.dumps(result) if result is not None else None,
      error_code(error) if error else None, str(error)[:2000] if error else None)
    await sync_account_settings_batch(pool, job["batchId"])


async def _execute_account_settings_job(pool, job):
    session = await pool.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted",
      account.active AS "accountActive", account."planExpiresAt"
      FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
      JOIN "ValidatorAccount" account ON account.id = s."accountId"
      WHERE s.id = $1 AND s."accountId" = $2''', job["sessionId"], job["accountId"])
    if not session:
        await finish_account_settings_job(pool, job, "failed", error=ValueError("Session not found"))
        return
    record = dict(session)
    client = None
    try:
        if (not record["accountActive"] or not record.get("planExpiresAt")
                or as_utc(record["planExpiresAt"]) <= utc_now()):
            raise SubscriptionRequiredError("Workspace subscription is not active")
        if record["status"] != "active" or not record["isLoggedIn"]:
            await finish_account_settings_job(pool, job, "skipped", {"skipReason": "not_connected"})
            return
        client = await open_campaign_client(record)
        payload = json_value(job.get("payload"))
        result = {"success": True}
        if job["action"] == "update_profile":
            flags = payload.get("updateFlags") or {}
            modes = payload.get("fieldModes") or {}
            profile_fields = {}
            if flags.get("firstName"):
                profile_fields["first_name"] = payload.get("firstName", "")
            if flags.get("lastName"):
                profile_fields["last_name"] = "" if modes.get("lastName") == "remove" else payload.get("lastName", "")
            if flags.get("bio"):
                profile_fields["about"] = "" if modes.get("bio") == "remove" else payload.get("bio", "")
            if profile_fields:
                await client.invoke(raw.functions.account.UpdateProfile(**profile_fields))
            if flags.get("username"):
                username = "" if modes.get("username") == "remove" else payload.get("username", "")
                await client.invoke(raw.functions.account.UpdateUsername(username=username))
            if flags.get("profilePhoto"):
                if modes.get("profilePhoto") == "remove":
                    result["deletedPhotos"] = await delete_profile_photos(client)
                else:
                    result["photo"] = await upload_profile_photo(client, job["accountId"], payload.get("profilePhotoPath"))
        elif job["action"] == "remove_photos":
            result["deletedPhotos"] = await delete_profile_photos(client)
        elif job["action"] == "set_photo":
            result["photo"] = await upload_profile_photo(client, job["accountId"], payload.get("photoPath"))
        elif job["action"] == "send_story":
            status, result = await send_account_story(client, job["accountId"], payload)
            await finish_account_settings_job(pool, job, status, result)
            return
        elif job["action"] == "clear_history":
            status, result = await clear_session_history(pool, job, record, client, payload)
            await finish_account_settings_job(pool, job, status, result)
            return
        else:
            raise ValueError(f"Unsupported account-settings action: {job['action']}")
        await finish_account_settings_job(pool, job, "completed", result)
    except Exception as error:
        if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
            with suppress(Exception):
                await record_session_signal(pool, record, None, error, getattr(error, "value", 0))
        await finish_account_settings_job(pool, job, "failed", error=error)
        log.warning("Account settings job %s failed: %s", job["id"], error)
    finally:
        await disconnect(client)


async def execute_account_settings_job(pool, job):
    lock = CLIENT_COMMAND_LOCKS.setdefault(job["sessionId"], asyncio.Lock())
    async with lock:
        await _execute_account_settings_job(pool, job)


async def account_settings_worker(pool):
    while True:
        job = await claim_account_settings_job(pool)
        if job:
            await execute_account_settings_job(pool, job)
        else:
            await asyncio.sleep(0.35)


async def account_settings_runtime(pool):
    workers = [asyncio.create_task(account_settings_worker(pool), name=f"account-settings-{index}")
               for index in range(ACCOUNT_SETTINGS_CONCURRENCY)]
    try:
        await asyncio.gather(*workers)
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def draft_tables_exist(pool):
    return bool(await pool.fetchval('''SELECT to_regclass('public."TelegramDraftSessionJob"')'''))


async def sync_draft_job(pool, draft_job_id):
    await pool.execute('''WITH session_counts AS (
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('completed','failed','skipped','cancelled'))::int AS processed,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status IN ('skipped','cancelled'))::int AS skipped,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
          COALESCE(SUM("totalChats"), 0)::int AS total_chats
        FROM "TelegramDraftSessionJob" WHERE "draftJobId" = $1
      ), result_counts AS (
        SELECT COUNT(*)::int AS processed_chats,
          COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
          COUNT(*) FILTER (WHERE status = 'filtered')::int AS filtered,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
        FROM "TelegramDraftResult" WHERE "draftJobId" = $1
      ) UPDATE "TelegramDraftJob" job SET
        "totalSessions" = session_counts.total,
        "processedSessions" = session_counts.processed,
        "completedSessions" = session_counts.completed,
        "failedSessions" = session_counts.failed,
        "skippedSessions" = session_counts.skipped,
        "totalChats" = session_counts.total_chats,
        "processedChats" = result_counts.processed_chats,
        "draftedChats" = result_counts.drafted,
        "filteredChats" = result_counts.filtered,
        "failedChats" = result_counts.failed,
        status = CASE
          WHEN session_counts.processed = session_counts.total AND job."cancelRequested" THEN 'cancelled'
          WHEN session_counts.processed = session_counts.total
            AND session_counts.completed = 0 AND session_counts.failed > 0 THEN 'failed'
          WHEN session_counts.processed = session_counts.total THEN 'completed'
          WHEN job.status = 'paused_subscription' THEN 'paused_subscription'
          WHEN session_counts.processing > 0 OR session_counts.processed > 0 THEN 'running'
          ELSE 'pending' END,
        "startedAt" = CASE
          WHEN session_counts.processing > 0 OR session_counts.processed > 0
            THEN COALESCE(job."startedAt", NOW()) ELSE job."startedAt" END,
        "finishedAt" = CASE WHEN session_counts.processed = session_counts.total
          THEN COALESCE(job."finishedAt", NOW()) ELSE NULL END,
        "lastProgressAt" = NOW(), "updatedAt" = NOW()
      FROM session_counts, result_counts WHERE job.id = $1''', draft_job_id)


async def recover_draft_jobs(pool):
    if not await draft_tables_exist(pool):
        return
    rows = await pool.fetch('''UPDATE "TelegramDraftSessionJob" SET status = 'pending',
      "claimedAt" = NULL, "currentChatTitle" = NULL, "errorCode" = NULL,
      "errorMessage" = NULL, "finishedAt" = NULL, "updatedAt" = NOW()
      WHERE status = 'processing' RETURNING "draftJobId"''')
    for draft_job_id in {row["draftJobId"] for row in rows}:
        await sync_draft_job(pool, draft_job_id)


async def claim_draft_session_job(pool):
    if not await draft_tables_exist(pool):
        return None
    await pool.execute('''UPDATE "TelegramDraftJob" draft_job
      SET status = 'paused_subscription',
        "errorMessage" = 'Draft placement paused until the workspace subscription is renewed',
        "lastProgressAt" = NOW(), "updatedAt" = NOW()
      FROM "ValidatorAccount" account WHERE account.id = draft_job."accountId"
        AND draft_job.status IN ('pending','running') AND draft_job."cancelRequested" = FALSE
        AND (account.active = FALSE OR account."planExpiresAt" IS NULL
          OR account."planExpiresAt" <= NOW())
        AND EXISTS (SELECT 1 FROM "TelegramDraftSessionJob" session_job
          WHERE session_job."draftJobId" = draft_job.id AND session_job.status = 'pending')''')
    cancelled = await pool.fetch('''UPDATE "TelegramDraftSessionJob" session_job
      SET status = 'cancelled', result = '{"skipReason":"cancelled"}'::jsonb,
        "errorCode" = 'CANCELLED', "errorMessage" = 'Cancelled before processing',
        "finishedAt" = NOW(), "updatedAt" = NOW()
      FROM "TelegramDraftJob" draft_job WHERE draft_job.id = session_job."draftJobId"
        AND draft_job."cancelRequested" = TRUE AND session_job.status = 'pending'
      RETURNING session_job."draftJobId"''')
    for draft_job_id in {item["draftJobId"] for item in cancelled}:
        await sync_draft_job(pool, draft_job_id)
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT session_job.*,
            draft_job.message, draft_job.scope, draft_job."filterWords", draft_job."historyDepth"
          FROM "TelegramDraftSessionJob" session_job
          JOIN "TelegramDraftJob" draft_job ON draft_job.id = session_job."draftJobId"
          JOIN "ValidatorAccount" account ON account.id = draft_job."accountId"
          WHERE session_job.status = 'pending' AND draft_job."cancelRequested" = FALSE
            AND account.active = TRUE AND account."planExpiresAt" > NOW()
          ORDER BY session_job."createdAt", session_job.position
          FOR UPDATE OF session_job SKIP LOCKED LIMIT 1''')
        if not row:
            return None
        await connection.execute('''UPDATE "TelegramDraftSessionJob" SET status = 'processing',
          attempts = attempts + 1, "claimedAt" = NOW(), "finishedAt" = NULL,
          "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW() WHERE id = $1''', row["id"])
        await connection.execute('''UPDATE "TelegramDraftJob" SET status = 'running',
          "errorMessage" = NULL, "startedAt" = COALESCE("startedAt", NOW()),
          "lastProgressAt" = NOW(), "updatedAt" = NOW()
          WHERE id = $1''', row["draftJobId"])
        return dict(row)


def draft_chat_in_scope(chat, scope, self_id):
    chat_type = enum_name(getattr(chat, "type", None))
    if int(chat.id) == int(self_id):
        return False
    if chat_type in ("private", "bot"):
        return scope in ("dms", "both")
    if chat_type in ("group", "supergroup"):
        return scope in ("groups", "both")
    return False


async def save_draft_result(pool, job, chat, status, *, matched_filter=None,
                            inspected_messages=0, error=None):
    view = chat_view(chat)
    result_id = f"tgdr_{uuid.uuid4().hex}"
    async with pool.acquire() as connection, connection.transaction():
        inserted = await connection.fetchval('''INSERT INTO "TelegramDraftResult"
          (id, "draftJobId", "draftSessionJobId", "chatId", "chatTitle", "chatUsername",
           "chatType", status, "matchedFilter", "inspectedMessages", "errorCode", "errorMessage",
           "createdAt", "updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
          ON CONFLICT ("draftSessionJobId", "chatId") DO NOTHING RETURNING id''',
          result_id, job["draftJobId"], job["id"], int(chat.id), str(view["title"])[:255],
          str(view.get("username"))[:100] if view.get("username") else None,
          str(view["type"])[:30], status, matched_filter[:100] if matched_filter else None,
          int(inspected_messages), error_code(error) if error else None,
          str(error)[:2000] if error else None)
        if inserted:
            await connection.execute('''UPDATE "TelegramDraftSessionJob" SET
              "processedChats" = "processedChats" + 1,
              "draftedChats" = "draftedChats" + $2,
              "filteredChats" = "filteredChats" + $3,
              "failedChats" = "failedChats" + $4,
              "currentChatTitle" = $5, "updatedAt" = NOW() WHERE id = $1''',
              job["id"], int(status == "drafted"), int(status == "filtered"),
              int(status == "failed"), str(view["title"])[:255])
    return bool(inserted)


async def finish_draft_session_job(pool, job, status, result=None, error=None):
    await pool.execute('''UPDATE "TelegramDraftSessionJob" SET status = $2,
      result = COALESCE($3::jsonb, result), "errorCode" = $4, "errorMessage" = $5,
      "currentChatTitle" = NULL, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
      job["id"], status, json.dumps(result) if result is not None else None,
      error_code(error) if error else None, str(error)[:2000] if error else None)
    await sync_draft_job(pool, job["draftJobId"])


async def process_draft_session(pool, job, client):
    filters_to_skip = [str(item).strip() for item in json_list(job.get("filterWords")) if str(item).strip()]
    normalized_filters = [(item, item.casefold()) for item in filters_to_skip]
    history_depth = max(1, min(10, int(job.get("historyDepth") or 10)))
    me = await client.get_me()
    dialogs = []
    async for dialog in safe_dialogs(client):
        if dialog and dialog.chat and draft_chat_in_scope(dialog.chat, job["scope"], me.id):
            dialogs.append(dialog)
    existing_chat_ids = {int(row["chatId"]) for row in await pool.fetch(
      '''SELECT "chatId" FROM "TelegramDraftResult" WHERE "draftSessionJobId" = $1''', job["id"]
    )}
    await pool.execute('''UPDATE "TelegramDraftSessionJob" SET "totalChats" = $2,
      "updatedAt" = NOW() WHERE id = $1''', job["id"], max(len(dialogs), len(existing_chat_ids)))
    await sync_draft_job(pool, job["draftJobId"])

    for index, dialog in enumerate(dialogs):
        chat = dialog.chat
        if int(chat.id) in existing_chat_ids:
            continue
        if index % 5 == 0:
            state = await pool.fetchrow('''SELECT draft_job."cancelRequested",
                account.active AND account."planExpiresAt" > NOW() AS "subscriptionActive"
              FROM "TelegramDraftJob" draft_job JOIN "ValidatorAccount" account
                ON account.id = draft_job."accountId" WHERE draft_job.id = $1''', job["draftJobId"])
            if not state or state["cancelRequested"]:
                return "cancelled", {"skipReason": "cancelled"}
            if not state["subscriptionActive"]:
                raise SubscriptionRequiredError(
                    "Workspace subscription expired while draft placement was running"
                )
        inspected = 0
        try:
            matched_filter = None
            async for history_message in client.get_chat_history(chat.id, limit=history_depth):
                inspected += 1
                text = str(getattr(history_message, "text", None)
                           or getattr(history_message, "caption", None) or "").casefold()
                if not matched_filter:
                    matched_filter = next((original for original, normalized in normalized_filters
                                           if normalized in text), None)
            if matched_filter:
                await save_draft_result(pool, job, chat, "filtered",
                                        matched_filter=matched_filter, inspected_messages=inspected)
            else:
                peer = await client.resolve_peer(chat.id)
                await client.invoke(raw.functions.messages.SaveDraft(
                    peer=peer, message=job["message"]
                ), sleep_threshold=60)
                await save_draft_result(pool, job, chat, "drafted", inspected_messages=inspected)
        except Exception as error:
            await save_draft_result(pool, job, chat, "failed",
                                    inspected_messages=inspected, error=error)
            if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
                raise
        if index % 5 == 4:
            await sync_draft_job(pool, job["draftJobId"])
    return "completed", {"success": True}


async def _execute_draft_session_job(pool, job):
    session = await pool.fetchrow('''SELECT session.*, credential."apiId", credential."apiHashEncrypted",
        account.active AS "accountActive", account."planExpiresAt"
      FROM "TelegramSession" session
      JOIN "TelegramApiCredential" credential ON credential.id = session."credentialId"
      JOIN "ValidatorAccount" account ON account.id = session."accountId"
      WHERE session.id = $1 AND session."accountId" = (
        SELECT "accountId" FROM "TelegramDraftJob" WHERE id = $2
      )''', job["sessionId"], job["draftJobId"])
    if not session:
        await finish_draft_session_job(pool, job, "failed", error=ValueError("Session not found"))
        return
    record = dict(session)
    client = None
    try:
        if (not record["accountActive"] or not record.get("planExpiresAt")
                or as_utc(record["planExpiresAt"]) <= utc_now()):
            raise SubscriptionRequiredError("Workspace subscription is not active")
        if record["status"] != "active" or not record["isLoggedIn"]:
            await finish_draft_session_job(pool, job, "skipped", {"skipReason": "not_connected"})
            return
        if record.get("spamStatus") == "frozen":
            await finish_draft_session_job(pool, job, "skipped", {"skipReason": "frozen"})
            return
        client = await open_campaign_client(record)
        status, result = await process_draft_session(pool, job, client)
        await finish_draft_session_job(pool, job, status, result)
    except SubscriptionRequiredError as error:
        await pool.execute('''UPDATE "TelegramDraftSessionJob" SET status = 'pending',
          "claimedAt" = NULL, "currentChatTitle" = NULL, "errorCode" = 'SUBSCRIPTION_REQUIRED',
          "errorMessage" = $2, "finishedAt" = NULL, "updatedAt" = NOW() WHERE id = $1''',
          job["id"], str(error)[:2000])
        await pool.execute('''UPDATE "TelegramDraftJob" SET status = 'paused_subscription',
          "errorMessage" = $2, "lastProgressAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
          job["draftJobId"], str(error)[:2000])
        await sync_draft_job(pool, job["draftJobId"])
        log.info("Telegram draft job %s paused for subscription renewal", job["draftJobId"])
    except Exception as error:
        if isinstance(error, (FloodWait, PeerFlood, *SESSION_DEAD_ERRORS)):
            with suppress(Exception):
                await record_session_signal(pool, record, None, error, getattr(error, "value", 0))
        await finish_draft_session_job(pool, job, "failed", error=error)
        log.warning("Telegram draft session job %s failed: %s", job["id"], error)
    finally:
        await disconnect(client)


async def execute_draft_session_job(pool, job):
    lock = CLIENT_COMMAND_LOCKS.setdefault(job["sessionId"], asyncio.Lock())
    async with lock:
        await _execute_draft_session_job(pool, job)


async def draft_session_worker(pool):
    while True:
        job = await claim_draft_session_job(pool)
        if job:
            await execute_draft_session_job(pool, job)
        else:
            await asyncio.sleep(0.35)


async def draft_runtime(pool):
    workers = [asyncio.create_task(draft_session_worker(pool), name=f"telegram-drafts-{index}")
               for index in range(DRAFT_SESSION_CONCURRENCY)]
    try:
        await asyncio.gather(*workers)
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def campaign_worker(pool):
    while True:
        campaign = await claim_campaign(pool)
        if campaign:
            await process_campaign(pool, campaign)
        else:
            await asyncio.sleep(0.35)


async def campaign_runtime(pool):
    workers = [asyncio.create_task(campaign_worker(pool), name=f"telegram-campaign-{index}")
               for index in range(CAMPAIGN_CONCURRENCY)]
    try:
        await asyncio.gather(*workers)
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def reply_tracking_runtime(pool):
    while True:
        campaign = await claim_reply_scan(pool)
        if campaign:
            await scan_replies(pool, campaign)
        else:
            await pool.execute('''UPDATE "TelegramCampaign" SET "replyTrackingStatus" = 'completed'
              WHERE "replyTrackingStatus" = 'tracking' AND "replyTrackingUntil" <= NOW()''')
            await asyncio.sleep(POLL_SECONDS)


async def main():
    database_url = os.environ["DATABASE_URL"]
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10, command_timeout=60)
    log.info("Hydrogram worker started")
    ai_task = asyncio.create_task(ai_runtime(pool), name="ai-runtime")
    client_task = asyncio.create_task(client_command_runtime(pool), name="telegram-client-runtime")
    reply_task = asyncio.create_task(reply_tracking_runtime(pool), name="telegram-reply-runtime")
    campaign_task = None
    account_settings_task = None
    draft_task = None
    try:
        await recover_account_settings_jobs(pool)
        account_settings_task = asyncio.create_task(account_settings_runtime(pool), name="account-settings-runtime")
        await recover_draft_jobs(pool)
        draft_task = asyncio.create_task(draft_runtime(pool), name="telegram-draft-runtime")
        interrupted = await pool.fetch('''UPDATE "TelegramCampaign" SET status = 'failed',
          "errorMessage" = 'Worker restarted while this campaign was running', "finishedAt" = NOW(),
          "replyTrackingStatus" = 'failed', "lastProgressAt" = NOW() WHERE status = 'running' RETURNING id''')
        for campaign in interrupted:
            pending = await pool.fetchval('SELECT COUNT(*) FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1 AND status = \'pending\'', campaign["id"])
            await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'skipped',
              "errorCode" = 'WORKER_RESTARTED', "errorMessage" = 'Worker restarted before this target was processed',
              "updatedAt" = NOW() WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"])
            await pool.execute('''UPDATE "TelegramCampaign" SET "skippedCount" = "skippedCount" + $2,
              "processedCount" = "processedCount" + $2 WHERE id = $1''', campaign["id"], pending)
            await settle_campaign_quota(pool, campaign["id"])
        campaign_task = asyncio.create_task(campaign_runtime(pool), name="telegram-campaign-runtime")
        while True:
            await pool.execute('''UPDATE "TelegramSession" SET status = 'queued_validation', "updatedAt" = NOW()
              WHERE status = 'validating' AND "updatedAt" < NOW() - INTERVAL '5 minutes' ''')
            await pool.execute('''UPDATE "TelegramLoginFlow" SET status = CASE status
                WHEN 'sending_code' THEN 'queued_send_code'
                WHEN 'signing_in' THEN 'queued_sign_in'
                WHEN 'checking_password' THEN 'queued_password' END, "updatedAt" = NOW()
              WHERE status IN ('sending_code','signing_in','checking_password')
                AND "updatedAt" < NOW() - INTERVAL '5 minutes' ''')
            await pool.execute('''UPDATE "TelegramLoginFlow" SET status = 'expired', "codeEncrypted" = NULL,
              "passwordEncrypted" = NULL, "phoneCodeHashEncrypted" = NULL, "sessionDataEncrypted" = NULL,
              "updatedAt" = NOW() WHERE "expiresAt" <= NOW() AND status IN
              ('queued_send_code','sending_code','awaiting_code','queued_sign_in','signing_in','awaiting_password','queued_password','checking_password')''')
            session = await claim_session(pool)
            if session:
                await validate_session(pool, session)
                continue
            profile_sync = await claim_profile_sync(pool)
            if profile_sync:
                await with_session_lock(profile_sync["id"], lambda: sync_profile(pool, profile_sync))
                continue
            flow = await claim_flow(pool)
            if flow:
                await process_flow(pool, flow)
                continue
            schedule = await claim_schedule(pool)
            if schedule:
                await materialize_schedule(pool, schedule)
                continue
            spam_check = await claim_spam_check(pool)
            if spam_check:
                await with_session_lock(spam_check["id"], lambda: process_spam_check(pool, spam_check))
                continue
            warmup = await claim_warmup(pool)
            if warmup:
                await with_session_lock(warmup["id"], lambda: process_warmup(pool, warmup))
                await asyncio.sleep(random_between(WARMUP_DELAY_MIN_SECONDS, WARMUP_DELAY_MAX_SECONDS))
                continue
            await asyncio.sleep(POLL_SECONDS)
    finally:
        tasks = [ai_task, client_task, reply_task, *([campaign_task] if campaign_task else []),
                 *([account_settings_task] if account_settings_task else []),
                 *([draft_task] if draft_task else [])]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
