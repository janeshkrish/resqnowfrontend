import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/contexts/SocketContext";
import { normalizeTechnicianStatus } from "@/utils/technicianStatus";

export interface TechnicianServiceRequest {
  id: string;
  service_type: string;
  vehicle_type: string | null;
  vehicle_model: string | null;
  address: string | null;
  description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  location_lat: number | null;
  location_lng: number | null;
}

interface UseRealtimeTechnicianRequestsOptions {
  onNewRequest?: (request: TechnicianServiceRequest) => void;
  onRequestUpdated?: (request: TechnicianServiceRequest) => void;
}

export const useRealtimeTechnicianRequests = (
  technicianId: string | undefined,
  options?: UseRealtimeTechnicianRequestsOptions
) => {
  const [requests, setRequests] = useState<TechnicianServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(!!technicianId);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected } = useSocket();

  // Fetch all requests for this technician
  const fetchRequests = useCallback(async () => {
    if (!technicianId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch from specific technician endpoint
      const res = await apiFetch(`/api/technicians/requests`, { technician: true });
      if (!res.ok) {
        console.warn("Failed to fetch requests via technician endpoint");
        throw new Error("Failed to fetch requests");
      }
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, [technicianId]);

  // Update request status
  const updateRequestStatus = useCallback(async (
    requestId: string,
    newStatus: string
  ): Promise<boolean> => {
    try {
      // Use the generic status update endpoint
      const res = await apiFetch(`/api/service-requests/${requestId}/technician-status`, {
        method: "PATCH",
        technician: true,
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error("Update failed");

      toast.success(`Request ${newStatus === 'completed' ? 'completed' : 'updated'} successfully`);

      // Optimistic update
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
      ));

      return true;
    } catch (err: any) {
      console.error('Error updating request:', err);
      toast.error('Failed to update request');
      return false;
    }
  }, []);

  // Listen to Socket Events
  useEffect(() => {
    if (!socket || !technicianId) return;

    const handleNewRequest = (raw: any) => {
      console.log('New request received via socket:', raw);
      const request: TechnicianServiceRequest = {
        id: String(raw.requestId || raw.id),
        service_type: raw.serviceType || raw.service_type || 'service',
        vehicle_type: raw.vehicleType || raw.vehicle_type || null,
        vehicle_model: raw.vehicle_model || null,
        address: raw.address || raw.location?.address || null,
        description: raw.description || null,
        contact_name: raw.customerName || raw.contact_name || null,
        contact_phone: raw.contact_phone || null,
        contact_email: raw.contact_email || null,
        status: normalizeTechnicianStatus(raw.status || 'assigned'),
        payment_status: raw.payment_status || null,
        created_at: raw.created_at || new Date().toISOString(),
        updated_at: raw.updated_at || new Date().toISOString(),
        user_id: String(raw.user_id || ''),
        location_lat: raw.location?.lat ?? raw.location_lat ?? null,
        location_lng: raw.location?.lng ?? raw.location_lng ?? null,
      };

      setRequests(prev => {
        const exists = prev.some(r => String(r.id) === String(request.id));
        return exists ? prev : [request, ...prev];
      });
      options?.onNewRequest?.(request);
      toast.info("New Service Request", {
        description: `${request.service_type} nearby`
      });
    };

    const handleRequestUpdate = (request: any) => {
      console.log('Request updated via socket:', request);
      const requestId = String(request.requestId || request.id);
      setRequests(prev => {
        return prev.map(r => String(r.id) === requestId ? { ...r, ...request, id: requestId, status: normalizeTechnicianStatus(request.status || r.status) } : r);
      });
      options?.onRequestUpdated?.({ ...(request as any), id: requestId });
    };

    const handleListUpdate = () => {
      fetchRequests();
    };

    socket.on('job_offer', handleNewRequest);
    socket.on('job:assigned', handleNewRequest);
    socket.on('job_assigned', handleNewRequest);
    socket.on('job:status_update', handleRequestUpdate);
    socket.on('job:list_update', handleListUpdate);

    // Initial fetch
    fetchRequests();

    return () => {
      socket.off('job_offer', handleNewRequest);
      socket.off('job:assigned', handleNewRequest);
      socket.off('job_assigned', handleNewRequest);
      socket.off('job:status_update', handleRequestUpdate);
      socket.off('job:list_update', handleListUpdate);
    };
  }, [socket, technicianId, fetchRequests, options?.onNewRequest, options?.onRequestUpdated]);

  return {
    requests,
    isLoading,
    isConnected,
    error,
    refresh: fetchRequests,
    updateRequestStatus
  };
};
