import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bike, Car, Loader2, Truck } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { toast } from 'sonner';
import ActiveJobMap, { type ActiveJobRouteState } from '@/components/technician/ActiveJobMap';
import TechnicianJobCompletion from '@/components/technician/TechnicianJobCompletion';
import CancelledJobCard, { CancelledJobDetails } from '@/components/technician/CancelledJobCard';
import { apiUrl } from '@/lib/api';
import { logLiveTrackingDiagnostic } from '@/lib/liveTrackingDiagnostics';
import {
  createTechnicianLocationSender,
  type TechnicianLocationSender,
  type TrackingLocationV1Payload,
} from '@/lib/technicianLocationSender';
import {
  isNativeBackgroundTrackingEnabled,
  nativeBackgroundTracking,
  type NativeTrackingStatus,
} from '@/lib/nativeBackgroundTracking';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  formatTechnicianStatus,
  isTechnicianCompletionStatus,
  normalizeTechnicianStatus,
} from '@/utils/technicianStatus';
import { useTechnicianActiveJob } from '@/hooks/useTechnicianActiveJob';
import { getTowingAction } from '@/lib/towingActionState';
import MaterialSymbol from '@/components/home/MaterialSymbol';
import { JobKeyStrip, JobLocationBox, JobSays, JobVehicleRow } from '@/components/technician/JobCardParts';
import { NavigationJobPanel, type NavigationArriveAction } from '@/components/technician/NavigationJobPanel';
import { formatKm, formatMinutes, formatRupees, sentenceCase } from '@/lib/technicianJobCard';
import { readJobDetails } from '@/lib/technicianJobDetails';
import {
  getTechnicianActiveJobPath,
  selectMatchingActiveJobNavigationState,
} from '@/lib/technicianActiveJobRoute';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  resolveActiveJobNavigationTarget,
  startJourneyAndNavigate,
} from '@/lib/activeJobNavigation';
import {
  MAX_NAVIGATION_ACCURACY_METERS,
  defaultNavigationVehicleMode,
  isPlausibleLocationSample,
  isUsableLocationFix,
  isWithinArrivalRange,
  isValidNavigationPoint,
  navigationVehicleLabels,
  resolveNavigationMotion,
  smoothNavigationPoint,
  type NavigationVehicleMode,
  type TechnicianLocationFix,
} from '@/lib/navigation/technicianNavigation';

const EMPTY_VALUE_TOKENS = new Set(['not available', 'n/a', 'na', 'null', 'undefined', 'no phone number']);
// Statuses outside the backend's LIVE_TRACKING_STATUSES; locations sent now are rejected.
const TRACKING_ENDED_STATUSES: string[] = [
  'service_completed',
  'payment_pending',
  'paid',
  'completed',
  'closed',
  'cancelled',
  'rejected',
];

const toOptionalString = (value: any) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return EMPTY_VALUE_TOKENS.has(normalized.toLowerCase()) ? null : normalized;
};

const toOptionalPhone = (value: any) => {
  const raw = toOptionalString(value);
  if (!raw) return null;
  const compact = raw.replace(/[^\d+]/g, '');
  return compact || null;
};

const toOptionalNumber = (value: any) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildVehicleDetails = (job: any) => {
  const explicit = toOptionalString(job?.vehicleDetails ?? job?.vehicle?.details ?? job?.vehicle_details);
  if (explicit) return explicit;
  const vehicleType = toOptionalString(job?.vehicle?.type ?? job?.vehicle_type);
  const vehicleModel = toOptionalString(job?.vehicle?.model ?? job?.vehicle_model);
  return [vehicleType, vehicleModel].filter(Boolean).join(' ').trim() || null;
};

const isPaidPaymentStatus = (value: unknown) =>
  ['paid', 'completed'].includes(String(value || '').trim().toLowerCase());

// What the GPS code says while a fix is merely poor. Anything else it reports (location
// off, permission, signed out) needs the technician to act, so it is shown as it is.
const GPS_QUALITY_MESSAGES = new Set([
  'Waiting for a valid GPS position.',
  'Ignoring an unstable GPS jump while accuracy settles.',
  'Improving GPS accuracy before navigation can start.',
  'Unable to read the current GPS position.',
  'Unable to acquire an accurate GPS position.',
]);

// How often a browser's unchanged position is re-checked, and the speed below which
// the technician counts as standing still.
const WEB_POSITION_REFRESH_MS = 10_000;
const STANDING_STILL_MAX_KMH = 5;

