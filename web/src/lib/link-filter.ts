import { Prisma } from "@prisma/client";
import { ProxyAgent, request } from "undici";
import { prisma } from "@/lib/prisma";
import { ListError, normalizeUsername } from "@/lib/lists";
import {
  debitValidatorCredits,
  quoteValidatorTask,
} from "@/lib/validator-credits";

const MAX_ITEMS = Math.max(
  1,
  Number(process.env.LINK_FILTER_MAX_ITEMS || 200000),
);
const CONCURRENCY = Math.max(
  1,
  Math.min(64, Number(process.env.LINK_FILTER_CONCURRENCY || 10)),
);
const REQUEST_GAP_MS = Math.max(
  0,
  Number(process.env.LINK_FILTER_GAP_MS || 110),
);
const REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.LINK_FILTER_TIMEOUT_MS || 8000),
);
const HTTP_RETRIES = Math.max(0, Number(process.env.LINK_FILTER_RETRIES || 2));
const MAX_PASSES = Math.max(1, Number(process.env.LINK_FILTER_MAX_PASSES || 6));
const PASS_COOLDOWN_MS = Math.max(
  0,
  Number(process.env.LINK_FILTER_PASS_COOLDOWN_MS || 20000),
);
const PROXY_COUNT = Math.max(
  0,
  Number(process.env.LINK_FILTER_PROXY_COUNT || 3),
);
const MAX_TOTAL_MS = Math.max(
  60000,
  Number(process.env.LINK_FILTER_MAX_TOTAL_MS || 18000000),
);
const BREAKER_CONSECUTIVE = Math.max(
  10,
  Number(process.env.LINK_FILTER_BREAKER_CONSEC || 120),
);
const BREAKER_PAUSE_MS = Math.max(
  1000,
  Number(process.env.LINK_FILTER_BREAKER_PAUSE_MS || 20000),
);
const WORKER_TICK_MS = Math.max(
  1000,
  Number(process.env.LINK_FILTER_JOB_TICK_MS || 3000),
);
const STALE_MINUTES = Math.max(
  2,
  Number(process.env.LINK_FILTER_STALE_JOB_MINUTES || 10),
);
const USER_AGENT =
  process.env.LINK_FILTER_UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const PROXY_SOURCES = [
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
];

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

type CheckResult = {
  normalized: string;
  username: string;
  status: "valid" | "invalid" | "failed";
  displayName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  kind: "user" | "not_found" | "generic" | "error";
};

type JobRow = {
  id: string;
  accountId: string;
  resultListId: string | null;
  totalRequests: number;
  useProxies: boolean;
};

function extractMeta(html: string, property: string) {
  const direct = html.match(
    new RegExp(
      `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
  );
  if (direct) return direct[1];
  return (
    html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${property}["']`,
        "i",
      ),
    )?.[1] || ""
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(Number(number)));
}

export function classifyTmeHtml(html: string) {
  const title = decodeEntities(extractMeta(html, "title")).trim();
  const contact = /^Telegram:\s*Contact\s*@/i.test(title);
  const generic =
    /^Telegram\s*[\u2013-]\s*a new era of messaging/i.test(title) ||
    title === "Telegram" ||
    /^Telegram Messenger/i.test(title);
  const hasPageTitle = /tgme_page_title/.test(html);
  if (hasPageTitle && title && !contact)
    return {
      valid: true,
      displayName: title,
      kind: "user" as const,
      reason: "RESOLVED",
    };
  if (generic && !hasPageTitle)
    return {
      valid: false,
      displayName: null,
      kind: "generic" as const,
      reason: "GENERIC_PAGE",
    };
  return {
    valid: false,
    displayName: null,
    kind: "not_found" as const,
    reason: "NOT_FOUND",
  };
}

