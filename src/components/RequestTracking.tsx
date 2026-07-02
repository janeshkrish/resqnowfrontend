import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Star,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  MapPin,
  MessageSquare,
  RadioTower,
  Wifi,
  WifiOff,
  Clock3,
  CircleDot,
  ReceiptText,
  AlertCircle,
  Wrench,
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
import AmountCard from "@/components/user/AmountCard";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { routePolylineFromMetadata } from "@/lib/geo";
import {
  resolveServiceRequestPaymentDetails,
  SERVICE_REQUEST_PLATFORM_FEE_PERCENT,
  normalizeServiceRequestPaymentMode,
} from "@/utils/serviceRequestPayment";

type MapLocation = { lat: number; lng: number };

const normalizeMapCoordinate = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildMapLocation = (latValue: unknown, lngValue: unknown): MapLocation | null => {
  const lat = normalizeMapCoordinate(latValue);
  const lng = normalizeMapCoordinate(lngValue);
  return lat === null || lng === null ? null : { lat, lng };
};

const STATUS_COPY: Record<string, { title: string; subtitle: string }> = {
  pending: {
    title: "Finding a nearby technician",
    subtitle: "We are matching your request with the best partner in your area."
  },
  assigned: {
    title: "Technician assigned",
    subtitle: "Your partner has accepted the job and is preparing to move."
  },
  accepted: {
    title: "Technician accepted",
    subtitle: "Your partner is getting ready to move toward pickup."
  },
  en_route_pickup: {
    title: "Technician is heading to pickup",
    subtitle: "Live location is active while your towing partner reaches the vehicle."
  },
  arrived_pickup: {
    title: "Technician reached pickup",
    subtitle: "Please meet the partner and confirm vehicle handover details."
  },
  vehicle_loaded: {
    title: "Vehicle loaded",
    subtitle: "Your vehicle is secured and ready for towing."
  },
  enroute_drop: {
    title: "Tow in progress",
    subtitle: "Your vehicle is being moved to the drop location."
  },
  arrived_drop: {
    title: "Reached drop location",
    subtitle: "The tow has arrived. Final service confirmation is next."
  },
  service_completed: {
    title: "Service completed",
    subtitle: "Complete payment to close this towing request."
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
  closed: {
    title: "Request closed",
    subtitle: "This towing request is closed. Thank you for choosing ResQNow."
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

type TrackingSheetMode = "map" | "sheet";

const TRACKING_PANEL_HEIGHT_VH = 82;
const TRACKING_PAYMENT_PANEL_HEIGHT_VH = 86;
const TRACKING_COLLAPSED_PEEK = 84;
const TRACKING_PAYMENT_COLLAPSED_PEEK = 84;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatCompactTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const formatDisplayLabel = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getTrackingSheetOffsets = (
  panelHeight: number,
  viewportHeight: number,
  showPayment: boolean,
): Record<TrackingSheetMode, number> => {
  const peekHeight = showPayment ? TRACKING_PAYMENT_COLLAPSED_PEEK : TRACKING_COLLAPSED_PEEK;
  const expandedVisibleHeight = clampNumber(
    Math.round(viewportHeight * (showPayment ? 0.83 : 0.76)),
    showPayment ? 470 : 410,
    panelHeight,
  );

  return {
    map: Math.max(0, panelHeight - peekHeight),
    sheet: Math.max(0, panelHeight - expandedVisibleHeight),
  };
};

const normalizeRequestStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "technician_assigned") return "assigned";
  if (raw === "on_the_way" || raw === "on-the-way" || raw === "en_route") return "en-route";
  if (raw === "service_started" || raw === "service-started" || raw === "service started") return "in-progress";
  if (raw === "processing") return "in-progress";
  if (raw === "awaiting_payment") return "payment_pending";
  if (raw === "in_progress") return "in-progress";
  if (raw === "en-route-pickup" || raw === "en route pickup") return "en_route_pickup";
  if (raw === "arrived-pickup" || raw === "arrived pickup") return "arrived_pickup";
  if (raw === "vehicle-loaded" || raw === "vehicle loaded") return "vehicle_loaded";
  if (raw === "tow_started" || raw === "tow-started" || raw === "tow started" || raw === "start_tow" || raw === "start tow") return "enroute_drop";
  if (raw === "en_route_drop" || raw === "en-route-drop" || raw === "en route drop") return "enroute_drop";
  if (raw === "arrived-drop" || raw === "arrived drop") return "arrived_drop";
  if (raw === "service-completed" || raw === "service completed") return "service_completed";
  if (raw === "job_closed" || raw === "job-closed") return "closed";
  return raw || "pending";
};

const normalizeRequestPaymentStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "completed" || raw === "paid") return "paid";
  return raw || "pending";
};

