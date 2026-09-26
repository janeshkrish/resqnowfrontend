import { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
import {
  deriveTrackingFreshness,
  type TrackingFreshness,
} from '@/lib/liveTrackingPlayback';
import { logLiveTrackingDiagnostic } from '@/lib/liveTrackingDiagnostics';
import {
  isTerminalRequestStatus,
  LIVE_ETA_MAX_AGE_MS,
  mergeLiveEta,
  parseLiveEta,
  type LiveEta,
} from '@/lib/liveEta';
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
  // Kept apart from the coordinate so GPS-only events never clear it.
  liveEta?: LiveEta | null;
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
  // Recent gap between authoritative socket fixes; the technician sends adaptively.
  const observedFixIntervalRef = useRef<number | null>(null);
  const lastReceivedSequenceRef = useRef<number | null>(null);
  const requestTerminalRef = useRef(false);
  const freshnessTrackerRef = useRef<{
    requestId: string | null;
    state: TrackingFreshness | null;
    since: number;
    totalsMs: Record<TrackingFreshness, number>;
  }>({
    requestId: null,
    state: null,
    since: 0,
    totalsMs: { LIVE: 0, UPDATING: 0, DELAYED: 0, RECONNECTING: 0, OFFLINE: 0 },
  });
  const { socket, isConnected } = useSocket();

  const fetchRequest = async () => {
    if (!requestId) return;
    try {
      const res = await apiFetch(`/api/service-requests/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        const normalizedRequest = normalizeRequestData(data);
        const requestIsTerminal = isTerminalRequestStatus(normalizedRequest.status);
        requestTerminalRef.current = requestIsTerminal;
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
            const preserveEta = !requestIsTerminal && prev.liveEta?.requestId === String(requestId);
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
              liveEta: preserveEta ? prev.liveEta : null,
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
    requestTerminalRef.current = false;
    fetchRequest();

  }, [requestId]);

  // Drop the ETA once it has gone unrefreshed for too long, rather than
  // showing an old figure indefinitely.
  const liveEta = technician?.liveEta ?? null;
  useEffect(() => {
    if (!liveEta) return;
    const expire = () => {
      logLiveTrackingDiagnostic('[RT-CUSTOMER-ETA]', 'eta_expired', {
        requestId: liveEta.requestId, provider: liveEta.provider,
        calculatedAt: new Date(liveEta.calculatedAt).toISOString(),
      });
      setTechnician(prev => (prev?.liveEta === liveEta ? { ...prev, liveEta: null } : prev));
    };
    const remainingMs = liveEta.receivedAt + LIVE_ETA_MAX_AGE_MS - Date.now();
    if (remainingMs < 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remainingMs + 1);
    return () => window.clearTimeout(timer);
  }, [liveEta]);

  useEffect(() => {
    if (FRONTEND_ONLY_MODE || !requestId || !socket) return;

    let handleStatusUpdate: ((data: any) => void) | null = null;
    let handleLocationUpdate: ((data: any) => void) | null = null;

    if (requestId) {
      // Listen for status updates from backend (notifyUser/notifyTechnician)
      handleStatusUpdate = (data: any) => {
        console.log("Status update received:", data);
        if (String(data.requestId) === String(requestId) || String(data.id) === String(requestId)) {
          if (isTerminalRequestStatus(data.status)) {
            requestTerminalRef.current = true;
            setTechnician(prev => (prev?.liveEta ? { ...prev, liveEta: null } : prev));
          }
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
        if (eventRequestId && String(eventRequestId) !== String(requestId)) {
          logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'location_ignored_request_mismatch', {
            requestId: String(requestId), eventRequestId, sequenceId: data?.sequenceId ?? null,
          });
          return;
        }
        const clientReceivedAtMs = Date.now();
        const receivedSequenceId = Number(data?.sequenceId);
        const recordedAtMs = Date.parse(String(data?.recordedAt ?? data?.locationUpdatedAt ?? ""));
        const backendReceivedAtMs = Date.parse(String(data?.receivedAt ?? ""));
        const latency = (from: number, to: number) =>
          Number.isFinite(from) && Number.isFinite(to) ? to - from : null;
        // Latencies cross device and server clocks, so they include any clock skew.
        logLiveTrackingDiagnostic('[RT-CUSTOMER-RECEIVE]', 'location_received', {
          requestId: eventRequestId || String(requestId),
          technicianId: data?.technicianId ?? null,
          sequenceId: data?.sequenceId ?? null,
          lat: data?.lat ?? null,
          lng: data?.lng ?? null,
          recordedAt: data?.recordedAt ?? data?.locationUpdatedAt ?? null,
          backendReceivedAt: data?.receivedAt ?? null,
          clientReceivedAt: new Date(clientReceivedAtMs).toISOString(),
          gpsToBackendMs: latency(recordedAtMs, backendReceivedAtMs),
          backendToCustomerMs: latency(backendReceivedAtMs, clientReceivedAtMs),
          gpsToCustomerMs: latency(recordedAtMs, clientReceivedAtMs),
          // The backend emits each fix under a canonical and a compatibility event name.
          repeatedSequence: Number.isSafeInteger(receivedSequenceId) &&
            receivedSequenceId === lastReceivedSequenceRef.current,
        });
        if (Number.isSafeInteger(receivedSequenceId)) lastReceivedSequenceRef.current = receivedSequenceId;

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
        // A request that has ended keeps no ETA, even from a late event.
        const incomingEta = requestTerminalRef.current
          ? null
          : parseLiveEta(data, String(requestId), clientReceivedAtMs);
        // We set the location on the technician object in state
        setTechnician(prev => {
          if (!prev) {
            logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'location_ignored_missing_technician', {
              requestId: String(requestId), sequenceId: sequenceId ?? null, lat, lng,
            });
            return null;
          }
          if (eventTechnicianId && String(prev.id) !== eventTechnicianId) {
            logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'location_ignored_technician_mismatch', {
              requestId: String(requestId), sequenceId: sequenceId ?? null,
              expectedTechnicianId: String(prev.id), eventTechnicianId,
            });
            return prev;
          }

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
            logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'location_ignored_stale', {
              requestId: String(requestId), sequenceId: sequenceId ?? null,
              incomingLat: lat, incomingLng: lng,
              previousLat: prev.location_lat ?? null, previousLng: prev.location_lng ?? null,
              incomingRecordedAt: locationUpdatedAt ?? null,
              previousRecordedAt: prev.locationUpdatedAt ?? null,
            });
            return prev;
          }

          if (hasLocation) {
            const previousFixAt = lastTrackingFixAtRef.current;
            // Only a strictly newer fix updates the cadence; duplicate events and
            // route-metric republishes carry the same receivedAt.
            if (previousFixAt != null && authoritativeReceivedAt > previousFixAt) {
              observedFixIntervalRef.current = authoritativeReceivedAt - previousFixAt;
            }
            lastTrackingFixAtRef.current = Math.max(
              previousFixAt ?? Number.NEGATIVE_INFINITY,
              authoritativeReceivedAt,
            );
          }

          const liveEta = mergeLiveEta(prev.liveEta, incomingEta);
          if (incomingEta) {
            logLiveTrackingDiagnostic('[RT-CUSTOMER-ETA]', liveEta === prev.liveEta ? 'eta_kept_current' : 'eta_applied', {
              requestId: String(requestId), sequenceId: sequenceId ?? null,
              provider: incomingEta.provider, trafficAware: incomingEta.trafficAware,
              etaSeconds: incomingEta.etaSeconds, distanceMeters: incomingEta.distanceMeters,
              calculatedAt: new Date(incomingEta.calculatedAt).toISOString(),
              displayedCalculatedAt: liveEta ? new Date(liveEta.calculatedAt).toISOString() : null,
            });
          }

          const next = {
            ...prev,
            location_lat: hasLocation ? lat : prev.location_lat,
            location_lng: hasLocation ? lng : prev.location_lng,
            liveEta,
            locationUpdatedAt: locationUpdatedAt ?? prev.locationUpdatedAt,
            recordedAt: typeof data?.recordedAt === 'string' ? data.recordedAt : prev.recordedAt,
            sequenceId: sequenceId ?? prev.sequenceId,
            speed: parseMotion(data?.speed, 0, 100),
            heading: parseMotion(data?.heading, 0, 359.999999),
            accuracy: parseMotion(data?.accuracy, 0, 500),
            // Map legacy 'location' string if needed
            location: hasLocation ? `${lat}, ${lng}` : prev.location
          };
          logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'location_applied', {
            requestId: String(requestId), sequenceId: next.sequenceId ?? null,
            previousLat: prev.location_lat ?? null, previousLng: prev.location_lng ?? null,
            incomingLat: hasLocation ? lat : null, incomingLng: hasLocation ? lng : null,
            displayedLat: next.location_lat ?? null, displayedLng: next.location_lng ?? null,
            freshness: deriveTrackingFreshness(
              lastTrackingFixAtRef.current,
              Date.now(),
              Boolean(socket.connected),
              observedFixIntervalRef.current,
            ),
          });
          return next;
        });
      };
      socket.on("tracking:location:v1", handleLocationUpdate);
      socket.on("location_update", handleLocationUpdate);
      socket.on("technician:location_update", handleLocationUpdate);
    }

    const subscribeToRequest = () => {
      logLiveTrackingDiagnostic('[RT-CUSTOMER-SOCKET]', 'subscription_requested', {
        requestId: String(requestId), socketId: socket.id ?? null, connected: socket.connected,
      });
      socket.emit("tracking:subscribe:v1", { requestId }, (acknowledgement: any) => {
        logLiveTrackingDiagnostic('[RT-CUSTOMER-SOCKET]', 'subscription_acknowledged', {
          requestId: String(requestId),
          socketId: socket.id ?? null,
          ok: Boolean(acknowledgement?.ok),
          code: acknowledgement?.code ?? null,
          recoverySequenceId: acknowledgement?.location?.sequenceId ?? null,
        });
        if (!acknowledgement?.ok) {
          logLiveTrackingDiagnostic('[RT-CUSTOMER-SOCKET]', 'subscription_failed', {
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
      const now = Date.now();
      const next = deriveTrackingFreshness(
        lastTrackingFixAtRef.current,
        now,
        isConnected,
        observedFixIntervalRef.current,
      );
      setTrackingFreshness(next);

      // Log only state transitions, with time spent per state for this request.
      const tracker = freshnessTrackerRef.current;
      const trackerRequestId = requestId ? String(requestId) : null;
      if (tracker.requestId !== trackerRequestId) {
        if (tracker.requestId !== null) {
          observedFixIntervalRef.current = null;
          lastReceivedSequenceRef.current = null;
        }
        tracker.requestId = trackerRequestId;
        tracker.state = null;
        tracker.totalsMs = { LIVE: 0, UPDATING: 0, DELAYED: 0, RECONNECTING: 0, OFFLINE: 0 };
      }
      if (tracker.state === next) return;
      const previousStateDurationMs = tracker.state ? now - tracker.since : null;
      if (tracker.state && previousStateDurationMs != null) {
        tracker.totalsMs[tracker.state] += previousStateDurationMs;
      }
      logLiveTrackingDiagnostic('[RT-CUSTOMER-STATE]', 'freshness_changed', {
        requestId: trackerRequestId,
        from: tracker.state,
        to: next,
        previousStateDurationMs,
        observedIntervalMs: observedFixIntervalRef.current,
        totalsMs: { ...tracker.totalsMs },
      });
      tracker.state = next;
      tracker.since = now;
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