async function fetchUsername(
  username: string,
  dispatcher: ProxyAgent | null,
): Promise<Omit<CheckResult, "normalized" | "username">> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    try {
      const response = await request(
        `https://t.me/${encodeURIComponent(username)}`,
        {
          method: "GET",
          dispatcher: dispatcher || undefined,
          headers: { "user-agent": USER_AGENT, accept: "text/html" },
          bodyTimeout: REQUEST_TIMEOUT_MS,
          headersTimeout: REQUEST_TIMEOUT_MS,
        },
      );
      const html = await response.body.text();
      if (response.statusCode === 429 || response.statusCode >= 500) {
        lastError = new Error(`HTTP ${response.statusCode}`);
        await sleep(300 * (attempt + 1));
        continue;
      }
      const classified = classifyTmeHtml(html);
      return {
        status: classified.valid ? "valid" : "invalid",
        displayName: classified.displayName?.slice(0, 100) || null,
        errorCode: classified.valid ? null : classified.reason,
        errorMessage: null,
        kind: classified.kind,
      };
    } catch (error) {
      lastError = error;
      await sleep(200 * (attempt + 1));
    }
  }
  return {
    status: "failed",
    displayName: null,
    errorCode: "CHECK_FAILED",
    errorMessage:
      lastError instanceof Error ? lastError.message : "Request failed",
    kind: "error",
  };
}

async function fetchProxyCandidates() {
  const candidates = new Set<string>();
  for (const source of PROXY_SOURCES) {
    try {
      const response = await request(source, {
        bodyTimeout: 12000,
        headersTimeout: 12000,
      });
      const body = await response.body.text();
      for (const line of body.split("\n")) {
        const value = line.trim();
        if (/^(\d{1,3}\.){3}\d{1,3}:\d{2,5}$/.test(value))
          candidates.add(value);
      }
      if (candidates.size >= 500) break;
    } catch {
      // A missing public source should not prevent direct-IP fallback.
    }
  }
  return [...candidates];
}

async function proxyWorks(proxyUrl: string) {
  const agent = new ProxyAgent(proxyUrl);
  try {
    const response = await request("https://t.me/telegram", {
      dispatcher: agent,
      headers: { "user-agent": USER_AGENT },
      bodyTimeout: 5000,
      headersTimeout: 5000,
    });
    const body = await response.body.text();
    return response.statusCode === 200 && body.length > 1000;
  } catch {
    return false;
  } finally {
    await agent.close().catch(() => undefined);
  }
}

async function getProxyAgents(count: number) {
  if (!count) return [];
  const candidates = (await fetchProxyCandidates())
    .sort(() => Math.random() - 0.5)
    .slice(0, 40);
  const working: ProxyAgent[] = [];
  for (
    let offset = 0;
    offset < candidates.length && working.length < count;
    offset += 5
  ) {
    const batch = candidates.slice(offset, offset + 5);
    const results = await Promise.all(
      batch.map(async (address) => {
        const url = `http://${address}`;
        return (await proxyWorks(url)) ? url : null;
      }),
    );
    for (const url of results) {
      if (url && working.length < count) working.push(new ProxyAgent(url));
    }
  }
  return working;
}

function jobView(
  job: Prisma.LinkFilterJobGetPayload<Record<string, never>>,
  recentItems: Array<{
    id: string;
    username: string;
    status: string;
    displayName: string | null;
    attempts: number;
    errorCode: string | null;
    errorMessage: string | null;
    finishedAt: Date | null;
  }> = [],
) {
  const handled = Math.min(
    job.totalCount,
    job.processedCount + job.skippedCount,
  );
  return {
    id: job.id,
    status: job.status,
    validationMethod: "link",
    sourceListId: job.sourceListId,
    sourceListName: job.sourceListName,
    resultListId: job.resultListId,
    resultListName: job.resultListName,
    sourceItemsCount: job.sourceItemsCount,
    totalCount: job.totalCount,
    processedCount: job.processedCount,
    validCount: job.validCount,
    invalidCount: job.invalidCount,
    failedCount: job.failedCount,
    skippedCount: job.skippedCount,
    ignoredCount: job.ignoredCount,
    duplicateCount: job.duplicateCount,
    handledCount: handled,
    progressPct: job.totalCount
      ? Math.round((handled / job.totalCount) * 100)
      : 100,
    currentPass: job.currentPass,
    maxPasses: job.maxPasses,
    passProcessedCount: job.passProcessedCount,
    passTotalCount: job.passTotalCount,
    passProgressPct: job.passTotalCount
      ? Math.round((job.passProcessedCount / job.passTotalCount) * 100)
      : 0,
    totalRequests: job.totalRequests,
    timedOut: job.timedOut,
    currentUsername: job.currentUsername,
    cancelRequested: job.cancelRequested,
    useProxies: job.useProxies,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    lastProgressAt: job.lastProgressAt,
    recentItems,
  };
}