type PaymentQuoteResponse = {
  success?: boolean;
  breakdown?: {
    currency?: string;
    payment_mode?: "cash" | "upi" | null;
    base_amount?: number;
    platform_fee_percent?: number;
    original_platform_fee?: number;
    discount_amount?: number;
    platform_fee?: number;
    payment_fee_percent?: number;
    payment_fee?: number;
    razorpay_fee?: number;
    total_amount?: number;
    final_amount?: number;
  };
  coupon?: {
    active?: boolean;
    configured_code?: string;
    entered_code?: string;
    applied_coupon_code?: string | null;
    is_applied?: boolean;
    reason?: string | null;
    discount_percent?: number;
    max_uses_per_user?: number;
    completed_services_count?: number;
    reserved_coupon_count?: number;
    remaining_eligible_uses?: number;
  };
};

type CouponMessageState = {
  tone: "success" | "error" | "info";
  text: string;
};

const RequestTracking = () => {
  const params = useParams<{ requestId?: string; serviceId?: string }>();
  const requestId = params.requestId || params.serviceId || "";
  const navigate = useNavigate();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"online" | "cash">("online");
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuoteResponse | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<CouponMessageState | null>(null);
  const [finalAmount, setFinalAmount] = useState<number | null>(null);
  const [sheetMode, setSheetMode] = useState<TrackingSheetMode>("map");
  const [panelHeight, setPanelHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const sheetY = useMotionValue(0);
  const reduceMotion = useReducedMotion();

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
    const status = normalizeRequestStatus(request?.status);
    const paymentStatus = normalizeRequestPaymentStatus(request?.payment_status);
    if ((status === "completed" || status === "payment_pending") && paymentStatus === "pending") {
      setShowPayment(true);
      return;
    }
    setShowPayment(false);
  }, [request?.status, request?.payment_status]);

  useEffect(() => {
    setPaymentQuote(null);
    setCouponCodeInput("");
    setAppliedCouponCode(null);
    setCouponMessage(null);
  }, [request?.id]);

  useEffect(() => {
    if (!isMobile) return;
    setSheetMode((current) => {
      if (showPayment) return "sheet";
      return current;
    });
  }, [isMobile, showPayment]);

  useEffect(() => {
    if (!isMobile) return;

    const updateViewportHeight = () => {
      const nextHeight = Math.round(window.visualViewport?.height || window.innerHeight);
      setViewportHeight(nextHeight);
    };

    const visualViewport = window.visualViewport;
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    visualViewport?.addEventListener("resize", updateViewportHeight);
    visualViewport?.addEventListener("scroll", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      visualViewport?.removeEventListener("resize", updateViewportHeight);
      visualViewport?.removeEventListener("scroll", updateViewportHeight);
    };
  }, [isMobile]);

  const selectedBackendPaymentMode = selectedPaymentMethod === "cash" ? "cash" : "upi";

  const fetchPaymentQuote = async (
    couponCode: string | null = null,
    {
      showFeedback = false,
      preserveExistingApplied = true,
      paymentMode = selectedBackendPaymentMode,
    }: { showFeedback?: boolean; preserveExistingApplied?: boolean; paymentMode?: "cash" | "upi" } = {}
  ) => {
    if (!request?.id) return null;
    setIsFetchingQuote(true);

    try {
      const payload: Record<string, unknown> = {
        requestId: request.id,
        preserveExistingApplied,
        paymentMode,
      };
      const normalizedCoupon = String(couponCode || "").trim().toUpperCase();
      if (normalizedCoupon) {
        payload.couponCode = normalizedCoupon;
      }

      const res = await apiFetch(`/api/payments/quote`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as PaymentQuoteResponse & { error?: string };

      if (!res.ok) {
        throw new Error(body?.error || "Failed to fetch payment quote");
      }

      setPaymentQuote(body);

      const backendAppliedCode = String(body?.coupon?.applied_coupon_code || "")
        .trim()
        .toUpperCase();
      if (backendAppliedCode) {
        setAppliedCouponCode(backendAppliedCode);
        setCouponCodeInput(backendAppliedCode);
      } else if (!preserveExistingApplied) {
        setAppliedCouponCode(null);
      }

      if (showFeedback) {
        if (normalizedCoupon && backendAppliedCode) {
          setCouponMessage({
            tone: "success",
            text: `${backendAppliedCode} applied. Platform fee discount added.`,
          });
        } else if (normalizedCoupon && !backendAppliedCode) {
          setCouponMessage({
            tone: "error",
            text: body?.coupon?.reason || "Coupon could not be applied.",
          });
        } else if (!normalizedCoupon) {
          setCouponMessage({
            tone: "info",
            text: "Coupon removed. Pricing updated.",
          });
        }
      }

      return body;
    } catch (error) {
      const message = (error as Error)?.message || "Failed to fetch payment quote.";
      if (showFeedback) {
        setCouponMessage({ tone: "error", text: message });
      }
      return null;
    } finally {
      setIsFetchingQuote(false);
    }
  };

  useEffect(() => {
    if (!showPayment || !request?.id) return;
    void fetchPaymentQuote(appliedCouponCode, {
      showFeedback: false,
      preserveExistingApplied: true,
      paymentMode: selectedBackendPaymentMode,
    });
    // Deliberately excluding appliedCouponCode to avoid repeated background refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPayment, request?.id, selectedBackendPaymentMode]);

  useEffect(() => {
    if (!showPaymentSummary || !request?.id) return;
    void fetchPaymentQuote(appliedCouponCode, {
      showFeedback: false,
      preserveExistingApplied: true,
      paymentMode: selectedBackendPaymentMode,
    });
    // Deliberately excluding appliedCouponCode to avoid repeated dialog refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentSummary, request?.id, selectedBackendPaymentMode]);

  const formatElapsedTime = () => {
    const secs = elapsedSeconds;
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s}s`;
  };

  const handleOnlinePaymentClick = () => {
    setSelectedPaymentMethod("online");
    setCouponMessage(null);
    setShowPaymentSummary(true);
  };

  const handleCashPaymentClick = () => {
    setSelectedPaymentMethod("cash");
    setCouponMessage(null);
    setShowPaymentSummary(true);
  };

  const handleApplyCoupon = async () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    await fetchPaymentQuote(code, { showFeedback: true, preserveExistingApplied: false });
  };

  const handleRemoveCoupon = async () => {
    setCouponCodeInput("");
    setAppliedCouponCode(null);
    await fetchPaymentQuote(null, { showFeedback: true, preserveExistingApplied: false });
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
      const normalizedCouponCode = String(appliedCouponCode || "").trim().toUpperCase();
      const orderRes = await apiFetch(`/api/payments/create-order`, {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
          couponCode: normalizedCouponCode || undefined,
        })
      });

      if (!orderRes.ok) {
        const errBody = await orderRes.json().catch(() => ({}));
        if (errBody?.coupon?.reason || errBody?.error) {
          setCouponMessage({
            tone: "error",
            text: errBody?.coupon?.reason || errBody?.error || "Coupon validation failed.",
          });
        }
        if (normalizedCouponCode) {
          await fetchPaymentQuote(normalizedCouponCode, {
            showFeedback: false,
            preserveExistingApplied: false,
          });
        }
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
      const normalizedCouponCode = String(appliedCouponCode || "").trim().toUpperCase();
      const res = await apiFetch(`/api/payments/cash`, {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
          couponCode: normalizedCouponCode || undefined,
        })
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Cash payment recorded");
        setShowPayment(false);
        setShowPaymentSummary(false);
        refresh();
      } else {
        console.error("Cash payment backend failure:", body);
        if (body?.coupon?.reason || body?.error) {
          setCouponMessage({
            tone: "error",
            text: body?.coupon?.reason || body?.error || "Coupon validation failed.",
          });
        }
        if (normalizedCouponCode) {
          await fetchPaymentQuote(normalizedCouponCode, {
            showFeedback: false,
            preserveExistingApplied: false,
          });
        }
        toast.error(body?.error || "Failed to record cash payment");
      }
    } catch (error: any) {
      console.error("Cash payment error:", error);
      toast.error(error.message || "Cash payment failed");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const status = normalizeRequestStatus(request?.status || "pending");
  const paymentStatus = normalizeRequestPaymentStatus(request?.payment_status);
  const paymentCompleted = paymentStatus === "paid" || status === "paid";
  const isTowingRequest = Boolean(request?.isTowing);
  const statusMeta = STATUS_COPY[status] || {
    title: "Request status updated",
    subtitle: "Your request is being processed."
  };

  const technicianRating = Number(technician?.rating);
  const technicianRatingLabel =
    Number.isFinite(technicianRating) && technicianRating > 0 ? technicianRating.toFixed(1) : "N/A";
  const technicianJobs = Number(technician?.completedJobs || 0);
  const technicianMapLocation = useMemo(
    () => buildMapLocation(technician?.location_lat, technician?.location_lng),
    [technician?.location_lat, technician?.location_lng]
  );
  const requestMapLocation = useMemo(
    () => buildMapLocation(request?.location_lat, request?.location_lng),
    [request?.location_lat, request?.location_lng]
  );
  const liveTrackingMetrics = useMemo(() => {
    if (!technicianMapLocation || !requestMapLocation) {
      return {
        eta:
          status === "arrived"
            ? "Arrived"
            : status === "en-route"
              ? "On the way"
              : status === "in-progress"
                ? "Live"
                : undefined,
        etaDisplay:
          status === "arrived"
            ? "Arrived"
            : status === "en-route"
              ? "On the way"
              : status === "in-progress"
                ? "Live"
                : undefined,
        distanceKm: null as number | null,
        distanceLabel: null as string | null,
      };
    }

    const technicianLat = technicianMapLocation.lat;
    const technicianLng = technicianMapLocation.lng;
    const requestLat = requestMapLocation.lat;
    const requestLng = requestMapLocation.lng;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRad(requestLat - technicianLat);
    const deltaLng = toRad(requestLng - technicianLng);
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRad(technicianLat)) *
        Math.cos(toRad(requestLat)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const distanceKm = Number((2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
    const minutes = Math.max(1, Math.ceil((distanceKm / 30) * 60));
    const etaLabel = `${minutes} min`;

    if (status === "arrived") {
      return {
        eta: "Arrived",
        etaDisplay: "Arrived",
        distanceKm,
        distanceLabel: "At your location",
      };
    }

    return {
      eta: status === "en-route" ? etaLabel : status === "in-progress" ? "Live" : undefined,
      etaDisplay: status === "en-route" ? etaLabel : status === "in-progress" ? "Live" : undefined,
      distanceKm,
      distanceLabel: `${distanceKm.toFixed(1)} km away`,
    };
  }, [
    requestMapLocation,
    status,
    technicianMapLocation,
  ]);
  const eta = liveTrackingMetrics.eta;
  const distanceLabel = liveTrackingMetrics.distanceLabel;
  const dropLat = Number(request?.dropLocation?.lat ?? request?.drop_latitude);
  const dropLng = Number(request?.dropLocation?.lng ?? request?.drop_longitude);
  const dropLocation =
    Number.isFinite(dropLat) && Number.isFinite(dropLng)
      ? { lat: dropLat, lng: dropLng }
      : null;
  const routeDistanceKm = Number(request?.routeDistanceKm ?? request?.route_distance_km);
  const routeSummaryVisible = isTowingRequest && Boolean(request?.drop_address || request?.dropLocation?.address || Number.isFinite(routeDistanceKm));
  const routePolyline = useMemo(
    () => {
      if (!isTowingRequest) return [];
      return routePolylineFromMetadata(
        request?.routePolyline
          ? { polyline: request.routePolyline }
          : request?.route_polyline
            ? { polyline: request.route_polyline }
            : request?.routeMetadata || request?.route_metadata || request?.routeGeometry || request?.route_geometry
      );
    },
    [
      isTowingRequest,
      request?.routePolyline,
      request?.route_polyline,
      request?.routeMetadata,
      request?.route_metadata,
      request?.routeGeometry,
      request?.route_geometry,
    ]
  );
  const trackingDropLocation = isTowingRequest ? dropLocation : null;
  const trackingRoutePolyline = isTowingRequest ? routePolyline : null;
  const mapDistanceLabel =
    isTowingRequest && Number.isFinite(routeDistanceKm)
      ? `${routeDistanceKm.toFixed(1)} km towing route`
      : distanceLabel || undefined;

  const stageIndex = (() => {
    if (status === "pending") return 0;
    if (status === "assigned" || status === "accepted") return 1;
    if (status === "en-route" || status === "en_route_pickup") return 2;
    if (
      status === "arrived" ||
      status === "in-progress" ||
      status === "arrived_pickup" ||
      status === "vehicle_loaded" ||
      status === "enroute_drop" ||
      status === "arrived_drop" ||
      status === "service_completed"
    ) return 3;
    if (status === "payment_pending" || status === "completed" || status === "paid" || status === "closed") return 4;
    return 0;
  })();

  const stageProgress = Math.round((stageIndex / (JOURNEY_STAGES.length - 1)) * 100);
  const quoteBreakdown = paymentQuote?.breakdown;
  const quoteCoupon = paymentQuote?.coupon;
  const requestPaymentDetails = useMemo(
    () => resolveServiceRequestPaymentDetails(request, showPayment ? selectedBackendPaymentMode : null),
    [request, showPayment, selectedBackendPaymentMode]
  );
  const selectedMethodPaymentDetails = useMemo(
    () => resolveServiceRequestPaymentDetails(request, selectedBackendPaymentMode),
    [request, selectedBackendPaymentMode]
  );
  const quotePaymentDetails = useMemo(() => {
    if (!quoteBreakdown) return null;

    const paymentMode =
      normalizeServiceRequestPaymentMode(quoteBreakdown.payment_mode, selectedBackendPaymentMode) ??
      selectedBackendPaymentMode;

    return resolveServiceRequestPaymentDetails(
      {
        paymentMode,
        baseAmount: quoteBreakdown.base_amount ?? selectedMethodPaymentDetails.baseAmount,
        platformFee: quoteBreakdown.platform_fee,
        razorpayFee: quoteBreakdown.razorpay_fee ?? quoteBreakdown.payment_fee,
        finalAmount: quoteBreakdown.final_amount ?? quoteBreakdown.total_amount,
        discountAmount: quoteBreakdown.discount_amount,
        originalPlatformFee: quoteBreakdown.original_platform_fee,
      },
      paymentMode
    );
  }, [quoteBreakdown, selectedBackendPaymentMode, selectedMethodPaymentDetails.baseAmount]);
  const amountCardDetails = quotePaymentDetails ?? requestPaymentDetails;
  const summaryPaymentDetails = quotePaymentDetails ?? selectedMethodPaymentDetails;

  useEffect(() => {
    const nextFinalAmount = Number(
      amountCardDetails.finalAmount ?? amountCardDetails.totalAmount ?? Number.NaN
    );
    if (Number.isFinite(nextFinalAmount) && nextFinalAmount > 0) {
      setFinalAmount(nextFinalAmount);
      return;
    }
    setFinalAmount(null);
  }, [amountCardDetails.finalAmount, amountCardDetails.totalAmount]);

  const requestAmount =
    Number.isFinite(Number(requestPaymentDetails.baseAmount)) && requestPaymentDetails.baseAmount > 0
      ? requestPaymentDetails.baseAmount
      : finalAmount ?? 0;
  const amountDueLabel =
    Number.isFinite(Number(summaryPaymentDetails.finalAmount)) && Number(summaryPaymentDetails.finalAmount) > 0
      ? Number(summaryPaymentDetails.finalAmount).toFixed(2)
      : requestAmount.toFixed(2);
  const shouldShowAmount =
    Boolean(amountCardDetails.hasPricing) && finalAmount !== null && !paymentCompleted && status !== "cancelled";

  const couponConfiguredCode = String(
    quoteCoupon?.configured_code || pricingConfig?.welcome_coupon_code || ""
  )
    .trim()
    .toUpperCase();
  const couponDiscountPercent = Number(
    quoteCoupon?.discount_percent ?? pricingConfig?.welcome_coupon_discount_percent ?? 0
  );
  const couponMaxUses = Number(
    quoteCoupon?.max_uses_per_user ?? pricingConfig?.welcome_coupon_max_uses_per_user ?? 2
  );
  const couponActive =
    quoteCoupon?.active ?? Boolean(pricingConfig?.welcome_coupon_active ?? true);
  const remainingCouponUses = Number(quoteCoupon?.remaining_eligible_uses);
  const couponHint = couponActive && couponConfiguredCode
    ? `Try ${couponConfiguredCode} for ${Math.round(couponDiscountPercent * 100)}% off on first ${couponMaxUses} services.`
    : null;
  const couponUsageHint =
    Number.isFinite(remainingCouponUses) && remainingCouponUses >= 0
      ? `${remainingCouponUses} eligible use${remainingCouponUses === 1 ? "" : "s"} remaining.`
      : null;
  const sheetPanelHeightVh = showPayment ? TRACKING_PAYMENT_PANEL_HEIGHT_VH : TRACKING_PANEL_HEIGHT_VH;
  const sheetOffsets = useMemo(
    () => getTrackingSheetOffsets(panelHeight, viewportHeight, showPayment),
    [panelHeight, showPayment, viewportHeight],
  );

  useEffect(() => {
    if (!isMobile || !panelRef.current) return;

    const panelNode = panelRef.current;
    const updatePanelHeight = () => {
      setPanelHeight(Math.round(panelNode.getBoundingClientRect().height));
    };

    updatePanelHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updatePanelHeight()) : null;
    resizeObserver?.observe(panelNode);
    window.addEventListener("resize", updatePanelHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePanelHeight);
    };
  }, [isMobile, sheetPanelHeightVh]);

  useEffect(() => {
    if (!isMobile || panelHeight === 0 || viewportHeight === 0) return;
    const targetY = sheetOffsets[sheetMode];

    if (reduceMotion) {
      sheetY.set(targetY);
      return;
    }

    const controls = animate(sheetY, targetY, {
      type: "spring",
      stiffness: 380,
      damping: 36,
      mass: 0.82,
    });

    return () => {
      controls.stop();
    };
  }, [isMobile, panelHeight, reduceMotion, sheetMode, sheetOffsets, sheetY, viewportHeight]);

  const handleMapInteract = () => {
    setSheetMode("map");
  };

  const toggleSheet = () => {
    setSheetMode((current) => (current === "map" ? "sheet" : "map"));
  };

  const serviceLocationLabel = request?.address?.trim() || "Location is being updated";
  const serviceTypeLabel = [formatDisplayLabel(request?.vehicle_type), formatDisplayLabel(requestServiceType)]
    .filter(Boolean)
    .join(" ");
  const paymentMethodLabel = paymentCompleted
    ? selectedBackendPaymentMode === "cash"
      ? "Cash collected"
      : "Paid online"
    : selectedBackendPaymentMode === "cash"
      ? "Cash on service"
      : "Online payment";
  const trackingSummary = useMemo(() => {
    if (isTowingRequest && (status === "en_route_pickup" || status === "accepted" || status === "assigned")) {
      return {
        eyebrow: "Tow partner heading to pickup",
        value: eta || "Live",
        detail: distanceLabel || serviceLocationLabel,
      };
    }

    if (isTowingRequest && (status === "vehicle_loaded" || status === "enroute_drop")) {
      return {
        eyebrow: "Towing route active",
        value: Number.isFinite(routeDistanceKm) ? `${routeDistanceKm.toFixed(1)} km` : "In transit",
        detail: request?.dropLocation?.address || request?.drop_address || "Moving toward drop location",
      };
    }

    if (isTowingRequest && (status === "arrived_drop" || status === "service_completed")) {
      return {
        eyebrow: "Tow reached drop location",
        value: status === "service_completed" ? "Complete" : "Arrived",
        detail: showPayment ? "Payment is pending" : "Final confirmation is next",
      };
    }

    if (status === "en-route") {
      return {
        eyebrow: "Technician arriving in",
        value: eta || "Live",
        detail: distanceLabel || "Live location active",
      };
    }

    if (status === "arrived") {
      return {
        eyebrow: "Technician has arrived",
        value: "On site",
        detail: serviceLocationLabel,
      };
    }

    if (status === "in-progress") {
      return {
        eyebrow: "Service is in progress",
        value: elapsedSeconds > 0 ? formatElapsedTime() : "Live",
        detail: "Work has started",
      };
    }

    if (showPayment && !paymentCompleted) {
      return {
        eyebrow: "Payment pending",
        value: `${currency} ${amountDueLabel}`,
        detail: "Complete payment to close the request",
      };
    }

    if (status === "pending") {
      return {
        eyebrow: "Finding a nearby technician",
        value: "Matching",
        detail: "We are checking nearby partners for you",
      };
    }

    return {
      eyebrow: statusMeta.title,
      value: status === "completed" || status === "paid" ? "Closed" : "Live",
      detail: statusMeta.subtitle,
    };
  }, [
    amountDueLabel,
    currency,
    distanceLabel,
    elapsedSeconds,
    isTowingRequest,
    paymentCompleted,
    request?.dropLocation?.address,
    request?.drop_address,
    routeDistanceKm,
    serviceLocationLabel,
    showPayment,
    status,
    statusMeta.subtitle,
    statusMeta.title,
    eta,
  ]);
  const collapsedPreviewLabel = technician
    ? `${technician.name}${eta ? ` | ${eta}` : ""}`
    : status === "pending"
      ? "Matching nearby technicians"
      : statusMeta.title;
  const trackingSteps = [
    {
      label: "Placed",
      caption: formatCompactTime(request?.created_at) || "Created",
      complete: stageIndex >= 0,
      active: stageIndex === 0,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    {
      label: "Assigned",
      caption: technician ? "Matched" : "Pending",
      complete: stageIndex >= 1,
      active: stageIndex === 1,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    {
      label: "On the way",
      caption: eta || "Waiting",
      complete: stageIndex >= 2,
      active: stageIndex === 2,
      icon: <RadioTower className="h-3.5 w-3.5" />,
    },
    {
      label: "Service",
      caption: formatCompactTime(request?.started_at) || "Pending",
      complete: stageIndex >= 3,
      active: stageIndex === 3,
      icon: <Wrench className="h-3.5 w-3.5" />,
    },
    {
      label: "Completed",
      caption: paymentCompleted ? "Paid" : formatCompactTime(request?.completed_at) || "Pending",
      complete: stageIndex >= 4,
      active: stageIndex === 4,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
  ];

  const summaryBreakdown = summaryPaymentDetails.hasPricing
    ? {
        currency: String(quoteBreakdown?.currency || currency).toUpperCase(),
        paymentMode: summaryPaymentDetails.paymentMode ?? selectedBackendPaymentMode,
        baseAmount: summaryPaymentDetails.baseAmount,
        platformFeePercent: Number(
          quoteBreakdown?.platform_fee_percent ?? SERVICE_REQUEST_PLATFORM_FEE_PERCENT
        ),
        originalPlatformFee: Number(
          quoteBreakdown?.original_platform_fee ?? summaryPaymentDetails.originalPlatformFee
        ),
        discountAmount: Number(
          quoteBreakdown?.discount_amount ?? summaryPaymentDetails.discountAmount
        ),
        platformFee: summaryPaymentDetails.platformFee,
        paymentFeePercent: 0,
        paymentFee: summaryPaymentDetails.razorpayFee,
        totalAmount: Number(
          summaryPaymentDetails.finalAmount ?? summaryPaymentDetails.totalAmount ?? requestAmount
        ),
      }
    : null;

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
            <FindingTechnician 
              vehicleType={request?.vehicle_type} 
              serviceType={request?.service_type} 
            />
          ) : (
            <LiveTrackingMap
              techLocation={technicianMapLocation}
              userLocation={requestMapLocation}
              dropLocation={trackingDropLocation}
              routePolyline={trackingRoutePolyline}
              eta={eta}
              variant="fullscreen"
              status={status}
              distanceLabel={mapDistanceLabel}
              mapMode={sheetMode}
              onInteract={handleMapInteract}
              showRoutePath={isTowingRequest}
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
              <ArrowLeft className="h-5 w-5" />
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

        {status !== "pending" && (
          <div className="absolute inset-x-0 bottom-0 z-40">
          <motion.section
            ref={panelRef}
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="mx-0 mb-0 w-full overflow-hidden rounded-t-[28px] border-t border-slate-200/80 bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.12)] pb-[max(env(safe-area-inset-bottom),1rem)]"
            style={{ height: `${sheetPanelHeightVh}dvh`, y: sheetY, willChange: "transform" }}
          >
            <div className="flex h-full flex-col">
              {/* ── Collapsed compact card ── */}
              {sheetMode === "map" && (
                <button type="button" onClick={toggleSheet} className="w-full shrink-0 px-5 py-3 text-left">
                  <div className="flex items-center gap-3">
                    {technician ? (
                      <>
                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-md">
                          <AvatarImage src={technician.avatar_url} />
                          <AvatarFallback className="bg-slate-100 text-sm font-bold text-slate-600">{(technician.name || "T")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-extrabold text-slate-900">{technician.name}</p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                            {trackingSummary.eyebrow}{eta ? ` · ${eta}` : ""}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold text-slate-900">{statusMeta.title}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{statusMeta.subtitle}</p>
                      </div>
                    )}
                    {technician?.phone && (
                      <a href={`tel:${technician.phone}`} onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" aria-label="Call technician">
                        <Phone className="h-4 w-4 fill-current" />
                      </a>
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    </span>
                  </div>
                </button>
              )}

              {/* ── Expanded header with collapse toggle ── */}
              {sheetMode === "sheet" && (
                <button type="button" onClick={toggleSheet} className="w-full shrink-0 px-5 pb-1 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                        {isConnected ? "Live tracking" : "Reconnecting..."}
                      </span>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200">
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </span>
                  </div>
                </button>
              )}

              {/* ── Scrollable expanded content ── */}
              <div
                className={cn(
                  "min-h-0 flex-1 px-5 pb-5",
                  sheetMode === "map" ? "hidden" : "overflow-y-auto"
                )}
              >
              <div className={cn(sheetMode === "map" ? "hidden" : "block")}>
              {/* Status header */}
              <div className="mb-1 mt-1">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">On-time assistance</span>
                  {eta && status === "en-route" && (
                    <span className="ml-1 text-[10px] font-semibold text-emerald-600">· ETA {eta}</span>
                  )}
                </div>
                <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-slate-900">
                  {statusMeta.title}
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{statusMeta.subtitle}</p>
              </div>

              {routeSummaryVisible && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Towing route
                  </div>
                  <div className="space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex gap-2">
                      <span className="text-emerald-600">Pickup</span>
                      <span className="line-clamp-2">{request.address || "Pickup selected"}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-rose-600">Drop</span>
                      <span className="line-clamp-2">{request.dropLocation?.address || request.drop_address || "Drop selected"}</span>
                    </div>
                    {Number.isFinite(routeDistanceKm) && (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-900">
                        {routeDistanceKm.toFixed(1)} km towing distance
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Google Material Stepper ── */}
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Journey progress</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">{stageProgress}%</span>
                </div>
                <div className="flex items-start">
                  {trackingSteps.map((step, index) => {
                    const isLast = index === trackingSteps.length - 1;
                    return (
                      <div key={step.label} className={cn("flex items-start", isLast ? "" : "flex-1")}>
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500",
                            step.complete && !step.active
                              ? "bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                              : step.active
                                ? "border-2 border-primary bg-white text-primary shadow-[0_0_0_4px_rgba(239,68,68,0.1)]"
                                : "border border-slate-200 bg-white text-slate-400"
                          )}>
                            {step.complete && !step.active ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>
                          <p className={cn(
                            "mt-1 text-center text-[8px] font-semibold leading-tight",
                            step.complete || step.active ? "text-slate-700" : "text-slate-400"
                          )}>
                            {step.label}
                          </p>
                        </div>
                        {!isLast && (
                          <div className="flex flex-1 items-center px-0.5" style={{ paddingTop: 12 }}>
                            <div className={cn(
                              "h-[2px] w-full rounded-full transition-all duration-700",
                              index < stageIndex
                                ? "bg-emerald-500"
                                : index === stageIndex
                                  ? "bg-gradient-to-r from-primary/60 to-slate-200"
                                  : "bg-slate-200"
                            )} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {technician ? (
                <>
                  {shouldShowAmount ? (
                    <AmountCard
                      amount={finalAmount}
                      technicianAmount={amountCardDetails.baseAmount}
                      platformFee={amountCardDetails.platformFee}
                      razorpayFee={amountCardDetails.paymentMode === "upi" ? amountCardDetails.razorpayFee : 0}
                      total={amountCardDetails.finalAmount}
                      paymentMode={amountCardDetails.paymentMode}
                      currency={currency}
                      title="Final Amount"
                      helperText="Live payment breakdown from your current service request."
                      badgeText={null}
                      className="mt-4"
                    />
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-3.5">
                      <Avatar className="h-12 w-12 ring-2 ring-slate-100 shadow-sm">
                        <AvatarImage src={technician.avatar_url} />
                        <AvatarFallback className="bg-slate-100 text-sm font-bold text-slate-600">{(technician.name || "T")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-extrabold text-slate-900">{technician.name}</h3>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-800">{technicianRatingLabel}</span>
                          <span className="text-slate-300">|</span>
                          <span>{Number.isFinite(technicianJobs) ? technicianJobs : 0} jobs</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
                          asChild
                        >
                          <a href={`sms:${technician.phone || ""}`} aria-label="Message technician">
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          className="h-10 w-10 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
                          asChild
                        >
                          <a href={`tel:${technician.phone || ""}`} aria-label="Call technician">
                            <Phone className="h-4 w-4 fill-current" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : status === "pending" ? (
                <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    Matching with nearby partners...
                  </div>
                </div>
              ) : null}

              {showPayment && !paymentCompleted && (
                <div className="mt-4 space-y-2">
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-primary text-white shadow-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                            Amount due
                          </p>
                          <h3 className="mt-1 text-3xl font-black">
                            {currency} {amountDueLabel}
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

              {!showPayment && (status === "en-route" || status === "in-progress" || status === "en_route_pickup" || status === "vehicle_loaded" || status === "enroute_drop") && (
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
                  <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
          </motion.section>
        </div>
        )}

        <PaymentSummaryDialog
          isOpen={showPaymentSummary}
          onClose={() => setShowPaymentSummary(false)}
          onConfirm={handleConfirmPayment}
          baseAmount={requestAmount}
          isProcessing={isProcessingPayment}
          paymentMethod={selectedPaymentMethod}
          platformFeePercent={SERVICE_REQUEST_PLATFORM_FEE_PERCENT}
          paymentFeePercent={0}
          currency={currency}
          breakdown={summaryBreakdown}
          showCouponSection={true}
          couponCodeInput={couponCodeInput}
          onCouponCodeInputChange={(value) => {
            setCouponCodeInput(value);
            if (couponMessage) setCouponMessage(null);
          }}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
          isApplyingCoupon={isFetchingQuote}
          couponAppliedCode={appliedCouponCode}
          couponHint={[couponHint, couponUsageHint].filter(Boolean).join(" ") || null}
          couponMessage={couponMessage}
        />

        {paymentCompleted && (status === "completed" || status === "paid" || status === "payment_pending") && (
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
              techLocation={technicianMapLocation}
              userLocation={requestMapLocation}
              dropLocation={trackingDropLocation}
              routePolyline={trackingRoutePolyline}
              eta={eta}
              status={status}
              distanceLabel={mapDistanceLabel}
              showRoutePath={isTowingRequest}
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
            {routeSummaryVisible && (
              <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  Towing route
                </div>
                <p className="font-semibold text-foreground">Pickup: {request.address || "Selected"}</p>
                <p className="mt-1 font-semibold text-foreground">Drop: {request.dropLocation?.address || request.drop_address || "Selected"}</p>
                {Number.isFinite(routeDistanceKm) && (
                  <p className="mt-2 text-xs font-bold text-slate-600">{routeDistanceKm.toFixed(1)} km route</p>
                )}
              </div>
            )}
            {shouldShowAmount ? (
              <AmountCard
                amount={finalAmount}
                technicianAmount={amountCardDetails.baseAmount}
                platformFee={amountCardDetails.platformFee}
                razorpayFee={amountCardDetails.paymentMode === "upi" ? amountCardDetails.razorpayFee : 0}
                total={amountCardDetails.finalAmount}
                paymentMode={amountCardDetails.paymentMode}
                currency={currency}
                title="Final Amount"
                helperText="Live payment breakdown from your current service request."
                badgeText={null}
              />
            ) : null}
            {showPayment && !paymentCompleted && (
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.12em] text-white/70">Amount due</p>
                <p className="mt-1 text-3xl font-black">
                  {currency} {amountDueLabel}
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
        platformFeePercent={SERVICE_REQUEST_PLATFORM_FEE_PERCENT}
        paymentFeePercent={0}
        currency={currency}
        breakdown={summaryBreakdown}
        showCouponSection={true}
        couponCodeInput={couponCodeInput}
        onCouponCodeInputChange={(value) => {
          setCouponCodeInput(value);
          if (couponMessage) setCouponMessage(null);
        }}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        isApplyingCoupon={isFetchingQuote}
        couponAppliedCode={appliedCouponCode}
        couponHint={[couponHint, couponUsageHint].filter(Boolean).join(" ") || null}
        couponMessage={couponMessage}
      />
    </div>
  );
};

const LoadingSpinner = () => <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />;

export default RequestTracking;
