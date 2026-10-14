import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptanceTechnicianId, pendingAcceptanceKey, readPendingAcceptance, readPendingAcceptanceOfferId,
  postJobAcceptance, readJobAcceptance, JobAcceptanceError, CHECKING_ACCEPTANCE_MESSAGE,
  type AcceptanceResult, type AcceptedJob,
} from '@/lib/technicianJobAcceptance';

export function useJobAcceptance(onAccepted: (job: AcceptedJob, recovered: boolean) => void) {
  const technicianId = acceptanceTechnicianId();
  const [pendingAcceptanceId, setPending] = useState(() => readPendingAcceptance(technicianId));
  const [acceptanceMessage, setMessage] = useState<string | null>(pendingAcceptanceId ? CHECKING_ACCEPTANCE_MESSAGE : null);
  const [canRetryAcceptance, setCanRetry] = useState(false);
  const pendingRef = useRef(pendingAcceptanceId);
  const pendingOfferRef = useRef(readPendingAcceptanceOfferId(technicianId));
  const busyRef = useRef(false);
  const checkingRef = useRef(false);
  const mounted = useRef(true);
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;

  const remember = useCallback((jobId: string | null, offerId?: string) => {
    if (!technicianId || acceptanceTechnicianId() !== technicianId) return;
    // Persist before sending. Browser storage failures still allow in-session recovery.
    try {
      if (jobId) localStorage.setItem(pendingAcceptanceKey(technicianId), JSON.stringify({ jobId, ...(offerId ? { offerId } : {}) }));
      else localStorage.removeItem(pendingAcceptanceKey(technicianId));
    } catch { /* storage unavailable */ }
    pendingRef.current = jobId;
    pendingOfferRef.current = jobId ? offerId : undefined;
    setCanRetry(false);
    if (mounted.current) setPending(jobId);
  }, [technicianId]);

  const checkAcceptance = useCallback(async (): Promise<AcceptanceResult | null> => {
    const jobId = pendingRef.current;
    if (!jobId || !technicianId || busyRef.current || checkingRef.current || navigator.onLine === false) return null;
    checkingRef.current = true;
    try {
      const outcome = await readJobAcceptance(jobId, pendingOfferRef.current);
      if (!mounted.current || acceptanceTechnicianId() !== technicianId || pendingRef.current !== jobId) return null;
      if (outcome.state === 'accepted' && outcome.job) {
        remember(null);
        setMessage(null);
        onAcceptedRef.current(outcome.job, true);
        return { success: true, job: outcome.job, request: outcome.job, idempotent: true };
      }
      // A GET may overtake a delayed POST. "Available" cannot prove that the
      // original attempt will never commit, so keep persistence and polling.
      if (outcome.state === 'available') {
        setCanRetry(true);
        setMessage('Acceptance is still unconfirmed. We will keep checking. You can retry accepting this same job.');
        return null;
      }
      remember(null);
      setMessage(outcome.state === 'taken' ? 'This job has already been taken by another technician.'
        : outcome.state === 'expired' ? 'This job offer has expired.' : 'This job is no longer available.');
    } catch {
      if (mounted.current && acceptanceTechnicianId() === technicianId) setMessage(CHECKING_ACCEPTANCE_MESSAGE);
    } finally { checkingRef.current = false; }
    return null;
  }, [technicianId, remember]);

  const submitAcceptance = useCallback(async (jobId: string, recovering = false, offerId?: string): Promise<AcceptanceResult> => {
    if (!technicianId || acceptanceTechnicianId() !== technicianId) throw new JobAcceptanceError('session_expired', 'Please log in again.', 401);
    if (busyRef.current || (pendingRef.current && (!recovering || pendingRef.current !== jobId))) throw new JobAcceptanceError('acceptance_unknown', CHECKING_ACCEPTANCE_MESSAGE);
    busyRef.current = true;
    const selectedOfferId = recovering ? pendingOfferRef.current : offerId;
    remember(jobId, selectedOfferId);
    setMessage(null);
    try {
      const result = await postJobAcceptance(jobId, selectedOfferId);
      if (acceptanceTechnicianId() !== technicianId) throw new JobAcceptanceError('session_changed', 'Your technician session changed. Please check your active job after logging in.', 401);
      if (mounted.current && acceptanceTechnicianId() === technicianId) {
        remember(null);
        setMessage(null);
        onAcceptedRef.current(result.job, recovering);
      }
      return result;
    } catch (error) {
      if (mounted.current && acceptanceTechnicianId() === technicianId) {
        if (recovering || !(error instanceof JobAcceptanceError) || error.code === 'acceptance_unknown') setMessage(CHECKING_ACCEPTANCE_MESSAGE);
        else { remember(null); setMessage(error.message); }
      }
      throw error;
    } finally { busyRef.current = false; }
  }, [technicianId, remember]);

  const acceptJob = useCallback((jobId: string, offerId?: string) => submitAcceptance(jobId, false, offerId), [submitAcceptance]);
  const retryAcceptance = useCallback((): Promise<AcceptanceResult> => {
    const jobId = pendingRef.current;
    if (!jobId || !canRetryAcceptance) return Promise.reject(new JobAcceptanceError('acceptance_unknown', CHECKING_ACCEPTANCE_MESSAGE));
    return submitAcceptance(jobId, true);
  }, [canRetryAcceptance, submitAcceptance]);

  useEffect(() => {
    mounted.current = true;
    const stored = readPendingAcceptance(technicianId);
    pendingRef.current = stored;
    pendingOfferRef.current = readPendingAcceptanceOfferId(technicianId);
    setPending(stored);
    setMessage(stored ? CHECKING_ACCEPTANCE_MESSAGE : null);
    setCanRetry(false);
    return () => { mounted.current = false; };
  }, [technicianId]);

  useEffect(() => {
    if (!pendingAcceptanceId) return;
    const check = () => { void checkAcceptance(); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    const timer = window.setInterval(check, 5_000);
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', check);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [pendingAcceptanceId, checkAcceptance]);

  return { acceptJob, pendingAcceptanceId, acceptanceMessage, checkAcceptance, canRetryAcceptance, retryAcceptance };
}
