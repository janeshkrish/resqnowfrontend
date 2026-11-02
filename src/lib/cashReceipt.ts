import { normalizeTechnicianStatus } from '@/utils/technicianStatus';

export type CashReceiptIntent = { intentId: string; technicianId: string; amountPaise: number; currency: string };

export function readCashReceiptIntent(job: any): CashReceiptIntent | null {
  if (!job || String(job.payment_method ?? job.paymentMode ?? '').toLowerCase() !== 'cash' ||
      ['paid', 'completed'].includes(String(job.payment_status ?? job.paymentStatus ?? '').toLowerCase())) return null;
  const status = normalizeTechnicianStatus(job.status);
  const stages = job.isTowing ? ['service_completed', 'payment_pending'] : ['payment_pending'];
  if (!stages.includes(status)) return null;
  try {
    const intent = typeof job.cash_payment_intent === 'string' ? JSON.parse(job.cash_payment_intent) : job.cash_payment_intent;
    if (!intent || typeof intent.intentId !== 'string' || !intent.intentId || typeof intent.technicianId !== 'string' ||
        !Number.isSafeInteger(intent.amountPaise) || intent.amountPaise <= 0 || !/^[A-Z]{3}$/.test(intent.currency)) return null;
    return intent;
  } catch { return null; }
}
