import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { useTechnicianJob } from '@/contexts/TechnicianJobContext';
import { apiFetch, readJsonSafely } from '@/lib/api';
import { createJobAlertSiren } from '@/lib/jobAlertSound';
import { offerRequestId, onClosedJobOffer, onPushedJobOffer } from '@/lib/jobOfferEvents';
import { getTechnicianActiveJobPath } from '@/lib/technicianActiveJobRoute';
import { fetchTechnicianOffer, toJobRequest } from '@/lib/technicianJobOffer';
import { normalizeTechnicianStatus } from '@/utils/technicianStatus';
import { TechnicianJobModal, type JobRequest } from './TechnicianJobModal';

const JOB_TAKEN_MESSAGE = 'This job has already been taken by another technician.';
const FREE_STATUSES = ['pending', 'completed', 'closed', 'cancelled', 'rejected'];

type AcceptedRequest = { id?: unknown; status?: string; job_status?: string };
type AcceptResponse = { success?: boolean; error?: string; request?: AcceptedRequest; job?: AcceptedRequest };

/**
 * The new-request card on every technician page except the dashboard, which shows the same
 * card itself. Offers come from the socket, or from a push while the app is open.
 */
const JobNotificationModal = () => {
  const { socket } = useSocket();
  const { token } = useTechnicianAuth();
  const { acceptedJobId, setAcceptedJobId } = useTechnicianJob();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDashboardRoute = pathname.startsWith('/technician/dashboard');
  const [job, setJob] = useState<JobRequest | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const jobRef = useRef<JobRequest | null>(null);
  const unavailableRef = useRef(false);
  const acceptedJobIdRef = useRef(acceptedJobId);
  const isMountedRef = useRef(true);
  const sirenRef = useRef<ReturnType<typeof createJobAlertSiren> | null>(null);

  jobRef.current = job;
  unavailableRef.current = isUnavailable;
  acceptedJobIdRef.current = acceptedJobId;

  const siren = () => (sirenRef.current ??= createJobAlertSiren());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sirenRef.current?.stop();
    };
  }, []);

  const close = useCallback(() => {
    siren().stop();
    setJob(null);
    setIsUnavailable(false);
  }, []);

  const markClosed = useCallback((requestId: string) => {
    const current = jobRef.current;
    if (!current || String(current.id) !== requestId) return;
    siren().stop();
    setIsUnavailable(true);
    toast.warning(JOB_TAKEN_MESSAGE);
  }, []);

  const showOffer = useCallback(async (raw: Record<string, unknown>, source: 'socket' | 'push') => {
    const requestId = offerRequestId(raw);
    if (!requestId || acceptedJobIdRef.current === requestId) return;
    // JOB_ALERT, job_offer and the push are the same offer: keep the card that is open.
    const current = jobRef.current;
    if (current && String(current.id) === requestId && !unavailableRef.current) return;

    try {
      const activeJobRes = await apiFetch('/api/technicians/me/active-job', { technician: true });
      const activeJob = activeJobRes.ok ? await readJsonSafely<{ id?: unknown; status?: string }>(activeJobRes) : null;
      if (activeJob?.id && !FREE_STATUSES.includes(normalizeTechnicianStatus(activeJob.status))) return;
    } catch {
      // Still show the offer if the busy check fails.
    }

    let next = source === 'socket' ? toJobRequest(raw) : null;
    if (source === 'push') {
      // A push carries a short summary and may be late: read the offer, and skip it once closed.
      const offer = await fetchTechnicianOffer(requestId).catch(() => null);
      if (!offer?.available) return;
      next = offer.job;
    }
    if (!next || !isMountedRef.current) return;
    setJob(next);
    setIsUnavailable(false);
    siren().start();
  }, []);

  useEffect(() => {
    if (!socket || isDashboardRoute) return;
    const handleOffer = (data: Record<string, unknown>) => void showOffer(data || {}, 'socket');
    const handleRevoked = (data: Record<string, unknown>) => markClosed(offerRequestId(data));
    const handleStatus = (data: Record<string, unknown>) => {
      const current = jobRef.current;
      if (!current || String(current.id) !== offerRequestId(data)) return;
      if (normalizeTechnicianStatus(String(data?.status || '')) !== 'pending') close();
    };

    socket.on('job_offer', handleOffer);
    socket.on('JOB_ALERT', handleOffer);
    socket.on('job:revoked', handleRevoked);
    socket.on('JOB_TAKEN', handleRevoked);
    socket.on('job:status_update', handleStatus);
    return () => {
      socket.off('job_offer', handleOffer);
      socket.off('JOB_ALERT', handleOffer);
      socket.off('job:revoked', handleRevoked);
      socket.off('JOB_TAKEN', handleRevoked);
      socket.off('job:status_update', handleStatus);
    };
  }, [socket, isDashboardRoute, showOffer, markClosed, close]);

  useEffect(() => {
    if (isDashboardRoute || !token) return;
    const stopOffers = onPushedJobOffer((offer) => {
      void showOffer(offer, 'push');
      return true;
    });
    const stopClosed = onClosedJobOffer(markClosed);
    return () => {
      stopOffers();
      stopClosed();
    };
  }, [isDashboardRoute, token, showOffer, markClosed]);

  // Leaving for the dashboard hands the offer to its own card.
  useEffect(() => {
    if (isDashboardRoute) close();
  }, [isDashboardRoute, close]);

  const handleAccept = async (jobId: string) => {
    const requestId = String(jobId || '').trim();
    if (!requestId || isSubmitting) return;
    if (isUnavailable) {
      toast.error(JOB_TAKEN_MESSAGE);
      return;
    }
    if (!token) {
      toast.error('Your technician session has expired. Please log in again.');
      return;
    }

    try {
      setIsSubmitting(true);
      siren().stop();
      const response = await apiFetch('/api/jobs/accept', {
        method: 'POST',
        technician: true,
        body: JSON.stringify({ jobId: requestId }),
      });
      const data = (await readJsonSafely<AcceptResponse>(response)) || {};
      if (!isMountedRef.current) return;
      if (!data.success) {
        if (response.status === 409) {
          setIsUnavailable(true);
          toast.error(JOB_TAKEN_MESSAGE);
          return;
        }
        toast.error(data.error || 'Failed to accept job');
        close();
        return;
      }

      const acceptedRequest = data.request || data.job || null;
      const acceptedId = String(acceptedRequest?.id || requestId).trim();
      toast.success('Job Accepted!');
      close();
      setAcceptedJobId(acceptedId);
      navigate(getTechnicianActiveJobPath(acceptedId), {
        replace: true,
        state: {
          jobId: acceptedId,
          job: acceptedRequest
            ? {
                ...acceptedRequest,
                id: acceptedId,
                status: normalizeTechnicianStatus(acceptedRequest.status || acceptedRequest.job_status || 'accepted'),
              }
            : { id: acceptedId, status: 'accepted' },
          alertAction: 'accept',
          alertSource: 'modal',
        },
      });
    } catch (error) {
      console.error('Accept error:', error);
      toast.error('Network error');
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleReject = async (jobId: string) => {
    const requestId = String(jobId || '').trim();
    const wasUnavailable = isUnavailable;
    close();
    if (!requestId || wasUnavailable) return;
    try {
      // Frees the offer for the next technician now instead of at its timeout.
      const res = await apiFetch(`/api/service-requests/${encodeURIComponent(requestId)}/technician-status`, {
        method: 'PATCH',
        technician: true,
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (res.ok) toast.info('Job Rejected');
    } catch {
      // The offer times out on the server anyway.
    }
  };

  if (!job || isDashboardRoute) return null;

  return (
    <TechnicianJobModal
      isOpen
      job={job}
      isProcessing={isSubmitting}
      isUnavailable={isUnavailable}
      unavailableMessage={JOB_TAKEN_MESSAGE}
      onAccept={handleAccept}
      onReject={handleReject}
      onDismissUnavailable={close}
    />
  );
};

export default JobNotificationModal;
