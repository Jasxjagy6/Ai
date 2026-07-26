import asyncio
import base64
import hashlib
import json
import logging
import math
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
from hydrogram import Client, enums, filters, raw
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


def error_code(error: Exception) -> str:
    return error.__class__.__name__.upper()[:100]


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
    transient_session = AI_TRANSIENT_CLIENTS.pop(id(client), None) if client else None
    if transient_session:
        AI_BUSY_SESSIONS.discard(transient_session)
    if client and client.is_connected:
        with suppress(Exception):
            await client.disconnect()


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
            SELECT s.*, c."apiId", c."apiHashEncrypted"
            FROM "TelegramSession" s
            JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
            WHERE s.status = 'queued_validation'
            ORDER BY s."createdAt" ASC
            FOR UPDATE OF s SKIP LOCKED LIMIT 1
        ''')
        if row:
            await connection.execute('UPDATE "TelegramSession" SET status = \'validating\', "updatedAt" = NOW() WHERE id = $1', row["id"])
        return dict(row) if row else None


async def validate_session(pool, record):
    client = None
    try:
        raw = decrypt(record["sessionDataEncrypted"])
        session_string = canonical_session(raw, record["sessionFormat"], record["apiId"])
        client = client_for(record, session_string)
        authorized = await asyncio.wait_for(client.connect(), timeout=45)
        if not authorized:
            raise ValueError("Telegram session is not authorized")
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
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE AND s."profileSyncRequested" = TRUE
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
              k."expiresAt" AS "keyExpiresAt", k."messagingAccess"
            FROM "TelegramLoginFlow" f
            JOIN "TelegramApiCredential" c ON c.id = f."credentialId"
            LEFT JOIN "ValidatorAccessKey" k ON k.id = f."accessKeyId"
            WHERE f.status IN ('queued_send_code', 'queued_sign_in', 'queued_password')
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
        count = await connection.fetchval('SELECT COUNT(*) FROM "TelegramSession" WHERE "accountId" = $1', record["accountId"])
        limit = await connection.fetchval('SELECT "sessionLimit" FROM "ValidatorAccessKey" WHERE id = $1', record["accessKeyId"])
        if limit is not None and count >= limit:
            raise ValueError(f"Session limit of {limit} reached")
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
        if not record["accessKeyId"] or record["revoked"] or not record["messagingAccess"]:
            raise PermissionError("Messaging access is no longer active")
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
            SELECT c.*, k.revoked AS "keyRevoked", k."messagingAccess" AS "keyMessagingAccess",
              k."expiresAt" AS "keyExpiresAt"
            FROM "TelegramCampaign" c
            LEFT JOIN "ValidatorAccessKey" k ON k.id = c."accessKeyId"
            WHERE c.status = 'pending'
            ORDER BY c."createdAt" ASC FOR UPDATE OF c SKIP LOCKED LIMIT 1
        ''')
        if row:
            await connection.execute('''UPDATE "TelegramCampaign" SET status = 'running',
              "startedAt" = COALESCE("startedAt", NOW()), "lastProgressAt" = NOW() WHERE id = $1''', row["id"])
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
    for _ in range(100):
        shared = next((entry for entry in AI_CLIENTS.values()
                       if entry["record"]["id"] == record["id"] and entry["client"].is_connected), None)
        if shared:
            shared["leases"] = int(shared.get("leases", 0)) + 1
            return shared["client"]
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
            raise ValueError("Telegram session is no longer authorized")
        AI_TRANSIENT_CLIENTS[id(client)] = record["id"]
        return client
    except Exception:
        AI_BUSY_SESSIONS.discard(record["id"])
        raise


