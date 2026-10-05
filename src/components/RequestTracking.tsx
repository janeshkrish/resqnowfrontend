import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { toast } from "@/components/ui/sonner";
import { useRealtimeServiceRequest } from "@/hooks/useRealtimeServiceRequest";
import { apiFetch } from "@/lib/api";
import { PaymentSummaryDialog } from "@/components/payments/PaymentSummaryDialog";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import {
  TrackingCard,
  TrackingDetails,
  TrackingStrip,
  type TrackingBill,
  type TrackingCardProps,
  type TrackingLiveChip,
} from "@/components/user/tracking/TrackingCard";
import { TrackingCancelDialog, TrackingHelpDialog } from "@/components/user/tracking/TrackingDialogs";
import { useTrackingSheet } from "@/components/user/tracking/useTrackingSheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { routePolylineFromMetadata } from "@/lib/geo";
import {
  canCustomerCancel,
  canResizeTrackingSheet,
  firstName,
  formatTrackingMoney,
  freshnessText,
  isCancelClosed,
  staleLocationNotice,
  technicianInitials,
  trackingHeadline,
  trackingPhase,
  trackingSteps,
  trackingStripHeadline,
  vehicleArt,
} from "@/lib/customerTracking";
import { distanceMeters, etaBasisLabel, formatEtaDuration, usableLiveEta } from "@/lib/liveEta";
import { formatClockTime } from "@/lib/technicianArrival";
import { trackingMapModeFromSheetSnap } from "@/lib/trackingMapMode";
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

