import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone,
  Star,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  Wifi,
  WifiOff,
  Clock3,
  CircleDot,
  ReceiptText,
  AlertCircle
} from "lucide-react";
import FindingTechnician from "./FindingTechnician";
import ClientJobCompletion from "./ClientJobCompletion";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePricingConfig } from "@/hooks/usePricingConfig";

const STATUS_COPY: Record<string, { title: string; subtitle: string }> = {
  pending: {
    title: "Finding a nearby technician",
    subtitle: "We are matching your request with the best partner in your area."
  },
  assigned: {
    title: "Technician assigned",
    subtitle: "Your partner has accepted the job and is preparing to move."
  },
  "en-route": {
    title: "Technician is on the way",
    subtitle: "Keep your phone available. Live location is now active."
  },
  arrived: {
    title: "Technician has arrived",
    subtitle: "Please meet the partner and confirm your vehicle details."
  },
  "in-progress": {
    title: "Service in progress",
    subtitle: "Repair work has started. You can track progress from this screen."
  },
  payment_pending: {
    title: "Service done, payment pending",
    subtitle: "Complete payment to close this request and get your receipt."
  },
  completed: {
    title: "Service completed",
    subtitle: "Final payment is pending before we close this request."
  },
  paid: {
    title: "Payment completed",
    subtitle: "Your request is fully completed. Thank you for choosing ResQNow."
  },
  cancelled: {
    title: "Request cancelled",
    subtitle: "This request is cancelled. You can create a new request anytime."
  }
};

const JOURNEY_STAGES = [
  "Request placed",
  "Technician assigned",
  "On the way",
  "Service started",
  "Completed"
];

