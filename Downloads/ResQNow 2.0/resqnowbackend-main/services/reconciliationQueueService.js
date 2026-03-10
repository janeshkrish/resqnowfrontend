import IORedis from "ioredis";
import { Queue, QueueEvents, Worker } from "bullmq";
import {
  hasReconciliationConfiguration,
  runPaymentReconciliation,
} from "./reconciliationService.js";

export const RECONCILIATION_QUEUE_NAME = "payment-reconciliation-queue";
const RECONCILIATION_JOB_NAME = "reconcile-payments";
const RECONCILIATION_SCHEDULE_JOB_ID = "reconcile-payments:hourly";

const RECONCILIATION_WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.RECON_WORKER_CONCURRENCY || 1)
);
const RECONCILIATION_RETRY_ATTEMPTS = Math.max(
  1,
  Number(process.env.RECON_JOB_RETRY_ATTEMPTS || 3)
);
const RECONCILIATION_RETRY_DELAY_MS = Math.max(
  1000,
  Number(process.env.RECON_JOB_RETRY_DELAY_MS || 5000)
);
const RECONCILIATION_CRON = String(
  process.env.RECONCILIATION_CRON || "0 * * * *"
).trim();

let queue = null;
let worker = null;
let queueEvents = null;

let producerConnection = null;
let workerConnection = null;
let eventsConnection = null;

function redisUrl() {
  return String(process.env.REDIS_URL || "").trim();
}

function scheduleEnabled() {
  const raw = String(process.env.RECONCILIATION_SCHEDULE_ENABLED || "true")
    .trim()
    .toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

export function isReconciliationQueueEnabled() {
  return Boolean(redisUrl()) && hasReconciliationConfiguration();
}

function createRedisConnection(label) {
  const connection = new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectionName: `resqnow_${label}`,
  });

  connection.on("connect", () => {
    console.log(`[Reconciliation Queue] Redis connected (${label}).`);
  });
  connection.on("ready", () => {
    console.log(`[Reconciliation Queue] Redis ready (${label}).`);
  });
  connection.on("error", (error) => {
    console.error(`[Reconciliation Queue] Redis error (${label}):`, error?.message || error);
  });
  connection.on("close", () => {
    console.warn(`[Reconciliation Queue] Redis connection closed (${label}).`);
  });

  return connection;
}

async function getProducerConnection() {
  if (producerConnection) return producerConnection;
  producerConnection = createRedisConnection("reconciliation_producer");
  await producerConnection.connect();
  return producerConnection;
}

async function getWorkerConnection() {
  if (workerConnection) return workerConnection;
  workerConnection = createRedisConnection("reconciliation_worker");
  await workerConnection.connect();
  return workerConnection;
}

async function getEventsConnection() {
  if (eventsConnection) return eventsConnection;
  eventsConnection = createRedisConnection("reconciliation_events");
  await eventsConnection.connect();
  return eventsConnection;
}

function toPositiveInt(value, min = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) return null;
  return parsed;
}

function buildReconciliationPayload(input = {}) {
  const lookbackHours = toPositiveInt(input.lookbackHours, 1);
  const maxPayments = toPositiveInt(input.maxPayments, 10);
  const triggerSource = String(input.triggerSource || input.source || "scheduled")
    .trim()
    .slice(0, 64);
  const initiatedBy = String(input.initiatedBy || "")
    .trim()
    .slice(0, 255);
  const runKey = String(input.runKey || "").trim();

  return {
    ...(lookbackHours ? { lookbackHours } : {}),
    ...(maxPayments ? { maxPayments } : {}),
    triggerSource: triggerSource || "scheduled",
    ...(initiatedBy ? { initiatedBy } : {}),
    ...(runKey ? { runKey } : {}),
  };
}

async function getReconciliationQueue() {
  if (!isReconciliationQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue(RECONCILIATION_QUEUE_NAME, {
    connection: await getProducerConnection(),
    defaultJobOptions: {
      attempts: RECONCILIATION_RETRY_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: RECONCILIATION_RETRY_DELAY_MS,
      },
      removeOnComplete: 2000,
      removeOnFail: 2000,
    },
  });
  return queue;
}

async function ensureScheduledReconciliationJob() {
  if (!scheduleEnabled()) {
    return { scheduled: false, reason: "schedule_disabled" };
  }

  const q = await getReconciliationQueue();
  if (!q) return { scheduled: false, reason: "queue_unavailable" };

  await q.add(
    RECONCILIATION_JOB_NAME,
    { triggerSource: "scheduled" },
    {
      jobId: RECONCILIATION_SCHEDULE_JOB_ID,
      repeat: {
        cron: RECONCILIATION_CRON,
      },
    }
  );

  return { scheduled: true, cron: RECONCILIATION_CRON };
}

async function processReconciliationJob(job) {
  if (!job || job.name !== RECONCILIATION_JOB_NAME) {
    return { skipped: true, reason: `unsupported_job:${job?.name || "unknown"}` };
  }
  const payload = buildReconciliationPayload(job.data || {});
  return runPaymentReconciliation(payload);
}

