import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { readCashReceiptIntent } from '@/lib/cashReceipt';

export default function CashReceiptConfirmation({ job, token, technicianId, onConfirmed, onStale }: {
  job: any; token?: string | null; technicianId?: string | null;
  onConfirmed: () => Promise<unknown> | void; onStale: () => Promise<unknown> | void;
}) {
  const intent = readCashReceiptIntent(job);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setConfirmed(false); setError(null); }, [job?.id, intent?.intentId]);
  if (!intent || !token || intent.technicianId !== String(technicianId)) return null;
  const amount = `${intent.currency} ${(intent.amountPaise / 100).toFixed(2)}`;
  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(apiUrl('/api/payments/cash/confirm'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: String(job.id ?? job.requestId), intentId: intent.intentId,
          amountPaise: intent.amountPaise, currency: intent.currency, received: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Cash receipt could not be confirmed.');
        if ([404, 409].includes(res.status)) await onStale();
        return;
      }
      if (!body.success || !['paid', 'completed'].includes(String(body.request?.payment_status ?? '').toLowerCase())) {
        setError('Cash receipt is still pending. Refresh the job before retrying.'); return;
      }
      setConfirmed(true); await onConfirmed();
    } catch { setError('Unable to confirm cash receipt. Refresh the job and retry.'); }
    finally { setBusy(false); }
  };
  return <div className='tj-wait' style={{ display: 'grid', gap: '0.75rem' }}>
    <p>The customer chose cash. Confirm only after you have collected the full {amount}.</p>
    {error ? <p role='alert'>{error}</p> : null}
    <button type='button' className='tj-cta' onClick={() => void confirm()} disabled={busy || confirmed}>
      {busy ? 'Confirming receipt…' : confirmed ? 'Cash receipt confirmed' : `I received ${amount} cash`}
    </button>
  </div>;
}
