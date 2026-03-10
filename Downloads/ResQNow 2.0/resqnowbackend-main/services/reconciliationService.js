import axios from "axios";
import crypto from "crypto";
import { getPool } from "../db.js";
import { enqueuePayoutJob } from "./payoutQueueService.js";
import { sendMail } from "./mailer.js";
import { socketService } from "./socket.js";

export const RECON_DISCREPANCY_TYPES = Object.freeze({
  PAYMENT_MISSING_GATEWAY: "PAYMENT_MISSING_GATEWAY",
  PAYMENT_NOT_CAPTURED: "PAYMENT_NOT_CAPTURED",
  PAYMENT_AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
  PAYOUT_NOT_SENT: "PAYOUT_NOT_SENT",
  PAYOUT_FAILED: "PAYOUT_FAILED",
  SETTLEMENT_MISSING: "SETTLEMENT_MISSING",
});

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";
const RECON_LOCK_NAME = "payment_reconciliation_lock";
const RECON_LOCK_TTL_SECONDS = Math.max(
  60,
  Number(process.env.RECON_LOCK_TTL_SECONDS || 900)
);
const RECON_LOOKBACK_HOURS = Math.max(
  1,
  Number(process.env.RECON_LOOKBACK_HOURS || 72)
);
const RECON_MAX_PAYMENTS_PER_RUN = Math.max(
  50,
  Number(process.env.RECON_MAX_PAYMENTS_PER_RUN || 2000)
);
const RECON_PAGE_SIZE = Math.max(
  10,
  Math.min(100, Number(process.env.RECON_PAGE_SIZE || 100))
);
const RECON_MAX_PAGES = Math.max(
  1,
  Number(process.env.RECON_MAX_PAGES || 20)
);
const SETTLEMENT_GRACE_HOURS = Math.max(
  1,
  Number(process.env.RECON_SETTLEMENT_GRACE_HOURS || 24)
);
const PAYOUT_GRACE_MINUTES = Math.max(
  1,
  Number(process.env.RECON_PAYOUT_GRACE_MINUTES || 5)
);
const RAZORPAY_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.RECON_RAZORPAY_TIMEOUT_MS || 15000)
);
const AMOUNT_TOLERANCE_INR = Math.max(
  0.1,
  Number(process.env.RECON_AMOUNT_TOLERANCE_INR || 0.5)
);

function hasNonPlaceholderSecret(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && !normalized.toLowerCase().includes("placeholder");
}

function paymentGatewayKeyId() {
  return String(process.env.RAZORPAY_KEY_ID || "").trim();
}

function paymentGatewayKeySecret() {
  return String(process.env.RAZORPAY_KEY_SECRET || "").trim();
}

function payoutGatewayKeyId() {
  return String(process.env.RAZORPAY_PAYOUT_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim();
}

function payoutGatewayKeySecret() {
  return String(process.env.RAZORPAY_PAYOUT_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "").trim();
}

function reconciliationAlertEmail() {
  return String(process.env.RECON_ALERT_EMAIL || process.env.ADMIN_EMAIL || "").trim();
}

function slackWebhookUrl() {
  return String(process.env.RECON_SLACK_WEBHOOK_URL || "").trim();
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ serialization_error: true });
  }
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function isCapturedStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "captured" || normalized === "completed";
}

function isProcessedPayoutStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "processed" || normalized === "completed" || normalized === "success";
}

function isFailedPayoutStatus(status) {
  const normalized = normalizeStatus(status);
  return (
    normalized === "failed" ||
    normalized === "reversed" ||
    normalized === "rejected" ||
    normalized === "cancelled"
  );
}

function isInFlightPayoutStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "queued" || normalized === "pending" || normalized === "processing";
}

function minutesSince(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return (Date.now() - time) / (1000 * 60);
}

function hoursSince(value) {
  const minutes = minutesSince(value);
  if (!Number.isFinite(minutes)) return null;
  return minutes / 60;
}

