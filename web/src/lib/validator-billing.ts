import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createValidatorSessionForAccount,
  decryptValidatorAccessKey,
  encryptValidatorAccessKey,
  ensureValidatorReferralCode,
} from "@/lib/validator-auth";
import { getValidatorPlans, ValidatorPlanCode } from "@/lib/validator-plans";
import { getValidatorCreditSettings } from "@/lib/validator-credits";

const OXAPAY_API = "https://api.oxapay.com/v1";
const PAID_STATUSES = new Set(["paid", "manual_accept"]);
const FINAL_FAILURES = new Set(["expired", "refunded"]);

function merchantKey() {
  const value = process.env.OXAPAY_MERCHANT_KEY?.trim();
  if (!value) throw new Error("OxaPay merchant key is not configured");
  return value;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function rawKeyForPurchase(purchaseId: string) {
  const secret = process.env.VALIDATOR_KEY_SECRET || merchantKey();
  const value = createHmac("sha256", secret)
    .update(`validator-purchase:${purchaseId}`)
    .digest("base64url");
  return `tgv_${value}`;
}

function claimMatches(rawToken: string, tokenHash: string) {
  const actual = Buffer.from(hash(rawToken));
  const expected = Buffer.from(tokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function oxapay<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${OXAPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      merchant_api_key: merchantKey(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(
      body?.error?.message || body?.message || "OxaPay request failed",
    );
  }
  return body as T;
}

async function oxapayLegacy<T>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://api.oxapay.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: merchantKey(), ...payload }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.result !== 100)
    throw new Error(body?.message || "OxaPay request failed");
  return body as T;
}

async function paymentInformation(trackId: string) {
  try {
    const response = await oxapay<{
      data?: {
        status?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
      };
    }>(`/payment/${encodeURIComponent(trackId)}`);
    return response.data || null;
  } catch {
    const response = await oxapayLegacy<{
      status?: string;
      orderId?: string;
      amount?: string | number;
      currency?: string;
    }>("/merchants/inquiry", { trackId });
    return {
      status: response.status,
      order_id: response.orderId,
      amount: Number(response.amount || 0),
      currency: response.currency,
    };
  }
}

async function createInvoice(payload: {
  amount: number;
  email: string;
  orderId: string;
  callbackUrl: string;
  returnUrl: string;
  description: string;
}) {
  try {
    const invoice = await oxapay<{
      data?: { track_id?: string; payment_url?: string };
    }>("/payment/invoice", {
      method: "POST",
      body: JSON.stringify({
        amount: payload.amount,
        currency: "USD",
        lifetime: 60,
        callback_url: payload.callbackUrl,
        return_url: payload.returnUrl,
        email: payload.email,
        order_id: payload.orderId,
        description: payload.description,
        thanks_message:
          "Payment confirmed. Return to Signal Desk to activate your subscription.",
      }),
    });
    return {
      trackId: invoice.data?.track_id,
      paymentUrl: invoice.data?.payment_url,
    };
  } catch {
    const invoice = await oxapayLegacy<{
      trackId?: string;
      payLink?: string;
    }>("/merchants/request", {
      amount: payload.amount,
      currency: "USD",
      lifeTime: 60,
      callbackUrl: payload.callbackUrl,
      returnUrl: payload.returnUrl,
      email: payload.email,
      orderId: payload.orderId,
      description: payload.description,
    });
    return { trackId: invoice.trackId, paymentUrl: invoice.payLink };
  }
}

async function applyAffiliateReward(
  transaction: Prisma.TransactionClient,
  purchase: {
    id: string;
    accountId: string;
    amountUsdCents: number;
    durationDays: number | null;
  },
) {
  if (purchase.amountUsdCents <= 0) return;
  const customer = await transaction.validatorAccount.findUnique({
    where: { id: purchase.accountId },
    select: { referredById: true },
  });
  if (!customer?.referredById || customer.referredById === purchase.accountId)
    return;
  const [referrer, settings] = await Promise.all([
    transaction.validatorAccount.findUnique({
      where: { id: customer.referredById },
      select: { affiliateRateBps: true },
    }),
    getValidatorCreditSettings(),
  ]);
  const rateBps = Math.max(
    0,
    Math.min(10_000, referrer?.affiliateRateBps ?? settings.affiliateRateBps),
  );
  const rewardDays = Math.floor((Number(purchase.durationDays || 0) * rateBps) / 10_000);
  if (!rewardDays) return;
  const existing = await transaction.validatorAffiliateReward.findUnique({
    where: { purchaseId: purchase.id },
  });
  if (existing) return;
  await transaction.validatorAffiliateReward.create({
    data: {
      referrerId: customer.referredById,
      referredAccountId: purchase.accountId,
      purchaseId: purchase.id,
      rateBps,
      depositUsdCents: purchase.amountUsdCents,
      rewardCredits: 0,
      rewardDays,
    },
  });
  const rewardBase = new Date();
  const referrerAccount = await transaction.validatorAccount.findUniqueOrThrow({
    where: { id: customer.referredById },
    select: { planExpiresAt: true },
  });
  const startsAt =
    referrerAccount.planExpiresAt && referrerAccount.planExpiresAt > rewardBase
      ? referrerAccount.planExpiresAt
      : rewardBase;
  await transaction.validatorAccount.update({
    where: { id: customer.referredById },
    data: {
      currentPlanCode: "affiliate_reward",
      planExpiresAt: new Date(startsAt.getTime() + rewardDays * 86_400_000),
    },
  });
}

async function fulfillPurchase(purchaseId: string) {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${purchaseId}))`;
      let purchase = await transaction.validatorPurchase.findUnique({
        where: { id: purchaseId },
      });
      if (!purchase) throw new Error("Purchase not found");
      if (purchase.fulfilledAt) return purchase;

      let accessKeyId = purchase.accessKeyId;
      if (purchase.purchaseType === "plan" && !accessKeyId) {
        const raw = rawKeyForPurchase(purchase.id);
        const key = await transaction.validatorAccessKey.create({
          data: {
            accountId: purchase.accountId,
            label: `${purchase.planName} access`,
            keyHash: hash(raw),
            prefix: `${raw.slice(0, 15)}...`,
            rawKeyEncrypted: encryptValidatorAccessKey(raw),
            expiresAt: null,
            planCode: purchase.planCode,
            validatorAccess: true,
            messagingAccess: true,
            requestLimit: null,
            sessionLimit: null,
            messageLimit: null,
          },
        });
        accessKeyId = key.id;
      }

      const current = await transaction.validatorAccount.findUniqueOrThrow({
        where: { id: purchase.accountId },
        select: { planExpiresAt: true },
      });
      const now = new Date();
      const startsAt =
        current.planExpiresAt && current.planExpiresAt > now
          ? current.planExpiresAt
          : now;
      const planExpiresAt =
        purchase.purchaseType === "plan" && purchase.durationDays
          ? new Date(
              startsAt.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000,
            )
          : purchase.purchaseType === "plan"
            ? null
            : undefined;
      await transaction.validatorAccount.update({
        where: { id: purchase.accountId },
        data: {
          active: true,
          currentPlanCode: purchase.planCode,
          planExpiresAt,
        },
      });
      if (accessKeyId)
        await transaction.validatorAccessKey.update({
          where: { id: accessKeyId },
          data: { planCode: purchase.planCode, expiresAt: null, revoked: false },
        });
      await applyAffiliateReward(transaction, purchase);
      purchase = await transaction.validatorPurchase.update({
        where: { id: purchase.id },
        data: {
          accessKeyId,
          status: "issued",
          paidAt: purchase.paidAt || now,
          fulfilledAt: now,
        },
      });
      return purchase;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    },
  );
}

async function syncPayment(purchaseId: string) {
  const purchase = await prisma.validatorPurchase.findUnique({
    where: { id: purchaseId },
  });
  if (!purchase || !purchase.providerTrackId || purchase.fulfilledAt)
    return purchase;
  const payment = await paymentInformation(purchase.providerTrackId);
  if (!payment || payment.order_id !== purchase.id) return purchase;
  const status = String(payment.status || "").toLowerCase();
  if (PAID_STATUSES.has(status)) {
    const amountCents = Math.round(Number(payment.amount || 0) * 100);
    if (
      String(payment.currency || "").toUpperCase() !== "USD" ||
      amountCents < purchase.amountUsdCents
    ) {
      throw new Error("OxaPay payment amount does not match the purchase");
    }
    return fulfillPurchase(purchase.id);
  }
  if (FINAL_FAILURES.has(status))
    return prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: { status },
    });
  if (status && status !== purchase.status)
    return prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: { status },
    });
  return purchase;
}

async function attachReferral(accountId: string, referralCode?: string | null) {
  const code = referralCode?.trim().toUpperCase();
  if (!code) return;
  const [account, referrer] = await Promise.all([
    prisma.validatorAccount.findUnique({
      where: { id: accountId },
      select: { referredById: true },
    }),
    prisma.validatorAccount.findUnique({
      where: { referralCode: code },
      select: { id: true },
    }),
  ]);
  if (!account?.referredById && referrer && referrer.id !== accountId) {
    await prisma.validatorAccount.update({
      where: { id: accountId },
      data: { referredById: referrer.id },
    });
  }
}

async function startPurchase(
  purchase: {
    accountId: string;
    accessKeyId?: string | null;
    email: string;
    planCode: string;
    planName: string;
    amountUsdCents: number;
    durationDays?: number | null;
    validatorAccess?: boolean;
    messagingAccess?: boolean;
    sessionLimit?: number | null;
    referralCode?: string | null;
  },
  origin: string,
) {
  if (purchase.amountUsdCents < 50)
    throw new Error("Paid purchases must cost at least $0.50");
  const claimToken = randomBytes(32).toString("base64url");
  const record = await prisma.validatorPurchase.create({
    data: {
      accountId: purchase.accountId,
      accessKeyId: purchase.accessKeyId || null,
      email: purchase.email,
      planCode: purchase.planCode,
      planName: purchase.planName,
      purchaseType: "plan",
      amountUsdCents: purchase.amountUsdCents,
      creditsAmount: 0,
      durationDays: purchase.durationDays,
      validatorAccess: purchase.validatorAccess ?? true,
      messagingAccess: purchase.messagingAccess ?? true,
      sessionLimit: purchase.sessionLimit,
      referralCode: purchase.referralCode,
      claimTokenHash: hash(claimToken),
    },
  });
  try {
    const callbackUrl = `${origin}/api/validator/billing/webhook/oxapay`;
    const returnUrl = `${origin}/buy?purchase=${encodeURIComponent(record.id)}&token=${encodeURIComponent(claimToken)}`;
    const invoice = await createInvoice({
      amount: purchase.amountUsdCents / 100,
      email: purchase.email,
      orderId: record.id,
      callbackUrl,
      returnUrl,
      description: `Signal Desk ${purchase.planName}`,
    });
    if (!invoice.trackId || !invoice.paymentUrl)
      throw new Error("OxaPay did not return a payment link");
    await prisma.validatorPurchase.update({
      where: { id: record.id },
      data: {
        providerTrackId: invoice.trackId,
        paymentUrl: invoice.paymentUrl,
        status: "new",
      },
    });
    return {
      purchaseId: record.id,
      claimToken,
      status: "new",
      paymentUrl: invoice.paymentUrl,
    };
  } catch (error) {
    await prisma.validatorPurchase
      .update({ where: { id: record.id }, data: { status: "failed" } })
      .catch(() => undefined);
    throw error;
  }
}

export async function startValidatorPlanPurchase(
  emailInput: string,
  planCode: ValidatorPlanCode,
  origin: string,
  referralCode?: string | null,
  existingAccount?: { id: string; email: string; accessKeyId: string | null } | null,
) {
  const email = existingAccount?.email || emailInput.trim().toLowerCase();
  const plans = await getValidatorPlans();
  const plan = plans[planCode];
  if (!plan?.enabled) throw new Error("This plan is not available");
  const account = existingAccount
    ? await prisma.validatorAccount.findUniqueOrThrow({ where: { id: existingAccount.id } })
    : await prisma.validatorAccount.upsert({
        where: { email },
        update: {},
        create: { email },
      });
  const existingKey = existingAccount?.accessKeyId
    ? { id: existingAccount.accessKeyId }
    : await prisma.validatorAccessKey.findFirst({
        where: { accountId: account.id, revoked: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  await ensureValidatorReferralCode(account.id);
  await attachReferral(account.id, referralCode);
  return startPurchase(
    {
      accountId: account.id,
      accessKeyId: existingKey?.id || null,
      email,
      planCode,
      planName: plan.name,
      amountUsdCents: plan.priceUsdCents,
      durationDays: plan.durationDays,
      validatorAccess: true,
      messagingAccess: true,
      sessionLimit: null,
      referralCode: referralCode?.trim().toUpperCase() || null,
    },
    origin,
  );
}

export async function getValidatorPurchase(
  purchaseId: string,
  claimToken: string,
  sync = true,
) {
  let purchase = await prisma.validatorPurchase.findUnique({
    where: { id: purchaseId },
    include: { accessKey: true, account: { select: { planExpiresAt: true } } },
  });
  if (!purchase || !claimMatches(claimToken, purchase.claimTokenHash))
    return null;
  const providerSyncDue = Date.now() - purchase.updatedAt.getTime() >= 10_000;
  if (
    sync &&
    providerSyncDue &&
    !purchase.fulfilledAt &&
    !["expired", "refunded", "failed"].includes(purchase.status)
  ) {
    await syncPayment(purchase.id).catch(() => undefined);
    purchase = await prisma.validatorPurchase.findUnique({
      where: { id: purchaseId },
      include: { accessKey: true, account: { select: { planExpiresAt: true } } },
    });
  }
  if (!purchase) return null;
  return {
    id: purchase.id,
    email: purchase.email,
    planCode: purchase.planCode,
    planName: purchase.planName,
    purchaseType: purchase.purchaseType,
    durationDays: purchase.durationDays,
    status: purchase.status,
    amountUsdCents: purchase.amountUsdCents,
    paymentUrl: purchase.paymentUrl,
    expiresAt: purchase.account.planExpiresAt,
    issued: !!purchase.fulfilledAt,
  };
}

export async function claimValidatorPurchase(
  purchaseId: string,
  claimToken: string,
) {
  const view = await getValidatorPurchase(purchaseId, claimToken, true);
  if (!view?.issued) return null;
  const purchase = await prisma.validatorPurchase.findUnique({
    where: { id: purchaseId },
    include: { accessKey: true },
  });
  if (!purchase) return null;
  const account = purchase.accessKey
    ? await createValidatorSessionForAccount(
        purchase.accountId,
        purchase.accessKey.id,
      )
    : null;
  await prisma.validatorPurchase.update({
    where: { id: purchase.id },
    data: { claimedAt: new Date() },
  });
  return {
    account,
    key: decryptValidatorAccessKey(purchase.accessKey?.rawKeyEncrypted || null),
    purchase: view,
  };
}

export async function processOxapayCallback(
  rawBody: string,
  signature: string,
) {
  const expected = createHmac("sha512", merchantKey())
    .update(rawBody)
    .digest("hex");
  const actualBuffer = Buffer.from(signature.toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  if (
    !signature ||
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  )
    throw new Error("Invalid OxaPay signature");
  const payload = JSON.parse(rawBody) as {
    type?: string;
    status?: string;
    order_id?: string;
    orderId?: string;
    track_id?: string;
    trackId?: string;
  };
  const orderId = payload.order_id || payload.orderId;
  const trackId = payload.track_id || payload.trackId;
  if (
    String(payload.type || "").toLowerCase() !== "invoice" ||
    !orderId ||
    !trackId
  )
    throw new Error("Invalid OxaPay callback");
  const purchase = await prisma.validatorPurchase.findUnique({
    where: { id: orderId },
  });
  if (
    !purchase ||
    (purchase.providerTrackId && purchase.providerTrackId !== trackId)
  )
    throw new Error("Purchase mismatch");
  const status = String(payload.status || "").toLowerCase();
  if (PAID_STATUSES.has(status)) {
    await prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: {
        providerTrackId: trackId,
        status: "paid",
        paidAt: purchase.paidAt || new Date(),
      },
    });
    await fulfillPurchase(purchase.id);
  } else if (status) {
    await prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: { status },
    });
  }
}
