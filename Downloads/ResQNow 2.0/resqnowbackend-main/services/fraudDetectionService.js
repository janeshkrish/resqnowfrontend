import { getPool } from "../db.js";

const FRAUD_THRESHOLDS = {
    HIGH_COST_MULTIPLIER: 3, // Amount > 3x average
    HIGH_VOLUME: 10          // More than 10 requests in 24h
};

/**
 * Scans recent completed jobs for potential fraud and inserts flags.
 */
export async function runFraudDetectionScan() {
    const pool = await getPool();
    const flagsGenerated = [];

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Rule 1: High Transaction Amount (Amount > 3x global average)
    const [avgResult] = await pool.query(
        `SELECT AVG(technician_amount) as avg_cost FROM payments WHERE status = 'completed'`
    );
    const globalAvg = Number(avgResult[0]?.avg_cost || 0);

    if (globalAvg > 0) {
        const thresholdCost = globalAvg * FRAUD_THRESHOLDS.HIGH_COST_MULTIPLIER;

        const [highCostJobs] = await pool.query(
            `SELECT p.id, p.service_request_id, p.technician_id, p.technician_amount 
             FROM payments p
             LEFT JOIN fraud_flags f ON p.service_request_id = f.job_id AND f.flag_type = 'high_cost'
             WHERE p.status = 'completed' AND p.technician_amount > ? AND f.flag_id IS NULL AND p.created_at >= ?`,
            [thresholdCost, twentyFourHoursAgo]
        );

        for (const job of highCostJobs) {
            if (!job.technician_id) continue;
            const [insert] = await pool.execute(
                `INSERT INTO fraud_flags (job_id, technician_id, flag_type, description, severity, status) 
                 VALUES (?, ?, 'high_cost', ?, 'high', 'pending')`,
                [job.service_request_id, job.technician_id, `Amount ${job.technician_amount} is > 3x global average (${globalAvg.toFixed(2)})`]
            );
            flagsGenerated.push(insert.insertId);
        }
    }

    // Rule 2: High Volume (More than 10 jobs in 24 hours)
    const [highVolumeTechs] = await pool.query(
        `SELECT technician_id, COUNT(id) as job_count
         FROM service_requests
         WHERE status = 'completed' AND completed_at >= ?
         GROUP BY technician_id
         HAVING job_count > ?`,
        [twentyFourHoursAgo, FRAUD_THRESHOLDS.HIGH_VOLUME]
    );

    for (const tech of highVolumeTechs) {
        // Check if we already flagged them today for volume
        const [existingFlags] = await pool.query(
            `SELECT flag_id FROM fraud_flags 
             WHERE technician_id = ? AND flag_type = 'high_volume' AND created_at >= ?`,
            [tech.technician_id, new Date(now.setHours(0, 0, 0, 0))]
        );

        if (existingFlags.length === 0) {
            const [insert] = await pool.execute(
                `INSERT INTO fraud_flags (technician_id, flag_type, description, severity, status) 
                 VALUES (?, 'high_volume', ?, 'medium', 'pending')`,
                [tech.technician_id, `Technician completed ${tech.job_count} jobs in 24 hours (threshold: ${FRAUD_THRESHOLDS.HIGH_VOLUME})`]
            );
            flagsGenerated.push(insert.insertId);
        }
    }

    return { flagsGenerated: flagsGenerated.length };
}

export async function getFraudFlags(status = null, limit = 50) {
    const pool = await getPool();
    let query = `
        SELECT f.*, t.name as technician_name, t.email as technician_email
        FROM fraud_flags f
        JOIN technicians t ON f.technician_id = t.id
    `;
    const params = [];

    if (status) {
        query += ` WHERE f.status = ?`;
        params.push(status);
    }

    query += ` ORDER BY f.created_at DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(query, params);
    return rows;
}

export async function updateFraudFlagStatus(flagId, status, adminId) {
    const pool = await getPool();
    await pool.execute(
        `UPDATE fraud_flags SET status = ? WHERE flag_id = ?`,
        [status, flagId]
    );

    await pool.execute(
        `INSERT INTO finance_audit_logs (action, admin_id, reference_id, details)
         VALUES (?, ?, ?, ?)`,
        ['update_fraud_flag', adminId, String(flagId), JSON.stringify({ new_status: status })]
    );

    return { success: true };
}
