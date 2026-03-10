import { getPool } from "../db.js";

// Ledger Account Types
export const ACCOUNT_TYPES = {
    ASSET: 'asset',
    LIABILITY: 'liability',
    EQUITY: 'equity',
    REVENUE: 'revenue',
    EXPENSE: 'expense'
};

// System Accounts (created on demand)
export const SYSTEM_ACCOUNTS = {
    PLATFORM_REVENUE: 'Platform Revenue',
    PLATFORM_FUNDS: 'Platform Funds',
    TECHNICIAN_PAYABLES: 'Technician Payables',
    PAYMENT_GATEWAY: 'Payment Gateway (Razorpay)'
};

export async function ensureSystemAccounts() {
    const pool = await getPool();
    const accounts = [
        { name: SYSTEM_ACCOUNTS.PLATFORM_REVENUE, type: ACCOUNT_TYPES.REVENUE, description: 'Commission and Fees earned by platform' },
        { name: SYSTEM_ACCOUNTS.PLATFORM_FUNDS, type: ACCOUNT_TYPES.ASSET, description: 'Main platform bank account' },
        { name: SYSTEM_ACCOUNTS.TECHNICIAN_PAYABLES, type: ACCOUNT_TYPES.LIABILITY, description: 'Money owed to technicians' },
        { name: SYSTEM_ACCOUNTS.PAYMENT_GATEWAY, type: ACCOUNT_TYPES.ASSET, description: 'Funds held in Razorpay' }
    ];

    for (const acc of accounts) {
        await pool.execute(
            `INSERT IGNORE INTO ledger_accounts (name, type, description) VALUES (?, ?, ?)`,
            [acc.name, acc.type, acc.description]
        );
    }
}

async function getAccountId(pool, accountName) {
    const [rows] = await pool.query('SELECT account_id FROM ledger_accounts WHERE name = ? LIMIT 1', [accountName]);
    if (rows.length === 0) throw new Error(`Ledger account not found: ${accountName}`);
    return rows[0].account_id;
}

/**
 * Records a double entry transaction in the ledger.
 * @param {object} params
 * @param {object} params.conn - Database connection (for transactions)
 * @param {string} params.transactionId - Unique logical transaction grouping ID
 * @param {string} params.referenceType - e.g., 'service_request', 'payout_batch'
 * @param {number} params.referenceId - ID of the reference
 * @param {Array<{account: string, amount: number, type: 'debit'|'credit', description: string}>} params.entries
 */
export async function recordLedgerTransaction({ conn, transactionId, referenceType, referenceId, entries }) {
    if (!entries || entries.length < 2) {
        throw new Error("A ledger transaction must have at least two entries (double-entry).");
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of entries) {
        const amount = Number(entry.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Invalid ledger entry amount: ${entry.amount}`);
        }
        if (entry.type === 'debit') totalDebit += amount;
        else if (entry.type === 'credit') totalCredit += amount;
        else throw new Error(`Invalid ledger entry type: ${entry.type}`);
    }

    // Ensure floating point arithmetic doesn't break equality (using cents roughly)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Ledger imbalance: Debits (${totalDebit}) != Credits (${totalCredit})`);
    }

    const pool = await getPool();

    for (const entry of entries) {
        const accountId = await getAccountId(pool, entry.account);
        const debit = entry.type === 'debit' ? entry.amount : 0;
        const credit = entry.type === 'credit' ? entry.amount : 0;

        await conn.execute(
            `INSERT INTO ledger_entries (
                transaction_id, account_id, reference_type, reference_id, debit, credit, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                transactionId,
                accountId,
                referenceType,
                referenceId || null,
                debit,
                credit,
                entry.description || ''
            ]
        );
    }
}

/**
 * Records the financial flow of a completed customer payment.
 */
export async function recordCustomerPayment(conn, paymentId, breakdown) {
    const transactionId = `PAY_${paymentId}`;
    const entries = [
        // Debit Gateway (Asset increases) with total paid
        {
            account: SYSTEM_ACCOUNTS.PAYMENT_GATEWAY,
            amount: breakdown.totalAmount,
            type: 'debit',
            description: `Customer payment for ${paymentId}`
        },
        // Credit Platform Revenue with commission/fee
        {
            account: SYSTEM_ACCOUNTS.PLATFORM_REVENUE,
            amount: breakdown.platformFee,
            type: 'credit',
            description: `Platform fee for payment ${paymentId}`
        },
        // Credit Technician Payables (Liability increases) with technician earnings
        {
            account: SYSTEM_ACCOUNTS.TECHNICIAN_PAYABLES,
            amount: breakdown.baseAmount,
            type: 'credit',
            description: `Technician earnings for payment ${paymentId}`
        }
    ];

    await recordLedgerTransaction({
        conn,
        transactionId,
        referenceType: 'payment',
        referenceId: paymentId,
        entries
    });
}

/**
 * Records a payout to technicians (via batch or direct).
 */
export async function recordPayout(conn, payoutId, amount, batchId = null) {
    const transactionId = `PO_${payoutId}`;
    const entries = [
        // Debit Technician Payables (Liability decreases)
        {
            account: SYSTEM_ACCOUNTS.TECHNICIAN_PAYABLES,
            amount: amount,
            type: 'debit',
            description: `Payout ${payoutId} dispatched`
        },
        // Credit Payment Gateway or Platform Funds (Asset decreases)
        {
            account: SYSTEM_ACCOUNTS.PAYMENT_GATEWAY,
            amount: amount,
            type: 'credit',
            description: `Funds transferred for payout ${payoutId}`
        }
    ];

    await recordLedgerTransaction({
        conn,
        transactionId,
        referenceType: batchId ? 'payout_batch' : 'payment_payout',
        referenceId: batchId || payoutId,
        entries
    });
}
