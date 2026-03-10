import { getPool } from "../db.js";
import { SYSTEM_ACCOUNTS } from "./ledgerService.js";

/**
 * Generates the daily settlement report for a specific date (YYYY-MM-DD).
 * It aggregates data from the double-entry ledger.
 */
export async function generateDailySettlement(dateString) {
    const pool = await getPool();

    // Calculate totals directly from ledger entries for the given date
    const [stats] = await pool.query(
        `SELECT
            SUM(CASE WHEN la.name = ? AND le.type = 'debit' THEN le.amount ELSE 0 END) as total_payments_received,
            SUM(CASE WHEN la.name = ? AND le.type = 'credit' THEN le.amount ELSE 0 END) as total_technician_earnings,
            SUM(CASE WHEN la.name = ? AND le.type = 'credit' THEN le.amount ELSE 0 END) as total_commission,
            SUM(CASE WHEN la.name = ? AND le.type = 'credit' THEN le.amount ELSE 0 END) as total_payouts_dispatched
         FROM ledger_entries le
         JOIN ledger_accounts la ON le.account_id = la.account_id
         WHERE DATE(le.created_at) = ?`,
        [
            SYSTEM_ACCOUNTS.PAYMENT_GATEWAY,       // Debit = funds received
            SYSTEM_ACCOUNTS.TECHNICIAN_PAYABLES,   // Credit = owed to tech
            SYSTEM_ACCOUNTS.PLATFORM_REVENUE,      // Credit = commission earned
            SYSTEM_ACCOUNTS.PAYMENT_GATEWAY,       // Credit = payout dispatched
            dateString
        ]
    );

    const totals = stats[0];

    // Upsert into daily_settlements table
    await pool.execute(
        `INSERT INTO daily_settlements (
            date, total_payments, total_technician_earnings, total_commission, total_payouts
         ) VALUES (?, COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0))
         ON DUPLICATE KEY UPDATE 
            total_payments = VALUES(total_payments),
            total_technician_earnings = VALUES(total_technician_earnings),
            total_commission = VALUES(total_commission),
            total_payouts = VALUES(total_payouts),
            generated_at = CURRENT_TIMESTAMP`,
        [
            dateString,
            totals.total_payments_received,
            totals.total_technician_earnings,
            totals.total_commission,
            totals.total_payouts_dispatched
        ]
    );

    const [row] = await pool.query(
        `SELECT * FROM daily_settlements WHERE date = ?`,
        [dateString]
    );

    return row[0];
}

/**
 * Retrieves past daily settlements.
 */
export async function getDailySettlements(limit = 30) {
    const pool = await getPool();
    const [rows] = await pool.query(
        `SELECT * FROM daily_settlements ORDER BY date DESC LIMIT ?`,
        [limit]
    );
    return rows;
}
