import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Bike,
  Car,
  CheckCircle,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  Truck,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { toast } from 'sonner';
import ActiveJobMap, { type ActiveJobRouteState } from '@/components/technician/ActiveJobMap';
import TechnicianJobCompletion from '@/components/technician/TechnicianJobCompletion';
import CancelledJobCard, { CancelledJobDetails } from '@/components/technician/CancelledJobCard';
import { apiUrl } from '@/lib/api';
import {
  formatTechnicianStatus,
  isTechnicianCompletionStatus,
  normalizeTechnicianStatus,
} from '@/utils/technicianStatus';
import { useTechnicianActiveJob } from '@/hooks/useTechnicianActiveJob';
import { getTowingAction } from '@/lib/towingActionState';
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
  defaultNavigationVehicleMode,
  isPlausibleLocationSample,
  isUsableLocationFix,
  isValidNavigationPoint,
  navigationVehicleLabels,
  resolveNavigationMotion,
  smoothNavigationPoint,
  type NavigationVehicleMode,
  type TechnicianLocationFix,
} from '@/lib/navigation/technicianNavigation';

const EMPTY_VALUE_TOKENS = new Set(['not available', 'n/a', 'na', 'null', 'undefined', 'no phone number']);

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

const formatMoney = (value: number | null, maximumFractionDigits = 0) => {
  if (!Number.isFinite(Number(value))) return 'Rs --';
  return `Rs ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value))}`;
};

const isPaidPaymentStatus = (value: unknown) =>
  ['paid', 'completed'].includes(String(value || '').trim().toLowerCase());

