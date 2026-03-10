import IORedis from "ioredis";
import axios from "axios";
import crypto from "crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { getPool } from "../db.js";
import { socketService } from "./socket.js";

export const PAYOUT_QUEUE_NAME = "technician-payout-queue";
const PAYOUT_JOB_NAME = "technician-payout";
const PAYOUT_WORKER_CONCURRENCY = Math.max(1, Number(process.env.PAYOUT_WORKER_CONCURRENCY || 6));
const PAYOUT_RETRY_ATTEMPTS = Math.max(1, Number(process.env.PAYOUT_RETRY_ATTEMPTS || 5));
const PAYOUT_RETRY_BASE_DELAY_MS = Math.max(250, Number(process.env.PAYOUT_RETRY_BASE_DELAY_MS || 1500));

let queue = null;
let worker = null;
let queueEvents = null;
let producerConnection = null;
let workerConnection = null;
let eventsConnection = null;

function redisUrl() {
  return String(process.env.REDIS_URL || "").trim();
}

function payoutAccountNumber() {
  return String(process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER || "").trim();
}

function payoutKeyId() {
  return String(process.env.RAZORPAY_PAYOUT_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim();
}

function payoutKeySecret() {
  return String(process.env.RAZORPAY_PAYOUT_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "").trim();
}

function hasNonPlaceholderSecret(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && !normalized.toLowerCase().includes("placeholder");
}

export function hasPayoutConfiguration() {
  return (
    hasNonPlaceholderSecret(payoutAccountNumber()) &&
    hasNonPlaceholderSecret(payoutKeyId()) &&
    hasNonPlaceholderSecret(payoutKeySecret())
  );
}

export function isPayoutQueueEnabled() {
  return Boolean(redisUrl()) && hasPayoutConfiguration();
}

function createRedisConnection(label) {
  const connection = new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectionName: `resqnow_${label}`,
  });

  connection.on("connect", () => {
    console.log(`[Payout Queue] Redis connected (${label}).`);
  });
  connection.on("ready", () => {
    console.log(`[Payout Queue] Redis ready (${label}).`);
  });
  connection.on("error", (error) => {
    console.error(`[Payout Queue] Redis error (${label}):`, error?.message || error);
  });
  connection.on("close", () => {
    console.warn(`[Payout Queue] Redis connection closed (${label}).`);
  });

  return connection;
}

async function getProducerConnection() {
  if (producerConnection) return producerConnection;
  producerConnection = createRedisConnection("payout_producer");
  await producerConnection.connect();
  return producerConnection;
}

async function getWorkerConnection() {
  if (workerConnection) return workerConnection;
  workerConnection = createRedisConnection("payout_worker");
  await workerConnection.connect();
  return workerConnection;
}

async function getEventsConnection() {
  if (eventsConnection) return eventsConnection;
  eventsConnection = createRedisConnection("payout_events");
  await eventsConnection.connect();
  return eventsConnection;
}

async function getPayoutQueue() {
  if (!isPayoutQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue(PAYOUT_QUEUE_NAME, {
    connection: await getProducerConnection(),
    defaultJobOptions: {
      attempts: PAYOUT_RETRY_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: PAYOUT_RETRY_BASE_DELAY_MS,
      },
      removeOnComplete: 5000,
      removeOnFail: 5000,
    },
  });
  return queue;
}

function asPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toPositiveMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function toErrorMessage(error) {
  if (!error) return "unknown_payout_error";
  const responseData = error?.response?.data;
  const details =
    responseData?.error?.description ||
    responseData?.error?.reason ||
    responseData?.description ||
    responseData?.message ||
    error?.message ||
    String(error);
  return String(details).slice(0, 1000);
}

function buildPayoutPayload(input = {}) {
  return {
    paymentId: asPositiveInt(input.paymentId ?? input.payment_id),
    requestId: asPositiveInt(input.requestId ?? input.request_id),
    enqueueSource: String(input.enqueueSource || input.source || "webhook").trim() || "webhook",
  };
}

