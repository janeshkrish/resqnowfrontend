import "../loadEnv.js";

import { validateEnvironmentOrThrow, logEnvironmentSummary } from "../config/envValidation.js";
import { closePool, getPool } from "../db.js";
import { startPayoutQueueWorker, stopPayoutQueueWorker } from "../services/payoutQueueService.js";

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Payout Worker] Shutdown requested via ${signal}.`);
  await stopPayoutQueueWorker();
  await closePool();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[Payout Worker] Unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Payout Worker] Uncaught exception:", error?.stack || error);
});

async function main() {
  validateEnvironmentOrThrow();
  logEnvironmentSummary();

  await getPool();
  const started = await startPayoutQueueWorker();
  if (!started) {
    throw new Error("Payout queue worker failed to start.");
  }

  console.log(`[Payout Worker] Running. pid=${process.pid}`);
}

main().catch(async (error) => {
  console.error("[Payout Worker] Fatal startup error:", error?.stack || error);
  await stopPayoutQueueWorker();
  await closePool();
  process.exit(1);
});
