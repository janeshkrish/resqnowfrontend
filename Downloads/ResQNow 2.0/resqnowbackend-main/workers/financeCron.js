import cron from "node-cron";
import { generateDailySettlement } from "../services/settlementService.js";
import { runFraudDetectionScan } from "../services/fraudDetectionService.js";
import { runPaymentReconciliation } from "../services/reconciliationService.js";

/**
 * Initializes and starts the finance background CRON jobs.
 * This runs daily tasks such as settlement report generation, fraud detection scans, 
 * and full gateway reconciliation.
 */
export function startFinanceCronJobs() {
    console.log("[Finance Cron] Initializing scheduled jobs...");

    // Schedule: 1:00 AM every day
    cron.schedule("0 1 * * *", async () => {
        console.log(`[Finance Cron] Starting daily jobs at ${new Date().toISOString()}`);

        try {
            // 1. Generate Daily Settlement for the previous day
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateString = yesterday.toISOString().split('T')[0];

            console.log(`[Finance Cron] Generating settlement report for ${dateString}...`);
            await generateDailySettlement(dateString);
            console.log(`[Finance Cron] Settlement report generated successfully.`);

        } catch (error) {
            console.error("[Finance Cron] Error generating daily settlement:", error?.message || error);
        }

        try {
            // 2. Run Fraud Detection Scan (Lookback 24h)
            console.log(`[Finance Cron] Running daily fraud detection scan...`);
            const fraudResult = await runFraudDetectionScan();
            console.log(`[Finance Cron] Fraud scan complete. Flags generated: ${fraudResult.flagsGenerated}`);
        } catch (error) {
            console.error("[Finance Cron] Error running fraud detection scan:", error?.message || error);
        }

        try {
            // 3. Run Gateway Reconciliation
            console.log(`[Finance Cron] Running daily gateway reconciliation...`);
            const reconResult = await runPaymentReconciliation({
                source: "daily_cron",
                lookbackHours: 24, // Scan past 24 hours
            });
            console.log(`[Finance Cron] Gateway reconciliation complete. Open discrepancies: ${reconResult.openDiscrepancies}`);
        } catch (error) {
            console.error("[Finance Cron] Error running gateway reconciliation:", error?.message || error);
        }

        console.log(`[Finance Cron] All daily jobs finished.`);
    });

    console.log("[Finance Cron] Jobs scheduled for 1:00 AM daily.");
}