const RequestTracking = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"online" | "cash">("online");

  const isMobile = useIsMobile();
  const { data: pricingConfig } = usePricingConfig();
  const currency = String(pricingConfig?.currency || "INR").toUpperCase();

  const realtimeOptions = useMemo(
    () => ({
      onStatusChange: (oldStatus: string | null, newStatus: string | null) => {
        console.log(`Status changed from ${oldStatus} to ${newStatus}`);
      },
      onTechnicianAssigned: () => {
        console.log("Technician assigned");
      }
    }),
    []
  );

  const { request, technician, isLoading, isConnected, refresh } = useRealtimeServiceRequest(
    requestId,
    realtimeOptions
  );

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

  useEffect(() => {
    const status = String(request?.status || "").toLowerCase();
    const paymentStatus = String(request?.payment_status || "").toLowerCase();
    if ((status === "completed" || status === "payment_pending") && paymentStatus === "pending") {
      setShowPayment(true);
      return;
    }
    setShowPayment(false);
  }, [request?.status, request?.payment_status]);

  const formatElapsedTime = () => {
    const secs = elapsedSeconds;
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s}s`;
  };

  const handleOnlinePaymentClick = () => {
    setSelectedPaymentMethod("online");
    setShowPaymentSummary(true);
  };

  const handleCashPaymentClick = () => {
    setSelectedPaymentMethod("cash");
    setShowPaymentSummary(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedPaymentMethod === "online") {
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

          if (
            latestPaymentStatus === "completed" ||
            latestRequestStatus === "paid" ||
            latestRequestStatus === "completed"
          ) {
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
      const orderRes = await apiFetch(`/api/payments/create-order`, {
        method: "POST",
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

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ResQNow",
        description: `Payment for Service #${request.id}`,
        order_id: orderData.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch(`/api/payments/confirm`, {
              method: "POST",
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

              const isConfirmed = isImmediatelyConfirmed || (await pollPaymentStatus(String(request.id)));

              if (isConfirmed) {
                const formattedTotal =
                  Number(orderData.total_amount || Number(orderData.amount || 0) / 100).toFixed(2);
                toast.success("Payment successful", {
                  description: `${currency} ${formattedTotal}`
                });
                setShowPayment(false);
                setShowPaymentSummary(false);
                refresh();
              } else {
                toast.warning("Payment is processing. Please refresh in a few seconds.");
              }
            } else {
              console.error("Payment confirmation failed:", verifyBody);
              toast.error(verifyBody?.error || "Payment verification failed.");
            }
          } catch (err) {
            const errMsg = (err as any).message || "Error verifying payment.";
            console.error("Payment verification failed:", err);
            toast.error(errMsg);
          } finally {
            setIsProcessingPayment(false);
          }
        },
        theme: { color: "#ea580c" },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      setShowPaymentSummary(false);
    } catch (error: any) {
      console.error("Online payment error:", error);
      toast.error(error.message || "Payment initialization failed.");
      setIsProcessingPayment(false);
    }
  };

  const proceedWithCashPayment = async () => {
    if (!request) return;
    setIsProcessingPayment(true);

    try {
      const res = await apiFetch(`/api/payments/cash`, {
        method: "POST",
        body: JSON.stringify({ requestId: request.id })
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Cash payment recorded");
        setShowPayment(false);
        setShowPaymentSummary(false);
        refresh();
      } else {
        console.error("Cash payment backend failure:", body);
        toast.error(body?.error || "Failed to record cash payment");
      }
    } catch (error: any) {
      console.error("Cash payment error:", error);
      toast.error(error.message || "Cash payment failed");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const status = String(request?.status || "pending").toLowerCase();
  const paymentStatus = String(request?.payment_status || "").toLowerCase();
  const paymentCompleted = paymentStatus === "completed" || status === "paid";
  const statusMeta = STATUS_COPY[status] || {
    title: "Request status updated",
    subtitle: "Your request is being processed."
  };

  const technicianRating = Number(technician?.rating);
  const technicianRatingLabel =
    Number.isFinite(technicianRating) && technicianRating > 0 ? technicianRating.toFixed(1) : "N/A";
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
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const mins = Math.max(1, Math.ceil((distanceKm / 30) * 60));
    return `${mins} mins`;
  })();

  const stageIndex = (() => {
    if (status === "pending") return 0;
    if (status === "assigned") return 1;
    if (status === "en-route") return 2;
    if (status === "arrived" || status === "in-progress") return 3;
    if (status === "payment_pending" || status === "completed" || status === "paid") return 4;
    return 0;
  })();

  const stageProgress = Math.round((stageIndex / (JOURNEY_STAGES.length - 1)) * 100);
  const requestAmount = Number(request?.amount || request?.service_charge || 0);
  const amountLabel = Number.isFinite(requestAmount) ? requestAmount.toFixed(2) : "0.00";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <LoadingSpinner />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center">
        Request not found <Button onClick={() => navigate("/")}>Home</Button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        className="relative h-[100dvh] w-full overflow-hidden bg-slate-950"
        style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
      >
        <div className="absolute inset-0 z-0">
          {status === "pending" ? (
            <FindingTechnician vehicleType={request?.vehicle_type} />
          ) : (
            <LiveTrackingMap
              techLocation={
                technician?.location_lat ? { lat: technician.location_lat, lng: technician.location_lng } : null
              }
              userLocation={request.location_lat ? { lat: request.location_lat, lng: request.location_lng } : null}
              eta={eta}
              variant="fullscreen"
              className="h-full w-full"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
        </div>

        <div className="absolute inset-x-4 z-30 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => navigate("/")}
              className="h-10 w-10 rounded-full bg-card/95 text-foreground shadow-lg backdrop-blur"
            >
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Button>
            <Badge
              className={cn(
                "border-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white",
                isConnected ? "bg-emerald-500/90" : "bg-amber-500/90"
              )}
            >
              {isConnected ? (
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Reconnecting
                </span>
              )}
            </Badge>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-40">
          <div className="mx-3 mb-[calc(env(safe-area-inset-bottom)+0.6rem)] max-h-[70dvh] overflow-hidden rounded-[1.8rem] border border-border bg-background shadow-[0_-10px_40px_rgba(2,6,23,0.24)]">
            <div className="flex justify-center pt-2">
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="max-h-[67dvh] overflow-y-auto px-5 pb-5 pt-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    On-time assistance
                  </div>
                  {eta && status === "en-route" && (
                    <span className="text-[11px] font-semibold text-emerald-700">ETA: {eta}</span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-black leading-tight tracking-tight text-foreground">
                  {statusMeta.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{statusMeta.subtitle}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <span>Journey progress</span>
                  <span>{stageProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-700"
                    style={{ width: `${stageProgress}%` }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {JOURNEY_STAGES.map((label, index) => (
                    <div key={label} className="text-center">
                      <div className="mx-auto flex h-5 w-5 items-center justify-center">
                        <CircleDot
                          className={cn(
                            "h-4 w-4",
                            index <= stageIndex ? "text-orange-500" : "text-muted-foreground/40"
                          )}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] font-medium leading-tight text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {technician ? (
                <div className="mt-4 rounded-2xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-1 ring-border">
                      <AvatarImage src={technician.avatar_url} />
                      <AvatarFallback>{(technician.name || "T")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-foreground">{technician.name}</h3>
                      <div className="mt-0.5 flex items-center text-[11px] font-medium text-muted-foreground">
                        <Star className="mr-1 h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        <span className="mr-1 text-foreground">{technicianRatingLabel}</span>
                        <span>| {Number.isFinite(technicianJobs) ? technicianJobs : 0} jobs</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 rounded-full border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                        asChild
                      >
                        <a href={`sms:${technician.phone || ""}`} aria-label="Message technician">
                          <MessageSquare className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-orange-600 text-white hover:bg-orange-500"
                        asChild
                      >
                        <a href={`tel:${technician.phone || ""}`} aria-label="Call technician">
                          <Phone className="h-4 w-4 fill-current" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : status === "pending" ? (
                <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                    Matching with nearby partners...
                  </div>
                </div>
              ) : null}

              {showPayment && !paymentCompleted && (
                <div className="mt-4 space-y-2">
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 text-white shadow-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                            Amount due
                          </p>
                          <h3 className="mt-1 text-3xl font-black">
                            {currency} {amountLabel}
                          </h3>
                        </div>
                        <Badge className="border border-white/20 bg-white/15 text-white hover:bg-white/15">
                          Pending
                        </Badge>
                      </div>
                      <Button
                        onClick={handleOnlinePaymentClick}
                        className="mt-4 h-11 w-full rounded-xl bg-white text-slate-900 hover:bg-slate-100"
                      >
                        Pay securely online
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCashPaymentClick}
                    className="h-10 w-full rounded-xl border-border text-xs font-semibold uppercase tracking-[0.12em]"
                  >
                    Pay with cash instead
                  </Button>
                </div>
              )}

              {!showPayment && (status === "en-route" || status === "in-progress") && (
                <div className="mt-4 rounded-2xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Active timer
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-foreground">
                      {elapsedSeconds > 0 ? formatElapsedTime() : "00:00"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-emerald-500 transition-all duration-1000",
                        status === "en-route" ? "w-1/3" : "w-2/3 animate-pulse"
                      )}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <p className="leading-relaxed">
                    Request ID #{request.id} | Keep this screen open for real-time updates and payment confirmation.
                  </p>
                </div>
              </div>

              {status !== "cancelled" && status !== "completed" && !paymentCompleted && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="mt-3 h-10 w-full rounded-xl text-[11px] font-semibold uppercase tracking-[0.12em] text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      Cancel request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Cancel this request?</DialogTitle>
                      <DialogDescription>This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const reason = formData.get("reason") as string;
                        try {
                          const res = await apiFetch(`/api/service-requests/${requestId}/cancel`, {
                            method: "PATCH",
                            body: JSON.stringify({ reason })
                          });
                          if (res.ok) {
                            refresh();
                            toast.success("Request cancelled");
                          } else {
                            toast.error("Unable to cancel request");
                          }
                        } catch {
                          toast.error("Error cancelling request");
                        }
                      }}
                    >
                      <div className="space-y-4 py-2">
                        <div>
                          <Label htmlFor="reason">Reason</Label>
                          <Textarea
                            id="reason"
                            name="reason"
                            required
                            className="mt-2 min-h-[90px]"
                            placeholder="Tell us why you want to cancel."
                          />
                        </div>
                        <Button type="submit" variant="destructive" className="w-full">
                          Confirm cancellation
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}

              {status === "cancelled" && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    This request was cancelled. You can place a fresh request from the home screen.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <PaymentSummaryDialog
          isOpen={showPaymentSummary}
          onClose={() => setShowPaymentSummary(false)}
          onConfirm={handleConfirmPayment}
          baseAmount={requestAmount}
          isProcessing={isProcessingPayment}
          paymentMethod={selectedPaymentMethod}
          platformFeePercent={pricingConfig?.platform_fee_percent}
          currency={currency}
        />

        {(status === "completed" || status === "paid" || (paymentCompleted && status === "payment_pending")) && (
          <ClientJobCompletion
            technicianName={technician?.name || "Technician"}
            onSubmitReview={() => {
              toast.success("Thank you for your feedback");
              navigate("/");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="container max-w-5xl py-8"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
    >
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden rounded-2xl border-border/80">
          <CardContent className="p-0">
            <LiveTrackingMap
              techLocation={technician?.location_lat ? { lat: technician.location_lat, lng: technician.location_lng } : null}
              userLocation={request.location_lat ? { lat: request.location_lat, lng: request.location_lng } : null}
              eta={eta}
              className="mb-0"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Badge className={isConnected ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}>
                {isConnected ? "LIVE" : "RECONNECTING"}
              </Badge>
              <p className="text-xs text-muted-foreground">Request #{request.id}</p>
            </div>
            <div>
              <h2 className="text-xl font-bold">{statusMeta.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{statusMeta.subtitle}</p>
            </div>
            {showPayment && !paymentCompleted && (
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.12em] text-white/70">Amount due</p>
                <p className="mt-1 text-3xl font-black">
                  {currency} {amountLabel}
                </p>
                <Button onClick={handleOnlinePaymentClick} className="mt-3 w-full bg-white text-slate-900 hover:bg-slate-100">
                  Pay now
                </Button>
              </div>
            )}
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Back to home
            </Button>
          </CardContent>
        </Card>
      </div>

      <PaymentSummaryDialog
        isOpen={showPaymentSummary}
        onClose={() => setShowPaymentSummary(false)}
        onConfirm={handleConfirmPayment}
        baseAmount={requestAmount}
        isProcessing={isProcessingPayment}
        paymentMethod={selectedPaymentMethod}
        platformFeePercent={pricingConfig?.platform_fee_percent}
        currency={currency}
      />
    </div>
  );
};

const LoadingSpinner = () => <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />;

export default RequestTracking;
