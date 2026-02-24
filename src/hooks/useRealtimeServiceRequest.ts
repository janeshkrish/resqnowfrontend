import { useState, useEffect, useRef } from 'react';
import { apiFetch, FRONTEND_ONLY_MODE, getRequiredApiBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface RequestData {
  id: string;
  user_id: string; // Added for feedback submission
  status: string;
  service_type: string;
  vehicle_type?: string;
  vehicle_model?: string;
  address?: string;
  location_lat?: number;
  location_lng?: number;
  created_at: string;
  payment_status: string;
  started_at?: string | null;
  completed_at?: string | null;
  price?: number;
  amount?: number;
  service_charge?: number | string;
}

interface TechnicianData {
  id: string;
  name: string;
  phone: string;
  rating: number;
  avatar_url?: string;
  location?: string;
  specialties?: string[];
  location_lat?: number;
  location_lng?: number;
  completedJobs?: number;
}

interface RealtimeOptions {
  onStatusChange?: (oldStatus: string | null, newStatus: string | null) => void;
  onTechnicianAssigned?: () => void;
}

export const useRealtimeServiceRequest = (requestId: string | undefined, options?: RealtimeOptions) => {
  const [request, setRequest] = useState<RequestData | null>(null);
  const [technician, setTechnician] = useState<TechnicianData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastTechnicianIdRef = useRef<string | null>(null);

  const fetchRequest = async () => {
    if (!requestId) return;
    try {
      const res = await apiFetch(`/api/service-requests/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        // Backend returns the full request object. If it has a technician property, use it.
        setRequest(data);
        if (data.technician) {
          // Normalize and sanitize technician payload so UI stays fully data-driven.
          const techData: any = { ...data.technician };
          const techId = techData?.id != null ? String(techData.id) : "";
          const rawLat = techData?.location?.lat ?? techData?.location_lat ?? null;
          const rawLng = techData?.location?.lng ?? techData?.location_lng ?? null;
          const parsedLat = Number(rawLat);
          const parsedLng = Number(rawLng);
          const parsedRating = Number(techData?.rating);
          const parsedCompletedJobs = Number(techData?.completedJobs ?? techData?.jobs_completed ?? 0);

          techData.id = techId;
          techData.location_lat = Number.isFinite(parsedLat) ? parsedLat : undefined;
          techData.location_lng = Number.isFinite(parsedLng) ? parsedLng : undefined;
          techData.rating = Number.isFinite(parsedRating) ? parsedRating : 0;
          techData.completedJobs = Number.isFinite(parsedCompletedJobs) ? parsedCompletedJobs : 0;

          setTechnician(techData);

          if (techId && lastTechnicianIdRef.current !== techId) {
            options?.onTechnicianAssigned?.();
            lastTechnicianIdRef.current = techId;
          }
        } else {
          lastTechnicianIdRef.current = null;
          setTechnician(null);
        }
      } else {
        console.error("Failed to fetch request");
        toast.error("Could not load request details");
      }
    } catch (err) {
      console.error("Error fetching request:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();

    if (FRONTEND_ONLY_MODE) {
      setIsConnected(false);
      return;
    }

    // Initialize Socket.IO
    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket = io(socketBaseUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected for tracking");
      setIsConnected(true);
      if (requestId) {
        socket.emit("join_request_room", requestId);
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    if (requestId) {
      // Listen for status updates from backend (notifyUser/notifyTechnician)
      socket.on("job:status_update", (data: any) => {
        console.log("Status update received:", data);
        if (String(data.requestId) === String(requestId) || String(data.id) === String(requestId)) {
          // Pull full request to ensure normalized fields (joined data, timestamps)
          fetchRequest();

          setRequest(prev => {
            if (!prev) return null;
            if (data.status && prev.status !== data.status) {
              options?.onStatusChange?.(prev.status, data.status);
            }
            // Merge only simple fields from event; fetchRequest will refresh full object
            return { ...prev, ...data } as any;
          });
        }
      });

      // Listen for technician location updates
      const handleLocationUpdate = (data: any) => {
        console.log("Tracking location update:", data);
        const eventRequestId = data?.requestId != null ? String(data.requestId) : "";
        if (eventRequestId && String(eventRequestId) !== String(requestId)) return;

        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        // We set the location on the technician object in state
        setTechnician(prev => {
          if (!prev) return null;
          return {
            ...prev,
            location_lat: Number.isFinite(lat) ? lat : prev.location_lat,
            location_lng: Number.isFinite(lng) ? lng : prev.location_lng,
            // Map legacy 'location' string if needed
            location: `${data?.lat}, ${data?.lng}`
          };
        });
      };
      socket.on("location_update", handleLocationUpdate);
      socket.on("technician:location_update", handleLocationUpdate);
    }

    return () => {
      socket.disconnect();
    };
  }, [requestId]);

  // Polling Fallback (every 5 seconds) to handle missed socket events or connection issues
  useEffect(() => {
    // Stop polling only when the request is fully paid
    if (!requestId || request?.status === 'paid') return;

    const interval = setInterval(() => {
      fetchRequest();
    }, 5000);

    return () => clearInterval(interval);
  }, [requestId, request?.status]);

  const refresh = () => {
    setIsLoading(true);
    fetchRequest();
  };

  return {
    request,
    technician,
    isLoading,
    isConnected,
    refresh
  };
};