const formatDisplayLabel = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

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
  const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<CouponMessageState | null>(null);
  const [finalAmount, setFinalAmount] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
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

  const { request, technician, isLoading, isConnected, trackingFreshness, refresh } = useRealtimeServiceRequest(
    requestId,
    realtimeOptions
  );
  const effectiveTrackingFreshness = trackingFreshness ?? (isConnected ? "LIVE" : "RECONNECTING");

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
  const requestServiceType = request?.service_type ?? request?.serviceType ?? "";
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
  const dropLat = Number(request?.dropLocation?.lat ?? request?.drop_latitude);
  const dropLng = Number(request?.dropLocation?.lng ?? request?.drop_longitude);
  const dropLocation =
    Number.isFinite(dropLat) && Number.isFinite(dropLng)
      ? { lat: dropLat, lng: dropLng }
      : null;
  const isTowingDropLeg =
    isTowingRequest &&
    [
      "vehicle_loaded",
      "enroute_drop",
      "arrived_drop",
      "service_completed",
      "payment_pending",
      "paid",
      "completed",
      "closed",
    ].includes(status);
  const liveTrackingDestination =
    isTowingDropLeg && dropLocation ? dropLocation : requestMapLocation;
  const liveEta = useMemo(
    () => usableLiveEta(technician?.liveEta, { requestId: String(requestId), destination: liveTrackingDestination }),
    [liveTrackingDestination, requestId, technician?.liveEta]
  );
  const liveTrackingMetrics = useMemo(() => {
    const statusLabel =
      status === "arrived"
        ? "Arrived"
        : status === "en-route"
          ? "On the way"
          : status === "in-progress"
            ? "Live"
            : undefined;

    let distanceKm: number | null = null;
    let distanceLabel: string | null = null;
    let etaLabel = statusLabel;
    if (liveEta) {
      distanceKm = liveEta.distanceMeters / 1000;
      distanceLabel = `${distanceKm.toFixed(1)} km away`;
      if (status === "en-route") etaLabel = formatEtaDuration(liveEta.etaSeconds);
    } else if (technicianMapLocation && liveTrackingDestination) {
      // Without a road ETA, show only an approximate straight-line distance;
      // minutes guessed from it would jump against the road ETA.
      distanceKm = Number((distanceMeters(technicianMapLocation, liveTrackingDestination) / 1000).toFixed(1));
      distanceLabel = `≈ ${distanceKm.toFixed(1)} km away`;
    }

    if (status === "arrived" && distanceKm !== null) {
      distanceLabel = "At your location";
    }

    return {
      eta: etaLabel,
      etaDisplay: etaLabel,
      etaBasis: liveEta && status === "en-route" ? etaBasisLabel(liveEta) : null,
      distanceKm,
      distanceLabel,
    };
  }, [liveEta, liveTrackingDestination, status, technicianMapLocation]);
  const eta = liveTrackingMetrics.eta;
  const distanceLabel = liveTrackingMetrics.distanceLabel;
  const shouldShowLiveRoute = Boolean(liveTrackingDestination);
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
  const technicianMotionProps = {
    technicianSpeed: technician?.speed,
    technicianHeading: technician?.heading,
    technicianAccuracy: technician?.accuracy,
    technicianRecordedAt: technician?.locationUpdatedAt,
    technicianSequenceId: technician?.sequenceId,
    trackingFreshness: effectiveTrackingFreshness,
  };

  const handleShareTracking = async () => {
    const trackingUrl = window.location.href;
    const shareData = {
      title: "ResQNow live tracking",
      text: "Follow the live progress of this ResQNow request.",
      url: trackingUrl,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingUrl);
        toast.success("Tracking link copied");
        return;
      }

      toast.error("Sharing is not available in this browser");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Unable to share the tracking link");
    }
  };

  const phase = trackingPhase({ status, paymentDue: showPayment, paymentCompleted });
  const canResize = canResizeTrackingSheet(phase);
  const sheet = useTrackingSheet({
    enabled: isMobile,
    viewportHeight,
    canResize,
    reduceMotion: Boolean(reduceMotion),
  });

  // A customer may cancel only until the technician sets off; the server holds the same rule.
  const canCancel = canCustomerCancel(status) && !paymentCompleted;
  useEffect(() => {
    if (!canCancel) setIsCancelOpen(false);
  }, [canCancel]);

  const cancelRequest = async (reason: string) => {
    try {
      const res = await apiFetch(`/api/service-requests/${requestId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        refresh();
        setIsCancelOpen(false);
        toast.success("Request cancelled");
        return;
      }
      if (res.status === 409) {
        // The technician set off before this tap reached the server.
        const body = await res.json().catch(() => ({}));
        refresh();
        setIsCancelOpen(false);
        toast.error(body?.error || "This request can no longer be cancelled.");
        return;
      }
      toast.error("Unable to cancel request");
    } catch {
      toast.error("Error cancelling request");
    }
  };

  const goHome = () => navigate("/");
  const requestExtras = request as (typeof request & { price_locked?: boolean; vehicle_name?: string }) | null;
  const serviceLocationLabel = request?.address?.trim() || "Location is being updated";
  const dropAddress = request?.dropLocation?.address || request?.drop_address || null;
  const technicianFirst = firstName(technician?.name);
  const money = (amount: number, whole = false) => formatTrackingMoney(amount, currency, { whole });
  const amountDue = Number(amountDueLabel);
  const amountLabel = Number.isFinite(amountDue) && amountDue > 0 ? money(amountDue) : null;
  const sentAt = Number.isFinite(Date.parse(String(request?.created_at ?? "")))
    ? formatClockTime(Date.parse(String(request?.created_at)))
    : null;

  const headlineInput = {
    phase,
    isTowing: isTowingRequest,
    technicianName: technician?.name,
    requestId: String(request?.id ?? requestId),
    createdAt: request?.created_at,
    startedAt: request?.started_at,
    elapsedSeconds,
    liveEta,
    distanceLabel,
    amountLabel,
    dropAddress,
    fallback: statusMeta,
  };
  const headline = trackingHeadline(headlineInput);
  const stripHeadline = trackingStripHeadline({ ...headlineInput, freshness: effectiveTrackingFreshness });
  const steps = trackingSteps(phase, isTowingRequest);

  // The live chip is about the technician's position, so it shows only while that matters.
  const followsTechnician = Boolean(technician) && ["accepted", "way", "loaded", "towing"].includes(phase);
  const liveChip: TrackingLiveChip | null = followsTechnician
    ? {
        text: freshnessText(effectiveTrackingFreshness),
        tone:
          effectiveTrackingFreshness === "LIVE"
            ? "ok"
            : effectiveTrackingFreshness === "DELAYED" || effectiveTrackingFreshness === "RECONNECTING"
              ? "warn"
              : "off",
      }
    : null;
  const staleNotice =
    technician && (phase === "way" || phase === "towing")
      ? staleLocationNotice(effectiveTrackingFreshness, technician.name)
      : null;

  const technicianView = technician
    ? {
        name: technician.name || "Technician",
        first: technicianFirst,
        initials: technicianInitials(technician.name),
        avatarUrl: technician.avatar_url,
        phone: technician.phone || null,
        meta: [
          technicianRatingLabel === "N/A" ? "New" : technicianRatingLabel,
          `${Number.isFinite(technicianJobs) ? technicianJobs : 0} ${technicianJobs === 1 ? "job" : "jobs"}`,
          "Verified",
        ].join(" · "),
      }
    : null;

  const billTotal = Number(amountCardDetails.finalAmount ?? finalAmount);
  const hasBillTotal = Boolean(amountCardDetails.hasPricing) && Number.isFinite(billTotal) && billTotal > 0;
  const requestRow = {
    title: formatDisplayLabel(requestServiceType) || "Service request",
    line:
      [requestExtras?.vehicle_model || requestExtras?.vehicle_name, formatDisplayLabel(request?.vehicle_type)]
        .filter(Boolean)
        .join(" · ") || "Request details",
    art: vehicleArt(request?.vehicle_type),
    fare: hasBillTotal && status !== "cancelled" ? money(billTotal, true) : null,
  };

  const bill: TrackingBill | null =
    shouldShowAmount && hasBillTotal
      ? {
          rows: [
            { label: "Technician charge", value: money(amountCardDetails.baseAmount) },
            { label: "Platform fee", value: money(amountCardDetails.platformFee) },
            ...(amountCardDetails.paymentMode === "upi" && amountCardDetails.razorpayFee > 0
              ? [{ label: "Payment fee", value: money(amountCardDetails.razorpayFee) }]
              : []),
          ],
          total: money(billTotal),
          note: [
            requestExtras?.price_locked ? "Price locked." : null,
            phase === "pay" ? "Pay online or in cash." : "You pay after the work is done.",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null;

  const cardProps: TrackingCardProps = {
    phase,
    headline,
    steps,
    live: liveChip,
    notice: staleNotice,
    onRefresh: refresh,
    technician: technicianView,
    request: requestRow,
    pay:
      phase === "pay"
        ? {
            amountLabel,
            technicianFirst,
            onPayOnline: handleOnlinePaymentClick,
            onPayCash: handleCashPaymentClick,
          }
        : null,
    rating:
      phase === "rate"
        ? {
            onSubmit: () => {
              toast.success("Thank you for your feedback");
              navigate("/");
            },
          }
        : null,
    onHome: goHome,
    onCancel: canCancel && phase === "search" ? () => setIsCancelOpen(true) : undefined,
  };

  const detailsProps = {
    place: {
      title: isTowingRequest ? "Towing route" : "Help is coming to",
      pickupLabel: isTowingRequest ? "Pickup" : "Your location",
      address: serviceLocationLabel,
      drop: routeSummaryVisible
        ? {
            label: Number.isFinite(routeDistanceKm) ? `Drop · ${routeDistanceKm.toFixed(1)} km` : "Drop",
            address: dropAddress || "Drop selected",
          }
        : null,
    },
    bill,
    onShare: () => void handleShareTracking(),
    onHelp: () => setIsEmergencyDialogOpen(true),
    onCancel: canCancel && phase !== "search" ? () => setIsCancelOpen(true) : undefined,
    cancelClosedNote: isCancelClosed(status)
      ? "Cancelling closed when your technician set off. If something is wrong, contact support."
      : null,
    requestLine: [`Request #${request?.id ?? requestId}`, sentAt ? `sent at ${sentAt}` : null].filter(Boolean).join(" · "),
  };

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

  const dialogs = (
    <>
      <TrackingHelpDialog
        open={isEmergencyDialogOpen}
        onOpenChange={setIsEmergencyDialogOpen}
        onShare={() => void handleShareTracking()}
      />

      <TrackingCancelDialog
        open={isCancelOpen && canCancel}
        onOpenChange={setIsCancelOpen}
        text={
          phase === "search"
            ? "We are still finding a technician for you."
            : `${technicianFirst} has accepted and is getting ready. You can cancel until they set off.`
        }
        onConfirm={cancelRequest}
      />

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
    </>
  );

  if (isMobile) {
    return (
      <div className="lt lt-screen">
        {/* The map fills the screen down to the card */}
        <motion.div className="lt-mapwrap" style={{ height: sheet.mapHeight }}>
          <LiveTrackingMap
            techLocation={technicianMapLocation}
            {...technicianMotionProps}
            userLocation={requestMapLocation}
            dropLocation={trackingDropLocation}
            routePolyline={trackingRoutePolyline}
            routeDestination={liveTrackingDestination}
            trackingSessionId={request.id}
            eta={eta}
            variant="fullscreen"
            status={status}
            distanceLabel={mapDistanceLabel}
            mapMode={trackingMapModeFromSheetSnap(sheet.snap)}
            onInteract={() => sheet.snapTo("collapsed")}
            showRoutePath={shouldShowLiveRoute}
            showStatusOverlay={false}
            className="h-full w-full"
          />
        </motion.div>

        <div className="lt-top" ref={sheet.topBarRef}>
          <button type="button" className="lt-round lt-press" aria-label="Back to home" onClick={goHome}>
            <MaterialSymbol name="arrow_back" />
          </button>
          <button
            type="button"
            className="lt-sos lt-press"
            aria-label="Open safety and help"
            onClick={() => setIsEmergencyDialogOpen(true)}
          >
            <MaterialSymbol name="emergency" />
            SOS
          </button>
        </div>

        {/* The card: a strip over the map, the card itself, or opened for details */}
        <motion.div
          className="lt-dock"
          style={{ y: sheet.sheetY }}
          drag={canResize ? "y" : false}
          dragControls={sheet.dragControls}
          dragListener={false}
          dragConstraints={sheet.dragConstraints}
          dragElastic={0.08}
          onDragStart={sheet.onDragStart}
          onDragEnd={sheet.onDragEnd}
        >
          <section
            className="lt-sheet"
            data-testid="tracking-sheet"
            data-size={sheet.snap}
            aria-label="Live tracking"
            style={{ height: sheet.sheetHeight }}
          >
            {canResize ? (
              <button
                type="button"
                className="lt-grab"
                aria-label={
                  sheet.snap === "collapsed"
                    ? "Open the card"
                    : sheet.snap === "expanded"
                      ? "Close details"
                      : "Open details"
                }
                onPointerDown={sheet.startDrag}
                onClick={sheet.stepFromHandle}
              >
                <span />
              </button>
            ) : (
              <div className="lt-grab is-still" aria-hidden="true" />
            )}
            <div className={cn("lt-scroll", sheet.scrollable && "is-open")} ref={sheet.scrollRef}>
              <motion.div className="lt-peek" ref={sheet.cardRef} style={{ opacity: sheet.cardOpacity }}>
                <TrackingCard
                  {...cardProps}
                  details={canResize ? { open: sheet.snap === "expanded", onToggle: sheet.toggleDetails } : undefined}
                  drag={canResize ? { onPointerDown: sheet.startDrag } : undefined}
                />
              </motion.div>
              {canResize ? (
                <div ref={sheet.detailsRef}>
                  <TrackingDetails {...detailsProps} />
                </div>
              ) : null}
            </div>
            {canResize ? (
              <motion.div className="lt-mini" ref={sheet.stripRef} style={{ opacity: sheet.stripOpacity }}>
                <TrackingStrip
                  headline={stripHeadline}
                  steps={steps}
                  dot={liveChip ? (liveChip.tone === "ok" ? "ok" : "warn") : null}
                  call={technician?.phone ? { phone: technician.phone, first: technicianFirst } : null}
                  pay={phase === "pay" ? { onPayOnline: handleOnlinePaymentClick } : null}
                  onExpand={sheet.showCard}
                  drag={{ onPointerDown: sheet.startDrag }}
                />
              </motion.div>
            ) : null}
          </section>
        </motion.div>

        {dialogs}
      </div>
    );
  }

  return (
    <div className="lt lt-desk container mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="lt-desk-bar">
        <button type="button" className="lt-back lt-press" onClick={goHome}>
          <MaterialSymbol name="arrow_back" />
          Back to home
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card className="lt-desk-map overflow-hidden rounded-2xl border-border/80 shadow-md">
          <CardContent className="p-0">
            <LiveTrackingMap
              techLocation={technicianMapLocation}
              {...technicianMotionProps}
              userLocation={requestMapLocation}
              dropLocation={trackingDropLocation}
              routePolyline={trackingRoutePolyline}
              routeDestination={liveTrackingDestination}
              trackingSessionId={request.id}
              eta={eta}
              status={status}
              distanceLabel={mapDistanceLabel}
              showRoutePath={shouldShowLiveRoute}
              className="w-full mb-0"
            />
          </CardContent>
        </Card>

        {/* Beside the map the card does not move, so its details are always open */}
        <section className="lt-panel" data-testid="tracking-sheet" data-size="open" aria-label="Live tracking">
          <div className="lt-peek">
            <TrackingCard {...cardProps} />
          </div>
          {canResize ? <TrackingDetails {...detailsProps} /> : null}
        </section>
      </div>

      {dialogs}
    </div>
  );
};

const LoadingSpinner = () => <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />;

export default RequestTracking;
