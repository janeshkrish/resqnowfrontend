import { getPool } from "../db.js";
import { recordPayout } from "./ledgerService.js";

/**
 * Creates a new payout batch from an array of payment IDs.
 */
export async function createPayoutBatch(adminId, paymentIds) {
    if (!paymentIds || paymentIds.length === 0) {
        throw new Error("No payments selected for batch.");
    }

    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Lock designated payments and verify they are eligible
        const placeholders = paymentIds.map(() => "?").join(",");
        const [paymentRows] = await conn.query(
            `SELECT id, technician_amount, service_cost, payout_status 
             FROM payments 
             WHERE id IN (${placeholders}) 
             FOR UPDATE`,
            paymentIds
        );

        if (paymentRows.length !== paymentIds.length) {
            throw new Error("Some payments could not be found.");
        }

        let totalAmount = 0;
        for (const row of paymentRows) {
            const status = String(row.payout_status || "").toLowerCase();
            if (status !== "pending" && status !== "failed") {
                throw new Error(`Payment ${row.id} has invalid payout status: ${status}`);
            }
            // amount can be in service_cost or technician_amount based on schema usage
            const amount = Number(row.service_cost || row.technician_amount || 0);
            if (amount <= 0) {
                throw new Error(`Payment ${row.id} has invalid technician amount.`);
            }
            totalAmount += amount;
        }

        // 2. Create the batch record
        const [batchResult] = await conn.execute(
            `INSERT INTO payout_batches (total_amount, total_payouts, created_by, status) 
             VALUES (?, ?, ?, 'pending')`,
            [totalAmount, paymentIds.length, adminId]
        );
        const batchId = batchResult.insertId;

        // 3. Link payments to batch and mark processing
        for (const pid of paymentIds) {
            await conn.execute(
                `INSERT INTO batch_payouts (batch_id, payout_id) VALUES (?, ?)`,
                [batchId, pid]
            );

            await conn.execute(
                `UPDATE payments 
                 SET payout_status = 'processing', payout_last_error = NULL
                 WHERE id = ?`,
                [pid]
            );
        }

        await conn.commit();
        return { batchId, totalAmount, count: paymentIds.length };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * Marks a payout batch as completed after external transfer.
 */
export async function completePayoutBatch(adminId, batchId) {
    const pool = await getPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [batchRows] = await conn.query(
            `SELECT * FROM payout_batches WHERE batch_id = ? FOR UPDATE`,
            [batchId]
        );

        if (batchRows.length === 0) throw new Error("Batch not found.");
        const batch = batchRows[0];

        if (batch.status === "completed") {
            throw new Error("Batch is already completed.");
        }

        const [links] = await conn.query(
            `SELECT payout_id FROM batch_payouts WHERE batch_id = ?`,
            [batchId]
        );

        for (const link of links) {
            const pid = link.payout_id;

            // Update payment record
            // Assume external batch transfer, so we generate a mock payout_id for record keeping if none.
            const externalRef = `batch_${batchId}_${pid}`;

            await conn.execute(
                `UPDATE payments 
                 SET payout_status = 'completed', payout_id = COALESCE(payout_id, ?), payout_processed_at = NOW()
                 WHERE id = ?`,
                [externalRef, pid]
            );

            // Fetch payment to record the ledger entry
            const [pRow] = await conn.query(`SELECT technician_amount, service_cost FROM payments WHERE id = ?`, [pid]);
            const amount = Number(pRow[0].service_cost || pRow[0].technician_amount || 0);

            await recordPayout(conn, pid, amount, batchId);
        }

        await conn.execute(
            `UPDATE payout_batches SET status = 'completed' WHERE batch_id = ?`,
            [batchId]
        );

        await conn.commit();
        return { batchId, status: "completed" };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}