export async function enqueueReconciliationJob(payload = {}, options = {}) {
  const normalizedPayload = buildReconciliationPayload(payload);
  if (!isReconciliationQueueEnabled()) {
    return { queued: false, reason: "reconciliation_queue_not_configured" };
  }

  try {
    const q = await getReconciliationQueue();
    if (!q) return { queued: false, reason: "queue_unavailable" };

    const delayMs = Math.max(0, Number(options.delayMs || 0));
    const jobId = String(options.jobId || `reconcile-payments:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);

    const job = await q.add(RECONCILIATION_JOB_NAME, normalizedPayload, {
      delay: delayMs,
      jobId,
      attempts: RECONCILIATION_RETRY_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: RECONCILIATION_RETRY_DELAY_MS,
      },
    });

    return {
      queued: true,
      queueJobId: job?.id || null,
    };
  } catch (error) {
    console.error("[Reconciliation Queue] Failed to enqueue job:", error?.message || error);
    return {
      queued: false,
      reason: "enqueue_failed",
      error: error?.message || String(error),
    };
  }
}

export async function getReconciliationQueueMetrics() {
  if (!isReconciliationQueueEnabled()) {
    return {
      enabled: false,
      queueName: RECONCILIATION_QUEUE_NAME,
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      },
      scheduled: {
        enabled: scheduleEnabled(),
        cron: RECONCILIATION_CRON,
        count: 0,
      },
    };
  }

  const q = await getReconciliationQueue();
  const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  let repeatableJobs = [];
  try {
    repeatableJobs = await q.getRepeatableJobs();
  } catch {
    repeatableJobs = [];
  }

  return {
    enabled: true,
    queueName: RECONCILIATION_QUEUE_NAME,
    counts,
    scheduled: {
      enabled: scheduleEnabled(),
      cron: RECONCILIATION_CRON,
      count: Array.isArray(repeatableJobs) ? repeatableJobs.length : 0,
    },
  };
}

export async function startReconciliationQueueWorker() {
  if (!Boolean(redisUrl())) {
    console.warn("[Reconciliation Queue] REDIS_URL missing. Worker is disabled.");
    return false;
  }
  if (!hasReconciliationConfiguration()) {
    console.warn("[Reconciliation Queue] Razorpay credentials missing. Worker is disabled.");
    return false;
  }
  if (worker) return true;

  try {
    await getReconciliationQueue();
    await ensureScheduledReconciliationJob();

    queueEvents = new QueueEvents(RECONCILIATION_QUEUE_NAME, {
      connection: await getEventsConnection(),
    });
    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`[Reconciliation Queue] Job failed id=${jobId} reason=${failedReason}`);
    });
    queueEvents.on("completed", ({ jobId }) => {
      console.log(`[Reconciliation Queue] Job completed id=${jobId}`);
    });
    await queueEvents.waitUntilReady();

    worker = new Worker(
      RECONCILIATION_QUEUE_NAME,
      async (job) => processReconciliationJob(job),
      {
        connection: await getWorkerConnection(),
        concurrency: RECONCILIATION_WORKER_CONCURRENCY,
      }
    );

    worker.on("completed", (job, result) => {
      console.log(
        `[Reconciliation Queue] Completed job id=${job?.id || "n/a"} runId=${result?.runId || "n/a"}`
      );
    });
    worker.on("failed", (job, error) => {
      console.error(
        `[Reconciliation Queue] Failed job id=${job?.id || "n/a"} attempts=${job?.attemptsMade || 0}:`,
        error?.message || error
      );
    });

    await worker.waitUntilReady();
    console.log(
      `[Reconciliation Queue] Worker started queue=${RECONCILIATION_QUEUE_NAME} cron=${RECONCILIATION_CRON}`
    );
    return true;
  } catch (error) {
    console.error("[Reconciliation Queue] Worker startup failed:", error?.message || error);
    await stopReconciliationQueueWorker();
    return false;
  }
}

export async function stopReconciliationQueueWorker() {
  const closeSafely = async (resource, label) => {
    if (!resource) return;
    try {
      await resource.close();
    } catch (error) {
      console.error(`[Reconciliation Queue] Failed to close ${label}:`, error?.message || error);
    }
  };

  await closeSafely(worker, "worker");
  await closeSafely(queueEvents, "queueEvents");
  await closeSafely(queue, "queue");

  worker = null;
  queueEvents = null;
  queue = null;

  const disconnectSafely = async (connection, label) => {
    if (!connection) return;
    try {
      await connection.quit();
    } catch {
      try {
        connection.disconnect();
      } catch (error) {
        console.error(`[Reconciliation Queue] Failed to disconnect ${label}:`, error?.message || error);
      }
    }
  };

  await disconnectSafely(producerConnection, "producerConnection");
  await disconnectSafely(workerConnection, "workerConnection");
  await disconnectSafely(eventsConnection, "eventsConnection");

  producerConnection = null;
  workerConnection = null;
  eventsConnection = null;
}

