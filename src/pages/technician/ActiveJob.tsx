import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Car,
  CheckCircle,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { toast } from 'sonner';
import ActiveJobMap from '@/components/technician/ActiveJobMap';
import TechnicianJobCompletion from '@/components/technician/TechnicianJobCompletion';
import { apiUrl } from '@/lib/api';
import {
  formatTechnicianStatus,
  isTechnicianCompletionStatus,
  normalizeTechnicianStatus,
} from '@/utils/technicianStatus';
import { useTechnicianActiveJob } from '@/hooks/useTechnicianActiveJob';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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

const ActiveJob = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { token, technician } = useTechnicianAuth();

  const { activeJob, dues, setDues, refreshActiveJob, refreshDues } = useTechnicianActiveJob(technician?.id, 15000);
  const [status, setStatus] = useState(normalizeTechnicianStatus(state?.job?.status || 'accepted'));
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [lastEarned, setLastEarned] = useState(0);
  const celebratedCompletionJobIdRef = useRef<string | null>(null);
  const job = activeJob || state?.job || null;

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

  // 1. Keep local status in sync with active job status
  useEffect(() => {
    if (!job && !state?.job) {
      navigate('/technician/dashboard');
      return;
    }
    if (job?.status) {
      setStatus(normalizeTechnicianStatus(job.status));
    }
  }, [job?.status, state?.job, navigate]);

  useEffect(() => {
    const completionJobId = String(job?.requestId || job?.id || state?.job?.requestId || state?.job?.id || '').trim();
    if (!completionJobId) return;

    const resolvedStatus = normalizeTechnicianStatus(job?.status ?? status);
    if (!isTechnicianCompletionStatus(resolvedStatus)) return;

    const earned = Number(job?.amount ?? state?.job?.amount ?? 0);
    openCompletionModal(completionJobId, earned);
  }, [
    job?.amount,
    job?.id,
    job?.requestId,
    job?.status,
    state?.job?.amount,
    state?.job?.id,
    state?.job?.requestId,
    status,
  ]);

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
    if (!job) return;

    let watchId: string | number | null = null;
    let cancelled = false;
    let permissionNotified = false;

    const applyLocationUpdate = (latitude: number, longitude: number) => {
      if (cancelled) return;
      setCurrentLocation({ lat: latitude, lng: longitude });

      fetch(apiUrl('/api/technicians/me/location'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude })
      }).catch(console.error);

      if (socket && job) {
        socket.emit('technician:location_update', {
          technicianId: technician?.id,
          lat: latitude,
          lng: longitude,
          requestId: job.requestId || job.id
        });
      }
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
        if (!permissionNotified) {
          permissionNotified = true;
          toast.error('Location permission is required to track this job.');
        }
        return;
      }

      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position, error) => {
          if (error) {
            console.warn('Native geolocation error:', error);
            return;
          }
          if (!position) return;
          applyLocationUpdate(position.coords.latitude, position.coords.longitude);
        }
      );
    };

    const startWebWatch = () => {
      if (!navigator.geolocation) return;
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          applyLocationUpdate(position.coords.latitude, position.coords.longitude);
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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
  }, [job, socket, technician?.id, token]);

  // 4. Update Status Logic
  const updateStatus = async (newStatus: string) => {
    if (!job) return;
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
      } else {
        setStatus(previousStatus);
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      setStatus(previousStatus);
      toast.error('Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Navigation Logic
  const openNavigation = () => {
    if (!job) return;
    const destLat = toOptionalNumber(job.pickupLatitude ?? job.location?.lat ?? job.location_lat);
    const destLng = toOptionalNumber(job.pickupLongitude ?? job.location?.lng ?? job.location_lng);

    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
      toast.error('Customer location coordinates are missing.');
      return;
    }

    const originParam = currentLocation ? `&origin=${currentLocation.lat},${currentLocation.lng}` : '';
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLat},${destLng}`;
    window.open(url, '_blank');

  };

  if (!job) return <div className="p-8 text-center">Loading job details...</div>;

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
  const jobAddress = toOptionalString(job.address ?? job.location?.address ?? state?.job?.address) || 'Location not available';
  const estimatedDistanceKm =
    currentLocation && Number.isFinite(customerLat) && Number.isFinite(customerLng)
      ? Math.sqrt(
          Math.pow(currentLocation.lat - Number(customerLat), 2) +
            Math.pow(currentLocation.lng - Number(customerLng), 2)
        ) * 111
      : null;
  const etaMinutes = estimatedDistanceKm !== null ? Math.max(3, Math.ceil((estimatedDistanceKm / 30) * 60)) : null;
  const actionGridClass = dialablePhone ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-8">
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl shadow-slate-200/60">
          <div className="relative h-[240px] w-full bg-muted/40">
            <ActiveJobMap
              technicianLocation={currentLocation || { lat: 28.6139, lng: 77.209 }}
              customerLocation={hasCustomerLocation ? { lat: customerLat, lng: customerLng } : undefined}
            />

            <div className="absolute left-4 top-4 z-[400]">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">
                  {formatTechnicianStatus(status)}
                </span>
              </div>
            </div>

            <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2">
              <div className="rounded-2xl bg-zinc-900/90 px-3 py-2 shadow-lg backdrop-blur-md">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Payout</p>
                <p className="mt-1 text-lg font-black text-white">{formatMoney(displayAmount, 0)}</p>
              </div>
              <button
                type="button"
                onClick={dues > 0 ? handlePayDues : undefined}
                disabled={dues <= 0}
                className={`rounded-2xl border px-3 py-2 text-left shadow-lg backdrop-blur-sm ${
                  dues > 0
                    ? 'border-red-200 bg-red-50/95 text-red-700'
                    : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]">
                  Platform Due
                </p>
                <p className="mt-1 text-sm font-black">{formatMoney(dues, 0)}</p>
              </button>
            </div>
          </div>

          <div className="space-y-5 p-5">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-blue-600 shadow-sm">
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
                    <p className={`text-sm font-black ${dues > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatMoney(dues, 0)}
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
                      {estimatedDistanceKm !== null ? `${estimatedDistanceKm.toFixed(1)} km` : '--'}
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

              <Button
                variant="outline"
                className="h-12 rounded-xl border-border bg-card text-muted-foreground shadow-sm"
                onClick={openNavigation}
              >
                <Navigation className="mr-2 h-4 w-4" />
                <span className="font-bold">Navigate</span>
              </Button>
            </div>

            <div className="space-y-3">
              {(status === 'accepted' || status === 'assigned') && (
                <Button
                  className="h-14 w-full rounded-2xl bg-blue-600 text-lg font-black tracking-wide text-white shadow-xl shadow-blue-600/20 hover:bg-blue-700"
                  onClick={() => updateStatus('en-route')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Navigation className="mr-2 h-5 w-5" />}
                  START JOURNEY
                </Button>
              )}

              {status === 'en-route' && (
                <Button
                  className="h-14 w-full rounded-2xl bg-indigo-600 text-lg font-black tracking-wide text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700"
                  onClick={() => updateStatus('arrived')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MapPin className="mr-2 h-5 w-5" />}
                  I&apos;VE ARRIVED
                </Button>
              )}

              {status === 'arrived' && (
                <Button
                  className="h-14 w-full rounded-2xl bg-zinc-900 text-lg font-black tracking-wide text-white shadow-xl shadow-zinc-900/20 hover:bg-zinc-800"
                  onClick={() => updateStatus('completed')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                  COMPLETE WORK
                </Button>
              )}

              {status === 'payment_pending' && (
                <div className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  <span className="font-bold text-orange-700">Waiting for customer payment...</span>
                </div>
              )}

              {!['payment_pending', 'completed', 'paid'].includes(status) && (
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
