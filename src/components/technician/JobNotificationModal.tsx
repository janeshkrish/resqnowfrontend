import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigation, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, readJsonSafely } from '@/lib/api';
import { useTechnicianJob } from '@/contexts/TechnicianJobContext';
import { normalizeTechnicianStatus } from '@/utils/technicianStatus';
import { getTechnicianActiveJobPath } from '@/lib/technicianActiveJobRoute';

interface JobRequest {
  id: string;
  isTowing?: boolean;
  service_type: string;
  amount: number;
  pickupAddress?: string;
  dropAddress?: string | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  vehicleType?: string | null;
  vehicleCategory?: string | null;
}

const JobNotificationModal = () => {
  const { socket } = useSocket();
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const jobRequestRef = useRef<JobRequest | null>(null);
  const { token } = useTechnicianAuth();
  const { acceptedJobId, setAcceptedJobId } = useTechnicianJob();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardRoute = location.pathname.startsWith('/technician/dashboard');
  const JOB_TAKEN_MESSAGE = 'This job has already been taken by another technician.';
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    jobRequestRef.current = jobRequest;
  }, [jobRequest]);

  useEffect(() => {
    if (!socket || isDashboardRoute) return;

    const handleNewJob = async (data: Record<string, unknown>) => {
      const rawId = data.requestId ?? data.id;
      if (!rawId) return;
      const normalizedId = String(rawId).trim();
      if (!normalizedId || normalizedId === 'undefined') return;
      if (acceptedJobId && acceptedJobId === normalizedId) return;

      try {
        const activeJobRes = await apiFetch('/api/technicians/me/active-job', { technician: true });
        if (activeJobRes.ok) {
          const activeJob = await activeJobRes.json();
          const activeStatus = normalizeTechnicianStatus(activeJob?.status);
          if (
            activeJob?.id &&
            !['pending', 'completed', 'cancelled', 'rejected'].includes(activeStatus)
          ) {
            return;
          }
        }
      } catch {
        // Ignore active-job probe failures and still show the offer modal.
      }

      const normalized: JobRequest = {
        id: normalizedId,
        isTowing: Boolean(data.isTowing),
        service_type: String(data.serviceType || data.service_type || 'Service'),
        amount: Number(data.technicianEstimatedEarning || data.estimatedEarnings || data.amount || 0),
        pickupAddress: String((data.location as any)?.address || data.address || ''),
        dropAddress: String((data.dropLocation as any)?.address || data.dropAddress || data.drop_address || '').trim() || null,
        distanceKm: Number(data.routeDistanceKm || data.route_distance_km || 0) || null,
        durationMinutes: Number(data.estimatedDuration || data.estimated_duration || 0) || null,
        vehicleType: String(data.vehicleType || data.vehicle_type || '').trim() || null,
        vehicleCategory: String(data.vehicleCategory || data.vehicle_category || '').trim() || null,
      };
      setJobRequest(normalized);
      setIsUnavailable(false);
      setOpen(true);
      const audio = new Audio('/notification.mp3');
      audio.play().catch((e) => console.log('Audio play failed', e));
    };

    const handleRevoked = (data: Record<string, unknown>) => {
      const revokedId = String(data?.requestId || data?.jobId || data?.id || '').trim();
      if (!revokedId) return;
      const currentOffer = jobRequestRef.current;
      if (!currentOffer || String(currentOffer.id) !== revokedId) return;
      setIsUnavailable(true);
      setOpen(true);
      toast.warning(JOB_TAKEN_MESSAGE);
    };

    socket.on('job_offer', handleNewJob);
    socket.on('JOB_ALERT', handleNewJob);
    socket.on('job:revoked', handleRevoked);
    socket.on('JOB_TAKEN', handleRevoked);

    return () => {
      socket.off('job_offer', handleNewJob);
      socket.off('JOB_ALERT', handleNewJob);
      socket.off('job:revoked', handleRevoked);
      socket.off('JOB_TAKEN', handleRevoked);
    };
  }, [socket, isDashboardRoute, acceptedJobId]);

  const handleAccept = async () => {
    if (!jobRequest || isSubmitting) return;
    if (isUnavailable) {
      toast.error(JOB_TAKEN_MESSAGE);
      return;
    }
    const requestId = String(jobRequest.id || '').trim();
    if (!requestId || requestId === 'undefined') {
      toast.error('Invalid job request id');
      return;
    }
    if (!token) {
      toast.error('Your technician session has expired. Please log in again.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiFetch('/api/jobs/accept', {
        method: 'POST',
        technician: true,
        body: JSON.stringify({ jobId: requestId })
      });
      const data = (await readJsonSafely<any>(response)) || {};
      if (!isMountedRef.current) return;
      if (data.success) {
        const acceptedRequest = data?.request || data?.job || null;
        const acceptedJobId = String(acceptedRequest?.id || requestId).trim();
        if (!acceptedJobId || acceptedJobId === 'undefined') {
          throw new Error('Accepted job id missing in response');
        }
        toast.success('Job Accepted!');
        setOpen(false);
        setJobRequest(null);
        setIsUnavailable(false);
        setAcceptedJobId(acceptedJobId);
        navigate(getTechnicianActiveJobPath(acceptedJobId), {
          replace: true,
          state: {
            jobId: acceptedJobId,
            job: acceptedRequest
              ? {
                  ...acceptedRequest,
                  id: acceptedJobId,
                  status: normalizeTechnicianStatus(
                    acceptedRequest?.status || acceptedRequest?.job_status || 'accepted'
                  ),
                }
              : { id: acceptedJobId, status: 'accepted' },
            alertAction: 'accept',
            alertSource: 'modal',
          },
        });
      } else {
        if (response.status === 409) {
          setIsUnavailable(true);
          setOpen(true);
          toast.error(JOB_TAKEN_MESSAGE);
          return;
        }
        toast.error(data.error || 'Failed to accept job');
        setOpen(false);
      }
    } catch (error) {
      console.error('Accept error:', error);
      toast.error('Network error');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleReject = () => {
    setOpen(false);
    setJobRequest(null);
    setIsUnavailable(false);
  };

  if (!jobRequest) return null;

  return (
    <Dialog open={open} onOpenChange={handleReject}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isUnavailable ? 'Job Unavailable' : 'New Service Request!'}</DialogTitle>
          <DialogDescription>
            {isUnavailable
              ? JOB_TAKEN_MESSAGE
              : 'A customer nearby needs help. You have 30 seconds to accept.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-lg border ${isUnavailable ? 'bg-amber-50 border-amber-200' : 'bg-muted border-border'}`}>
            <div className="flex flex-col">
              <span className="font-semibold text-lg flex items-center gap-2">
                <Navigation className="w-4 h-4" /> {jobRequest.service_type}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Est. Earnings: INR {jobRequest.amount}
              </span>
              {jobRequest.pickupAddress && (
                <span className="mt-2 text-xs text-muted-foreground">Pickup: {jobRequest.pickupAddress}</span>
              )}
              {jobRequest.dropAddress && (
                <span className="text-xs text-muted-foreground">Drop: {jobRequest.dropAddress}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {[jobRequest.distanceKm ? `${jobRequest.distanceKm.toFixed(1)} km` : null, jobRequest.durationMinutes ? `${Math.round(jobRequest.durationMinutes)} min` : null].filter(Boolean).join(' / ')}
              </span>
              {(jobRequest.vehicleType || jobRequest.vehicleCategory) && (
                <span className="text-xs text-muted-foreground">
                  Vehicle: {[jobRequest.vehicleType, jobRequest.vehicleCategory].filter(Boolean).join(' / ')}
                </span>
              )}
            </div>
          </div>
          {isUnavailable && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm font-semibold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{JOB_TAKEN_MESSAGE}</span>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleReject}>
            {isUnavailable ? 'Dismiss' : 'Reject'}
          </Button>
          <Button
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            disabled={isSubmitting || isUnavailable}
            onClick={handleAccept}
          >
            {isUnavailable ? 'Already Taken' : isSubmitting ? 'Accepting...' : 'Accept Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobNotificationModal;
