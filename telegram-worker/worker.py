import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import sqlite3
import struct
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote, urlparse

import asyncpg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from hydrogram import Client, enums, raw
from hydrogram.errors import (
    AuthKeyDuplicated, AuthKeyUnregistered, FloodWait, PeerFlood,
    SessionPasswordNeeded, SessionRevoked, UserDeactivated, UserDeactivatedBan,
)


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("telegram-worker")
POLL_SECONDS = max(0.25, float(os.getenv("TELEGRAM_WORKER_POLL_SECONDS", "1")))
SPAM_CHECK_MAX_AGE_DAYS = max(1, int(os.getenv("TELEGRAM_SPAM_CHECK_MAX_AGE_DAYS", "7")))
WARMUP_MIN_GAP_MINUTES = max(5, int(os.getenv("TELEGRAM_WARMUP_MIN_GAP_MINUTES", "30")))
WARMUP_DELAY_MIN_SECONDS = max(0.0, float(os.getenv("TELEGRAM_WARMUP_DELAY_MIN_SECONDS", "4")))
WARMUP_DELAY_MAX_SECONDS = max(WARMUP_DELAY_MIN_SECONDS, float(os.getenv("TELEGRAM_WARMUP_DELAY_MAX_SECONDS", "12")))
SESSION_DEAD_ERRORS = (AuthKeyDuplicated, AuthKeyUnregistered, SessionRevoked, UserDeactivated, UserDeactivatedBan)


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


def client_for(record, session_string: str | None = None) -> Client:
    proxy_enabled = record.get("proxyEnabled", bool(record.get("proxyEncrypted")))
    anti_detect = record.get("antiDetectEnabled", True)
    return Client(
        f"signal-desk-{record['id']}",
        api_id=record["apiId"],
        api_hash=decrypt(record["apiHashEncrypted"]).decode(),
        session_string=session_string,
        in_memory=True,
        no_updates=True,
        workers=1,
        proxy=proxy_value(record.get("proxyEncrypted")) if proxy_enabled else None,
        **identity_kwargs(record.get("deviceIdentity")) if anti_detect else {},
    )


async def disconnect(client: Client | None) -> None:
    if client and client.is_connected:
        with suppress(Exception):
            await client.disconnect()


