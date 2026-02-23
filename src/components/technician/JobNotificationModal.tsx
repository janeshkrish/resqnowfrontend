import React, { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigation, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';

interface JobRequest {
  id: string;
  service_type: string;
  amount: number;
}

const JobNotificationModal = () => {
  const { socket } = useSocket();
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useTechnicianAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardRoute = location.pathname.startsWith('/technician/dashboard');

  useEffect(() => {
    if (!socket || isDashboardRoute) return;

    const handleNewJob = (data: Record<string, unknown>) => {
      const rawId = data.requestId ?? data.id;
      if (!rawId) return;
      const normalizedId = String(rawId).trim();
      if (!normalizedId || normalizedId === 'undefined') return;

      const normalized: JobRequest = {
        id: normalizedId,
        service_type: String(data.serviceType || data.service_type || 'Service'),
        amount: Number(data.amount || 0),
      };
      setJobRequest(normalized);
      setOpen(true);
      const audio = new Audio('/notification.mp3');
      audio.play().catch((e) => console.log('Audio play failed', e));
    };

    socket.on('job_offer', handleNewJob);

    return () => {
      socket.off('job_offer', handleNewJob);
    };
  }, [socket, isDashboardRoute]);

  const handleAccept = async () => {
    if (!jobRequest || isSubmitting) return;
    const requestId = String(jobRequest.id || '').trim();
    if (!requestId || requestId === 'undefined') {
      toast.error('Invalid job request id');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Job Accepted!');
        setOpen(false);
        navigate('/technician/active-job');
      } else {
        toast.error(data.error || 'Failed to accept job');
        setOpen(false);
      }
    } catch (error) {
      console.error('Accept error:', error);
      toast.error('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    setOpen(false);
    setJobRequest(null);
  };

  if (!jobRequest) return null;

  return (
    <Dialog open={open} onOpenChange={handleReject}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Service Request!</DialogTitle>
          <DialogDescription>
            A customer nearby needs help. You have 30 seconds to accept.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex flex-col">
              <span className="font-semibold text-lg flex items-center gap-2">
                <Navigation className="w-4 h-4" /> {jobRequest.service_type}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Est. Earnings: INR {jobRequest.amount}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleReject}>
            Reject
          </Button>
          <Button
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            disabled={isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? 'Accepting...' : 'Accept Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobNotificationModal;
