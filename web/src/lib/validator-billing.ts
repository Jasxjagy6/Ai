import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createValidatorSessionForAccount } from "@/lib/validator-auth";
import { getValidatorPlans, ValidatorPlanCode } from "@/lib/validator-plans";

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

function rawKeyForPurchase(purchaseId: string) {
  const secret = process.env.VALIDATOR_KEY_SECRET || merchantKey();
  const value = createHmac("sha256", secret).update(`validator-purchase:${purchaseId}`).digest("base64url");
  return `tgv_${value}`;
}

function claimMatches(rawToken: string, tokenHash: string) {
  const actual = Buffer.from(hash(rawToken));
  const expected = Buffer.from(tokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function expiresAt(durationDays: number | null) {
  return durationDays == null ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
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
    throw new Error(body?.error?.message || body?.message || "OxaPay request failed");
  }
  return body as T;
}

async function oxapayLegacy<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.oxapay.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: merchantKey(), ...payload }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.result !== 100) throw new Error(body?.message || "OxaPay request failed");
  return body as T;
}

async function paymentInformation(trackId: string) {
  try {
    const response = await oxapay<{ data?: { status?: string; order_id?: string; amount?: number; currency?: string } }>(
      `/payment/${encodeURIComponent(trackId)}`,
    );
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
    const invoice = await oxapay<{ data?: { track_id?: string; payment_url?: string } }>("/payment/invoice", {
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
        thanks_message: "Payment confirmed. Return to Signal Desk to collect your access key.",
      }),
    });
    return { trackId: invoice.data?.track_id, paymentUrl: invoice.data?.payment_url };
  } catch {
    const invoice = await oxapayLegacy<{ trackId?: string; payLink?: string }>("/merchants/request", {
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

async function issuePurchase(purchaseId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${purchaseId}))`;
    const purchase = await transaction.validatorPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.accessKeyId) return purchase;

    const raw = rawKeyForPurchase(purchase.id);
    const key = await transaction.validatorAccessKey.create({
      data: {
        accountId: purchase.accountId,
        label: `${purchase.planName} access`,
        keyHash: hash(raw),
        prefix: `${raw.slice(0, 15)}...`,
        expiresAt: expiresAt(purchase.durationDays),
        requestLimit: purchase.requestLimit,
        planCode: purchase.planCode,
        validatorAccess: purchase.validatorAccess,
        messagingAccess: purchase.messagingAccess,
        sessionLimit: purchase.sessionLimit,
        messageLimit: purchase.messageLimit,
      },
    });
    return transaction.validatorPurchase.update({
      where: { id: purchase.id },
      data: {
        accessKeyId: key.id,
        status: "issued",
        paidAt: purchase.paidAt || new Date(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

async function syncPayment(purchaseId: string) {
  const purchase = await prisma.validatorPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || !purchase.providerTrackId || purchase.status === "issued") return purchase;
  const payment = await paymentInformation(purchase.providerTrackId);
  if (!payment || payment.order_id !== purchase.id) return purchase;
  const status = String(payment.status || "").toLowerCase();
  if (PAID_STATUSES.has(status)) {
    const amountCents = Math.round(Number(payment.amount || 0) * 100);
    if (String(payment.currency || "").toUpperCase() !== "USD" || amountCents < purchase.amountUsdCents) {
      throw new Error("OxaPay payment amount does not match the purchase");
    }
    return issuePurchase(purchase.id);
  }
  if (FINAL_FAILURES.has(status)) {
    return prisma.validatorPurchase.update({ where: { id: purchase.id }, data: { status } });
  }
  if (status && status !== purchase.status) {
    return prisma.validatorPurchase.update({ where: { id: purchase.id }, data: { status } });
  }
  return purchase;
}

export async function startValidatorPurchase(emailInput: string, planCode: ValidatorPlanCode, origin: string) {
  const email = emailInput.trim().toLowerCase();
  const plans = await getValidatorPlans();
  const plan = plans[planCode];
  if (!plan?.enabled) throw new Error("This access plan is not available");
  const claimToken = randomBytes(32).toString("base64url");
  const account = await prisma.validatorAccount.upsert({
    where: { email },
    update: { active: true },
    create: { email },
  });

  if (planCode === "trial") {
    const purchase = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const used = await transaction.validatorPurchase.findFirst({ where: { email, planCode: "trial" } });
      if (used) throw new Error("A free trial has already been used for this email");
      return transaction.validatorPurchase.create({
        data: {
          accountId: account.id,
          email,
          planCode,
          planName: plan.name,
          status: "paid",
          amountUsdCents: 0,
          durationDays: plan.durationDays,
          requestLimit: plan.requestLimit,
          validatorAccess: plan.validatorAccess,
          messagingAccess: plan.messagingAccess,
          sessionLimit: plan.sessionLimit,
          messageLimit: plan.messageLimit,
          claimTokenHash: hash(claimToken),
          paidAt: new Date(),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await issuePurchase(purchase.id);
    return { purchaseId: purchase.id, claimToken, status: "issued", paymentUrl: null };
  }

  if (plan.priceUsdCents < 50) throw new Error("Paid plans must cost at least $0.50");
  const purchase = await prisma.validatorPurchase.create({
    data: {
      accountId: account.id,
      email,
      planCode,
      planName: plan.name,
      amountUsdCents: plan.priceUsdCents,
      durationDays: plan.durationDays,
      requestLimit: plan.requestLimit,
      validatorAccess: plan.validatorAccess,
      messagingAccess: plan.messagingAccess,
      sessionLimit: plan.sessionLimit,
      messageLimit: plan.messageLimit,
      claimTokenHash: hash(claimToken),
    },
  });

  try {
    const callbackUrl = `${origin}/api/validator/billing/webhook/oxapay`;
    const returnUrl = `${origin}/validator/buy?purchase=${encodeURIComponent(purchase.id)}&token=${encodeURIComponent(claimToken)}`;
    const invoice = await createInvoice({
      amount: plan.priceUsdCents / 100,
      email,
      orderId: purchase.id,
      callbackUrl,
      returnUrl,
      description: `Signal Desk ${plan.name} validator access`,
    });
    const trackId = invoice.trackId;
    const paymentUrl = invoice.paymentUrl;
    if (!trackId || !paymentUrl) throw new Error("OxaPay did not return a payment link");
    await prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: { providerTrackId: trackId, paymentUrl, status: "new" },
    });
    return { purchaseId: purchase.id, claimToken, status: "new", paymentUrl };
  } catch (error) {
    await prisma.validatorPurchase.update({ where: { id: purchase.id }, data: { status: "failed" } }).catch(() => undefined);
    throw error;
  }
}

export async function getValidatorPurchase(purchaseId: string, claimToken: string, sync = true) {
  let purchase = await prisma.validatorPurchase.findUnique({
    where: { id: purchaseId },
    include: { accessKey: true },
  });
  if (!purchase || !claimMatches(claimToken, purchase.claimTokenHash)) return null;
  if (!purchase.accessKeyId && purchase.amountUsdCents === 0 && purchase.status === "paid") {
    await issuePurchase(purchase.id);
    purchase = await prisma.validatorPurchase.findUnique({ where: { id: purchaseId }, include: { accessKey: true } });
  }
  if (!purchase) return null;
  const providerSyncDue = Date.now() - purchase.updatedAt.getTime() >= 10_000;
  if (sync && providerSyncDue && !["issued", "expired", "refunded", "failed"].includes(purchase.status)) {
    await syncPayment(purchase.id).catch(() => undefined);
    purchase = await prisma.validatorPurchase.findUnique({ where: { id: purchaseId }, include: { accessKey: true } });
  }
  if (!purchase) return null;
  return {
    id: purchase.id,
    email: purchase.email,
    planCode: purchase.planCode,
    planName: purchase.planName,
    status: purchase.status,
    amountUsdCents: purchase.amountUsdCents,
    paymentUrl: purchase.paymentUrl,
    expiresAt: purchase.accessKey?.expiresAt || null,
    requestLimit: purchase.requestLimit,
    requestsUsed: purchase.accessKey?.requestsUsed || 0,
    validatorAccess: purchase.validatorAccess,
    messagingAccess: purchase.messagingAccess,
    sessionLimit: purchase.sessionLimit,
    messageLimit: purchase.messageLimit,
    messagesUsed: purchase.accessKey?.messagesUsed || 0,
    issued: !!purchase.accessKeyId,
  };
}

export async function claimValidatorPurchase(purchaseId: string, claimToken: string) {
  const view = await getValidatorPurchase(purchaseId, claimToken, true);
  if (!view || !view.issued) return null;
  const purchase = await prisma.validatorPurchase.findUnique({ where: { id: purchaseId }, include: { accessKey: true } });
  if (!purchase?.accessKey) return null;
  const account = await createValidatorSessionForAccount(purchase.accountId, purchase.accessKey.id, purchase.accessKey.expiresAt);
  await prisma.validatorPurchase.update({ where: { id: purchase.id }, data: { claimedAt: new Date() } });
  return { account, key: rawKeyForPurchase(purchase.id), purchase: view };
}

export async function processOxapayCallback(rawBody: string, signature: string) {
  const expected = createHmac("sha512", merchantKey()).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature.toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  if (!signature || actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("Invalid OxaPay signature");
  }
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
  if (String(payload.type || "").toLowerCase() !== "invoice" || !orderId || !trackId) throw new Error("Invalid OxaPay callback");
  const purchase = await prisma.validatorPurchase.findUnique({ where: { id: orderId } });
  if (!purchase || (purchase.providerTrackId && purchase.providerTrackId !== trackId)) throw new Error("Purchase mismatch");
  const status = String(payload.status || "").toLowerCase();
  if (PAID_STATUSES.has(status)) {
    await prisma.validatorPurchase.update({
      where: { id: purchase.id },
      data: { providerTrackId: trackId, status: "paid", paidAt: purchase.paidAt || new Date() },
    });
    await issuePurchase(purchase.id);
  } else if (status) {
    await prisma.validatorPurchase.update({ where: { id: purchase.id }, data: { status } });
  }
}