export async function startLinkFilterJob(
  accountId: string,
  sourceListId: string,
  requestedName: string,
  useProxies = true,
  accessKeyId: string | null = null,
) {
  const source = await prisma.contactList.findFirst({
    where: { id: sourceListId, accountId },
  });
  if (!source)
    throw new ListError("Source list not found", 404, "SOURCE_LIST_NOT_FOUND");
  if (source.type === "profile")
    throw new ListError(
      "Profile lists cannot be link-filtered",
      400,
      "INVALID_SOURCE_LIST_TYPE",
    );
  const sourceItems = await prisma.listItem.findMany({
    where: { listId: sourceListId },
    select: { id: true, username: true },
    orderBy: [{ addedAt: "asc" }, { id: "asc" }],
  });
  if (sourceItems.length > MAX_ITEMS) {
    throw new ListError(
      `Link filtering supports at most ${MAX_ITEMS.toLocaleString()} rows`,
      400,
      "SOURCE_LIST_TOO_LARGE",
    );
  }
  const candidates: Array<{
    sourceListItemId: string;
    username: string;
    normalizedUsername: string;
  }> = [];
  const seen = new Set<string>();
  let ignoredCount = 0;
  let duplicateCount = 0;
  for (const item of sourceItems) {
    const username = normalizeUsername(item.username);
    if (!username) {
      ignoredCount++;
      continue;
    }
    const normalizedUsername = username.toLowerCase();
    if (seen.has(normalizedUsername)) {
      duplicateCount++;
      continue;
    }
    seen.add(normalizedUsername);
    candidates.push({
      sourceListItemId: item.id,
      username,
      normalizedUsername,
    });
  }
  if (!candidates.length)
    throw new ListError(
      "The source list contains no usable usernames",
      400,
      "NO_USERNAMES",
    );
  const resultListName = (
    requestedName.trim() || `${source.name} - Valid Usernames`
  ).slice(0, 255);
  const creditQuote = await quoteValidatorTask("validator_run", {
    items: candidates.length,
  });

  try {
    const job = await prisma.$transaction(
      async (transaction) => {
        const resultList = await transaction.contactList.create({
          data: {
            accountId,
            name: resultListName,
            type: "users",
            source: "link_filter",
            itemsCount: 0,
          },
        });
        const created = await transaction.linkFilterJob.create({
          data: {
            accountId,
            sourceListId,
            resultListId: resultList.id,
            sourceListName: source.name,
            resultListName,
            sourceItemsCount: sourceItems.length,
            totalCount: candidates.length,
            ignoredCount,
            duplicateCount,
            maxPasses: MAX_PASSES,
            useProxies,
            creditsCharged: creditQuote.credits,
          },
        });
        await debitValidatorCredits(transaction, {
          accountId,
          accessKeyId,
          credits: creditQuote.credits,
          taskCode: "validator_run",
          description: `Validate ${candidates.length.toLocaleString()} usernames`,
          referenceType: "validation_job",
          referenceId: created.id,
          metadata: { candidates: candidates.length, useProxies },
        });
        if (accessKeyId) {
          await transaction.validatorAccessKey.updateMany({
            where: { id: accessKeyId, accountId },
            data: { requestsUsed: { increment: candidates.length } },
          });
        }
        for (let offset = 0; offset < candidates.length; offset += 1000) {
          await transaction.linkFilterItem.createMany({
            data: candidates
              .slice(offset, offset + 1000)
              .map((candidate) => ({ jobId: created.id, ...candidate })),
          });
        }
        return created;
      },
      { timeout: 120000 },
    );
    kickLinkFilterWorker();
    return jobView(job);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ListError(
        "A link-filter job is already active for this account",
        409,
        "LINK_FILTER_ALREADY_RUNNING",
      );
    }
    throw error;
  }
}