async def profile(client: Client):
    me = await client.get_me()
    await client.storage.user_id(me.id)
    await client.storage.is_bot(bool(me.is_bot))
    session_string = await client.export_session_string()
    return me, session_string


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
        me, session_string = await asyncio.wait_for(profile(client), timeout=30)
        await pool.execute('''
            UPDATE "TelegramSession" SET status = 'active', "isLoggedIn" = TRUE,
              phone = $2, username = $3, "firstName" = $4, "lastName" = $5, "telegramUserId" = $6,
              "sessionDataEncrypted" = $7, "sessionFingerprint" = $8, "sessionFormat" = 'hydrogram_string',
              "lastErrorCode" = NULL, "lastErrorMessage" = NULL, "lastLoginAt" = NOW(),
              "lastActiveAt" = NOW(), "updatedAt" = NOW() WHERE id = $1
        ''', record["id"], me.phone_number, me.username, me.first_name, me.last_name, me.id,
            encrypt(session_string), fingerprint(session_string))
        log.info("Validated Telegram session %s", record["id"])
    except Exception as error:
        log.warning("Session %s validation failed: %s", record["id"], error)
        await pool.execute('''UPDATE "TelegramSession" SET status = 'error', "isLoggedIn" = FALSE,
            "lastErrorCode" = $2, "lastErrorMessage" = $3, "updatedAt" = NOW() WHERE id = $1''',
            record["id"], error_code(error), str(error)[:2000])
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
              "sessionFormat", status, "isLoggedIn", "hasTwoFactor", "deviceIdentity", "proxyEncrypted",
              "proxyEnabled", "lastLoginAt", "lastActiveAt", "createdAt", "updatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'hydrogram_string','active',TRUE,$12,$13,$14,$15,NOW(),NOW(),NOW(),NOW())
        ''', session_id, record["accountId"], record["credentialId"], record["label"], me.phone_number,
            me.username, me.first_name, me.last_name, me.id, encrypted, fingerprint(session_string),
            record["claimed_status"] == "checking_password", record["deviceIdentity"], record["proxyEncrypted"],
            bool(record["proxyEncrypted"]))
        await connection.execute('''UPDATE "TelegramLoginFlow" SET status = 'completed', "sessionId" = $2,
          "codeEncrypted" = NULL, "passwordEncrypted" = NULL, "phoneCodeHashEncrypted" = NULL,
          "sessionDataEncrypted" = NULL, "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW()
          WHERE id = $1''', record["id"], session_id)
    log.info("Completed Telegram login %s", record["id"])


async def process_flow(pool, record):
    client = None
    try:
        now = utc_now()
        if not record["accessKeyId"] or record["revoked"] or not record["messagingAccess"] or (record["keyExpiresAt"] and as_utc(record["keyExpiresAt"]) <= now):
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
    session_string = canonical_session(decrypt(record["sessionDataEncrypted"]), record["sessionFormat"], record["apiId"])
    client = client_for(record, session_string)
    authorized = await asyncio.wait_for(client.connect(), timeout=45)
    if not authorized:
        await disconnect(client)
        raise ValueError("Telegram session is no longer authorized")
    return client


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
        campaign = await connection.fetchrow('''SELECT "accessKeyId", "reservedMessages", "sentCount", "quotaSettled"
          FROM "TelegramCampaign" WHERE id = $1 FOR UPDATE''', campaign_id)
        if not campaign or campaign["quotaSettled"]:
            return
        refund = max(0, campaign["reservedMessages"] - campaign["sentCount"])
        if campaign["accessKeyId"] and refund:
            await connection.execute('''UPDATE "ValidatorAccessKey" SET "messagesUsed" = GREATEST(0, "messagesUsed" - $2)
              WHERE id = $1''', campaign["accessKeyId"], refund)
        await connection.execute('UPDATE "TelegramCampaign" SET "quotaSettled" = TRUE WHERE id = $1', campaign_id)


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
        if not campaign.get("accessKeyId") or campaign.get("keyRevoked") or not campaign.get("keyMessagingAccess") or (campaign.get("keyExpiresAt") and as_utc(campaign["keyExpiresAt"]) <= now):
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
        if not schedule.get("accessKeyId") or schedule.get("keyRevoked") or not schedule.get("keyMessagingAccess") or (schedule.get("keyExpiresAt") and as_utc(schedule["keyExpiresAt"]) <= now):
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
        async with pool.acquire() as connection, connection.transaction():
            reserved = await connection.fetchrow('''UPDATE "ValidatorAccessKey"
              SET "messagesUsed" = "messagesUsed" + $2 WHERE id = $1 AND revoked = FALSE
              AND "messagingAccess" = TRUE AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
              AND ("messageLimit" IS NULL OR "messagesUsed" + $2 <= "messageLimit") RETURNING id''',
              schedule["accessKeyId"], len(transmissions))
            if not reserved:
                await connection.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_quota\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])
                return
            await connection.execute('''INSERT INTO "TelegramCampaign"
              (id, "accountId", "accessKeyId", "sourceListId", "scheduleId", name, "targetType", mode,
               message, "parseMode", status, "totalCount", "sessionCount", "reservedMessages", configuration,
               "trackReplies", "replyWindowHours", "createdAt", "lastProgressAt")
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$11,$13::jsonb,$14,$15,NOW(),NOW())''',
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
              "lastRunAt" = NOW(), "updatedAt" = NOW() WHERE id = $1''', schedule["id"])
        log.info("Materialized schedule %s as campaign %s", schedule["id"], campaign_id)
    except Exception:
        log.exception("Schedule %s failed to materialize", schedule["id"])
        await pool.execute('UPDATE "TelegramMessageSchedule" SET status = \'paused_error\', "updatedAt" = NOW() WHERE id = $1', schedule["id"])


async def main():
    database_url = os.environ["DATABASE_URL"]
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5, command_timeout=60)
    log.info("Hydrogram worker started")
    try:
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
            await pool.execute('''UPDATE "TelegramCampaign" SET "replyTrackingStatus" = 'completed'
              WHERE "replyTrackingStatus" = 'tracking' AND "replyTrackingUntil" <= NOW()''')
            await asyncio.sleep(POLL_SECONDS)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