const ActiveJob = () => {
  const location = useLocation();
  const { state } = location;
  const { requestId: routeRequestId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
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
  const vehicleSelectionTouchedRef = useRef(false);
  const locationSocketRef = useRef(socket);
  const trackingSequenceRef = useRef(0);
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
    if (!job && !cancelledJob && hasResolvedActiveJob) {
      navigate('/technician/dashboard');
      return;
    }
    if (job?.status) {
      setStatus(normalizeTechnicianStatus(job.status));
    }
  }, [cancelledJob, hasResolvedActiveJob, job, job?.status, navigate]);

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

    let watchId: string | number | null = null;
    let cancelled = false;
    let permissionNotified = false;

    const applyLocationUpdate = (position: {
      coords: {
        latitude: number;
        longitude: number;
        accuracy?: number | null;
        speed?: number | null;
        heading?: number | null;
      };
      timestamp?: number;
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
      setCurrentLocation(nextFix);
      setLocationNow(Date.now());
      setLocationError(
        isUsableLocationFix(nextFix)
          ? null
          : 'Improving GPS accuracy before navigation can start.',
      );

      const sequenceId = Math.max(timestamp * 1000, trackingSequenceRef.current + 1);
      trackingSequenceRef.current = sequenceId;
      const locationPayload = {
        version: 1 as const,
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
      let recoverySent = false;
      const sendRestRecovery = () => {
        if (recoverySent) return;
        recoverySent = true;
        fetch(apiUrl('/api/technicians/me/location'), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(locationPayload),
        }).catch(console.error);
      };

      const trackingSocket = locationSocketRef.current;
      if (!trackingSocket?.connected) {
        sendRestRecovery();
        return;
      }

      const acknowledgementTimeout = window.setTimeout(sendRestRecovery, 3_500);
      trackingSocket.emit('tracking:location:v1', locationPayload, (acknowledgement: { ok?: boolean } | undefined) => {
        window.clearTimeout(acknowledgementTimeout);
        if (!acknowledgement?.ok) sendRestRecovery();
      });
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
    };

    const startWebWatch = () => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not available on this device.');
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          applyLocationUpdate(position);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocationError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is required to start navigation.'
              : 'Unable to acquire an accurate GPS position.',
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    if (Capacitor.isNativePlatform()) {
      void startNativeWatch();
    } else {
      startWebWatch();
    }

    return () => {
      cancelled = true;
      if (Capacitor.isNativePlatform()) {
        if (watchId != null) {
          Geolocation.clearWatch({ id: watchId as string }).catch(() => {});
        }
      } else if (typeof watchId === 'number') {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeRequestId, technician?.id, token]);

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

  if (!job) return <div className="p-8 text-center">Loading job details...</div>;

  const jobDue = toOptionalNumber(job.dueAmount ?? job.due_amount);
  const displayDue = jobDue != null && jobDue > 0 ? jobDue : dues;
  const displayUser = toOptionalString(job.customerName ?? job.contact_name ?? job.user?.name) || 'Not Available';
  const displayService = toOptionalString(job.serviceType ?? job.service_type ?? job.service?.type);
  const displayVehicle = buildVehicleDetails(job);
  const hasServiceOrVehicle = Boolean(displayService || displayVehicle);
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
  const routeDistanceKm = routeState.status === 'ready' ? routeState.distanceKm : null;
  const etaMinutes = routeState.status === 'ready' ? routeState.durationMinutes : null;
  const actionGridClass = dialablePhone ? 'grid-cols-2' : 'grid-cols-1';

  if (isNavigationActive) {
    return (
      <div className="fixed inset-0 z-[1000] bg-slate-100">
        <ActiveJobMap
          technicianLocation={hasUsableCurrentLocation && currentLocation ? currentLocation : undefined}
          customerLocation={hasCustomerLocation ? { lat: customerLat, lng: customerLng } : undefined}
          destinationLocation={hasDropLocation ? { lat: dropLat, lng: dropLng } : undefined}
          navigationMode
          navigationDestination={navigationTarget || undefined}
          heading={currentLocation?.heading}
          speedKmh={currentLocation?.speedKmh}
          vehicleMode={vehicleMode}
          onRouteStateChange={handleRouteStateChange}
          onExitNavigation={() => setIsNavigationActive(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-8">
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl shadow-slate-200/60">
          <div className={`relative w-full bg-muted/40 ${isNavigationActive ? 'h-[calc(100dvh-2rem)] min-h-[560px] max-h-[760px]' : 'h-[240px]'}`}>
            <ActiveJobMap
              technicianLocation={hasUsableCurrentLocation && currentLocation ? currentLocation : undefined}
              customerLocation={hasCustomerLocation ? { lat: customerLat, lng: customerLng } : undefined}
              destinationLocation={hasDropLocation ? { lat: dropLat, lng: dropLng } : undefined}
              navigationDestination={navigationTarget || undefined}
              heading={currentLocation?.heading}
              speedKmh={currentLocation?.speedKmh}
              vehicleMode={vehicleMode}
              onRouteStateChange={handleRouteStateChange}
            />

            {!isNavigationActive && <div className="absolute left-4 top-4 z-[400]">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">
                  {formatTechnicianStatus(status)}
                </span>
              </div>
            </div>}

            {!isNavigationActive && <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2">
              <div className="rounded-2xl bg-zinc-900/90 px-3 py-2 shadow-lg backdrop-blur-md">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Payout</p>
                <p className="mt-1 text-lg font-black text-white">{formatMoney(displayAmount, 0)}</p>
              </div>
              <button
                type="button"
                onClick={displayDue > 0 ? handlePayDues : undefined}
                disabled={displayDue <= 0}
                className={`rounded-2xl border px-3 py-2 text-left shadow-lg backdrop-blur-sm ${
                  displayDue > 0
                    ? 'border-red-200 bg-red-50/95 text-red-700'
                    : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]">
                  Platform Due
                </p>
                <p className="mt-1 text-sm font-black">{formatMoney(displayDue, 0)}</p>
              </button>
            </div>}
          </div>

          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Navigation vehicle</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {!hasUsableCurrentLocation
                      ? 'Acquiring accurate location…'
                      : routeState.status === 'ready'
                      ? 'Road route ready'
                      : routeState.message || 'Calculating road route…'}
                  </p>
                  {locationError && !hasUsableCurrentLocation && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">{locationError}</p>
                  )}
                </div>
                {routeState.status === 'ready' && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">READY</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Navigation vehicle">
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
                    className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-xs font-extrabold transition ${
                      vehicleMode === mode
                        ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                    onClick={() => {
                      vehicleSelectionTouchedRef.current = true;
                      setVehicleMode(mode);
                    }}
                  >
                    <Icon className="mb-1 h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Routing as {navigationVehicleLabels[vehicleMode]}
              </p>
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {displayService || 'Active Job'}
              </h1>
              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <div className="mt-0.5 rounded-full bg-muted p-1 text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <p className="leading-snug">{jobAddress}</p>
              </div>
              {isTowingActiveJob && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Towing job</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Pickup</p>
                  <p className="text-sm font-bold text-foreground">{jobAddress}</p>
                  {dropAddress && <p className="mt-1 text-sm font-bold text-foreground">{dropAddress}</p>}
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {[
                      Number.isFinite(bookedRouteDistanceKm) ? `${bookedRouteDistanceKm.toFixed(1)} km` : null,
                      Number.isFinite(bookedEstimatedDuration) ? `${Math.round(bookedEstimatedDuration)} min` : null,
                      displayVehicle,
                      `Status: ${formatTechnicianStatus(status)}`,
                    ].filter(Boolean).join(' / ')}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-red-600 shadow-sm">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Earnings</p>
                    <p className="text-sm font-black text-foreground">{formatMoney(displayAmount, 0)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-indigo-600 shadow-sm">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">ETA</p>
                    <p className="text-sm font-black text-foreground">
                      {etaMinutes !== null ? `${etaMinutes} min` : '--'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-red-500 shadow-sm">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Platform Due</p>
                    <p className={`text-sm font-black ${displayDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatMoney(displayDue, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-slate-600 shadow-sm">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Distance</p>
                    <p className="text-sm font-black text-foreground">
                      {Number.isFinite(routeDistanceKm) ? `${routeDistanceKm.toFixed(1)} km` : '--'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Customer</p>
                  <p className="truncate text-sm font-bold text-foreground">{displayUser}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Vehicle</p>
                  <p className="truncate text-sm font-bold text-foreground">{displayVehicle || 'Not Available'}</p>
                </div>
              </div>
            </div>

            {hasServiceOrVehicle && (
              <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Service Notes</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {displayService || 'Not Available'}
                  {displayVehicle ? ` - ${displayVehicle}` : ''}
                </p>
              </div>
            )}

            <div className={`grid gap-3 ${actionGridClass}`}>
              {dialablePhone ? (
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-border bg-card text-muted-foreground shadow-sm"
                  asChild
                >
                  <a href={`tel:${dialablePhone}`} aria-label="Call customer">
                    <PhoneCall className="mr-2 h-4 w-4" />
                    <span className="font-bold">Call</span>
                  </a>
                </Button>
              ) : null}

              {status !== 'accepted' && status !== 'assigned' && (
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-border bg-card text-muted-foreground shadow-sm"
                  onClick={() => void openNavigation()}
                  disabled={!navigationStartReady}
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  <span className="font-bold">Open navigation</span>
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {isTowingActiveJob && towingAction && (
                <Button
                  className="h-14 w-full rounded-2xl bg-red-600 text-lg font-black tracking-wide text-white shadow-xl shadow-red-600/20 hover:bg-red-700"
                  onClick={() => void handleTowingAction()}
                  disabled={isLoading || (towingStartsNavigation && !navigationStartReady)}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : TowingActionIcon ? <TowingActionIcon className="mr-2 h-5 w-5" /> : null}
                  {towingAction.label}
                </Button>
              )}

              {isTowingActiveJob && status === 'payment_pending' && !isPaidPaymentStatus(job.payment_status ?? job.paymentStatus) && (
                <div className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  <span className="font-bold text-orange-700">Waiting for customer payment...</span>
                </div>
              )}

              {!isTowingActiveJob && (status === 'accepted' || status === 'assigned') && (
                <Button
                  className="h-14 w-full rounded-2xl bg-red-600 text-lg font-black tracking-wide text-white shadow-xl shadow-red-600/20 hover:bg-red-700"
                  onClick={() => void openNavigation()}
                  disabled={isLoading || !navigationStartReady}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Navigation className="mr-2 h-5 w-5" />}
                  START NAVIGATION
                </Button>
              )}

              {!isTowingActiveJob && status === 'en-route' && (
                <Button
                  className="h-14 w-full rounded-2xl bg-indigo-600 text-lg font-black tracking-wide text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700"
                  onClick={() => updateStatus('arrived')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MapPin className="mr-2 h-5 w-5" />}
                  I&apos;VE ARRIVED
                </Button>
              )}

              {!isTowingActiveJob && status === 'arrived' && (
                <Button
                  className="h-14 w-full rounded-2xl bg-zinc-900 text-lg font-black tracking-wide text-white shadow-xl shadow-zinc-900/20 hover:bg-zinc-800"
                  onClick={() => updateStatus('completed')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                  COMPLETE WORK
                </Button>
              )}

              {!isTowingActiveJob && status === 'payment_pending' && (
                <div className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  <span className="font-bold text-orange-700">Waiting for customer payment...</span>
                </div>
              )}

              {showActionFallback && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
                  <p className="text-sm font-bold">Something looks off with this job.</p>
                  <p className="mt-1 text-xs text-amber-800">
                    The current status cannot be advanced safely. Contact support so we can unblock it.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 h-11 w-full rounded-xl border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    asChild
                  >
                    <a href="tel:+919566510080">
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Call Support
                    </a>
                  </Button>
                </div>
              )}

              {!['payment_pending', 'completed', 'paid', 'closed'].includes(status) && (
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => updateStatus('cancelled')}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Job
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCompletionModal && (
        <TechnicianJobCompletion
          amount={lastEarned}
          onClose={() => {
            setShowCompletionModal(false);
            navigate('/technician/dashboard', { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default ActiveJob;