export async function listLinkFilterJobs(accountId: string, limit = 20) {
  const jobs = await prisma.linkFilterJob.findMany({
    where: { accountId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(100, limit || 20)),
  });
  return jobs.map((job) => jobView(job));
}

export async function getLinkFilterJob(accountId: string, jobId: string) {
  const job = await prisma.linkFilterJob.findFirst({
    where: { id: jobId, accountId },
  });
  if (!job)
    throw new ListError("Link-filter job not found", 404, "JOB_NOT_FOUND");
  const recentItems = await prisma.linkFilterItem.findMany({
    where: { jobId, status: { not: "pending" } },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      username: true,
      status: true,
      displayName: true,
      attempts: true,
      errorCode: true,
      errorMessage: true,
      finishedAt: true,
    },
  });
  return jobView(job, recentItems);
}

export async function cancelLinkFilterJob(accountId: string, jobId: string) {
  const job = await prisma.linkFilterJob.findFirst({
    where: { id: jobId, accountId },
  });
  if (!job)
    throw new ListError("Link-filter job not found", 404, "JOB_NOT_FOUND");
  if (!["pending", "running"].includes(job.status)) return jobView(job);
  const updated = await prisma.linkFilterJob.update({
    where: { id: jobId },
    data: { cancelRequested: true, lastProgressAt: new Date() },
  });
  if (job.status === "pending")
    await finishJob(jobId, "cancelled", false, "Job cancelled by operator");
  return getLinkFilterJob(accountId, jobId).catch(() => jobView(updated));
}

