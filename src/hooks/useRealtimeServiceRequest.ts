import { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE, getRequiredApiBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveServiceRequestPaymentDetails } from '@/utils/serviceRequestPayment';

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
  drop_address?: string | null;
  dropLocation?: { lat?: number | null; lng?: number | null; address?: string | null } | null;
  drop_latitude?: number | string | null;
  drop_longitude?: number | string | null;
  route_distance_km?: number | string | null;
  routeDistanceKm?: number | string | null;
  estimated_duration?: number | string | null;
  estimatedDuration?: number | string | null;
  pricingBreakdown?: Record<string, any> | null;
  pricing_breakdown?: Record<string, any> | null;
  created_at: string;
  payment_status: string;
  started_at?: string | null;
  completed_at?: string | null;
  price?: number;
  amount?: number | string | null;
  service_charge?: number | string | null;
  payment_method?: string | null;
  paymentMode?: "cash" | "upi" | null;
  payment_mode?: "cash" | "upi" | null;
  baseAmount?: number | string | null;
  base_amount?: number | string | null;
  platformFee?: number | string | null;
  platform_fee?: number | string | null;
  razorpayFee?: number | string | null;
  razorpay_fee?: number | string | null;
  finalAmount?: number | string | null;
  final_amount?: number | string | null;
  dueAmount?: number | string | null;
  due_amount?: number | string | null;
  cancellation_reason?: string | null;
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

const normalizeRequestData = (data: any): RequestData => {
  const paymentDetails = resolveServiceRequestPaymentDetails(data);

  return {
    ...data,
    paymentMode: paymentDetails.paymentMode,
    payment_mode: paymentDetails.paymentMode,
    baseAmount: paymentDetails.baseAmount,
    base_amount: paymentDetails.baseAmount,
    platformFee: paymentDetails.platformFee,
    platform_fee: paymentDetails.platformFee,
    razorpayFee: paymentDetails.razorpayFee,
    razorpay_fee: paymentDetails.razorpayFee,
    finalAmount: paymentDetails.finalAmount,
    final_amount: paymentDetails.finalAmount,
    dueAmount: paymentDetails.dueAmount,
    due_amount: paymentDetails.dueAmount,
  };
};

export const useRealtimeServiceRequest = (requestId: string | undefined, options?: RealtimeOptions) => {
  const [request, setRequest] = useState<RequestData | null>(null);
  const [technician, setTechnician] = useState<TechnicianData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const lastTechnicianIdRef = useRef<string | null>(null);
  const { user } = useAuth();

  const fetchRequest = async () => {
    if (!requestId) return;
    try {
      const res = await apiFetch(`/api/service-requests/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        const normalizedRequest = normalizeRequestData(data);
        // Backend returns the full request object. If it has a technician property, use it.
        setRequest(normalizedRequest);
        if (normalizedRequest.technician) {
          // Normalize and sanitize technician payload so UI stays fully data-driven.
          const techData: any = { ...normalizedRequest.technician };
          const techId = techData?.id != null ? String(techData.id) : "";
          const rawLat = techData?.location?.lat ?? techData?.location_lat ?? null;
          const rawLng = techData?.location?.lng ?? techData?.location_lng ?? null;
          const parsedLat = Number(rawLat);
          const parsedLng = Number(rawLng);
          const parsedRating = Number(techData?.rating);
          const parsedCompletedJobs = Number(techData?.completedJobs ?? techData?.jobs_completed ?? 0);
          const rawAvatarUrl = String(techData?.avatar_url || techData?.profile_photo || "").trim();

          techData.id = techId;
          techData.location_lat = Number.isFinite(parsedLat) ? parsedLat : undefined;
          techData.location_lng = Number.isFinite(parsedLng) ? parsedLng : undefined;
          techData.rating = Number.isFinite(parsedRating) ? parsedRating : 0;
          techData.completedJobs = Number.isFinite(parsedCompletedJobs) ? parsedCompletedJobs : 0;
          techData.avatar_url = rawAvatarUrl
            ? (/^https?:\/\//i.test(rawAvatarUrl) ? rawAvatarUrl : apiUrl(rawAvatarUrl))
            : undefined;

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
    const socket = io(socketBaseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: localStorage.getItem('resqnow_user_token') || undefined },
    });
    let handleStatusUpdate: ((data: any) => void) | null = null;
    let handleLocationUpdate: ((data: any) => void) | null = null;

    socket.on("connect", () => {
      console.log("Socket connected for tracking");
      setIsConnected(true);
      if (user?.id) {
        socket.emit("join_user_room", user.id);
      }
      if (requestId) {
        socket.emit("join_request_room", requestId);
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    if (requestId) {
      // Listen for status updates from backend (notifyUser/notifyTechnician)
      handleStatusUpdate = (data: any) => {
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
            return normalizeRequestData({ ...prev, ...data }) as any;
          });
        }
      };
      socket.on("job:status_update", handleStatusUpdate);
      socket.on(`job_update_${requestId}`, handleStatusUpdate);

      // Listen for technician location updates
      handleLocationUpdate = (data: any) => {
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
      if (handleStatusUpdate) {
        socket.off("job:status_update", handleStatusUpdate);
        if (requestId) socket.off(`job_update_${requestId}`, handleStatusUpdate);
      }
      if (handleLocationUpdate) {
        socket.off("location_update", handleLocationUpdate);
        socket.off("technician:location_update", handleLocationUpdate);
      }
      socket.disconnect();
    };
  }, [requestId, user?.id]);

  // Polling fallback (2 seconds) to keep user timeline in near-real-time if sockets miss an event.
  useEffect(() => {
    const normalizedStatus = String(request?.status || "").trim().toLowerCase();
    const normalizedPaymentStatus = String(request?.payment_status || "").trim().toLowerCase();
    if (
      !requestId ||
      normalizedStatus === "paid" ||
      normalizedStatus === "completed" ||
      normalizedPaymentStatus === "paid" ||
      normalizedPaymentStatus === "completed"
    ) {
      return;
    }

    const interval = setInterval(() => {
      fetchRequest();
    }, 2000);

    return () => clearInterval(interval);
  }, [requestId, request?.status, request?.payment_status]);

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
