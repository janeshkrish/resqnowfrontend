import { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
import {
  deriveTrackingFreshness,
  type TrackingFreshness,
} from '@/lib/liveTrackingPlayback';
import { resolveServiceRequestPaymentDetails } from '@/utils/serviceRequestPayment';

interface RequestData {
  id: string;
  isTowing: boolean;
  user_id: string; // Added for feedback submission
  status: string;
  service_type: string;
  serviceType?: string;
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
  routeMetadata?: Record<string, any> | null;
  route_metadata?: Record<string, any> | null;
  routeGeometry?: Record<string, any> | null;
  route_geometry?: Record<string, any> | null;
  routePolyline?: Array<[number, number]> | null;
  route_polyline?: Array<[number, number]> | null;
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
  routeDistanceKm?: number;
  routeEtaMinutes?: number;
  routeEtaText?: string;
  routeEtaSource?: string;
  routeRequestId?: string;
  routeLocationLat?: number;
  routeLocationLng?: number;
  locationUpdatedAt?: number;
  recordedAt?: string;
  sequenceId?: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
}

interface RealtimeOptions {
  onStatusChange?: (oldStatus: string | null, newStatus: string | null) => void;
  onTechnicianAssigned?: () => void;
}

const TOWING_STATUS_EVENTS = [
  "vehicle_loaded",
  "tow_started",
  "arrived_drop",
  "service_completed",
  "payment_pending",
  "job_closed",
];
// Request status remains recoverable without letting REST compete with Socket.IO
// for the technician's live coordinate. A modest interval avoids a 2-second
// request fetch per customer while still recovering missed status transitions.
const REQUEST_STATUS_POLL_MS = 10_000;

const logTrackingDiagnostic = (event: string, details: Record<string, unknown>) => {
  if (String(import.meta.env.VITE_LIVE_TRACKING_DIAGNOSTICS || '').trim().toLowerCase() !== 'true') return;
  console.info('[LiveTracking Diagnostics]', { event, ...details });
};

const normalizeRequestData = (data: any): RequestData => {
  const paymentDetails = resolveServiceRequestPaymentDetails(data);

  return {
    ...data,
    isTowing: Boolean(data?.isTowing),
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
  const [trackingFreshness, setTrackingFreshness] = useState<TrackingFreshness>('UPDATING');
  const lastTechnicianIdRef = useRef<string | null>(null);
  const lastTrackingFixAtRef = useRef<number | null>(null);
  const { socket, isConnected } = useSocket();

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
          const snapshotUpdatedAt = Date.parse(String(
            techData?.location?.recordedAt ?? techData?.recordedAt ?? techData?.locationUpdatedAt ?? '',
          ));

          techData.id = techId;
          techData.location_lat = Number.isFinite(parsedLat) ? parsedLat : undefined;
          techData.location_lng = Number.isFinite(parsedLng) ? parsedLng : undefined;
          techData.rating = Number.isFinite(parsedRating) ? parsedRating : 0;
          techData.completedJobs = Number.isFinite(parsedCompletedJobs) ? parsedCompletedJobs : 0;
          techData.avatar_url = rawAvatarUrl
            ? (/^https?:\/\//i.test(rawAvatarUrl) ? rawAvatarUrl : apiUrl(rawAvatarUrl))
            : undefined;

          if (Number.isFinite(snapshotUpdatedAt)) {
            lastTrackingFixAtRef.current = Math.max(
              lastTrackingFixAtRef.current ?? Number.NEGATIVE_INFINITY,
              snapshotUpdatedAt,
            );
          }

          setTechnician(prev => {
            if (!prev || String(prev.id) !== techId) return techData;
            const currentUpdatedAt = Number(prev.locationUpdatedAt);
            const snapshotIsNewer = Number.isFinite(snapshotUpdatedAt) &&
              (!Number.isFinite(currentUpdatedAt) || snapshotUpdatedAt > currentUpdatedAt);
            const preserveRouteMetrics = prev.routeRequestId === String(requestId);
            return {
              ...techData,
              location_lat: snapshotIsNewer ? techData.location_lat : prev.location_lat,
              location_lng: snapshotIsNewer ? techData.location_lng : prev.location_lng,
              location: snapshotIsNewer ? techData.location : prev.location,
              locationUpdatedAt: snapshotIsNewer ? snapshotUpdatedAt : prev.locationUpdatedAt,
              recordedAt: snapshotIsNewer ? techData.recordedAt : prev.recordedAt,
              sequenceId: snapshotIsNewer ? techData.sequenceId : prev.sequenceId,
              speed: snapshotIsNewer ? techData.speed : prev.speed,
              heading: snapshotIsNewer ? techData.heading : prev.heading,
              accuracy: snapshotIsNewer ? techData.accuracy : prev.accuracy,
              routeDistanceKm: preserveRouteMetrics ? prev.routeDistanceKm : undefined,
              routeEtaMinutes: preserveRouteMetrics ? prev.routeEtaMinutes : undefined,
              routeEtaText: preserveRouteMetrics ? prev.routeEtaText : undefined,
              routeEtaSource: preserveRouteMetrics ? prev.routeEtaSource : undefined,
              routeRequestId: preserveRouteMetrics ? prev.routeRequestId : undefined,
              routeLocationLat: preserveRouteMetrics ? prev.routeLocationLat : undefined,
              routeLocationLng: preserveRouteMetrics ? prev.routeLocationLng : undefined,
            };
          });

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

  }, [requestId]);

  useEffect(() => {
    if (FRONTEND_ONLY_MODE || !requestId || !socket) return;

    let handleStatusUpdate: ((data: any) => void) | null = null;
    let handleLocationUpdate: ((data: any) => void) | null = null;

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
      TOWING_STATUS_EVENTS.forEach((eventName) => {
        socket.on(eventName, handleStatusUpdate);
      });

      // Listen for technician location updates
      handleLocationUpdate = (data: any) => {
        console.log("Tracking location update:", data);
        const eventRequestId = data?.requestId != null ? String(data.requestId) : "";
        if (eventRequestId && String(eventRequestId) !== String(requestId)) return;
        logTrackingDiagnostic('customer_location_received', {
          requestId: eventRequestId || String(requestId),
          technicianId: data?.technicianId ?? null,
          sequenceId: data?.sequenceId ?? null,
          lat: data?.lat ?? null,
          lng: data?.lng ?? null,
          recordedAt: data?.recordedAt ?? data?.locationUpdatedAt ?? null,
        });

        const eventTechnicianId = data?.technicianId != null
          ? String(data.technicianId)
          : "";

        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
        const parsedLocationUpdatedAt = Date.parse(String(data?.recordedAt ?? data?.locationUpdatedAt ?? ""));
        const locationUpdatedAt = Number.isFinite(parsedLocationUpdatedAt)
          ? parsedLocationUpdatedAt
          : undefined;
        const parsedReceivedAt = Date.parse(String(data?.receivedAt ?? ""));
        const authoritativeReceivedAt = Number.isFinite(parsedReceivedAt)
          ? parsedReceivedAt
          : locationUpdatedAt ?? Date.now();
        const parsedSequenceId = Number(data?.sequenceId);
        const sequenceId = Number.isSafeInteger(parsedSequenceId) && parsedSequenceId > 0
          ? parsedSequenceId
          : undefined;
        const parseMotion = (value: unknown, minimum: number, maximum: number) => {
          if (value == null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
        };
        const parseRouteMetric = (value: unknown) => {
          if (value == null || (typeof value === "string" && value.trim() === "")) return undefined;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
        };
        const routeDistanceKm = parseRouteMetric(data?.distanceKm);
        const routeEtaMinutes = parseRouteMetric(data?.durationMinutes);
        const routeEtaText = typeof data?.etaText === "string" && data.etaText.trim()
          ? data.etaText.trim()
          : undefined;
        const routeEtaSource = typeof data?.etaSource === "string" && data.etaSource.trim()
          ? data.etaSource.trim()
          : undefined;
        const hasRouteMetrics =
          hasLocation && routeDistanceKm !== undefined && routeEtaMinutes !== undefined;
        const routeRequestId = hasRouteMetrics
          ? String(requestId)
          : undefined;
        // We set the location on the technician object in state
        setTechnician(prev => {
          if (!prev) return null;
          if (eventTechnicianId && String(prev.id) !== eventTechnicianId) return prev;

          const currentLocationUpdatedAt = Number(prev.locationUpdatedAt);
          const currentSequenceId = Number(prev.sequenceId);
          // Route enrichment is asynchronous. The backend sends its original
          // GPS timestamp back with the enriched event, allowing an older road
          // route response to be ignored without rejecting compatible servers
          // that do not yet send that optional timestamp.
          if (
            locationUpdatedAt !== undefined &&
            Number.isFinite(currentLocationUpdatedAt) &&
            (locationUpdatedAt < currentLocationUpdatedAt ||
              (locationUpdatedAt === currentLocationUpdatedAt &&
                sequenceId !== undefined &&
                Number.isFinite(currentSequenceId) &&
                sequenceId < currentSequenceId))
          ) {
            return prev;
          }

          if (hasLocation) {
            lastTrackingFixAtRef.current = Math.max(
              lastTrackingFixAtRef.current ?? Number.NEGATIVE_INFINITY,
              authoritativeReceivedAt,
            );
          }

          return {
            ...prev,
            location_lat: hasLocation ? lat : prev.location_lat,
            location_lng: hasLocation ? lng : prev.location_lng,
            routeDistanceKm,
            routeEtaMinutes,
            routeEtaText,
            routeEtaSource,
            routeRequestId,
            routeLocationLat: hasRouteMetrics ? lat : undefined,
            routeLocationLng: hasRouteMetrics ? lng : undefined,
            locationUpdatedAt: locationUpdatedAt ?? prev.locationUpdatedAt,
            recordedAt: typeof data?.recordedAt === 'string' ? data.recordedAt : prev.recordedAt,
            sequenceId: sequenceId ?? prev.sequenceId,
            speed: parseMotion(data?.speed, 0, 100),
            heading: parseMotion(data?.heading, 0, 359.999999),
            accuracy: parseMotion(data?.accuracy, 0, 500),
            // Map legacy 'location' string if needed
            location: hasLocation ? `${lat}, ${lng}` : prev.location
          };
        });
      };
      socket.on("tracking:location:v1", handleLocationUpdate);
      socket.on("location_update", handleLocationUpdate);
      socket.on("technician:location_update", handleLocationUpdate);
    }

    const subscribeToRequest = () => {
      logTrackingDiagnostic('customer_subscription_requested', { requestId: String(requestId), socketId: socket.id ?? null });
      socket.emit("tracking:subscribe:v1", { requestId }, (acknowledgement: any) => {
        logTrackingDiagnostic('customer_subscription_acknowledged', {
          requestId: String(requestId),
          socketId: socket.id ?? null,
          ok: Boolean(acknowledgement?.ok),
          code: acknowledgement?.code ?? null,
          recoverySequenceId: acknowledgement?.location?.sequenceId ?? null,
        });
        if (!acknowledgement?.ok) {
          logTrackingDiagnostic('customer_subscription_failed', {
            requestId: String(requestId),
            code: acknowledgement?.code ?? 'UNKNOWN',
          });
        }
        if (acknowledgement?.ok && acknowledgement.location && handleLocationUpdate) {
          handleLocationUpdate(acknowledgement.location);
        }
      });
    };
    const handleConnect = () => subscribeToRequest();
    socket.on("connect", handleConnect);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      if (handleStatusUpdate) {
        socket.off("job:status_update", handleStatusUpdate);
        if (requestId) socket.off(`job_update_${requestId}`, handleStatusUpdate);
        TOWING_STATUS_EVENTS.forEach((eventName) => {
          socket.off(eventName, handleStatusUpdate);
        });
      }
      if (handleLocationUpdate) {
        socket.off("tracking:location:v1", handleLocationUpdate);
        socket.off("location_update", handleLocationUpdate);
        socket.off("technician:location_update", handleLocationUpdate);
      }
    };
  }, [requestId, socket]);

  useEffect(() => {
    const updateFreshness = () => {
      setTrackingFreshness(deriveTrackingFreshness(lastTrackingFixAtRef.current, Date.now(), isConnected));
    };
    updateFreshness();
    const interval = window.setInterval(updateFreshness, 1_000);
    return () => window.clearInterval(interval);
  }, [isConnected, requestId]);

  // Status-only recovery. `fetchRequest` preserves a newer realtime coordinate,
  // so Socket.IO remains the customer map's authoritative live-location feed.
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
    }, REQUEST_STATUS_POLL_MS);

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
    trackingFreshness,
    refresh
  };
};