async def claim_spam_check(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted"
          FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE
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
          WHERE s.status = 'active' AND s."isLoggedIn" = TRUE AND s."warmupEnabled" = TRUE
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
        campaign = await connection.fetchrow('''SELECT "accountId", "accessKeyId", "reservedMessages", "sentCount",
          "quotaSettled", "reservedCredits", "creditItemCost", "creditsSettled", configuration
          FROM "TelegramCampaign" WHERE id = $1 FOR UPDATE''', campaign_id)
        if not campaign:
            return
        refund = max(0, campaign["reservedMessages"] - campaign["sentCount"])
        if not campaign["quotaSettled"] and campaign["accessKeyId"] and refund:
            await connection.execute('''UPDATE "ValidatorAccessKey" SET "messagesUsed" = GREATEST(0, "messagesUsed" - $2)
              WHERE id = $1''', campaign["accessKeyId"], refund)
        if not campaign["creditsSettled"]:
            pricing = json_value(json_value(campaign["configuration"]).get("creditPricing", {}))
            item_cost = max(0, int(pricing.get("itemCost", campaign["creditItemCost"])))
            item_unit = max(1, int(pricing.get("itemUnit", 1)))
            reserved_variable = math.ceil(campaign["reservedMessages"] / item_unit) * item_cost
            sent_variable = math.ceil(campaign["sentCount"] / item_unit) * item_cost if campaign["sentCount"] else 0
            credit_refund = min(campaign["reservedCredits"], max(0, reserved_variable - sent_variable))
            if credit_refund:
                balance = await connection.fetchval('''UPDATE "ValidatorAccount" SET
                  "creditsBalance" = "creditsBalance" + $2,
                  "creditsSpent" = GREATEST(0, "creditsSpent" - $2), "updatedAt" = NOW()
                  WHERE id = $1 RETURNING "creditsBalance"''', campaign["accountId"], credit_refund)
                await connection.execute('''INSERT INTO "ValidatorCreditTransaction"
                  (id, "accountId", "accessKeyId", amount, "balanceAfter", kind, "taskCode", description,
                   "referenceType", "referenceId", metadata, "createdAt")
                  VALUES ($1,$2,$3,$4,$5,'refund','campaign_send',$6,'telegram_campaign',$7,$8::jsonb,NOW())''',
                  f"vct_{uuid.uuid4().hex}", campaign["accountId"], campaign["accessKeyId"], credit_refund,
                  balance, "Refund for unsent Telegram attempts", campaign_id,
                  json.dumps({"unsentAttempts": refund}))
        await connection.execute('''UPDATE "TelegramCampaign" SET "quotaSettled" = TRUE,
          "creditsSettled" = TRUE WHERE id = $1''', campaign_id)


async def process_campaign(pool, campaign):
    clients = {}
    sessions = []
    retired_sessions = set()
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
        if not campaign.get("accessKeyId") or campaign.get("keyRevoked") or not campaign.get("keyMessagingAccess"):
            raise PermissionError("Messaging access is no longer active")
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
                clients[session["id"]] = await open_campaign_client(session)
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

        async def is_cancelled():
            state = await pool.fetchrow('SELECT "cancelRequested", status FROM "TelegramCampaign" WHERE id = $1', campaign["id"])
            return not state or state["cancelRequested"]

        if campaign["mode"] == "parallel":
            queue = asyncio.Queue()
            for row in rows:
                queue.put_nowait(dict(row))

            async def parallel_worker(session_id):
                while True:
                    if session_id in retired_sessions or await is_cancelled():
                        return
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
    except Exception as error:
        log.exception("Campaign %s failed", campaign["id"])
        pending = await pool.fetchval('SELECT COUNT(*) FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1 AND status = \'pending\'', campaign["id"])
        await pool.execute('''UPDATE "TelegramCampaignRecipient" SET status = 'skipped', "errorCode" = 'CAMPAIGN_FAILED',
          "errorMessage" = $2, "updatedAt" = NOW() WHERE "campaignId" = $1 AND status = 'pending' ''', campaign["id"], str(error)[:2000])
        await pool.execute('''UPDATE "TelegramCampaign" SET status = 'failed', "skippedCount" = "skippedCount" + $2,
          "processedCount" = "processedCount" + $2, "errorMessage" = $3, "finishedAt" = NOW(),
          "replyTrackingStatus" = 'failed', "lastProgressAt" = NOW() WHERE id = $1''', campaign["id"], pending, str(error)[:2000])
    finally:
        for client in clients.values():
            await disconnect(client)
        await settle_campaign_quota(pool, campaign["id"])


async def claim_reply_scan(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT * FROM "TelegramCampaign" WHERE "replyTrackingStatus" = 'tracking'
          AND "replyTrackingUntil" > NOW() AND ("replyTrackingLastScanAt" IS NULL OR "replyTrackingLastScanAt" < NOW() - INTERVAL '2 minutes')
          ORDER BY COALESCE("replyTrackingLastScanAt", "finishedAt") ASC FOR UPDATE SKIP LOCKED LIMIT 1''')
        if row:
            await connection.execute('UPDATE "TelegramCampaign" SET "replyTrackingLastScanAt" = NOW() WHERE id = $1', row["id"])
        return dict(row) if row else None


async def scan_replies(pool, campaign):
    clients = {}
    try:
        sessions = await campaign_sessions(pool, campaign["id"])
        recipients = await pool.fetch('''SELECT * FROM "TelegramCampaignRecipient" WHERE "campaignId" = $1
          AND status = 'sent' AND replied = FALSE ORDER BY "sentAt" ASC LIMIT 1000''', campaign["id"])
        by_session = {}
        for row in recipients:
            by_session.setdefault(row["sessionId"], []).append(dict(row))
        for session in sessions:
            pending = by_session.get(session["id"])
            if not pending:
                continue
            try:
                client = clients[session["id"]] = await open_campaign_client(session)
                for recipient in pending:
                    try:
                        async for message in client.get_chat_history(await target_for(client, recipient), limit=30):
                            if message.id == recipient["messageId"]:
                                continue
                            if not message.outgoing and message.date and recipient["sentAt"] and as_utc(message.date) >= as_utc(recipient["sentAt"]):
                                preview = (message.text or message.caption or "[media]")[:500]
                                updated = await pool.execute('''UPDATE "TelegramCampaignRecipient" SET replied = TRUE,
                                  "repliedAt" = $2, "replyMessageId" = $3, "replyPreview" = $4, "lastCheckedAt" = NOW(),
                                  "updatedAt" = NOW() WHERE id = $1 AND replied = FALSE''', recipient["id"],
                                  as_utc(message.date).replace(tzinfo=None), message.id, preview)
                                if updated.endswith("1"):
                                    await pool.execute('UPDATE "TelegramCampaign" SET "repliedCount" = "repliedCount" + 1 WHERE id = $1', campaign["id"])
                                    await pool.execute('UPDATE "TelegramSession" SET "repliesReceived" = "repliesReceived" + 1 WHERE id = $1', session["id"])
                                break
                        await pool.execute('UPDATE "TelegramCampaignRecipient" SET "lastCheckedAt" = NOW() WHERE id = $1', recipient["id"])
                    except Exception as error:
                        log.info("Reply check failed for recipient %s: %s", recipient["id"], error)
            except Exception as error:
                log.warning("Reply session %s failed: %s", session["id"], error)
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
        return {"targetKey": f"id:{target}", "targetInput": target, "telegramId": int(target)}
    return None


async def claim_schedule(pool):
    async with pool.acquire() as connection, connection.transaction():
        row = await connection.fetchrow('''SELECT s.*, k.revoked AS "keyRevoked",
          k."messagingAccess" AS "keyMessagingAccess", k."expiresAt" AS "keyExpiresAt"
          FROM "TelegramMessageSchedule" s
          LEFT JOIN "ValidatorAccessKey" k ON k.id = s."accessKeyId"
          WHERE s.status = 'active' AND s."nextRunAt" <= NOW()
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
        if not schedule.get("accessKeyId") or schedule.get("keyRevoked") or not schedule.get("keyMessagingAccess"):
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
        raw_credit_settings = await pool.fetchval('SELECT value FROM "Setting" WHERE key = \'validator_credit_settings_json\'')
        credit_settings = json_value(raw_credit_settings) if raw_credit_settings else {}
        task_price = json_value(credit_settings.get("tasks", {}).get("campaign_send", {}))
        base_cost = max(0, int(task_price.get("baseCost", 5)))
        item_cost = max(0, int(task_price.get("itemCost", 2)))
        item_unit = max(1, int(task_price.get("itemUnit", 1)))
        session_cost = max(0, int(task_price.get("sessionCost", 1)))
        if task_price.get("enabled", True) is False:
            await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_task\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
            return
        credits_required = base_cost + math.ceil(len(transmissions) / item_unit) * item_cost + len(session_ids) * session_cost
        configuration["creditPricing"] = {
            "baseCost": base_cost, "itemCost": item_cost, "itemUnit": item_unit,
            "sessionCost": session_cost, "enabled": task_price.get("enabled", True),
        }
        async with pool.acquire() as connection, connection.transaction():
            reserved = await connection.fetchrow('''UPDATE "ValidatorAccount" SET
              "creditsBalance" = "creditsBalance" - $2, "creditsSpent" = "creditsSpent" + $2,
              "updatedAt" = NOW() WHERE id = $1 AND active = TRUE AND "creditsBalance" >= $2
              AND ("planExpiresAt" IS NULL OR "planExpiresAt" > NOW()
                OR "lastCreditTopupAt" > "planExpiresAt") RETURNING "creditsBalance"''',
              schedule["accountId"], credits_required)
            if credits_required and not reserved:
                await connection.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_quota\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
                return
            await connection.execute('''UPDATE "ValidatorAccessKey" SET "messagesUsed" = "messagesUsed" + $2
              WHERE id = $1 AND revoked = FALSE AND "messagingAccess" = TRUE''',
              schedule["accessKeyId"], len(transmissions))
            await connection.execute('''INSERT INTO "TelegramCampaign"
              (id, "accountId", "accessKeyId", "sourceListId", "scheduleId", name, "targetType", mode,
               message, "parseMode", status, "totalCount", "sessionCount", "reservedMessages", "reservedCredits",
               "creditItemCost", configuration, "trackReplies", "replyWindowHours", "createdAt", "lastProgressAt")
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$11,$13,$14,$15::jsonb,$16,$17,NOW(),NOW())''',
              campaign_id, schedule["accountId"], schedule["accessKeyId"], schedule["sourceListId"], schedule["id"],
              schedule["name"], schedule["targetType"], schedule["mode"], schedule["message"], schedule["parseMode"],
              len(transmissions), len(session_ids), credits_required, item_cost, json.dumps(configuration), track_replies, reply_window)
            if credits_required:
                await connection.execute('''INSERT INTO "ValidatorCreditTransaction"
                  (id, "accountId", "accessKeyId", amount, "balanceAfter", kind, "taskCode", description,
                   "referenceType", "referenceId", metadata, "createdAt")
                  VALUES ($1,$2,$3,$4,$5,'debit','campaign_send',$6,'telegram_campaign',$7,$8::jsonb,NOW())''',
                  f"vct_{uuid.uuid4().hex}", schedule["accountId"], schedule["accessKeyId"], -credits_required,
                  reserved["creditsBalance"], f"{len(transmissions)} scheduled Telegram message attempts", campaign_id,
                  json.dumps({"attempts": len(transmissions), "sessions": len(session_ids), "scheduleId": schedule["id"]}))
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
              "lastRunAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', schedule["id"])
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
      LEFT JOIN "AiChatSetting" chat ON chat."campaignId" = c.id
        AND chat."sessionId" = membership."sessionId" AND chat."peerId" = $3
      WHERE membership.id = $1 AND membership."activeSessionId" = $2
        AND c.status IN ('starting','running','credit_grace') AND COALESCE(chat.enabled, TRUE) = TRUE''',
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
          status = CASE WHEN status = 'credit_grace' AND "creditGraceEndsAt" <= NOW()
            THEN 'grace_expired' ELSE 'expired' END,
          "stoppedAt" = NOW(), "lastError" = CASE
            WHEN status = 'credit_grace' AND "creditGraceEndsAt" <= NOW()
            THEN 'Credit refill grace period expired' ELSE 'Campaign duration completed' END,
          "updatedAt" = NOW()
          WHERE status IN ('starting','running','credit_grace')
            AND (("endsAt" IS NOT NULL AND "endsAt" <= NOW())
              OR (status = 'credit_grace' AND "creditGraceEndsAt" <= NOW()))
          RETURNING id''')
        ids = [row["id"] for row in terminal_ids]
        if ids:
            await connection.execute('''UPDATE "AiCampaignSession" SET "activeSessionId" = NULL,
              "runtimeStatus" = 'stopping', "updatedAt" = NOW() WHERE "campaignId" = ANY($1::text[])''', ids)
            await connection.execute('''UPDATE "AiChatJob" SET status = 'cancelled',
              "errorCode" = 'CAMPAIGN_ENDED', "errorMessage" = 'Campaign is no longer active',
              "finishedAt" = NOW(), "updatedAt" = NOW()
              WHERE "campaignId" = ANY($1::text[]) AND status = 'pending' ''', ids)

        await connection.execute('''UPDATE "AiCampaign" campaign SET status = 'credit_grace',
          "creditGraceStartedAt" = COALESCE(campaign."creditGraceStartedAt", NOW()),
          "creditGraceEndsAt" = COALESCE(campaign."creditGraceEndsAt", NOW() + INTERVAL '24 hours'),
          "lastError" = 'AI replies paused until workspace credits are refilled', "updatedAt" = NOW()
          FROM "ValidatorAccount" account WHERE account.id = campaign."accountId"
            AND campaign.status IN ('starting','running') AND account."creditsBalance" < 5''')
        await connection.execute('''UPDATE "AiCampaign" campaign SET status = 'running',
          "creditGraceStartedAt" = NULL, "creditGraceEndsAt" = NULL, "lastError" = NULL,
          "updatedAt" = NOW() FROM "ValidatorAccount" account
          WHERE account.id = campaign."accountId" AND campaign.status = 'credit_grace'
            AND account.active = TRUE AND account."creditsBalance" >= 5''')


async def reconcile_ai_clients(pool):
    await reconcile_ai_campaigns(pool)
    rows = await pool.fetch('''SELECT s.*, credential."apiId", credential."apiHashEncrypted",
        membership.id AS "membershipId", membership."campaignId", membership."catchupRequested",
        campaign.config AS "campaignConfig", campaign.status AS "campaignStatus"
      FROM "AiCampaignSession" membership
      JOIN "AiCampaign" campaign ON campaign.id = membership."campaignId"
      JOIN "TelegramSession" s ON s.id = membership."sessionId"
      JOIN "TelegramApiCredential" credential ON credential.id = s."credentialId"
      WHERE membership."activeSessionId" = s.id
        AND campaign.status IN ('starting','running','credit_grace')
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
        if session_id in AI_BUSY_SESSIONS:
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
          WHERE job.status = 'pending' AND job."runAfter" <= NOW()
            AND campaign.status IN ('starting','running')
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


async def reserve_ai_credit(pool, job):
    async with pool.acquire() as connection, connection.transaction():
        await connection.fetchval('SELECT pg_advisory_xact_lock(hashtext($1))', job["id"])
        existing = await connection.fetchval('''SELECT COALESCE(SUM(amount), 0) FROM "ValidatorCreditTransaction"
          WHERE "referenceType" = 'ai_job' AND "referenceId" = $1''', job["id"])
        if int(existing or 0) <= -5:
            return True
        row = await connection.fetchrow('''SELECT account.id, account."creditsBalance", campaign.status
          FROM "ValidatorAccount" account JOIN "AiCampaign" campaign ON campaign."accountId" = account.id
          WHERE campaign.id = $1 AND account.active = TRUE FOR UPDATE OF account, campaign''', job["campaignId"])
        if not row or row["status"] not in ("starting", "running"):
            return False
        if row["creditsBalance"] < 5:
            await connection.execute('''UPDATE "AiCampaign" SET status = 'credit_grace',
              "creditGraceStartedAt" = COALESCE("creditGraceStartedAt", NOW()),
              "creditGraceEndsAt" = COALESCE("creditGraceEndsAt", NOW() + INTERVAL '24 hours'),
              "lastError" = 'AI replies paused until workspace credits are refilled', "updatedAt" = NOW()
              WHERE id = $1''', job["campaignId"])
            return False
        await connection.execute('''UPDATE "ValidatorAccount" SET "creditsBalance" = "creditsBalance" - 5,
          "creditsSpent" = "creditsSpent" + 5, "updatedAt" = NOW() WHERE id = $1''', job["accountId"])
        remaining = row["creditsBalance"] - 5
        await connection.execute('''INSERT INTO "ValidatorCreditTransaction"
          (id, "accountId", amount, "balanceAfter", kind, "taskCode", description,
           "referenceType", "referenceId", metadata, "createdAt")
          VALUES ($1,$2,-5,$3,'debit','ai_chat_send','AI message send reserved',
            'ai_job',$4,$5::jsonb,NOW())''', f"txn_{uuid.uuid4().hex}", job["accountId"], remaining,
          job["id"], json.dumps({"campaignId": job["campaignId"]}))
        await connection.execute('''UPDATE "AiCampaign" SET "creditsUsed" = "creditsUsed" + 5,
          "updatedAt" = NOW() WHERE id = $1''', job["campaignId"])
        return True


async def refund_ai_credit(pool, job):
    async with pool.acquire() as connection, connection.transaction():
        await connection.fetchval('SELECT pg_advisory_xact_lock(hashtext($1))', job["id"])
        reserved = await connection.fetchval('''SELECT COALESCE(SUM(amount), 0)
          FROM "ValidatorCreditTransaction" WHERE "referenceType" = 'ai_job' AND "referenceId" = $1''', job["id"])
        if int(reserved or 0) >= 0:
            return
        balance = await connection.fetchval('''UPDATE "ValidatorAccount" SET
          "creditsBalance" = "creditsBalance" + 5, "creditsSpent" = GREATEST(0, "creditsSpent" - 5),
          "updatedAt" = NOW() WHERE id = $1 RETURNING "creditsBalance"''', job["accountId"])
        await connection.execute('''INSERT INTO "ValidatorCreditTransaction"
          (id, "accountId", amount, "balanceAfter", kind, "taskCode", description,
           "referenceType", "referenceId", metadata, "createdAt")
          VALUES ($1,$2,5,$3,'refund','ai_chat_send','AI message was not sent',
            'ai_job',$4,$5::jsonb,NOW())''', f"txn_{uuid.uuid4().hex}", job["accountId"], balance,
          job["id"], json.dumps({"campaignId": job["campaignId"]}))
        await connection.execute('''UPDATE "AiCampaign" SET "creditsUsed" = GREATEST(0, "creditsUsed" - 5),
          "updatedAt" = NOW() WHERE id = $1''', job["campaignId"])


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
    credit_reserved = False
    telegram_sent = False
    try:
        context = await pool.fetchrow('''SELECT j.*, s.label, s."firstName", s."lastName", s.username,
          s.status AS "sessionStatus", s."isLoggedIn", s."spamStatus",
          membership.id AS "membershipId", membership."activeSessionId",
          campaign.status AS "campaignStatus", campaign.config AS "campaignConfig",
          campaign.provider, campaign."secretEncrypted", campaign."credentialValid",
          campaign."modelId", campaign."presetId"
          FROM "AiChatJob" j JOIN "TelegramSession" s ON s.id = j."sessionId"
          JOIN "AiCampaign" campaign ON campaign.id = j."campaignId"
          JOIN "AiCampaignSession" membership ON membership."campaignId" = campaign.id
            AND membership."sessionId" = j."sessionId" WHERE j.id = $1''', job["id"])
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
            await refund_ai_credit(pool, job)
            credit_reserved = False
            await ai_log(pool, job, provider, "not_our_turn", response=response, category=category)
            await finish_ai_job(pool, job, "not_our_turn", response)
            return
        if category in AI_GHOSTING:
            await refund_ai_credit(pool, job)
            credit_reserved = False
            await pool.execute('''UPDATE "AiChatMemory" SET "conversationState" = 'ghosted', "lastCategory" = $4,
              "updatedAt" = NOW() WHERE "campaignId" = $1 AND "sessionId" = $2 AND "peerId" = $3''',
              job["campaignId"], job["sessionId"], job["peerId"], category)
            await ai_log(pool, job, provider, "ghosting", response=response, category=category)
            await finish_ai_job(pool, job, "ghosting", response)
            return
        text = str(response.get("text") or "").strip()
        if not text:
            await refund_ai_credit(pool, job)
            credit_reserved = False
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
            await refund_ai_credit(pool, job)
            credit_reserved = False
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
        credit_reserved = await reserve_ai_credit(pool, job)
        if not credit_reserved:
            campaign_status = await pool.fetchval('SELECT status FROM "AiCampaign" WHERE id = $1', job["campaignId"])
            if campaign_status == "credit_grace":
                await pool.execute('''UPDATE "AiChatJob" SET status = 'pending', attempts = GREATEST(0, attempts - 1),
                  "runAfter" = NOW() + INTERVAL '1 minute', "claimedAt" = NULL, "errorCode" = 'CREDIT_GRACE',
                  "errorMessage" = 'Waiting for workspace credit refill', "updatedAt" = NOW() WHERE id = $1''', job["id"])
            else:
                await finish_ai_job(pool, job, "cancelled")
            return
        still_active = await pool.fetchval('''SELECT EXISTS(
          SELECT 1 FROM "AiCampaign" campaign JOIN "AiCampaignSession" membership
            ON membership."campaignId" = campaign.id
          WHERE campaign.id = $1 AND campaign.status IN ('starting','running')
            AND membership."sessionId" = $2 AND membership."activeSessionId" = $2)''',
          job["campaignId"], job["sessionId"])
        if not still_active:
            await refund_ai_credit(pool, job)
            credit_reserved = False
            await finish_ai_job(pool, job, "cancelled")
            return
        sent = await asyncio.wait_for(entry["client"].send_message(int(job["peerId"]), text, parse_mode=enums.ParseMode.DISABLED), timeout=45)
        telegram_sent = True
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
        if not telegram_sent:
            await refund_ai_credit(pool, job)
            credit_reserved = False
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
      JOIN "AiCampaignSession" membership ON membership."campaignId" = m."campaignId"
        AND membership."sessionId" = m."sessionId"
      LEFT JOIN "AiChatSetting" cs ON cs."campaignId" = m."campaignId"
        AND cs."sessionId" = m."sessionId" AND cs."peerId" = m."peerId"
      WHERE campaign.status IN ('starting','running') AND campaign."reengageEnabled" = TRUE
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
          WHERE campaign.id = job."campaignId" AND campaign.status NOT IN ('starting','running','credit_grace')
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
          WHERE j.status = 'pending' AND b."cancelRequested" = FALSE
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


async def finish_account_settings_job(pool, job, status, result=None, error=None):
    await pool.execute('''UPDATE "TelegramAccountSettingsJob" SET status = $2, "result" = $3::jsonb,
      "errorCode" = $4, "errorMessage" = $5, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''',
      job["id"], status, json.dumps(result) if result is not None else None,
      error_code(error) if error else None, str(error)[:2000] if error else None)
    await sync_account_settings_batch(pool, job["batchId"])


async def execute_account_settings_job(pool, job):
    session = await pool.fetchrow('''SELECT s.*, c."apiId", c."apiHashEncrypted"
      FROM "TelegramSession" s JOIN "TelegramApiCredential" c ON c.id = s."credentialId"
      WHERE s.id = $1 AND s."accountId" = $2''', job["sessionId"], job["accountId"])
    if not session:
        await finish_account_settings_job(pool, job, "failed", error=ValueError("Session not found"))
        return
    record = dict(session)
    client = None
    try:
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


async def main():
    database_url = os.environ["DATABASE_URL"]
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10, command_timeout=60)
    log.info("Hydrogram worker started")
    ai_task = asyncio.create_task(ai_runtime(pool), name="ai-runtime")
    try:
        await recover_account_settings_jobs(pool)
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
                await sync_profile(pool, profile_sync)
                continue
            flow = await claim_flow(pool)
            if flow:
                await process_flow(pool, flow)
                continue
            campaign = await claim_campaign(pool)
            if campaign:
                await process_campaign(pool, campaign)
                continue
            reply_scan = await claim_reply_scan(pool)
            if reply_scan:
                await scan_replies(pool, reply_scan)
                continue
            schedule = await claim_schedule(pool)
            if schedule:
                await materialize_schedule(pool, schedule)
                continue
            spam_check = await claim_spam_check(pool)
            if spam_check:
                await process_spam_check(pool, spam_check)
                continue
            warmup = await claim_warmup(pool)
            if warmup:
                await process_warmup(pool, warmup)
                await asyncio.sleep(random_between(WARMUP_DELAY_MIN_SECONDS, WARMUP_DELAY_MAX_SECONDS))
                continue
            as_job = await claim_account_settings_job(pool)
            if as_job:
                await execute_account_settings_job(pool, as_job)
                continue
            await pool.execute('''UPDATE "TelegramCampaign" SET "replyTrackingStatus" = 'completed'
              WHERE "replyTrackingStatus" = 'tracking' AND "replyTrackingUntil" <= NOW()''')
            await asyncio.sleep(POLL_SECONDS)
    finally:
        ai_task.cancel()
        await asyncio.gather(ai_task, return_exceptions=True)
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
