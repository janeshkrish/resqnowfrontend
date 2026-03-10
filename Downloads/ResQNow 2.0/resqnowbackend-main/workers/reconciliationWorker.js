import "../loadEnv.js";

import { validateEnvironmentOrThrow, logEnvironmentSummary } from "../config/envValidation.js";
import {
  closePool,
  ensurePaymentReconciliationAuditLogsTable,
  ensurePaymentReconciliationLocksTable,
  ensurePaymentReconciliationRunsTable,
  ensurePaymentReconciliationTable,
  getPool,
  updatePaymentReconciliationSchema,
} from "../db.js";
import {
  startReconciliationQueueWorker,
  stopReconciliationQueueWorker,
} from "../services/reconciliationQueueService.js";

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Reconciliation Worker] Shutdown requested via ${signal}.`);
  await stopReconciliationQueueWorker();
  await closePool();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[Reconciliation Worker] Unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Reconciliation Worker] Uncaught exception:", error?.stack || error);
});

async function main() {
  validateEnvironmentOrThrow();
  logEnvironmentSummary();

  await getPool();
  await ensurePaymentReconciliationTable();
  await ensurePaymentReconciliationAuditLogsTable();
  await ensurePaymentReconciliationRunsTable();
  await ensurePaymentReconciliationLocksTable();
  await updatePaymentReconciliationSchema();

  const started = await startReconciliationQueueWorker();
  if (!started) {
    throw new Error("Reconciliation queue worker failed to start.");
  }

  console.log(`[Reconciliation Worker] Running. pid=${process.pid}`);
}

main().catch(async (error) => {
  console.error("[Reconciliation Worker] Fatal startup error:", error?.stack || error);
  await stopReconciliationQueueWorker();
  await closePool();
  process.exit(1);
});
