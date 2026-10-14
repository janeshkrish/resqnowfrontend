import { apiFetch, FRONTEND_ONLY_MODE, getTechnicianToken, readJsonSafely } from '@/lib/api';

export type AcceptedJob = { id: string | number; status?: string; [key: string]: unknown };
export type AcceptanceResult = { success: true; job: AcceptedJob; request: AcceptedJob; idempotent?: boolean };
export type AcceptanceOutcome = { state: 'accepted' | 'available' | 'taken' | 'expired' | 'closed'; job?: AcceptedJob };

export class JobAcceptanceError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}
export const CHECKING_ACCEPTANCE_MESSAGE = 'Connection lost. Checking whether your job was accepted. Reconnect to confirm.';

// Used only to scope browser state; server authentication remains authoritative.
export function acceptanceTechnicianId(): string | null {
  try {
    const token = getTechnicianToken() || '';
    if (FRONTEND_ONLY_MODE && token === 'demo-tech-token') {
      const technician = JSON.parse(localStorage.getItem('resqnow_technician') || 'null');
      return technician?.id ? `demo:${technician.id}` : null;
    }
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.type === 'technician' && payload.id ? String(payload.id) : null;
  } catch { return null; }
}
export const pendingAcceptanceKey = (technicianId: string) => `resqnow_pending_acceptance_${technicianId}`;

export function readPendingAcceptance(technicianId: string | null): string | null {
  if (!technicianId) return null;
  try {
    const row = JSON.parse(localStorage.getItem(pendingAcceptanceKey(technicianId)) || 'null');
    const validId = FRONTEND_ONLY_MODE && technicianId.startsWith('demo:') ? /^req-\d+$/ : /^[1-9]\d*$/;
    return validId.test(String(row?.jobId || '')) ? String(row.jobId) : null;
  } catch { return null; }
}

async function request(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await apiFetch(path, { ...options, technician: true, signal: controller.signal, cache: 'no-store' });
    const data = await readJsonSafely<Record<string, unknown>>(response);
    return { response, data };
  } finally { window.clearTimeout(timer); }
}

export function readPendingAcceptanceOfferId(technicianId: string | null): string | undefined {
  if (!technicianId || !readPendingAcceptance(technicianId)) return undefined;
  try {
    const row = JSON.parse(localStorage.getItem(pendingAcceptanceKey(technicianId)) || 'null');
    const offerId = String(row?.offerId || '');
    return /^[1-9]\d*$/.test(offerId) ? offerId : undefined;
  } catch { return undefined; }
}

export async function postJobAcceptance(jobId: string, offerId?: string): Promise<AcceptanceResult> {
  try {
    const { response, data } = await request('/api/jobs/accept', { method: 'POST', body: JSON.stringify({ jobId, ...(offerId ? { offerId } : {}) }) });
    if ([400, 401, 403, 404, 409].includes(response.status) && data?.code !== 'acceptance_retry') {
      throw new JobAcceptanceError(String(data?.code || 'acceptance_rejected'), String(data?.error || 'Unable to accept this job.'), response.status);
    }
    const job = (data?.request || data?.job) as AcceptedJob | undefined;
    if (!response.ok || !data?.success || String(job?.id) !== jobId) throw new Error('Acceptance has not been confirmed');
    return { success: true, job: job!, request: job!, idempotent: Boolean(data.idempotent) };
  } catch (error) {
    if (error instanceof JobAcceptanceError) throw error;
    throw new JobAcceptanceError('acceptance_unknown', CHECKING_ACCEPTANCE_MESSAGE);
  }
}

export async function readJobAcceptance(jobId: string, offerId?: string): Promise<AcceptanceOutcome> {
  const suffix = offerId ? `?offerId=${encodeURIComponent(offerId)}` : '';
  const { response, data } = await request(`/api/jobs/${encodeURIComponent(jobId)}/acceptance${suffix}`);
  if (response.status === 404) return { state: 'closed' };
  if (!response.ok || !['accepted', 'available', 'taken', 'expired', 'closed'].includes(String(data?.state))) throw new Error('Unable to confirm acceptance');
  if (data?.state === 'accepted' && String((data.job as AcceptedJob)?.id) !== jobId) throw new Error('Invalid acceptance result');
  return data as AcceptanceOutcome;
}