async function processTechnicianPayout(jobData = {}) {
  const payload = buildPayoutPayload(jobData);
  if (!payload.paymentId) {
    return { skipped: true, reason: "invalid_payment_id" };
  }

  const pool = await getPool();
  const conn = await pool.getConnection();
  let lockedPayment = null;
  let technicianUpi = "";
  let payoutAmount = null;
  let payoutIdempotencyKey = "";
  let technicianId = null;
  let requestId = payload.requestId || null;

  try {
    await conn.beginTransaction();

    const [paymentRows] = await conn.query(
      `SELECT
          id,
          service_request_id,
          technician_id,
          service_cost,
          technician_amount,
          commission,
          platform_fee,
          total_paid,
          status,
          payment_status,
          payout_status,
          payout_id,
          payout_idempotency_key,
          payout_attempt_count,
          razorpay_payment_id
       FROM payments
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [payload.paymentId]
    );

    if (paymentRows.length === 0) {
      await conn.rollback();
      return { skipped: true, reason: "payment_not_found" };
    }

    lockedPayment = paymentRows[0];
    requestId = requestId || asPositiveInt(lockedPayment.service_request_id);
    const payoutStatus = String(lockedPayment.payout_status || "").toLowerCase();

    if (payoutStatus === "completed") {
      await conn.commit();
      return { skipped: true, reason: "payout_already_completed", payoutId: lockedPayment.payout_id || null };
    }
    if (payoutStatus === "processing") {
      await conn.commit();
      return { skipped: true, reason: "payout_in_progress" };
    }
    if (payoutStatus === "not_applicable") {
      await conn.commit();
      return { skipped: true, reason: "payout_not_applicable" };
    }

    const paymentStatus = String(lockedPayment.payment_status || lockedPayment.status || "").toLowerCase();
    if (!["captured", "completed"].includes(paymentStatus)) {
      await conn.rollback();
      throw new Error(`payment_not_captured:${paymentStatus || "unknown"}`);
    }

    technicianId = asPositiveInt(lockedPayment.technician_id);
    if (!technicianId && requestId) {
      const [requestRows] = await conn.query(
        "SELECT technician_id FROM service_requests WHERE id = ? LIMIT 1 FOR UPDATE",
        [requestId]
      );
      technicianId = asPositiveInt(requestRows?.[0]?.technician_id);
      if (technicianId) {
        await conn.execute("UPDATE payments SET technician_id = ? WHERE id = ?", [technicianId, lockedPayment.id]);
      }
    }

    if (!technicianId) {
      await conn.execute(
        `UPDATE payments
         SET payout_status = 'not_applicable',
             payout_last_error = 'technician_not_found',
             payout_processed_at = NOW()
         WHERE id = ?`,
        [lockedPayment.id]
      );
      await conn.commit();
      return { skipped: true, reason: "technician_not_found" };
    }

    const [technicianRows] = await conn.query(
      "SELECT upi_id FROM technicians WHERE id = ? LIMIT 1 FOR UPDATE",
      [technicianId]
    );
    technicianUpi = String(technicianRows?.[0]?.upi_id || "").trim();
    if (!technicianUpi) {
      await conn.execute(
        `UPDATE payments
         SET payout_status = 'failed',
             payout_last_error = 'technician_upi_missing'
         WHERE id = ?`,
        [lockedPayment.id]
      );
      await conn.commit();
      throw new Error("technician_upi_missing");
    }

    payoutAmount = roundMoney(
      toPositiveMoney(lockedPayment.service_cost) ??
      toPositiveMoney(lockedPayment.technician_amount)
    );
    if (!payoutAmount) {
      await conn.execute(
        `UPDATE payments
         SET payout_status = 'failed',
             payout_last_error = 'invalid_technician_amount'
         WHERE id = ?`,
        [lockedPayment.id]
      );
      await conn.commit();
      throw new Error("invalid_technician_amount");
    }

    payoutIdempotencyKey = String(lockedPayment.payout_idempotency_key || "").trim() || crypto.randomUUID();

    await conn.execute(
      `UPDATE payments
       SET payout_status = 'processing',
           payout_idempotency_key = ?,
           payout_last_error = NULL,
           payout_last_attempt_at = NOW(),
           payout_attempt_count = COALESCE(payout_attempt_count, 0) + 1
       WHERE id = ?`,
      [payoutIdempotencyKey, lockedPayment.id]
    );

    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch { }
    throw error;
  } finally {
    conn.release();
  }

  let payoutId = null;
  try {
    const auth = Buffer.from(`${payoutKeyId()}:${payoutKeySecret()}`).toString("base64");
    const response = await axios.post(
      "https://api.razorpay.com/v1/payouts",
      {
        account_number: payoutAccountNumber(),
        fund_account: {
          account_type: "vpa",
          vpa: {
            address: technicianUpi,
          },
        },
        amount: Math.round(Number(payoutAmount) * 100),
        currency: "INR",
        mode: "UPI",
        purpose: "payout",
        reference_id: String(lockedPayment.id),
      },
      {
        timeout: 15000,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "X-Payout-Idempotency": payoutIdempotencyKey,
        },
      }
    );
    payoutId = String(response?.data?.id || response?.data?.payout_id || "").trim() || null;

    await pool.execute(
      `UPDATE payments
       SET payout_status = 'completed',
           payout_id = ?,
           payout_processed_at = NOW(),
           payout_last_error = NULL
       WHERE id = ?
         AND payout_status = 'processing'`,
      [payoutId, lockedPayment.id]
    );

    if (technicianId) {
      socketService.notifyTechnician(technicianId, "technician:payout_completed", {
        paymentId: lockedPayment.id,
        requestId: requestId || lockedPayment.service_request_id || null,
        payoutId,
        amount: payoutAmount,
        at: new Date().toISOString(),
      });
    }

    return {
      completed: true,
      payoutId,
      paymentId: lockedPayment.id,
      requestId: requestId || lockedPayment.service_request_id || null,
      technicianId,
      amount: payoutAmount,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    await pool.execute(
      `UPDATE payments
       SET payout_status = 'failed',
           payout_last_error = ?
       WHERE id = ?
         AND payout_status = 'processing'`,
      [errorMessage, lockedPayment.id]
    );
    throw new Error(`payout_failed:${errorMessage}`);
  }
}

export async function enqueuePayoutJob(payload, options = {}) {
  const normalizedPayload = buildPayoutPayload(payload);
  if (!normalizedPayload.paymentId) {
    return { queued: false, reason: "invalid_payment_id" };
  }
  if (!isPayoutQueueEnabled()) {
    return { queued: false, reason: "payout_queue_not_configured" };
  }

  try {
    const q = await getPayoutQueue();
    if (!q) {
      return { queued: false, reason: "queue_unavailable" };
    }

    const delay = Math.max(0, Number(options.delayMs || 0));
    const jobId = String(options.jobId || `${PAYOUT_JOB_NAME}:${normalizedPayload.paymentId}`);
    const queuedJob = await q.add(PAYOUT_JOB_NAME, normalizedPayload, {
      delay,
      jobId,
      attempts: PAYOUT_RETRY_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: PAYOUT_RETRY_BASE_DELAY_MS,
      },
    });

    return {
      queued: true,
      queueJobId: queuedJob?.id || null,
      paymentId: normalizedPayload.paymentId,
    };
  } catch (error) {
    console.error("[Payout Queue] Failed to enqueue payout:", error?.message || error);
    return {
      queued: false,
      reason: "enqueue_failed",
      error: error?.message || String(error),
    };
  }
}

export async function getPayoutQueueMetrics() {
  if (!isPayoutQueueEnabled()) {
    return {
      enabled: false,
      configured: hasPayoutConfiguration(),
      redisConfigured: Boolean(redisUrl()),
      queueName: PAYOUT_QUEUE_NAME,
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      },
    };
  }

  const q = await getPayoutQueue();
  const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  return {
    enabled: true,
    configured: true,
    redisConfigured: true,
    queueName: PAYOUT_QUEUE_NAME,
    counts,
  };
}

export async function startPayoutQueueWorker() {
  if (!Boolean(redisUrl())) {
    console.warn("[Payout Queue] REDIS_URL missing. Payout queue worker is disabled.");
    return false;
  }
  if (!hasPayoutConfiguration()) {
    console.warn("[Payout Queue] Razorpay payout credentials missing. Payout queue worker is disabled.");
    return false;
  }
  if (worker) return true;

  try {
    await getPayoutQueue();

    queueEvents = new QueueEvents(PAYOUT_QUEUE_NAME, {
      connection: await getEventsConnection(),
    });
    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`[Payout Queue] Job failed id=${jobId} reason=${failedReason}`);
    });
    queueEvents.on("active", ({ jobId }) => {
      console.log(`[Payout Queue] Job active id=${jobId}`);
    });
    queueEvents.on("completed", ({ jobId }) => {
      console.log(`[Payout Queue] Job completed id=${jobId}`);
    });
    await queueEvents.waitUntilReady();

    worker = new Worker(
      PAYOUT_QUEUE_NAME,
      async (job) => {
        if (job?.name !== PAYOUT_JOB_NAME) {
          return { skipped: true, reason: `unsupported_job:${job?.name || "unknown"}` };
        }
        return processTechnicianPayout(job.data || {});
      },
      {
        connection: await getWorkerConnection(),
        concurrency: PAYOUT_WORKER_CONCURRENCY,
      }
    );

    worker.on("completed", (job, result) => {
      console.log(
        `[Payout Queue] Completed job id=${job?.id || "n/a"} paymentId=${result?.paymentId || "n/a"} payoutId=${result?.payoutId || "n/a"}`
      );
    });
    worker.on("failed", (job, error) => {
      console.error(
        `[Payout Queue] Failed job id=${job?.id || "n/a"} attemptsMade=${job?.attemptsMade || 0}:`,
        error?.message || error
      );
    });

    await worker.waitUntilReady();
    console.log(
      `[Payout Queue] Worker started queue=${PAYOUT_QUEUE_NAME} concurrency=${PAYOUT_WORKER_CONCURRENCY} attempts=${PAYOUT_RETRY_ATTEMPTS}`
    );
    return true;
  } catch (error) {
    console.error("[Payout Queue] Worker startup failed:", error?.message || error);
    await stopPayoutQueueWorker();
    return false;
  }
}

export async function stopPayoutQueueWorker() {
  const closeSafely = async (resource, label) => {
    if (!resource) return;
    try {
      await resource.close();
    } catch (error) {
      console.error(`[Payout Queue] Failed to close ${label}:`, error?.message || error);
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
        console.error(`[Payout Queue] Failed to disconnect ${label}:`, error?.message || error);
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