const ActiveJob = () => {
  const location = useLocation();
  const { state } = location;
  const { requestId: routeRequestId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected: isSocketConnected } = useSocket();
  const { token, technician } = useTechnicianAuth();

  const { activeJob, dues, setDues, refreshActiveJob, refreshDues } = useTechnicianActiveJob(technician?.id, 15000);
  const stateJob = selectMatchingActiveJobNavigationState(state?.job, routeRequestId);
  const shouldAutoOpenNavigationRef = useRef(Boolean(state?.openNavigation));
  const [status, setStatus] = useState(normalizeTechnicianStatus(stateJob?.status || 'accepted'));
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<TechnicianLocationFix | null>(null);
  const [locationNow, setLocationNow] = useState(() => Date.now());
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [vehicleMode, setVehicleMode] = useState<NavigationVehicleMode>(() =>
    defaultNavigationVehicleMode(technician?.vehicle_types),
  );
  const [routeState, setRouteState] = useState<ActiveJobRouteState>({
    status: 'idle',
    distanceKm: null,
    durationMinutes: null,
  });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [lastEarned, setLastEarned] = useState(0);
  const [cancelledJob, setCancelledJob] = useState<CancelledJobDetails | null>(null);
  const [hasResolvedActiveJob, setHasResolvedActiveJob] = useState(false);
  const celebratedCompletionJobIdRef = useRef<string | null>(null);
  const jobSnapshotRef = useRef<any | null>(stateJob);
  const previousLocationRef = useRef<TechnicianLocationFix | null>(null);
  // The last fix good enough to navigate by: shown, labelled, while the signal is weak.
  const lastUsableLocationRef = useRef<TechnicianLocationFix | null>(null);
  const vehicleSelectionTouchedRef = useRef(false);
  const locationSocketRef = useRef(socket);
  const trackingSequenceRef = useRef(0);
  const locationSenderRef = useRef<TechnicianLocationSender | null>(null);
  const trackingEndedRef = useRef(false);
  const refreshActiveJobRef = useRef(refreshActiveJob);
  refreshActiveJobRef.current = refreshActiveJob;
  locationSocketRef.current = socket;
  const job = activeJob ?? (!hasResolvedActiveJob ? stateJob : null);
  const navigationTarget = useMemo(
    () => resolveActiveJobNavigationTarget(job, status),
    [job, status],
  );
  const activeRequestId = job?.requestId || job?.id;

  useEffect(() => {
    if (!vehicleSelectionTouchedRef.current) {
      setVehicleMode(defaultNavigationVehicleMode(technician?.vehicle_types));
    }
  }, [technician?.vehicle_types]);

  useEffect(() => {
    if (!activeRequestId) return;
    const timer = window.setInterval(() => setLocationNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [activeRequestId]);

  const isCancelledStatus = (value: unknown) => {
    const raw = String(value || '').trim().toLowerCase();
    return raw === 'cancelled_by_user' || normalizeTechnicianStatus(raw) === 'cancelled';
  };

  const buildCancelledJobDetails = (source: any): CancelledJobDetails | null => {
    const requestId = String(source?.requestId ?? source?.id ?? '').trim();
    if (!requestId) return null;

    return {
      id: requestId,
      contactName: toOptionalString(
        source?.customerName ?? source?.contact_name ?? source?.customer_name ?? source?.user?.name
      ),
      address: toOptionalString(source?.address ?? source?.location?.address),
      cancellationReason: toOptionalString(source?.cancellation_reason ?? source?.reason),
      serviceType: toOptionalString(source?.serviceType ?? source?.service_type ?? source?.service?.type),
      cancelledAt: toOptionalString(source?.cancelled_at ?? source?.cancelledAt ?? source?.updated_at),
    };
  };

  const openCompletionModal = (jobId: string, amount: number, message = 'Customer payment received. Job completed.') => {
    const normalizedJobId = String(jobId || '').trim();
    if (!normalizedJobId || celebratedCompletionJobIdRef.current === normalizedJobId) {
      return;
    }

    celebratedCompletionJobIdRef.current = normalizedJobId;
    const earned = Number(amount);
    setLastEarned(Number.isFinite(earned) && earned > 0 ? earned : 0);
    setShowCompletionModal(true);
    toast.success(message);
  };

  useEffect(() => {
    let cancelled = false;

    const syncActiveJob = async () => {
      const refreshedJob = await refreshActiveJob();
      if (!cancelled && refreshedJob !== undefined) {
        setHasResolvedActiveJob(true);
        navigate(
          refreshedJob?.id
            ? getTechnicianActiveJobPath(refreshedJob.id)
            : location.pathname,
          { replace: true, state: null }
        );
      }
    };

    void syncActiveJob();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, refreshActiveJob]);

  useEffect(() => {
    if (!activeJob) return;
    setHasResolvedActiveJob(true);
    const activeJobPath = getTechnicianActiveJobPath(activeJob.id);
    if (location.state || location.pathname !== activeJobPath) {
      navigate(activeJobPath, { replace: true, state: null });
    }
  }, [activeJob, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!activeRequestId) return;
    jobSnapshotRef.current = job;
    if (isCancelledStatus(job.status)) {
      const details = buildCancelledJobDetails(job);
      if (details) {
        setCancelledJob(details);
      }
    }
  }, [job]);

  // 1. Keep local status in sync with active job status
  useEffect(() => {
    // The job clears as soon as it is paid: the well-done screen leaves for the dashboard itself.
    if (!job && !cancelledJob && hasResolvedActiveJob && !showCompletionModal) {
      navigate('/technician/dashboard');
      return;
    }
    if (job?.status) {
      setStatus(normalizeTechnicianStatus(job.status));
    }
  }, [cancelledJob, hasResolvedActiveJob, job, job?.status, navigate, showCompletionModal]);

  useEffect(() => {
    if (
      [
        'arrived',
        'arrived_pickup',
        'arrived_drop',
        'service_completed',
        'payment_pending',
        'completed',
        'paid',
        'closed',
        'cancelled',
        'rejected',
      ].includes(status)
    ) {
      setIsNavigationActive(false);
    }
  }, [status]);

  // Canonical ingestion only accepts locations while the request is live. Once it
  // ends, stop offering fixes and drop anything still pending for this job. The
  // geolocation effect also re-runs on this flag, which stops native tracking.
  const trackingEnded = TRACKING_ENDED_STATUSES.includes(status);
  useEffect(() => {
    trackingEndedRef.current = trackingEnded;
    if (trackingEnded) locationSenderRef.current?.clearPending('request_ended');
  }, [trackingEnded]);

  // Connectivity is back: deliver the newest location that could not be sent.
  useEffect(() => {
    if (isSocketConnected) locationSenderRef.current?.flush('socket_connected');
  }, [isSocketConnected]);

  useEffect(() => {
    const completionJobId = String(job?.requestId || job?.id || stateJob?.requestId || stateJob?.id || '').trim();
    if (!completionJobId) return;

    const resolvedStatus = normalizeTechnicianStatus(job?.status ?? status);
    if (!isTechnicianCompletionStatus(resolvedStatus)) return;

    const earned = Number(job?.amount ?? stateJob?.amount ?? 0);
    openCompletionModal(completionJobId, earned);
  }, [
    job?.amount,
    job?.id,
    job?.requestId,
    job?.status,
    stateJob?.amount,
    stateJob?.id,
    stateJob?.requestId,
    status,
  ]);

  const visibleCancelledJob =
    cancelledJob ||
    (jobSnapshotRef.current && isCancelledStatus(jobSnapshotRef.current?.status)
      ? buildCancelledJobDetails(jobSnapshotRef.current)
      : null);

  // 2. Pay Dues Handler
  const handlePayDues = async () => {
    try {
      const orderRes = await fetch(apiUrl('/api/technicians/me/pay-dues/order'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const order = await orderRes.json();
      if (!orderRes.ok) {
        if (orderRes.status === 400 && order?.error === 'No pending dues') {
          setDues(0);
          toast.success('All dues are already cleared.');
          return;
        }
        throw new Error(order?.error || 'Failed to create dues order');
      }
      if (order.error) throw new Error(order.error);

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'ResQNow Platform Fee',
        description: 'Clear pending dues',
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(apiUrl('/api/technicians/me/pay-dues/verify'), {
              method: 'POST',
              cache: 'no-store',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(response)
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Failed to verify dues payment');
            }
            if (verifyData?.financials && verifyData.financials.pending_dues != null) {
              setDues(Number(verifyData.financials.pending_dues) || 0);
            } else {
              refreshDues();
            }
            toast.success('Dues Paid Successfully!');
          } catch (err: any) {
            toast.error(err?.message || 'Failed to verify dues payment');
            refreshDues();
          }
        }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment failed');
      refreshDues();
    }
  };

  // 3. Geolocation Logic
  useEffect(() => {
    if (!activeRequestId) return;

    // A last known position belongs to the job it was read on.
    lastUsableLocationRef.current = null;
    let watchId: string | number | null = null;
    let webRefreshTimer: number | null = null;
    let webWatchHealthy = true;
    let cancelled = false;
    let permissionNotified = false;

    // One sender per active job: its pending location can never leak into another job.
    const locationSender = createTechnicianLocationSender({
      jobId: String(activeRequestId),
      transport: {
        isSocketConnected: () => Boolean(locationSocketRef.current?.connected),
        emitSocket: (payload, acknowledge) => {
          locationSocketRef.current?.emit('tracking:location:v1', payload, acknowledge);
        },
        sendRest: async (payload) => {
          const response = await fetch(apiUrl('/api/technicians/me/location'), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const body = await response.json().catch(() => null);
          return { ok: response.ok, status: response.status, code: body?.code };
        },
      },
    });
    locationSenderRef.current = locationSender;
    const handleBrowserOnline = () => locationSender.flush('browser_online');
    window.addEventListener('online', handleBrowserOnline);

    const applyLocationUpdate = (position: {
      coords: {
        latitude: number;
        longitude: number;
        accuracy?: number | null;
        speed?: number | null;
        heading?: number | null;
      };
      timestamp?: number;
      /** Assigned by the native tracking service, which numbers every fix it produces. */
      sequenceId?: number;
    }) => {
      if (cancelled) return;
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const timestamp = Number(position.timestamp) || Date.now();
      if (!isValidNavigationPoint({ lat: latitude, lng: longitude })) {
        setLocationError('Waiting for a valid GPS position.');
        return;
      }

      const rawFix = {
        lat: latitude,
        lng: longitude,
        accuracy: Number.isFinite(Number(position.coords.accuracy))
          ? Number(position.coords.accuracy)
          : null,
        timestamp,
        speedMetersPerSecond: position.coords.speed,
        heading: position.coords.heading,
      };
      if (!isPlausibleLocationSample(previousLocationRef.current, rawFix)) {
        setLocationError('Ignoring an unstable GPS jump while accuracy settles.');
        return;
      }
      const motion = resolveNavigationMotion(previousLocationRef.current, rawFix);
      const smoothedPoint = smoothNavigationPoint(previousLocationRef.current, rawFix);
      const nextFix: TechnicianLocationFix = { ...rawFix, ...smoothedPoint, ...motion };
      previousLocationRef.current = nextFix;
      if (isUsableLocationFix(nextFix)) lastUsableLocationRef.current = nextFix;
      setCurrentLocation(nextFix);
      setLocationNow(Date.now());
      setLocationError(
        isUsableLocationFix(nextFix)
          ? null
          : 'Improving GPS accuracy before navigation can start.',
      );

      const sequenceId = Math.max(
        Number.isSafeInteger(position.sequenceId) ? Number(position.sequenceId) : timestamp * 1000,
        trackingSequenceRef.current + 1,
      );
      trackingSequenceRef.current = sequenceId;
      const locationPayload: TrackingLocationV1Payload = {
        version: 1,
        technicianId: String(technician?.id || ''),
        jobId: String(activeRequestId),
        lat: latitude,
        lng: longitude,
        speed: Number.isFinite(Number(position.coords.speed)) && Number(position.coords.speed) >= 0
          ? Number(position.coords.speed)
          : null,
        heading: Number.isFinite(Number(position.coords.heading)) && Number(position.coords.heading) >= 0
          ? Number(position.coords.heading)
          : null,
        accuracy: Number.isFinite(Number(position.coords.accuracy)) && Number(position.coords.accuracy) >= 0
          ? Number(position.coords.accuracy)
          : null,
        recordedAt: new Date(timestamp).toISOString(),
        sequenceId,
      };
      const trackingSocket = locationSocketRef.current;
      logLiveTrackingDiagnostic('[RT-TECH-GPS]', 'gps_fix_accepted', {
        requestId: String(activeRequestId), sequenceId, latitude, longitude,
        speed: locationPayload.speed, heading: locationPayload.heading,
        accuracy: locationPayload.accuracy, recordedAt: locationPayload.recordedAt,
        transport: trackingSocket?.connected ? 'socket' : 'rest_recovery',
        socketConnected: Boolean(trackingSocket?.connected),
        socketId: trackingSocket?.id ?? null,
      });
      // The sender applies the adaptive cadence and the latest-point recovery queue
      // over the same canonical Socket.IO / REST recovery path.
      if (!trackingEndedRef.current) locationSender.handleFix(locationPayload);
    };

    const ensureNativePermission = async () => {
      try {
        const current = await Geolocation.checkPermissions();
        const status = String(
          (current as any).location || (current as any).coarseLocation || (current as any).fineLocation || ''
        ).toLowerCase();
        if (status === 'granted') return true;
        const requested = await Geolocation.requestPermissions();
        const nextStatus = String(
          (requested as any).location || (requested as any).coarseLocation || (requested as any).fineLocation || ''
        ).toLowerCase();
        return nextStatus === 'granted';
      } catch (error) {
        console.warn('Native geolocation permission error:', error);
        return false;
      }
    };

    const startNativeWatch = async () => {
      const granted = await ensureNativePermission();
      if (cancelled) return;
      if (!granted) {
        setLocationError('Location permission is required to start navigation.');
        if (!permissionNotified) {
          permissionNotified = true;
          toast.error('Location permission is required to track this job.');
        }
        return;
      }

      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, minimumUpdateInterval: 1000, interval: 1000 } as any,
        (position, error) => {
          if (error) {
            console.warn('Native geolocation error:', error);
            setLocationError('Unable to read the current GPS position.');
            return;
          }
          if (!position) return;
          applyLocationUpdate(position);
        }
      );
      // The job ended or changed while the native watch was starting; the effect
      // cleanup has already run and could not see this id.
      if (cancelled) Geolocation.clearWatch({ id: watchId as string }).catch(() => {});
    };

    const startWebWatch = () => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not available on this device.');
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          webWatchHealthy = true;
          applyLocationUpdate(position);
        },
        (err) => {
          webWatchHealthy = false;
          console.error('Geolocation error:', err);
          setLocationError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is required to start navigation.'
              : 'Unable to acquire an accurate GPS position.',
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      // A browser reports a position only when it changes. A technician standing still
      // sends nothing new, and the last fix would age out and take the route with it.
      // While the watch is healthy and the last fix was not moving, that fix is still
      // where they are: this page's copy is kept current. Nothing is sent to live tracking.
      webRefreshTimer = window.setInterval(() => {
        const lastFix = previousLocationRef.current;
        if (cancelled || !webWatchHealthy || !lastFix) return;
        if (Date.now() - lastFix.timestamp < WEB_POSITION_REFRESH_MS) return;
        // Updates that stop while moving mean the signal was lost: let that fix expire.
        if (Number(lastFix.speedKmh ?? 0) > STANDING_STILL_MAX_KMH) return;
        const confirmedAt = Date.now();
        setCurrentLocation((current) => (current ? { ...current, timestamp: confirmedAt } : current));
        setLocationNow(confirmedAt);
      }, WEB_POSITION_REFRESH_MS);
    };

    // Android app with the flag on: the native live tracking service is the single
    // GPS source. While this screen is visible its fixes still go through
    // locationSender; when the app is backgrounded or locked the service posts the
    // same TrackingLocationV1 payload natively to the canonical REST endpoint.
    const nativeListeners: PluginListenerHandle[] = [];
    let nativeTrackingActive = false;
    const keepNativeListener = (handle: PluginListenerHandle) => {
      if (cancelled) void handle.remove();
      else nativeListeners.push(handle);
    };

    const handleNativeStatus = (nativeStatus: NativeTrackingStatus) => {
      if (nativeStatus.jobId && String(nativeStatus.jobId) !== String(activeRequestId)) return;
      logLiveTrackingDiagnostic('[RT-TECH-GPS]', 'native_tracking_status', {
        requestId: String(activeRequestId),
        state: nativeStatus.state,
        reason: nativeStatus.reason ?? null,
      });
      if (nativeStatus.state === 'delivery_js') {
        // Back in the foreground: anything this page still holds is older than what
        // the service delivered natively while the app was in the background.
        locationSender.clearPending('native_background_handover');
      } else if (nativeStatus.state === 'location_unavailable') {
        setLocationError('Location is off or unavailable. Turn it on to keep sharing your live position.');
      } else if (nativeStatus.state === 'stopped') {
        nativeTrackingActive = false;
        if (nativeStatus.reason === 'AUTH_FAILED') {
          setLocationError('Live tracking stopped. Please sign in again to keep sharing your location.');
        } else if (nativeStatus.reason === 'PERMISSION_DENIED') {
          setLocationError('Location permission is required to track this job.');
        } else if (nativeStatus.reason === 'NO_ACTIVE_JOB' || nativeStatus.reason === 'FORBIDDEN') {
          void refreshActiveJobRef.current();
        }
      }
    };

    const startNativeBackgroundTracking = async () => {
      const granted = await ensureNativePermission();
      if (cancelled) return;
      if (!granted) {
        setLocationError('Location permission is required to start navigation.');
        if (!permissionNotified) {
          permissionNotified = true;
          toast.error('Location permission is required to track this job.');
        }
        return;
      }
      try {
        keepNativeListener(await nativeBackgroundTracking.onLocation((fix) => {
          if (fix.jobId && String(fix.jobId) !== String(activeRequestId)) return;
          applyLocationUpdate({
            coords: {
              latitude: fix.latitude,
              longitude: fix.longitude,
              accuracy: fix.accuracy ?? null,
              speed: fix.speed ?? null,
              heading: fix.heading ?? null,
            },
            timestamp: fix.timestamp,
            sequenceId: fix.sequenceId,
          });
        }));
        keepNativeListener(await nativeBackgroundTracking.onStatus(handleNativeStatus));
        if (cancelled) return;
        await nativeBackgroundTracking.start({
          jobId: String(activeRequestId),
          technicianId: String(technician?.id || ''),
          endpointUrl: apiUrl('/api/technicians/me/location'),
          token: String(token || ''),
          sequenceFloor: trackingSequenceRef.current,
        });
        if (cancelled) {
          // The cleanup ran while the service was starting and could not stop it.
          void nativeBackgroundTracking.stop('tracking_stopped', String(activeRequestId));
          return;
        }
        nativeTrackingActive = true;
        logLiveTrackingDiagnostic('[RT-TECH-GPS]', 'native_tracking_started', { requestId: String(activeRequestId) });
      } catch (error) {
        nativeListeners.splice(0).forEach((handle) => void handle.remove());
        logLiveTrackingDiagnostic('[RT-TECH-GPS]', 'native_tracking_unavailable', {
          requestId: String(activeRequestId),
          code: (error as { code?: string } | null)?.code ?? null,
        });
        if (cancelled) return;
        // Foreground-only fallback: the existing single plugin watcher.
        await startNativeWatch();
      }
    };

    if (!trackingEnded && isNativeBackgroundTrackingEnabled()) {
      void startNativeBackgroundTracking();
    } else if (Capacitor.isNativePlatform()) {
      void startNativeWatch();
    } else {
      startWebWatch();
    }

    return () => {
      cancelled = true;
      nativeListeners.splice(0).forEach((handle) => void handle.remove());
      if (nativeTrackingActive) void nativeBackgroundTracking.stop('tracking_stopped', String(activeRequestId));
      window.removeEventListener('online', handleBrowserOnline);
      locationSender.dispose();
      if (locationSenderRef.current === locationSender) locationSenderRef.current = null;
      if (Capacitor.isNativePlatform()) {
        if (watchId != null) {
          Geolocation.clearWatch({ id: watchId as string }).catch(() => {});
        }
      } else if (typeof watchId === 'number') {
        navigator.geolocation.clearWatch(watchId);
      }
      if (webRefreshTimer != null) window.clearInterval(webRefreshTimer);
    };
  }, [activeRequestId, technician?.id, token, trackingEnded]);

  // 4. Update Status Logic
  const updateStatus = async (newStatus: string) => {
    if (!job) return false;
    const normalizedNextStatus = normalizeTechnicianStatus(newStatus);
    setIsLoading(true);
    const previousStatus = status;

    setStatus(normalizedNextStatus);

    try {
      const idToUse = job.requestId || job.id;
      const response = await fetch(
        apiUrl(`/api/service-requests/${idToUse}/technician-status`),
        {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: normalizedNextStatus })
      });

      const data = await response.json();
      if (data.success || response.ok) {
        const resolvedStatus = normalizeTechnicianStatus(data?.status ?? normalizedNextStatus);
        setStatus(resolvedStatus);
        if (isTechnicianCompletionStatus(resolvedStatus)) {
          const earned = Number(data?.request?.amount ?? job?.amount ?? 0);
          openCompletionModal(String(idToUse || ''), earned, 'Job completed successfully.');
        } else {
          toast.success(`Status updated to: ${formatTechnicianStatus(resolvedStatus)}`);
        }
        refreshActiveJob();
        return true;
      } else {
        setStatus(previousStatus);
        toast.error(data.error || 'Failed to update status');
        return false;
      }
    } catch (error) {
      console.error('Update status error:', error);
      setStatus(previousStatus);
      toast.error('Failed to update status');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Navigation Logic
  const hasUsableCurrentLocation = isUsableLocationFix(currentLocation, locationNow);
  const navigationStartReady =
    hasUsableCurrentLocation && routeState.status === 'ready' && Boolean(navigationTarget);
  const handleRouteStateChange = useCallback((nextState: ActiveJobRouteState) => {
    setRouteState((current) =>
      current.status === nextState.status &&
      current.distanceKm === nextState.distanceKm &&
      current.durationMinutes === nextState.durationMinutes &&
      current.message === nextState.message
        ? current
        : nextState,
    );
  }, []);

  const openNavigation = async () => {
    if (!navigationTarget) {
      toast.error('Customer location coordinates are missing.');
      return;
    }
    if (!hasUsableCurrentLocation) {
      toast.error('An accurate, current GPS position is required to start navigation.');
      return;
    }
    if (routeState.status !== 'ready') {
      toast.error('Wait for the road route to finish calculating.');
      return;
    }
    if (status === 'accepted' || status === 'assigned') {
      await startJourneyAndNavigate(updateStatus, setIsNavigationActive);
      return;
    }
    setIsNavigationActive(true);
  };

  useEffect(() => {
    if (
      !shouldAutoOpenNavigationRef.current ||
      !navigationStartReady ||
      status === 'accepted' ||
      status === 'assigned'
    ) return;
    shouldAutoOpenNavigationRef.current = false;
    setIsNavigationActive(true);
  }, [navigationStartReady, status]);

  if (visibleCancelledJob) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] pb-8">
        <div className="mx-auto max-w-md px-4 py-4">
          <CancelledJobCard
            job={visibleCancelledJob}
            onViewDetails={() => navigate('/technician/history', { replace: true })}
          />
        </div>
      </div>
    );
  }

  const completionOutro = showCompletionModal ? (
    <TechnicianJobCompletion
      amount={lastEarned}
      onClose={() => {
        setShowCompletionModal(false);
        navigate('/technician/dashboard', { replace: true });
      }}
    />
  ) : null;

  if (!job) return completionOutro ?? <div className="p-8 text-center">Loading job details...</div>;

  const jobDue = toOptionalNumber(job.dueAmount ?? job.due_amount);
  const displayDue = jobDue != null && jobDue > 0 ? jobDue : dues;
  const displayUser = toOptionalString(job.customerName ?? job.contact_name ?? job.user?.name) || 'Not Available';
  const displayService = toOptionalString(job.serviceType ?? job.service_type ?? job.service?.type);
  const jobDetails = readJobDetails(job);
  const displayVehicle = jobDetails?.vehicleLine || buildVehicleDetails(job);
  const displayPhoneText = toOptionalString(job.phoneNumber ?? job.contact_phone ?? job.user?.phone);
  const dialablePhone = toOptionalPhone(displayPhoneText);
  const displayAmount = toOptionalNumber(job.amount ?? job.service_charge ?? job.serviceCharge);
  const customerLat = toOptionalNumber(job.pickupLatitude ?? job.location?.lat ?? job.location_lat);
  const customerLng = toOptionalNumber(job.pickupLongitude ?? job.location?.lng ?? job.location_lng);
  const hasCustomerLocation = Number.isFinite(customerLat) && Number.isFinite(customerLng);
  const dropLat = toOptionalNumber(job.destinationLatitude ?? job.dropLocation?.lat ?? job.drop_latitude);
  const dropLng = toOptionalNumber(job.destinationLongitude ?? job.dropLocation?.lng ?? job.drop_longitude);
  const dropAddress = toOptionalString(job.destinationAddress ?? job.dropAddress ?? job.drop_address ?? job.dropLocation?.address);
  const hasDropLocation = Number.isFinite(dropLat) && Number.isFinite(dropLng);
  const bookedRouteDistanceKm = toOptionalNumber(job.routeDistanceKm ?? job.route_distance_km);
  const bookedEstimatedDuration = toOptionalNumber(job.estimatedDuration ?? job.estimated_duration);
  const jobAddress = toOptionalString(job.address ?? job.location?.address ?? stateJob?.address) || 'Location not available';
  const isTowingActiveJob = Boolean(job.isTowing);
  const towingAction = isTowingActiveJob ? getTowingAction(status, job.payment_status ?? job.paymentStatus) : null;
  const TowingActionIcon = towingAction?.icon;
  const isWaitingForTowingPayment =
    isTowingActiveJob &&
    status === 'payment_pending' &&
    !isPaidPaymentStatus(job.payment_status ?? job.paymentStatus);
  const hasNormalStatusAction =
    !isTowingActiveJob &&
    ['accepted', 'assigned', 'en-route', 'arrived', 'payment_pending'].includes(status);
  const isTerminalStatus = ['completed', 'paid', 'closed', 'cancelled', 'rejected'].includes(status);
  const showActionFallback =
    !isTerminalStatus &&
    !towingAction &&
    !isWaitingForTowingPayment &&
    !hasNormalStatusAction;
  const towingStartsNavigation = Boolean(
    towingAction && ['en_route_pickup', 'enroute_drop'].includes(towingAction.status),
  );
  const handleTowingAction = async () => {
    if (!towingAction) return;
    if (towingStartsNavigation) {
      if (!navigationStartReady) {
        toast.error('Accurate GPS and a ready road route are required to start navigation.');
        return;
      }
      const updated = await updateStatus(towingAction.status);
      if (updated) setIsNavigationActive(true);
      return;
    }
    await updateStatus(towingAction.status);
  };
  // With no live fix, the map keeps the last good position and the route drawn from it.
  const heldLocation = hasUsableCurrentLocation ? null : lastUsableLocationRef.current;
  const mapTechnicianLocation = hasUsableCurrentLocation && currentLocation
    ? currentLocation
    : heldLocation ?? undefined;
  const positionNote = !heldLocation
    ? null
    : locationError && !GPS_QUALITY_MESSAGES.has(locationError)
      ? locationError
      : 'Weak GPS signal · showing your last position';
  const locationAccuracy = Number(currentLocation?.accuracy);
  const locationWait = hasUsableCurrentLocation
    ? null
    : positionNote
      ?? (currentLocation && locationAccuracy > MAX_NAVIGATION_ACCURACY_METERS
        ? `Your location is only accurate to about ${Math.round(locationAccuracy)} m. Move outdoors or turn on precise location.`
        : locationError || 'Finding your location…');
  const routeDistanceKm = routeState.status === 'ready' ? routeState.distanceKm : null;
  const etaMinutes = routeState.status === 'ready' ? routeState.durationMinutes : null;

  if (isNavigationActive) {
    // A loaded tow is heading for the drop point; everything else for the customer.
    const isDropLeg = Boolean(
      navigationTarget && hasDropLocation && navigationTarget.lat === dropLat && navigationTarget.lng === dropLng,
    );
    const stopName = isDropLeg ? 'drop point' : isTowingActiveJob ? 'pickup point' : 'customer';
    // The same step the job card offers at this status, when that step is an arrival.
    const arriveAction: NavigationArriveAction | null = !isTowingActiveJob && status === 'en-route'
      ? { label: "I've arrived", onClick: () => void updateStatus('arrived') }
      : isTowingActiveJob && towingAction && ['arrived_pickup', 'arrived_drop'].includes(towingAction.status)
        ? { label: sentenceCase(towingAction.label), onClick: () => void handleTowingAction() }
        : null;
    const nearDestination = isWithinArrivalRange(
      mapTechnicianLocation,
      navigationTarget,
      routeDistanceKm == null ? null : routeDistanceKm * 1000,
    );
    return (
      <div className="fixed inset-0 z-[1000] bg-slate-100">
        <ActiveJobMap
          technicianLocation={mapTechnicianLocation}
          customerLocation={hasCustomerLocation ? { lat: customerLat, lng: customerLng } : undefined}
          destinationLocation={hasDropLocation ? { lat: dropLat, lng: dropLng } : undefined}
          navigationMode
          navigationDestination={navigationTarget || undefined}
          heading={(heldLocation ?? currentLocation)?.heading}
          speedKmh={heldLocation ? null : currentLocation?.speedKmh}
          positionNote={positionNote}
          vehicleMode={vehicleMode}
          navigationPanel={
            <NavigationJobPanel
              stopLabel={isDropLeg ? 'Drop location' : isTowingActiveJob ? 'Pickup location' : 'Customer location'}
              address={isDropLeg ? dropAddress || 'Drop location' : jobAddress}
              landmark={isDropLeg ? null : jobDetails?.landmark}
              phone={dialablePhone}
              arrive={arriveAction}
              reachedText={nearDestination ? `You've reached the ${stopName}` : null}
              busy={isLoading}
            />
          }
          onRouteStateChange={handleRouteStateChange}
          onExitNavigation={() => setIsNavigationActive(false)}
        />
      </div>
    );
  }

  const serviceTitle = (displayService || 'Active Job').replace(/-/g, ' ');
  const canOpenNavigation = status !== 'accepted' && status !== 'assigned';
  const dropLabel = [
    'Drop',
    Number.isFinite(bookedRouteDistanceKm) ? formatKm(bookedRouteDistanceKm) : null,
    Number.isFinite(bookedEstimatedDuration) ? formatMinutes(bookedEstimatedDuration) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="tj tj-page">
      <div className="tj-page-inner">
        <div className="tj-map">
          <ActiveJobMap
            technicianLocation={mapTechnicianLocation}
            customerLocation={hasCustomerLocation ? { lat: customerLat, lng: customerLng } : undefined}
            destinationLocation={hasDropLocation ? { lat: dropLat, lng: dropLng } : undefined}
            navigationDestination={navigationTarget || undefined}
            heading={(heldLocation ?? currentLocation)?.heading}
            speedKmh={heldLocation ? null : currentLocation?.speedKmh}
            positionNote={positionNote}
            vehicleMode={vehicleMode}
            onRouteStateChange={handleRouteStateChange}
          />

          <div className="tj-banner">
            <span className="tj-live" aria-hidden="true" />
            <div>
              <small>{sentenceCase(formatTechnicianStatus(status))}</small>
              {routeState.status === 'ready' && etaMinutes !== null && Number.isFinite(routeDistanceKm) ? (
                <b>{formatMinutes(etaMinutes)} · {formatKm(routeDistanceKm)}</b>
              ) : null}
              {locationWait ? <span className="tj-banner-hint" role="status">{locationWait}</span> : null}
            </div>
          </div>
        </div>

        <section className="tj-card" aria-label="Active job">
          <span className="tj-grab" aria-hidden="true" />
          <div className="tj-body">
            <div className="tj-stage">
              <h1 className="tj-title">{serviceTitle}</h1>
              <span className="tj-status">{sentenceCase(formatTechnicianStatus(status))}</span>
            </div>

            {jobDetails?.urgent ? (
              <p className="tj-urgent" role="alert">
                <MaterialSymbol name="warning" />
                Urgent · {jobDetails.urgentReason}
              </p>
            ) : null}

            <JobKeyStrip
              earn={formatRupees(displayAmount)}
              distance={formatKm(routeDistanceKm)}
              eta={formatMinutes(etaMinutes)}
            />

            <JobLocationBox
              label={isTowingActiveJob ? 'Pickup location' : 'Customer location'}
              address={jobAddress}
              landmark={jobDetails?.landmark}
              drop={dropAddress ? { label: dropLabel, address: dropAddress } : null}
            />

            {displayVehicle || jobDetails?.plate ? (
              <JobVehicleRow
                vehicleType={job.vehicle?.type ?? job.vehicle_type}
                name={displayVehicle || 'Vehicle'}
                sub={jobDetails?.towTruckLabel ? `${jobDetails.towTruckLabel} needed` : null}
                plate={jobDetails?.plate}
              />
            ) : null}

            <div className="tj-line">
              <span>Customer</span>
              <b>{displayUser}</b>
            </div>

            {jobDetails ? <JobSays details={jobDetails} /> : null}

            <div className="tj-route">
              <div className="tj-route-top">
                <p>
                  {!hasUsableCurrentLocation
                    ? 'Acquiring accurate location…'
                    : routeState.status === 'ready'
                    ? 'Road route ready'
                    : routeState.message || 'Calculating road route…'}
                </p>
                {routeState.status === 'ready' && <span className="tj-ready">READY</span>}
              </div>
              <div className="tj-modes" role="radiogroup" aria-label="Navigation vehicle">
                {([
                  ['two-wheeler', 'Bike', Bike],
                  ['car', 'Car', Car],
                  ['commercial-tow', 'Tow', Truck],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={vehicleMode === mode}
                    className="tj-mode"
                    onClick={() => {
                      vehicleSelectionTouchedRef.current = true;
                      setVehicleMode(mode);
                    }}
                  >
                    <Icon />
                    {label}
                  </button>
                ))}
              </div>
              <p className="tj-note">Routing as {navigationVehicleLabels[vehicleMode]}</p>
            </div>

            <button
              type="button"
              className={`tj-line ${displayDue > 0 ? 'is-due' : ''}`}
              onClick={displayDue > 0 ? handlePayDues : undefined}
              disabled={displayDue <= 0}
            >
              <span>{displayDue > 0 ? 'Platform due · tap to pay' : 'Platform due'}</span>
              <b>{formatRupees(displayDue)}</b>
            </button>

            {!['payment_pending', 'completed', 'paid', 'closed'].includes(status) && (
              <button type="button" className="tj-ghost is-danger" onClick={() => updateStatus('cancelled')}>
                <MaterialSymbol name="close" />
                Cancel Job
              </button>
            )}
          </div>

          <div className="tj-foot is-sticky">
            {dialablePhone || canOpenNavigation ? (
              <div className={`tj-pair ${dialablePhone && canOpenNavigation ? '' : 'is-single'}`}>
                {dialablePhone ? (
                  <a href={`tel:${dialablePhone}`} aria-label="Call customer" className="tj-act">
                    <MaterialSymbol name="call" />
                    Call
                  </a>
                ) : null}

                {canOpenNavigation && (
                  <button
                    type="button"
                    className="tj-act is-dark"
                    onClick={() => void openNavigation()}
                    disabled={!navigationStartReady}
                  >
                    <MaterialSymbol name="navigation" />
                    Open navigation
                  </button>
                )}
              </div>
            ) : null}

            {isTowingActiveJob && towingAction && (
              <button
                type="button"
                className="tj-cta"
                onClick={() => void handleTowingAction()}
                disabled={isLoading || (towingStartsNavigation && !navigationStartReady)}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : TowingActionIcon ? <TowingActionIcon className="h-5 w-5" /> : null}
                {sentenceCase(towingAction.label)}
              </button>
            )}

            {isTowingActiveJob && status === 'payment_pending' && !isPaidPaymentStatus(job.payment_status ?? job.paymentStatus) && (
              <div className="tj-wait" role="status">
                <Loader2 className="h-5 w-5 animate-spin" />
                Waiting for customer payment...
              </div>
            )}

            {!isTowingActiveJob && (status === 'accepted' || status === 'assigned') && (
              <button
                type="button"
                className="tj-cta"
                onClick={() => void openNavigation()}
                disabled={isLoading || !navigationStartReady}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MaterialSymbol name="navigation" />}
                Start navigation
              </button>
            )}

            {!isTowingActiveJob && status === 'en-route' && (
              <button type="button" className="tj-cta" onClick={() => updateStatus('arrived')} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MaterialSymbol name="location_on" />}
                I&apos;ve arrived
              </button>
            )}

            {!isTowingActiveJob && status === 'arrived' && (
              <button type="button" className="tj-cta is-dark" onClick={() => updateStatus('completed')} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MaterialSymbol name="check_circle" />}
                Complete work
              </button>
            )}

            {!isTowingActiveJob && status === 'payment_pending' && (
              <div className="tj-wait" role="status">
                <Loader2 className="h-5 w-5 animate-spin" />
                Waiting for customer payment...
              </div>
            )}

            {showActionFallback && (
              <div className="tj-alert" role="alert">
                <p>Something looks off with this job.</p>
                <p>The current status cannot be advanced safely. Contact support so we can unblock it.</p>
                <a href="tel:+919566510080" className="tj-ghost">
                  <MaterialSymbol name="support_agent" />
                  Call Support
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
      {completionOutro}
    </div>
  );
};

export default ActiveJob;