function buildRazorpayAuthHeader({ payoutApi = false } = {}) {
  const keyId = payoutApi ? payoutGatewayKeyId() : paymentGatewayKeyId();
  const keySecret = payoutApi ? payoutGatewayKeySecret() : paymentGatewayKeySecret();
  if (!hasNonPlaceholderSecret(keyId) || !hasNonPlaceholderSecret(keySecret)) {
    return null;
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function hasPaymentGatewayReadConfig() {
  return (
    hasNonPlaceholderSecret(paymentGatewayKeyId()) &&
    hasNonPlaceholderSecret(paymentGatewayKeySecret())
  );
}

function hasPayoutGatewayReadConfig() {
  return (
    hasNonPlaceholderSecret(payoutGatewayKeyId()) &&
    hasNonPlaceholderSecret(payoutGatewayKeySecret())
  );
}

export function hasReconciliationConfiguration() {
  return hasPaymentGatewayReadConfig();
}

async function razorpayGet(path, { params = {}, payoutApi = false } = {}) {
  const authHeader = buildRazorpayAuthHeader({ payoutApi });
  if (!authHeader) {
    throw new Error(`Razorpay ${payoutApi ? "payout" : "payment"} credentials are not configured.`);
  }

  const sanitizedParams = Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

  const response = await axios.get(`${RAZORPAY_API_BASE_URL}${path}`, {
    params: sanitizedParams,
    timeout: RAZORPAY_TIMEOUT_MS,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }

  const message =
    response?.data?.error?.description ||
    response?.data?.description ||
    response?.data?.message ||
    `HTTP_${response.status}`;
  const error = new Error(`Razorpay GET ${path} failed: ${message}`);
  error.httpStatus = response.status;
  error.responseData = response.data;
  throw error;
}

async function fetchRazorpayCollection(path, { params = {}, payoutApi = false } = {}) {
  const items = [];
  for (let page = 0; page < RECON_MAX_PAGES; page += 1) {
    const skip = page * RECON_PAGE_SIZE;
    const payload = await razorpayGet(path, {
      params: { ...params, count: RECON_PAGE_SIZE, skip },
      payoutApi,
    });
    const pageItems = Array.isArray(payload?.items) ? payload.items : [];
    items.push(...pageItems);
    if (pageItems.length < RECON_PAGE_SIZE) break;
  }
  return items;
}

function pickLatestByCreatedAt(previous, next) {
  const previousCreatedAt = Number(previous?.created_at || 0);
  const nextCreatedAt = Number(next?.created_at || 0);
  return nextCreatedAt >= previousCreatedAt ? next : previous;
}

function buildGatewayIndexes({ payments = [], payouts = [], settlements = [] }) {
  const paymentsById = new Map();
  const paymentsByOrderId = new Map();
  const payoutsById = new Map();
  const payoutsByReferenceId = new Map();
  const settlementsById = new Map();
  const settlementsByPaymentId = new Map();

  for (const payment of payments) {
    const paymentId = String(payment?.id || "").trim();
    const orderId = String(payment?.order_id || "").trim();
    if (paymentId) paymentsById.set(paymentId, payment);
    if (orderId) {
      const existing = paymentsByOrderId.get(orderId);
      paymentsByOrderId.set(orderId, existing ? pickLatestByCreatedAt(existing, payment) : payment);
    }
  }

  for (const payout of payouts) {
    const payoutId = String(payout?.id || "").trim();
    const referenceId = String(
      payout?.reference_id ??
      payout?.notes?.payment_id ??
      payout?.notes?.paymentId ??
      ""
    ).trim();
    if (payoutId) payoutsById.set(payoutId, payout);
    if (referenceId) {
      const existing = payoutsByReferenceId.get(referenceId);
      payoutsByReferenceId.set(referenceId, existing ? pickLatestByCreatedAt(existing, payout) : payout);
    }
  }

  for (const settlement of settlements) {
    const settlementId = String(settlement?.id || "").trim();
    if (settlementId) settlementsById.set(settlementId, settlement);

    const possiblePaymentIds = [
      settlement?.entity_id,
      settlement?.source_id,
      settlement?.payment_id,
      settlement?.entity?.id,
      settlement?.source?.id,
      settlement?.notes?.payment_id,
      settlement?.notes?.paymentId,
    ]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);

    for (const paymentId of possiblePaymentIds) {
      const existing = settlementsByPaymentId.get(paymentId);
      settlementsByPaymentId.set(
        paymentId,
        existing ? pickLatestByCreatedAt(existing, settlement) : settlement
      );
    }
  }

  return {
    paymentsById,
    paymentsByOrderId,
    payoutsById,
    payoutsByReferenceId,
    settlementsById,
    settlementsByPaymentId,
  };
}

function resolveSettlementRecord(gatewayPayment, settlementIndex) {
  if (!gatewayPayment) return null;
  const settlementId = String(gatewayPayment?.settlement_id || "").trim();
  if (settlementId && settlementIndex.settlementsById.has(settlementId)) {
    return settlementIndex.settlementsById.get(settlementId);
  }
  const paymentId = String(gatewayPayment?.id || "").trim();
  if (paymentId && settlementIndex.settlementsByPaymentId.has(paymentId)) {
    return settlementIndex.settlementsByPaymentId.get(paymentId);
  }
  return null;
}

function detectPaymentDiscrepancies({
  paymentRow,
  gatewayPayment,
  gatewayPayout,
  settlementRecord,
}) {
  const localPaymentStatus = normalizeStatus(paymentRow.payment_status || paymentRow.status);
  const localPayoutStatus = normalizeStatus(paymentRow.payout_status);
  const gatewayPaymentStatus = normalizeStatus(gatewayPayment?.status || (gatewayPayment ? "unknown" : "missing"));
  const gatewayPayoutStatus = normalizeStatus(gatewayPayout?.status || (gatewayPayout ? "unknown" : "missing"));
  const localTotalPaid = toMoney(paymentRow.total_paid ?? paymentRow.amount);
  const gatewayTotalPaid = gatewayPayment ? toMoney(Number(gatewayPayment.amount || 0) / 100) : null;
  const discrepancies = [];

  if (isCapturedStatus(localPaymentStatus) && !gatewayPayment) {
    discrepancies.push({
      type: RECON_DISCREPANCY_TYPES.PAYMENT_MISSING_GATEWAY,
      details: {
        razorpay_payment_id: paymentRow.razorpay_payment_id,
        razorpay_order_id: paymentRow.razorpay_order_id,
      },
    });
  }

  if (
    gatewayPayment &&
    localTotalPaid != null &&
    gatewayTotalPaid != null &&
    Math.abs(localTotalPaid - gatewayTotalPaid) > AMOUNT_TOLERANCE_INR
  ) {
    discrepancies.push({
      type: RECON_DISCREPANCY_TYPES.PAYMENT_AMOUNT_MISMATCH,
      details: {
        local_total_paid: localTotalPaid,
        gateway_total_paid: gatewayTotalPaid,
        tolerance_inr: AMOUNT_TOLERANCE_INR,
      },
    });
  }

  if (gatewayPayment && (isCapturedStatus(localPaymentStatus) !== isCapturedStatus(gatewayPaymentStatus))) {
    discrepancies.push({
      type: RECON_DISCREPANCY_TYPES.PAYMENT_NOT_CAPTURED,
      details: {
        local_payment_status: localPaymentStatus || "missing",
        gateway_payment_status: gatewayPaymentStatus || "missing",
      },
    });
  }

  const paymentAgeMinutes = minutesSince(paymentRow.created_at);
  const needsPayout =
    toPositiveInt(paymentRow.technician_id) &&
    localPayoutStatus !== "not_applicable" &&
    (isCapturedStatus(localPaymentStatus) || isCapturedStatus(gatewayPaymentStatus));

  if (needsPayout) {
    if (!gatewayPayout) {
      if (
        localPayoutStatus === "completed" ||
        localPayoutStatus === "failed" ||
        (localPayoutStatus === "pending" && Number(paymentAgeMinutes) >= PAYOUT_GRACE_MINUTES) ||
        (localPayoutStatus === "processing" && Number(paymentAgeMinutes) >= PAYOUT_GRACE_MINUTES)
      ) {
        discrepancies.push({
          type: RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
          details: {
            local_payout_status: localPayoutStatus || "missing",
            payment_age_minutes: paymentAgeMinutes,
          },
        });
      }
    } else if (isFailedPayoutStatus(gatewayPayoutStatus) || localPayoutStatus === "failed") {
      discrepancies.push({
        type: RECON_DISCREPANCY_TYPES.PAYOUT_FAILED,
        details: {
          local_payout_status: localPayoutStatus || "missing",
          gateway_payout_status: gatewayPayoutStatus || "missing",
          gateway_failure_reason: gatewayPayout?.failure_reason || gatewayPayout?.status_details || null,
        },
      });
    } else if (isProcessedPayoutStatus(gatewayPayoutStatus) && localPayoutStatus !== "completed") {
      discrepancies.push({
        type: RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
        details: {
          local_payout_status: localPayoutStatus || "missing",
          gateway_payout_status: gatewayPayoutStatus || "missing",
          gateway_payout_id: gatewayPayout?.id || null,
        },
      });
    }
  }

  const paymentAgeHours = hoursSince(paymentRow.created_at);
  const hasSettlement = Boolean(settlementRecord || gatewayPayment?.settlement_id);
  const capturedForSettlement = isCapturedStatus(localPaymentStatus) || isCapturedStatus(gatewayPaymentStatus);
  if (capturedForSettlement && Number(paymentAgeHours) >= SETTLEMENT_GRACE_HOURS && !hasSettlement) {
    discrepancies.push({
      type: RECON_DISCREPANCY_TYPES.SETTLEMENT_MISSING,
      details: {
        payment_age_hours: paymentAgeHours,
        settlement_grace_hours: SETTLEMENT_GRACE_HOURS,
      },
    });
  }

  const settlementStatus = hasSettlement
    ? (String(
      settlementRecord?.utr ||
      settlementRecord?.utr_no ||
      settlementRecord?.notes?.utr ||
      ""
    ).trim() ? "settled" : "recorded")
    : "missing";

  return {
    discrepancies,
    statuses: {
      razorpayStatus: gatewayPaymentStatus || "missing",
      databaseStatus: localPaymentStatus || "missing",
      payoutGatewayStatus: gatewayPayoutStatus || "missing",
      payoutDatabaseStatus: localPayoutStatus || "missing",
      settlementStatus,
    },
  };
}

async function insertReconciliationAuditLog(conn, payload) {
  await conn.execute(
    `INSERT INTO payment_reconciliation_audit_logs (
      run_id,
      payment_id,
      discrepancy_type,
      action,
      action_details
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      payload.runId || null,
      payload.paymentId || null,
      payload.discrepancyType || null,
      payload.action || "unknown_action",
      safeJsonStringify(payload.actionDetails || {}),
    ]
  );
}

async function persistPaymentDiscrepancies({
  pool,
  runId,
  paymentId,
  razorpayPaymentId,
  statuses,
  discrepancies,
}) {
  const conn = await pool.getConnection();
  let detectedCount = 0;
  let resolvedCount = 0;

  try {
    await conn.beginTransaction();

    const [openRows] = await conn.query(
      `SELECT id, discrepancy_type
       FROM payment_reconciliation
       WHERE payment_id = ?
         AND resolved = FALSE
       FOR UPDATE`,
      [paymentId]
    );

    const openByType = new Map();
    for (const row of openRows || []) {
      openByType.set(String(row.discrepancy_type || ""), row);
    }

    const currentTypes = new Set();
    for (const discrepancy of discrepancies) {
      const discrepancyType = String(discrepancy.type || "").trim();
      if (!discrepancyType) continue;
      currentTypes.add(discrepancyType);
      detectedCount += 1;

      const existing = openByType.get(discrepancyType);
      if (existing) {
        await conn.execute(
          `UPDATE payment_reconciliation
           SET run_id = ?,
               razorpay_payment_id = ?,
               razorpay_status = ?,
               database_status = ?,
               payout_gateway_status = ?,
               payout_database_status = ?,
               settlement_status = ?,
               discrepancy_details = ?,
               last_detected_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [
            runId,
            razorpayPaymentId || null,
            statuses.razorpayStatus,
            statuses.databaseStatus,
            statuses.payoutGatewayStatus,
            statuses.payoutDatabaseStatus,
            statuses.settlementStatus,
            safeJsonStringify(discrepancy.details || {}),
            existing.id,
          ]
        );
        await insertReconciliationAuditLog(conn, {
          runId,
          paymentId,
          discrepancyType,
          action: "discrepancy_still_open",
          actionDetails: discrepancy.details || {},
        });
      } else {
        await conn.execute(
          `INSERT INTO payment_reconciliation (
             run_id,
             payment_id,
             razorpay_payment_id,
             razorpay_status,
             database_status,
             payout_gateway_status,
             payout_database_status,
             settlement_status,
             discrepancy_type,
             discrepancy_details,
             resolved,
             first_detected_at,
             last_detected_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW(), NOW())`,
          [
            runId,
            paymentId,
            razorpayPaymentId || null,
            statuses.razorpayStatus,
            statuses.databaseStatus,
            statuses.payoutGatewayStatus,
            statuses.payoutDatabaseStatus,
            statuses.settlementStatus,
            discrepancyType,
            safeJsonStringify(discrepancy.details || {}),
          ]
        );

        // Phase 6: Explicit Logging into reconciliation_errors table
        let diffAmount = 0;
        if (discrepancyType === RECON_DISCREPANCY_TYPES.PAYMENT_AMOUNT_MISMATCH) {
          diffAmount = Math.abs((discrepancy.details.local_total_paid || 0) - (discrepancy.details.gateway_total_paid || 0));
        }

        if (discrepancyType === RECON_DISCREPANCY_TYPES.PAYMENT_AMOUNT_MISMATCH ||
          discrepancyType === RECON_DISCREPANCY_TYPES.PAYMENT_MISSING_GATEWAY) {

          await conn.execute(
            `INSERT INTO reconciliation_errors (ledger_txn_id, difference_amount, status)
                 VALUES (?, ?, 'open')`,
            [paymentId, diffAmount]
          );
        }

        await insertReconciliationAuditLog(conn, {
          runId,
          paymentId,
          discrepancyType,
          action: "discrepancy_detected",
          actionDetails: discrepancy.details || {},
        });
      }
    }

    for (const openRow of openRows || []) {
      const type = String(openRow.discrepancy_type || "");
      if (!currentTypes.has(type)) {
        resolvedCount += 1;
        await conn.execute(
          `UPDATE payment_reconciliation
           SET run_id = ?,
               resolved = TRUE,
               resolution_action = ?,
               resolved_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [runId, "auto_resolved_after_recheck", openRow.id]
        );
        await insertReconciliationAuditLog(conn, {
          runId,
          paymentId,
          discrepancyType: type,
          action: "discrepancy_resolved",
          actionDetails: { resolution_action: "auto_resolved_after_recheck" },
        });
      }
    }

    await conn.commit();
    return { detectedCount, resolvedCount };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // no-op
    }
    throw error;
  } finally {
    conn.release();
  }
}

async function logAutoResolutionAction(pool, payload) {
  await pool.execute(
    `INSERT INTO payment_reconciliation_audit_logs (
      run_id,
      payment_id,
      discrepancy_type,
      action,
      action_details
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      payload.runId || null,
      payload.paymentId || null,
      payload.discrepancyType || null,
      payload.action || "auto_resolution",
      safeJsonStringify(payload.actionDetails || {}),
    ]
  );
}

async function applyAutoResolutions({
  pool,
  runId,
  paymentRow,
  gatewayPayment,
  gatewayPayout,
  discrepancies,
  triggerSource,
}) {
  const actions = [];
  const discrepancyTypes = new Set(discrepancies.map((entry) => String(entry.type || "")));
  const paymentId = paymentRow.id;

  if (
    discrepancyTypes.has(RECON_DISCREPANCY_TYPES.PAYMENT_NOT_CAPTURED) &&
    gatewayPayment &&
    isCapturedStatus(gatewayPayment.status) &&
    !isCapturedStatus(paymentRow.payment_status || paymentRow.status)
  ) {
    const [updateResult] = await pool.execute(
      `UPDATE payments
       SET status = 'completed',
           payment_status = 'captured',
           webhook_last_event = 'reconciliation.auto_capture_sync',
           webhook_received_at = NOW()
       WHERE id = ?
         AND LOWER(COALESCE(payment_status, status, '')) NOT IN ('captured', 'completed')`,
      [paymentId]
    );
    if (Number(updateResult?.affectedRows || 0) > 0) {
      actions.push({
        discrepancyType: RECON_DISCREPANCY_TYPES.PAYMENT_NOT_CAPTURED,
        action: "auto_mark_payment_captured",
        actionDetails: {
          gateway_payment_status: gatewayPayment.status,
        },
      });
    }
  }

  if (gatewayPayout) {
    const gatewayPayoutStatus = normalizeStatus(gatewayPayout.status);
    const gatewayPayoutId = String(gatewayPayout.id || "").trim() || null;

    if (isProcessedPayoutStatus(gatewayPayoutStatus)) {
      const [updateResult] = await pool.execute(
        `UPDATE payments
         SET payout_status = 'completed',
             payout_id = COALESCE(?, payout_id),
             payout_processed_at = COALESCE(payout_processed_at, NOW()),
             payout_last_error = NULL
         WHERE id = ?
           AND LOWER(COALESCE(payout_status, '')) <> 'completed'`,
        [gatewayPayoutId, paymentId]
      );
      if (Number(updateResult?.affectedRows || 0) > 0) {
        actions.push({
          discrepancyType: RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
          action: "auto_sync_completed_payout_from_gateway",
          actionDetails: {
            gateway_payout_id: gatewayPayoutId,
            gateway_payout_status: gatewayPayout.status,
          },
        });
      }
    } else if (isFailedPayoutStatus(gatewayPayoutStatus)) {
      const failureReason = String(
        gatewayPayout.failure_reason ||
        gatewayPayout.status_details ||
        gatewayPayout.status ||
        "gateway_payout_failed"
      )
        .trim()
        .slice(0, 1000);

      const [updateResult] = await pool.execute(
        `UPDATE payments
         SET payout_status = 'failed',
             payout_id = COALESCE(?, payout_id),
             payout_last_error = ?
         WHERE id = ?
           AND LOWER(COALESCE(payout_status, '')) <> 'failed'`,
        [gatewayPayoutId, failureReason, paymentId]
      );
      if (Number(updateResult?.affectedRows || 0) > 0) {
        actions.push({
          discrepancyType: RECON_DISCREPANCY_TYPES.PAYOUT_FAILED,
          action: "auto_sync_failed_payout_from_gateway",
          actionDetails: {
            gateway_payout_id: gatewayPayoutId,
            gateway_payout_status: gatewayPayout.status,
            failure_reason: failureReason,
          },
        });
      }
    } else if (isInFlightPayoutStatus(gatewayPayoutStatus)) {
      const [updateResult] = await pool.execute(
        `UPDATE payments
         SET payout_status = 'processing',
             payout_id = COALESCE(?, payout_id)
         WHERE id = ?
           AND LOWER(COALESCE(payout_status, '')) = 'pending'`,
        [gatewayPayoutId, paymentId]
      );
      if (Number(updateResult?.affectedRows || 0) > 0) {
        actions.push({
          discrepancyType: RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
          action: "auto_sync_processing_payout_from_gateway",
          actionDetails: {
            gateway_payout_id: gatewayPayoutId,
            gateway_payout_status: gatewayPayout.status,
          },
        });
      }
    }
  }

  if (
    discrepancyTypes.has(RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT) ||
    discrepancyTypes.has(RECON_DISCREPANCY_TYPES.PAYOUT_FAILED)
  ) {
    const localPayoutStatus = normalizeStatus(paymentRow.payout_status);
    const canRetry =
      localPayoutStatus === "pending" ||
      localPayoutStatus === "failed" ||
      localPayoutStatus === "processing" ||
      !localPayoutStatus;

    const gatewayPayoutKnown = Boolean(gatewayPayout);
    const gatewayFailed = gatewayPayoutKnown && isFailedPayoutStatus(gatewayPayout?.status);
    const gatewayInFlight = gatewayPayoutKnown && isInFlightPayoutStatus(gatewayPayout?.status);
    const shouldEnqueueRetry = canRetry && (!gatewayPayoutKnown || gatewayFailed || !gatewayInFlight);

    if (shouldEnqueueRetry) {
      const queued = await enqueuePayoutJob(
        {
          paymentId: paymentId,
          requestId: paymentRow.service_request_id,
          enqueueSource: `reconciliation:${triggerSource}`,
        },
        {
          jobId: `technician-payout:${paymentId}`,
        }
      );

      if (queued.queued) {
        actions.push({
          discrepancyType: discrepancyTypes.has(RECON_DISCREPANCY_TYPES.PAYOUT_FAILED)
            ? RECON_DISCREPANCY_TYPES.PAYOUT_FAILED
            : RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
          action: "enqueue_payout_retry",
          actionDetails: {
            queue_job_id: queued.queueJobId || null,
          },
        });
      } else {
        actions.push({
          discrepancyType: discrepancyTypes.has(RECON_DISCREPANCY_TYPES.PAYOUT_FAILED)
            ? RECON_DISCREPANCY_TYPES.PAYOUT_FAILED
            : RECON_DISCREPANCY_TYPES.PAYOUT_NOT_SENT,
          action: "enqueue_payout_retry_failed",
          actionDetails: {
            reason: queued.reason || "unknown",
            error: queued.error || null,
          },
        });
      }
    }
  }

  for (const action of actions) {
    await logAutoResolutionAction(pool, {
      runId,
      paymentId,
      discrepancyType: action.discrepancyType,
      action: action.action,
      actionDetails: action.actionDetails,
    });
  }

  return {
    actionCount: actions.length,
    actions,
  };
}

async function fetchLocalPayments(pool, { lookbackHours, maxPayments }) {
  const [rows] = await pool.query(
    `SELECT
        p.id,
        p.user_id,
        p.service_request_id,
        p.technician_id,
        p.amount,
        p.service_cost,
        p.commission,
        p.total_paid,
        p.status,
        p.payment_status,
        p.payout_status,
        p.payout_id,
        p.payout_last_error,
        p.razorpay_order_id,
        p.razorpay_payment_id,
        p.created_at
     FROM payments p
     WHERE LOWER(COALESCE(p.payment_method, '')) = 'razorpay'
       AND (
         p.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         OR p.id IN (
           SELECT pr.payment_id
           FROM payment_reconciliation pr
           WHERE pr.resolved = FALSE
         )
       )
     ORDER BY p.id DESC
     LIMIT ?`,
    [lookbackHours, maxPayments]
  );
  return rows || [];
}

async function fetchOpenDiscrepancySummary(pool) {
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM payment_reconciliation
     WHERE resolved = FALSE`
  );
  const [groupRows] = await pool.query(
    `SELECT discrepancy_type, COUNT(*) AS count
     FROM payment_reconciliation
     WHERE resolved = FALSE
     GROUP BY discrepancy_type
     ORDER BY count DESC, discrepancy_type ASC`
  );
  return {
    openCount: Number(countRows?.[0]?.count || 0),
    byType: (groupRows || []).map((row) => ({
      discrepancyType: row.discrepancy_type,
      count: Number(row.count || 0),
    })),
  };
}

async function fetchOpenDiscrepancies(pool, limit = 50) {
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const [rows] = await pool.query(
    `SELECT
       id AS recon_id,
       run_id,
       payment_id,
       razorpay_payment_id,
       razorpay_status,
       database_status,
       payout_gateway_status,
       payout_database_status,
       settlement_status,
       discrepancy_type,
       discrepancy_details,
       first_detected_at,
       last_detected_at
     FROM payment_reconciliation
     WHERE resolved = FALSE
     ORDER BY last_detected_at DESC
     LIMIT ?`,
    [cappedLimit]
  );
  return (rows || []).map((row) => ({
    ...row,
    discrepancy_details: safeJsonParse(row.discrepancy_details, {}),
  }));
}

async function sendReconciliationAlerts({
  runId,
  triggerSource,
  summary,
  recentDiscrepancies,
  errorsCount,
}) {
  const byTypeText = summary.byType
    .map((entry) => `${entry.discrepancyType}:${entry.count}`)
    .join(", ");
  const samplePaymentIds = recentDiscrepancies
    .slice(0, 5)
    .map((entry) => String(entry.payment_id))
    .join(", ");

  const alertPayload = {
    runId,
    triggerSource,
    openDiscrepancies: summary.openCount,
    byType: summary.byType,
    errorsCount,
    samplePaymentIds: samplePaymentIds || null,
    generatedAt: new Date().toISOString(),
  };

  socketService.broadcast("admin:reconciliation_alert", alertPayload);

  const slackUrl = slackWebhookUrl();
  if (slackUrl) {
    try {
      await axios.post(
        slackUrl,
        {
          text:
            `[Reconciliation] run=${runId} source=${triggerSource} open=${summary.openCount} ` +
            `errors=${errorsCount} byType=${byTypeText || "none"} samplePayments=${samplePaymentIds || "none"}`,
        },
        {
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[Reconciliation] Slack alert failed:", error?.message || error);
    }
  }

  const emailTo = reconciliationAlertEmail();
  if (emailTo) {
    const subject = `[ResQNow][Reconciliation] Open discrepancies: ${summary.openCount}`;
    const textBody =
      `Run ID: ${runId}\n` +
      `Trigger: ${triggerSource}\n` +
      `Open discrepancies: ${summary.openCount}\n` +
      `Errors: ${errorsCount}\n` +
      `By type: ${byTypeText || "none"}\n` +
      `Sample payments: ${samplePaymentIds || "none"}\n`;
    try {
      await sendMail({
        to: emailTo,
        subject,
        text: textBody,
        html: `<pre>${textBody}</pre>`,
      });
    } catch (error) {
      console.error("[Reconciliation] Email alert failed:", error?.message || error);
    }
  }
}

async function acquireReconciliationLock(pool, ownerId) {
  await pool.execute(
    `INSERT INTO payment_reconciliation_locks (lock_name, owner_id, locked_until)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE
       owner_id = IF(locked_until < NOW(), VALUES(owner_id), owner_id),
       locked_until = IF(locked_until < NOW(), VALUES(locked_until), locked_until),
       updated_at = CURRENT_TIMESTAMP`,
    [RECON_LOCK_NAME, ownerId, RECON_LOCK_TTL_SECONDS]
  );

  const [rows] = await pool.query(
    `SELECT owner_id
     FROM payment_reconciliation_locks
     WHERE lock_name = ?
     LIMIT 1`,
    [RECON_LOCK_NAME]
  );
  const lockOwner = String(rows?.[0]?.owner_id || "").trim();
  return lockOwner === ownerId;
}

async function releaseReconciliationLock(pool, ownerId) {
  await pool.execute(
    `UPDATE payment_reconciliation_locks
     SET owner_id = NULL,
         locked_until = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE lock_name = ?
       AND owner_id = ?`,
    [RECON_LOCK_NAME, ownerId]
  );
}

async function createReconciliationRun(pool, { runKey, triggerSource, initiatedBy }) {
  const [insertResult] = await pool.execute(
    `INSERT INTO payment_reconciliation_runs (
      run_key,
      trigger_source,
      initiated_by,
      status,
      started_at
    ) VALUES (?, ?, ?, 'running', NOW())`,
    [runKey, triggerSource, initiatedBy || null]
  );
  return Number(insertResult.insertId);
}

async function completeReconciliationRun(pool, runId, payload) {
  await pool.execute(
    `UPDATE payment_reconciliation_runs
     SET status = ?,
         scanned_count = ?,
         discrepancy_count = ?,
         resolved_count = ?,
         auto_resolved_count = ?,
         errors_count = ?,
         notes = ?,
         finished_at = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      payload.status,
      payload.scannedCount,
      payload.discrepancyCount,
      payload.resolvedCount,
      payload.autoResolvedCount,
      payload.errorsCount,
      payload.notes || null,
      runId,
    ]
  );
}