async function persistResults(job: JobRow, results: CheckResult[]) {
  if (!results.length) return;
  await prisma.$transaction(
    async (transaction) => {
      const valid = results.filter((result) => result.status === "valid");
      if (valid.length && job.resultListId) {
        await transaction.listItem.createMany({
          data: valid.map((result) => ({
            listId: job.resultListId!,
            username: result.username.slice(0, 100),
            firstName: result.displayName,
          })),
        });
      }
      const payload = JSON.stringify(
        results.map((result) => ({
          normalized: result.normalized,
          status: result.status,
          displayName: result.displayName,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        })),
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "LinkFilterItem" AS item
          SET "status" = input.status,
              "displayName" = input."displayName",
              "attempts" = item."attempts" + 1,
              "errorCode" = input."errorCode",
              "errorMessage" = input."errorMessage",
              "finishedAt" = NOW()
         FROM jsonb_to_recordset($2::jsonb) AS input(
           normalized TEXT, status TEXT, "displayName" TEXT, "errorCode" TEXT, "errorMessage" TEXT
         )
        WHERE item."jobId" = $1
          AND item."normalizedUsername" = input.normalized
          AND item."status" = 'pending'`,
        job.id,
        payload,
      );
      const grouped = await transaction.linkFilterItem.groupBy({
        by: ["status"],
        where: { jobId: job.id },
        _count: { _all: true },
      });
      const count = (status: string) =>
        grouped.find((row) => row.status === status)?._count._all || 0;
      const validCount = count("valid");
      const invalidCount = count("invalid");
      const failedCount = count("failed");
      await transaction.linkFilterJob.update({
        where: { id: job.id },
        data: {
          validCount,
          invalidCount,
          failedCount,
          processedCount: validCount + invalidCount + failedCount,
          lastProgressAt: new Date(),
        },
      });
      if (job.resultListId) {
        await transaction.contactList.update({
          where: { id: job.resultListId },
          data: { itemsCount: validCount },
        });
      }
    },
    { timeout: 30000 },
  );
}

function finalNotFound(candidate: {
  username: string;
  normalizedUsername: string;
}): CheckResult {
  return {
    username: candidate.username,
    normalized: candidate.normalizedUsername,
    status: "invalid",
    displayName: null,
    errorCode: "NOT_FOUND_AFTER_RECHECKS",
    errorMessage: null,
    kind: "not_found",
  };
}

async function finishJob(
  jobId: string,
  status: "completed" | "cancelled" | "failed",
  timedOut: boolean,
  message: string | null,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.linkFilterItem.updateMany({
      where: { jobId, status: "pending" },
      data: {
        status: "skipped",
        errorCode: timedOut
          ? "TIME_BUDGET_EXCEEDED"
          : status === "cancelled"
            ? "CANCELLED"
            : "JOB_FAILED",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    const grouped = await transaction.linkFilterItem.groupBy({
      by: ["status"],
      where: { jobId },
      _count: { _all: true },
    });
    const count = (value: string) =>
      grouped.find((row) => row.status === value)?._count._all || 0;
    const validCount = count("valid");
    const invalidCount = count("invalid");
    const failedCount = count("failed");
    await transaction.linkFilterJob.update({
      where: { id: jobId },
      data: {
        status,
        validCount,
        invalidCount,
        failedCount,
        skippedCount: count("skipped"),
        processedCount: validCount + invalidCount + failedCount,
        currentUsername: null,
        timedOut,
        errorMessage: message,
        finishedAt: new Date(),
        lastProgressAt: new Date(),
      },
    });
  });
}

async function claimNextJob() {
  const rows = await prisma.$queryRaw<JobRow[]>`
    WITH next_job AS (
      SELECT "id" FROM "LinkFilterJob"
       WHERE "status" = 'pending' AND "cancelRequested" = false
       ORDER BY "createdAt" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
    )
    UPDATE "LinkFilterJob" AS job
       SET "status" = 'running',
           "startedAt" = COALESCE(job."startedAt", NOW()),
           "lastProgressAt" = NOW(),
           "errorMessage" = NULL
      FROM next_job
     WHERE job."id" = next_job."id"
     RETURNING job."id", job."accountId", job."resultListId", job."totalRequests", job."useProxies"
  `;
  return rows[0] || null;
}

async function processJob(job: JobRow) {
  let pending = await prisma.linkFilterItem.findMany({
    where: { jobId: job.id, status: "pending" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { username: true, normalizedUsername: true },
  });
  if (!pending.length) {
    console.log(
      "[link-filter] Job %s has no pending items, finishing",
      job.id.slice(-9),
    );
    await finishJob(job.id, "completed", false, null);
    return;
  }
  console.log(
    "[link-filter] Processing job %s — %d pending items (max %d)",
    job.id.slice(-9),
    pending.length,
    MAX_ITEMS,
  );
  const deadline = Date.now() + MAX_TOTAL_MS;
  let proxyAgents: ProxyAgent[] = [];
  if (job.useProxies) {
    console.log("[link-filter] Fetching up to %d proxy agents...", PROXY_COUNT);
    const proxyStart = Date.now();
    proxyAgents = await getProxyAgents(PROXY_COUNT).catch(() => []);
    console.log(
      "[link-filter] Proxy discovery took %dms, got %d agents",
      Date.now() - proxyStart,
      proxyAgents.length,
    );
  } else {
    console.log("[link-filter] Proxies disabled by user — using direct VPS IP");
  }
  const dispatchers: Array<ProxyAgent | null> = proxyAgents.length
    ? [...proxyAgents, null]
    : [null];
  console.log(
    "[link-filter] Using %d dispatchers for job %s",
    dispatchers.length,
    job.id.slice(-9),
  );
  let totalRequests = job.totalRequests || 0;
  let cancelled = false;
  let timedOut = false;
  let lastProgress = 0;

  try {
    for (let pass = 1; pass <= MAX_PASSES && pending.length; pass++) {
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
      if (pass > 1) {
        console.log(
          "[link-filter] Job %s pass %d/%d rechecking %d usernames",
          job.id.slice(-9),
          pass,
          MAX_PASSES,
          pending.length,
        );
        await sleep(Math.min(PASS_COOLDOWN_MS, deadline - Date.now()));
        if (Date.now() > deadline) {
          timedOut = true;
          break;
        }
      }

      const row = await prisma.linkFilterJob.findUnique({
        where: { id: job.id },
        select: { cancelRequested: true },
      });
      if (row?.cancelRequested) {
        console.log(
          "[link-filter] Job %s cancellation requested, stopping before pass %d",
          job.id.slice(-9),
          pass,
        );
        cancelled = true;
        break;
      }

      const passCandidates = pending;
      const retryCandidates: typeof pending = [];
      let index = 0;
      let checked = 0;
      const finalPass = pass === MAX_PASSES;

      await prisma.linkFilterJob.update({
        where: { id: job.id },
        data: {
          currentPass: pass,
          passTotalCount: passCandidates.length,
          passProcessedCount: 0,
          currentUsername: null,
        },
      });

      const worker = async (workerIndex: number) => {
        let dispatcherIndex = workerIndex % dispatchers.length;
        let consecutiveMisses = 0;
        const buffered: CheckResult[] = [];
        const flush = async () => {
          if (!buffered.length) return;
          const batch = buffered.splice(0, buffered.length);
          await persistResults(job, batch);
        };
        try {
          while (
            index < passCandidates.length &&
            !cancelled &&
            !timedOut
          ) {
            if (Date.now() > deadline) {
              timedOut = true;
              break;
            }
            const candidate = passCandidates[index++];
            let result = await fetchUsername(
              candidate.username,
              dispatchers[dispatcherIndex],
            );
            if (result.kind === "error" && dispatchers.length > 1) {
              dispatcherIndex = (dispatcherIndex + 1) % dispatchers.length;
              result = await fetchUsername(
                candidate.username,
                dispatchers[dispatcherIndex],
              );
            }
            const complete: CheckResult = {
              username: candidate.username,
              normalized: candidate.normalizedUsername,
              ...result,
            };
            if (
              complete.status === "valid" ||
              complete.kind === "generic" ||
              finalPass
            ) {
              buffered.push(complete);
            } else {
              retryCandidates.push(candidate);
            }
            checked++;
            totalRequests++;
            if (result.kind === "not_found") {
              consecutiveMisses++;
              if (consecutiveMisses >= BREAKER_CONSECUTIVE) {
                consecutiveMisses = 0;
                dispatcherIndex =
                  (dispatcherIndex + 1) % dispatchers.length;
                await sleep(BREAKER_PAUSE_MS);
              }
            } else if (result.kind === "user") {
              consecutiveMisses = 0;
            }
            if (buffered.length >= 50) await flush();

            const now = Date.now();
            if (now - lastProgress >= 500 || checked % 20 === 0) {
              lastProgress = now;
              const current = await prisma.linkFilterJob.update({
                where: { id: job.id },
                data: {
                  passProcessedCount: checked,
                  totalRequests,
                  currentUsername: candidate.username,
                  lastProgressAt: new Date(),
                },
                select: { cancelRequested: true },
              });
              cancelled = current.cancelRequested;
            }
            if (REQUEST_GAP_MS) await sleep(REQUEST_GAP_MS);
          }
        } finally {
          await flush();
        }
      };

      console.log(
        "[link-filter] Launching %d workers for job %s pass %d/%d",
        Math.min(CONCURRENCY, passCandidates.length),
        job.id.slice(-9),
        pass,
        MAX_PASSES,
      );
      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, passCandidates.length) },
          (_, workerIndex) => worker(workerIndex),
        ),
      );
      if (cancelled || timedOut) break;

      const converged =
        pass > 1 && retryCandidates.length === passCandidates.length;
      pending = retryCandidates;
      if (converged) {
        console.log(
          "[link-filter] Job %s converged after pass %d",
          job.id.slice(-9),
          pass,
        );
        break;
      }
    }

    if (!cancelled && !timedOut && pending.length) {
      for (let offset = 0; offset < pending.length; offset += 1000) {
        await persistResults(
          job,
          pending.slice(offset, offset + 1000).map(finalNotFound),
        );
      }
      pending = [];
    }

    const outcome = cancelled
      ? "cancelled"
      : timedOut
        ? "completed (timed out)"
        : "completed";
    console.log(
      "[link-filter] Job %s finished: %s (%d requests)",
      job.id.slice(-9),
      outcome,
      totalRequests,
    );
    if (cancelled)
      await finishJob(job.id, "cancelled", false, "Job cancelled by operator");
    else if (timedOut)
      await finishJob(
        job.id,
        "completed",
        true,
        "Stopped at the 300-minute time budget; confirmed results were preserved",
      );
    else await finishJob(job.id, "completed", false, null);
  } catch (error) {
    console.error(
      "[link-filter] Job %s crashed: %s",
      job.id.slice(-9),
      error instanceof Error ? error.message : error,
    );
    await finishJob(
      job.id,
      "failed",
      false,
      error instanceof Error ? error.message : "Link-filter job failed",
    ).catch(() => undefined);
  } finally {
    await Promise.all(
      proxyAgents.map((agent) => agent.close().catch(() => undefined)),
    );
  }
}

let workerTimer: NodeJS.Timeout | null = null;
let sweepRunning = false;

async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const cancelled = await prisma.linkFilterJob.findMany({
    where: {
      status: "running",
      cancelRequested: true,
      lastProgressAt: { lt: staleBefore },
    },
    select: { id: true },
  });
  for (const job of cancelled)
    await finishJob(job.id, "cancelled", false, "Job cancelled by operator");
  await prisma.linkFilterJob.updateMany({
    where: {
      status: "running",
      cancelRequested: false,
      lastProgressAt: { lt: staleBefore },
    },
    data: {
      status: "pending",
      currentUsername: null,
      currentPass: 0,
      passProcessedCount: 0,
      passTotalCount: 0,
      startedAt: null,
      finishedAt: null,
      lastProgressAt: new Date(),
    },
  });
}

async function runSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    await recoverStaleJobs();
    const job = await claimNextJob();
    if (job) await processJob(job);
  } finally {
    sweepRunning = false;
  }
}

export function startLinkFilterWorker() {
  if (workerTimer) {
    console.log("[link-filter] Worker already running");
    return;
  }
  console.log(
    "[link-filter] Starting worker (tick=%dms, concurrency=%d, gap=%dms, passes=%d, passCooldown=%dms, proxies=%d)",
    WORKER_TICK_MS,
    CONCURRENCY,
    REQUEST_GAP_MS,
    MAX_PASSES,
    PASS_COOLDOWN_MS,
    PROXY_COUNT,
  );
  void runSweep().catch((error) =>
    console.error("[link-filter] Worker failed on first sweep", error),
  );
  workerTimer = setInterval(() => {
    void runSweep().catch((error) =>
      console.error("[link-filter] Worker failed", error),
    );
  }, WORKER_TICK_MS);
  workerTimer.unref?.();
}

export function kickLinkFilterWorker() {
  startLinkFilterWorker();
  void runSweep().catch((error) =>
    console.error("Link-filter worker failed", error),
  );
}
