import { useState, useEffect, useMemo } from "react";
import FindingTechnician from "./FindingTechnician";
import ClientJobCompletion from "./ClientJobCompletion";

// ...

import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  User,
  Phone,
  Clock,
  Car,
  Wrench,
  CheckCircle2,
  CircleDot,
  CreditCard,
  Star,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Files,
  ArrowRight,
  ShieldCheck,
  CreditCard as CreditCardIcon,
  ChevronUp,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { toast } from "@/components/ui/sonner";
import { useRealtimeServiceRequest } from "@/hooks/useRealtimeServiceRequest";
import { apiFetch } from "@/lib/api";
import { PaymentSummaryDialog } from "@/components/payments/PaymentSummaryDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePricingConfig } from "@/hooks/usePricingConfig";

const RequestTracking = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPayment, setShowPayment] = useState(false);

  // Use hook from new file or standard method
  const isMobile = useIsMobile();
  const { data: pricingConfig } = usePricingConfig();
  const currency = pricingConfig?.currency || "INR";

  // Use real-time subscription hook with callbacks
  const realtimeOptions = useMemo(() => ({
    onStatusChange: (oldStatus: string | null, newStatus: string | null) => {
      console.log(`Status changed from ${oldStatus} to ${newStatus}`);
    },
    onTechnicianAssigned: () => {
      console.log('Technician assigned!');
    }
  }), []);

  const {
    request,
    technician,
    isLoading,
    isConnected,
    refresh
  } = useRealtimeServiceRequest(requestId, realtimeOptions);

  // Compute elapsed time based on started_at and completed_at (persistent)
  useEffect(() => {
    function compute() {
      if (!request?.started_at) {
        setElapsedSeconds(0);
        return;
      }
      const start = new Date(request.started_at).getTime();
      const end = request.completed_at ? new Date(request.completed_at).getTime() : Date.now();
      const secs = Math.max(0, Math.floor((end - start) / 1000));
      setElapsedSeconds(secs);
    }

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [request?.started_at, request?.completed_at, request?.status]);

  // Check if payment should be shown
  useEffect(() => {
    if ((request?.status === 'completed' || request?.status === 'payment_pending') && request?.payment_status === 'pending') {
      setShowPayment(true);
    } else {
      setShowPayment(false);
    }
  }, [request?.status, request?.payment_status]);

  // Invoice state (declared unconditionally so hooks order is stable)
  const [invoice, setInvoice] = useState<any | null>(null);
  const paymentCompleted = request?.payment_status === 'completed';

  useEffect(() => {
    if (!request || !paymentCompleted) return;
    let abort = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/service-requests/${request.id}/invoice`);
        if (res.ok && !abort) {
          setInvoice(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch invoice', err);
      }
    })();
    return () => { abort = true; };
  }, [request, paymentCompleted]);

  const formatElapsedTime = () => {
    const secs = elapsedSeconds;
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s}s`;
  };

  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'online' | 'cash'>('online');

  const handleOnlinePaymentClick = () => {
    setSelectedPaymentMethod('online');
    setShowPaymentSummary(true);
  };

  const handleCashPaymentClick = () => {
    setSelectedPaymentMethod('cash');
    setShowPaymentSummary(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedPaymentMethod === 'online') {
      await proceedWithOnlinePayment();
    } else {
      await proceedWithCashPayment();
    }
  };

  const ensureRazorpayLoaded = async () => {
    if ((window as any).Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.body.appendChild(script);
    });
    return !!(window as any).Razorpay;
  };

  const proceedWithOnlinePayment = async () => {
    if (!request) return;
    setIsProcessingPayment(true);

    const pollPaymentStatus = async (targetRequestId: string) => {
      const maxAttempts = 40;
      const pollIntervalMs = 3000;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const statusRes = await apiFetch(`/api/service-requests/${targetRequestId}`, {
            method: "GET",
            cache: "no-store",
          });
          const statusBody = await statusRes.json().catch(() => ({}));
          const latestPaymentStatus = String(statusBody?.payment_status || "").toLowerCase();
          const latestRequestStatus = String(statusBody?.status || "").toLowerCase();

          if (latestPaymentStatus === "completed" || latestRequestStatus === "paid" || latestRequestStatus === "completed") {
            return true;
          }
        } catch (pollError) {
          console.error("Payment status polling error:", pollError);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      return false;
    };

    try {
      // 1. Create Order via central payments API
      const orderRes = await apiFetch(`/api/payments/create-order`, {
        method: 'POST',
        body: JSON.stringify({ requestId: request.id })
      });

      if (!orderRes.ok) {
        const errBody = await orderRes.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create payment order");
      }
      const orderData = await orderRes.json();
      const keyId = orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) {
        throw new Error("Razorpay key is not configured");
      }

      const sdkReady = await ensureRazorpayLoaded();
      if (!sdkReady) {
        throw new Error("Razorpay SDK not available");
      }

      // 2. Open Razorpay
      const options = {
        key: keyId,
        amount: orderData.amount, // This now includes the platform fee
        currency: orderData.currency,
        name: "ResQNow",
        description: `Payment for Service #${request.id}`,
        order_id: orderData.id,
        handler: async (response: any) => {
          // 3. Confirm with backend
          try {
            const verifyRes = await apiFetch(`/api/payments/confirm`, {
              method: 'POST',
              cache: "no-store",
              body: JSON.stringify({
                requestId: request.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyBody = await verifyRes.json().catch(() => ({}));

            if (verifyRes.ok) {
              const requestStatus = String(verifyBody?.request?.status || "").toLowerCase();
              const paymentStatus = String(verifyBody?.request?.payment_status || "").toLowerCase();
              const isImmediatelyConfirmed =
                verifyBody?.success === true ||
                verifyBody?.alreadyPaid === true ||
                requestStatus === "paid" ||
                paymentStatus === "completed";

              if (!isImmediatelyConfirmed) {
                toast.info("Payment received. Verifying final status...");
              }

              const isConfirmed = isImmediatelyConfirmed || await pollPaymentStatus(String(request.id));

              if (isConfirmed) {
                toast.success("Payment Successful!", {
                  description: `Paid ${currency} ${orderData.total_amount || (orderData.amount / 100)}`
                });
                setShowPayment(false);
                setShowPaymentSummary(false);
                refresh();
              } else {
                toast.warning("Payment is processing. Please wait a few seconds and refresh.");
              }
            } else {
              console.error('Payment confirmation failed:', verifyBody);
              toast.error(verifyBody?.error || "Payment verification failed.");
            }
          } catch (err) {
            console.error("Verification error", err);
            // Fix: Cast err to any or Error to safely access message
            const errMsg = (err as any).message || "Error verifying payment.";
            console.error("Payment Verification Failed:", err);
            toast.error(errMsg);
          }
        },
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

      setShowPaymentSummary(false);
      setIsProcessingPayment(false);

    } catch (error: any) {
      console.error('Online payment error:', error);
      toast.error(error.message || 'Payment initialization failed.');
      setIsProcessingPayment(false);
    }
  };

  const proceedWithCashPayment = async () => {
    if (!request) return;
    setIsProcessingPayment(true);

    try {
      const res = await apiFetch(`/api/payments/cash`, {
        method: 'POST',
        body: JSON.stringify({ requestId: request.id })
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Cash payment recorded!");
        setShowPayment(false);
        refresh();
      } else {
        console.error('Cash payment backend failure:', body);
        toast.error(body?.error || "Failed to record cash payment");
      }
    } catch (error: any) {
      console.error("Cash payment error:", error);
      toast.error(error.message || 'Cash payment failed');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const status = request?.status || 'pending';
  const technicianRating = Number(technician?.rating);
  const technicianRatingLabel = Number.isFinite(technicianRating) && technicianRating > 0
    ? technicianRating.toFixed(1)
    : "N/A";
  const technicianJobs = Number(technician?.completedJobs || 0);
  const eta = (() => {
    if (status === "arrived") return "Arrived";
    if (status !== "en-route") return undefined;
    if (!technician?.location_lat || !technician?.location_lng || !request?.location_lat || !request?.location_lng) {
      return "On the way";
    }
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(request.location_lat - technician.location_lat);
    const dLon = toRad(request.location_lng - technician.location_lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(technician.location_lat)) *
      Math.cos(toRad(request.location_lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const mins = Math.max(1, Math.ceil((distanceKm / 30) * 60));
    return `${mins} mins`;
  })();


  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted">
        <LoadingSpinner />
      </div>
    );
  }

  if (!request) {
    return <div className="p-8 text-center">Request Not Found <Button onClick={() => navigate('/')}>Home</Button></div>
  }

  /* Mobile-first Redesign Logic */
  if (isMobile) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden bg-muted/50 flex flex-col">
        {/* 1. Full Screen Map Area or Radar Animation */}
        <div className="absolute inset-0 z-0 bg-slate-900">
          {status === 'pending' ? (
            <FindingTechnician vehicleType={request?.vehicle_type} />
          ) : (
            <LiveTrackingMap
              techLocation={technician?.location_lat ? { lat: technician.location_lat, lng: technician.location_lng } : null}
              userLocation={request.location_lat ? { lat: request.location_lat, lng: request.location_lng } : null}
              eta={eta}
              variant="fullscreen"
              className="h-full w-full"
            />
          )}
          {/* Gradient Overlay for better text visibility at top */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* 2. Top Floating Status Bar */}
        <div className="absolute top-safe left-4 right-4 z-20 flex justify-between items-center mt-4">
          <Button variant="secondary" size="icon" onClick={() => navigate('/')} className="rounded-full h-10 w-10 shadow-lg bg-card dark:bg-slate-900/95 backdrop-blur text-foreground hover:bg-card dark:bg-slate-900">
            <ArrowRight className="h-5 w-5 rotate-180" />
          </Button>

          <Badge className={cn(
            "px-3 py-1.5 shadow-lg backdrop-blur-md border-0 text-white font-semibold tracking-wide",
            isConnected ? "bg-green-500/90" : "bg-yellow-500/90"
          )}>
            {isConnected ? "LIVE" : "CONNECTING..."}
          </Badge>
        </div>

        {/* 3. Bottom Sheet / Card for Details */}
        {/* 3. Floating Bottom Card for Details */}
        <div className="absolute inset-x-4 bottom-4 z-[500] bg-white dark:bg-zinc-950 rounded-[2rem] shadow-[0_-5px_40px_rgba(0,0,0,0.12)] border border-border flex flex-col max-h-[60dvh] overflow-hidden">
          {/* Green Guarantee Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">On-Time Guarantee</span>
            </div>
            {eta && status === 'en-route' && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500">
                ETA: {eta}
              </span>
            )}
          </div>

          <div className="px-5 py-4 pb-safe flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
            {/* Primary Status Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-foreground leading-tight tracking-tight">
                  {status === 'pending' ? "Searching Technicians..." :
                    status === 'assigned' ? "Technician Assigned" :
                      status === 'en-route' ? "Technician is on the way" :
                        status === 'arrived' ? "Technician has arrived" :
                          status === 'in-progress' ? "Service in progress" :
                            status === 'payment_pending' ? "Service Completed" :
                              status === 'completed' ? "Service Completed" : status}
                </h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {status === 'pending' ? "Matching you with nearby experts..." :
                    status === 'en-route' ? "Partner will arrive soon, keep your phone handy." :
                      status === 'arrived' ? "Partner is at your location." :
                        "Please wait while the service finishes."}
                </p>
              </div>

              {/* ETA Bubble */}
              {eta && status === 'en-route' && (
                <div className="bg-emerald-600 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0 transform -rotate-3">
                  <span className="text-xl font-black leading-none">{eta.split(' ')[0]}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">mins</span>
                </div>
              )}
            </div>

            {/* Technician Card (Mini) */}
            {technician ? (
              <div className="flex items-center gap-4 py-4 border-t border-border">
                <Avatar className="h-12 w-12 shadow-sm ring-1 ring-border">
                  <AvatarImage src={technician.avatar_url} />
                  <AvatarFallback>{(technician.name || "T")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate text-sm">{technician.name}</h3>
                  <div className="flex items-center text-[10px] font-bold text-muted-foreground mt-0.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 mr-1" />
                    <span className="text-foreground mr-1.5">{technicianRatingLabel}</span>
                    <span>• {Number.isFinite(technicianJobs) ? technicianJobs : 0} jobs</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="icon" variant="ghost" className="rounded-full w-10 h-10 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" asChild>
                    <a href={`sms:${technician.phone || ""}`}><MessageSquare className="h-4 w-4" /></a>
                  </Button>
                  <Button size="icon" className="rounded-full w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20" asChild>
                    <a href={`tel:${technician.phone || ""}`}><Phone className="h-4 w-4 fill-current" /></a>
                  </Button>
                </div>
              </div>
            ) : status === 'pending' ? (
              <div className="py-4 border-t border-border flex items-center gap-3">
                <div className="flex-1 bg-muted/50 rounded-xl p-3 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs font-bold text-foreground">Analyzing routes...</span>
                </div>
              </div>
            ) : null}

            {/* Payment Card / Status Actions */}
            {showPayment && !paymentCompleted && (
              <div className="mt-2 mb-4 flex flex-col gap-2">
                <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative rounded-2xl shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                  <CardContent className="p-5 relative">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-300 font-bold mb-0.5">Total Amount Due</p>
                        <h3 className="text-3xl font-black">{currency} {request.amount}</h3>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-white bg-white/10 backdrop-blur py-1 px-3">Pending</Badge>
                    </div>
                    <Button onClick={handleOnlinePaymentClick} className="w-full bg-white text-slate-900 hover:bg-gray-100 font-bold h-12 rounded-xl text-sm shadow-lg">
                      Pay Securely Online
                    </Button>
                  </CardContent>
                </Card>
                <button onClick={handleCashPaymentClick} className="w-full py-3 rounded-xl border border-border text-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:bg-muted/50 transition-colors">
                  Or Pay with Cash
                </button>
              </div>
            )}

            {/* Tracking Progress (Simplified Linear) */}
            {!showPayment && (status === 'en-route' || status === 'in-progress') && (
              <div className="py-4 border-t border-border">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                  <span>Job Progress</span>
                  <span className="font-mono bg-muted px-2 py-0.5 rounded-full text-foreground">{elapsedSeconds > 0 ? formatElapsedTime() : '00:00'}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full transition-all duration-1000 bg-emerald-500",
                    status === 'en-route' ? 'w-1/3' : 'w-2/3 animate-pulse'
                  )} />
                </div>
              </div>
            )}

            {/* Cancel Button - Displayed discreetly at bottom */}
            {status !== 'cancelled' && status !== 'completed' && !paymentCompleted && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full mt-2 text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px] uppercase tracking-wider font-bold h-10 rounded-xl">
                    Cancel Request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Request?</DialogTitle>
                    <DialogDescription>This action cannot be undone.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const reason = formData.get('reason') as string;
                    try {
                      const res = await apiFetch(`/api/service-requests/${requestId}/cancel`, {
                        method: 'PATCH',
                        body: JSON.stringify({ reason })
                      });
                      if (res.ok) { refresh(); toast.success("Cancelled"); }
                    } catch (e) { toast.error("Error cancelling"); }
                  }}>
                    <div className="py-4 space-y-4">
                      <Label>Reason</Label>
                      <Textarea name="reason" placeholder="Why are you cancelling?" required />
                      <Button type="submit" variant="destructive" className="w-full">Confirm Cancellation</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <PaymentSummaryDialog
          isOpen={showPaymentSummary}
          onClose={() => setShowPaymentSummary(false)}
          onConfirm={handleConfirmPayment}
          baseAmount={request?.amount || 0}
          isProcessing={isProcessingPayment}
          paymentMethod={selectedPaymentMethod}
          platformFeePercent={pricingConfig?.platform_fee_percent}
          currency={currency}
        />

        {/* Completion & Rating Modal */}
        {(status === 'completed' || status === 'paid' || (paymentCompleted && status === 'payment_pending')) && (
          <ClientJobCompletion
            technicianName={technician?.name || "Technician"}
            onSubmitReview={(rating, comment) => {
              toast.success("Thank you for your feedback!");
              navigate('/');
            }}
          />
        )}
      </div>
    );
  }

  // Desktop Return (Simple container wrapper for now, user mainly cares about mobile)
  return (
    <div className="container max-w-3xl py-12">
      <div className="bg-card dark:bg-slate-900 shadow-md rounded-xl border border-border overflow-hidden">
        <div className="p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold mb-4">Desktop View Not Optimized</h2>
          <p className="text-muted-foreground/80 mb-6">Please view this page on a mobile device for the best tracking experience.</p>
          <div className="w-full max-w-md h-64 bg-muted/50 rounded-xl overflow-hidden relative">
            <LiveTrackingMap
              techLocation={technician?.location_lat ? { lat: technician.location_lat, lng: technician.location_lng } : null}
              userLocation={request.location_lat ? { lat: request.location_lat, lng: request.location_lng } : null}
              eta={eta}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingSpinner = () => <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />;

export default RequestTracking;