export async function runPaymentReconciliation(options = {}) {
  const triggerSource = String(options.triggerSource || options.source || "scheduled").trim() || "scheduled";
  const initiatedBy = String(options.initiatedBy || "").trim() || null;
  const lookbackHours = Math.max(
    1,
    Number(options.lookbackHours || RECON_LOOKBACK_HOURS)
  );
  const maxPayments = Math.max(
    10,
    Math.min(RECON_MAX_PAYMENTS_PER_RUN, Number(options.maxPayments || RECON_MAX_PAYMENTS_PER_RUN))
  );

  const pool = await getPool();
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const lockAcquired = await acquireReconciliationLock(pool, ownerId);
  if (!lockAcquired) {
    return {
      ok: true,
      skipped: true,
      reason: "lock_not_acquired",
      triggerSource,
    };
  }

  const runKey = String(options.runKey || crypto.randomUUID());
  let runId = null;
  let scannedCount = 0;
  let discrepancyCount = 0;
  let resolvedCount = 0;
  let autoResolvedCount = 0;
  let errorsCount = 0;
  let notes = [];

  try {
    runId = await createReconciliationRun(pool, {
      runKey,
      triggerSource,
      initiatedBy,
    });

    const localPayments = await fetchLocalPayments(pool, { lookbackHours, maxPayments });
    scannedCount = localPayments.length;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const fromSeconds = nowSeconds - (lookbackHours * 60 * 60);

    let razorpayPayments = [];
    if (hasPaymentGatewayReadConfig()) {
      try {
        razorpayPayments = await fetchRazorpayCollection("/payments", {
          params: { from: fromSeconds, to: nowSeconds },
          payoutApi: false,
        });
      } catch (error) {
        errorsCount += 1;
        notes.push(`payments_api_error:${error?.message || String(error)}`);
      }
    } else {
      notes.push("payments_api_skipped:missing_credentials");
    }

    let razorpayPayouts = [];
    if (hasPayoutGatewayReadConfig()) {
      try {
        razorpayPayouts = await fetchRazorpayCollection("/payouts", {
          params: { from: fromSeconds, to: nowSeconds },
          payoutApi: true,
        });
      } catch (error) {
        errorsCount += 1;
        notes.push(`payouts_api_error:${error?.message || String(error)}`);
      }
    } else {
      notes.push("payouts_api_skipped:missing_credentials");
    }

    let razorpaySettlements = [];
    if (hasPaymentGatewayReadConfig()) {
      try {
        razorpaySettlements = await fetchRazorpayCollection("/settlements", {
          params: { from: fromSeconds, to: nowSeconds },
          payoutApi: false,
        });
      } catch (error) {
        errorsCount += 1;
        notes.push(`settlements_api_error:${error?.message || String(error)}`);
      }
    }

    const gatewayIndex = buildGatewayIndexes({
      payments: razorpayPayments,
      payouts: razorpayPayouts,
      settlements: razorpaySettlements,
    });

    for (const paymentRow of localPayments) {
      const paymentId = Number(paymentRow.id);
      if (!Number.isInteger(paymentId) || paymentId <= 0) continue;

      try {
        const gatewayPayment = (
          gatewayIndex.paymentsById.get(String(paymentRow.razorpay_payment_id || "").trim()) ||
          gatewayIndex.paymentsByOrderId.get(String(paymentRow.razorpay_order_id || "").trim()) ||
          null
        );

        const gatewayPayout = (
          gatewayIndex.payoutsById.get(String(paymentRow.payout_id || "").trim()) ||
          gatewayIndex.payoutsByReferenceId.get(String(paymentRow.id || "").trim()) ||
          gatewayIndex.payoutsByReferenceId.get(String(paymentRow.razorpay_payment_id || "").trim()) ||
          null
        );

        const settlementRecord = resolveSettlementRecord(gatewayPayment, gatewayIndex);

        const { discrepancies, statuses } = detectPaymentDiscrepancies({
          paymentRow,
          gatewayPayment,
          gatewayPayout,
          settlementRecord,
        });

        const persisted = await persistPaymentDiscrepancies({
          pool,
          runId,
          paymentId,
          razorpayPaymentId: String(paymentRow.razorpay_payment_id || "").trim() || null,
          statuses,
          discrepancies,
        });
        discrepancyCount += persisted.detectedCount;
        resolvedCount += persisted.resolvedCount;

        const autoResolution = await applyAutoResolutions({
          pool,
          runId,
          paymentRow,
          gatewayPayment,
          gatewayPayout,
          discrepancies,
          triggerSource,
        });
        autoResolvedCount += autoResolution.actionCount;
      } catch (error) {
        errorsCount += 1;
        await pool.execute(
          `INSERT INTO payment_reconciliation_audit_logs (
            run_id,
            payment_id,
            discrepancy_type,
            action,
            action_details
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            runId,
            paymentId,
            null,
            "reconciliation_payment_processing_error",
            safeJsonStringify({
              message: error?.message || String(error),
            }),
          ]
        );
      }
    }

    const openSummary = await fetchOpenDiscrepancySummary(pool);
    const recentDiscrepancies = await fetchOpenDiscrepancies(pool, 20);

    if (openSummary.openCount > 0 || errorsCount > 0) {
      await sendReconciliationAlerts({
        runId,
        triggerSource,
        summary: openSummary,
        recentDiscrepancies,
        errorsCount,
      });
    }

    await completeReconciliationRun(pool, runId, {
      status: "completed",
      scannedCount,
      discrepancyCount,
      resolvedCount,
      autoResolvedCount,
      errorsCount,
      notes: notes.length > 0 ? notes.join("; ") : null,
    });

    return {
      ok: true,
      runId,
      triggerSource,
      scannedCount,
      discrepancyCount,
      resolvedCount,
      autoResolvedCount,
      errorsCount,
      openDiscrepancies: openSummary.openCount,
      openByType: openSummary.byType,
      notes,
    };
  } catch (error) {
    if (runId) {
      try {
        await completeReconciliationRun(pool, runId, {
          status: "failed",
          scannedCount,
          discrepancyCount,
          resolvedCount,
          autoResolvedCount,
          errorsCount: errorsCount + 1,
          notes: `${notes.join("; ")}; fatal:${error?.message || String(error)}`.slice(0, 4000),
        });
      } catch (updateErr) {
        console.error("[Reconciliation] Failed to update failed run status:", updateErr?.message || updateErr);
      }
    }
    throw error;
  } finally {
    try {
      await releaseReconciliationLock(pool, ownerId);
    } catch (lockError) {
      console.error("[Reconciliation] Failed to release lock:", lockError?.message || lockError);
    }
  }
}

export async function getLatestReconciliationSummary() {
  const pool = await getPool();
  const [runRows] = await pool.query(
    `SELECT
       id,
       run_key,
       trigger_source,
       initiated_by,
       status,
       scanned_count,
       discrepancy_count,
       resolved_count,
       auto_resolved_count,
       errors_count,
       notes,
       started_at,
       finished_at,
       created_at,
       updated_at
     FROM payment_reconciliation_runs
     ORDER BY id DESC
     LIMIT 1`
  );
  const summary = await fetchOpenDiscrepancySummary(pool);
  return {
    latestRun: runRows?.[0] || null,
    openDiscrepancies: summary.openCount,
    openByType: summary.byType,
  };
}

export async function listOpenReconciliationDiscrepancies({ limit = 100 } = {}) {
  const pool = await getPool();
  return fetchOpenDiscrepancies(pool, limit);
}
