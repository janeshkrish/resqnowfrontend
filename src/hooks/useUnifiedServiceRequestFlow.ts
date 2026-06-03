import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { ServiceRequestFormData } from "@/components/service-request/types";
import { apiFetch } from "@/lib/api";
import { searchLocations } from "@/lib/geo";
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from "@/lib/googlePlaces";
import { toast } from "sonner";

type UnifiedRequestFlowOptions = {
  serviceId?: string;
  vehicleType: "car" | "bike" | "commercial" | "ev";
  storageKey: string;
  resetRequested?: boolean;
  user?: { name?: string; email?: string; phone?: string; id?: number | string } | null;
  navigate: (path: string) => void;
  updateProfile?: (payload: { phone?: string }) => Promise<unknown>;
  createInitialFormData: (techId: string | null) => ServiceRequestFormData;
  validateStep1: (formData: ServiceRequestFormData) => boolean;
  buildVehicleModel: (formData: ServiceRequestFormData) => string;
  buildDescription?: (formData: ServiceRequestFormData, serviceId?: string) => string;
  successTitle?: string;
  successDescription?: string;
  allowDirectTechnician?: boolean;
};

const isTowingServiceId = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(car|bike|ev|commercial)-/, "")
    .replace(/[_\s]+/g, "-");
  return normalized === "towing" || normalized === "tow" || normalized === "tow-truck" || normalized === "flatbed-towing";
};

const normalizeAddressValue = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.formatted_address || record.address || record.description || "").trim();
  }
  return String(value).trim();
};

const normalizeCoordinateValue = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasFiniteCoordinate = (value: unknown) => normalizeCoordinateValue(value) !== null;

const normalizeCoordinateKey = (value: unknown) => {
  const parsed = normalizeCoordinateValue(value);
  return parsed !== null ? parsed.toFixed(6) : "";
};

const buildTowingEstimateInputKey = ({
  formData,
  serviceId,
  vehicleType,
}: {
  formData: ServiceRequestFormData;
  serviceId?: string;
  vehicleType: string;
}) =>
  [
    String(serviceId || "").trim().toLowerCase(),
    String(vehicleType || "").trim().toLowerCase(),
    normalizeAddressValue(formData.location).toLowerCase(),
    normalizeCoordinateKey(formData.locationLat),
    normalizeCoordinateKey(formData.locationLng),
    normalizeAddressValue(formData.dropLocation).toLowerCase(),
    normalizeCoordinateKey(formData.dropLat),
    normalizeCoordinateKey(formData.dropLng),
    String(formData.vehicleType || "").trim().toLowerCase(),
    String(formData.vehicleSubtype || "").trim().toLowerCase(),
    String(formData.vehicleModel || "").trim().toLowerCase(),
  ].join("|");

const clearTowingEstimateDerivedFields = (formData: ServiceRequestFormData): ServiceRequestFormData => {
  const hasDerivedFields =
    formData.routeDistanceKm != null ||
    formData.estimatedDuration != null ||
    formData.pricingBreakdown != null ||
    formData.finalEstimatedPrice != null;

  if (!hasDerivedFields) return formData;

  return {
    ...formData,
    routeDistanceKm: undefined,
    estimatedDuration: undefined,
    pricingBreakdown: null,
    finalEstimatedPrice: null,
  };
};

const isNonBlockingTowingEstimateEndpointFailure = (error: unknown) => {
  const status = Number((error as { status?: unknown })?.status);
  return status === 404 || status === 405 || status === 410 || status === 501;
};

const TOWING_ESTIMATE_UNAVAILABLE_MESSAGE =
  "Live fare preview is temporarily unavailable. Continue and the verified fare will be confirmed when booking is created.";

export function useUnifiedServiceRequestFlow({
  serviceId,
  vehicleType,
  storageKey,
  resetRequested,
  user,
  navigate,
  updateProfile,
  createInitialFormData,
  validateStep1,
  buildVehicleModel,
  buildDescription,
  successTitle = "Request Broadcasted!",
  successDescription = "Searching for nearby technicians...",
  allowDirectTechnician = false
}: UnifiedRequestFlowOptions) {
  const [formData, setFormData] = useState<ServiceRequestFormData>(() => {
    if (resetRequested) {
      localStorage.removeItem(storageKey);
    }

    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        return parsed.formData;
      } catch {
        // ignore bad local state
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const techId = urlParams.get("techId");
    return createInitialFormData(techId);
  });

  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (resetRequested) return 1;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        return parsed.currentStep || 1;
      } catch {
        // ignore bad local state
      }
    }
    return 1;
  });

  const [currentLocation, setCurrentLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEstimatingTowing, setIsEstimatingTowing] = useState(false);
  const [towingEstimate, setTowingEstimate] = useState<any>(null);
  const [towingEstimateError, setTowingEstimateError] = useState<string | null>(null);
  const [towingEstimateWarning, setTowingEstimateWarning] = useState<string | null>(null);
  const [towingEstimateInputKey, setTowingEstimateInputKey] = useState<string | null>(null);
  const [towingEstimateWarningInputKey, setTowingEstimateWarningInputKey] = useState<string | null>(null);
  const [isDetectingGoogleLocation, setIsDetectingGoogleLocation] = useState(false);
  const googleAutoDetectAttemptedRef = useRef(false);
  const requiresDropLocation = isTowingServiceId(serviceId);

  const {
    coordinates,
    address,
    loading: loadingGeo,
    error: geoError,
    requestLocation
  } = useGeolocation();

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ formData, currentStep }));
  }, [formData, currentStep, storageKey]);

  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || ""
    }));
  }, [user]);

  useEffect(() => {
    if (requiresDropLocation) return;
    if (!coordinates || !address) return;
    setCurrentLocation(address);
    setFormData((prev) => ({
      ...prev,
      location: address,
      locationLat: coordinates.lat,
      locationLng: coordinates.lng
    }));
  }, [coordinates, address, requiresDropLocation]);

  useEffect(() => {
    if (geoError) {
      toast.error(geoError);
    }
  }, [geoError]);

  const detectCurrentPickupWithGoogle = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation API not available. Please use a modern browser.");
      return;
    }

    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      toast.error("Geolocation requires HTTPS. Please connect securely.");
      return;
    }

    setIsDetectingGoogleLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordinates = { lat: latitude, lng: longitude };

        try {
          const resolved = await reverseGeocodeWithGoogle(latitude, longitude);
          const addressText = normalizeAddressValue(resolved) || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setCurrentLocation(addressText);
          setFormData((prev) => ({
            ...prev,
            location: addressText,
            locationLat: coordinates.lat,
            locationLng: coordinates.lng,
            locationCoordinates: coordinates,
            locationPlaceId: resolved.placeId || null,
            locationPlace: {
              address: addressText,
              formatted_address: addressText,
              lat: coordinates.lat,
              lng: coordinates.lng,
              placeId: resolved.placeId || null,
            },
          }));
        } catch (error) {
          const fallbackAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setCurrentLocation(fallbackAddress);
          setFormData((prev) => ({
            ...prev,
            location: fallbackAddress,
            locationLat: coordinates.lat,
            locationLng: coordinates.lng,
            locationCoordinates: coordinates,
          }));
          toast.error(error instanceof Error ? error.message : "Unable to fetch locations");
        } finally {
          setIsDetectingGoogleLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Unable to get location. Please try again.";
        if (error.code === 1) errorMessage = "Location permission denied. Please enable location access in browser settings.";
        if (error.code === 2) errorMessage = "Location unavailable. Check GPS/location services.";
        if (error.code === 3) errorMessage = "Location request timed out. Please try again.";
        toast.error(errorMessage);
        setIsDetectingGoogleLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  useEffect(() => {
    if (!requiresDropLocation || googleAutoDetectAttemptedRef.current) return;
    const hasPickupCoordinates = hasFiniteCoordinate(formData.locationLat) && hasFiniteCoordinate(formData.locationLng);
    if (normalizeAddressValue(formData.location) || hasPickupCoordinates) return;
    googleAutoDetectAttemptedRef.current = true;
    detectCurrentPickupWithGoogle();
  }, [detectCurrentPickupWithGoogle, formData.location, formData.locationLat, formData.locationLng, requiresDropLocation]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const nextValue = name === "location" || name === "dropLocation" ? normalizeAddressValue(value) : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleLocationSelect = (lat: number, lng: number, addressText?: string, placeId?: string | null) => {
    const addressValue = normalizeAddressValue(addressText);
    setFormData((prev) => ({
      ...prev,
      location: addressValue || normalizeAddressValue(prev.location),
      locationLat: lat,
      locationLng: lng,
      locationCoordinates: { lat, lng },
      locationPlaceId: placeId ?? prev.locationPlaceId ?? null,
      locationPlace: addressValue
        ? {
            address: addressValue,
            formatted_address: addressValue,
            lat,
            lng,
            placeId: placeId ?? prev.locationPlaceId ?? null,
          }
        : prev.locationPlace ?? null,
    }));
  };

  const handleGetCurrentLocation = () => {
    if (requiresDropLocation) {
      googleAutoDetectAttemptedRef.current = true;
      detectCurrentPickupWithGoogle();
      return;
    }
    requestLocation();
  };

  const handleDropLocationSelect = (lat: number, lng: number, addressText?: string, placeId?: string | null) => {
    const addressValue = normalizeAddressValue(addressText);
    setFormData((prev) => ({
      ...prev,
      dropLat: lat,
      dropLng: lng,
      dropLocation: addressValue || normalizeAddressValue(prev.dropLocation),
      dropLocationCoordinates: { lat, lng },
      dropPlaceId: placeId ?? prev.dropPlaceId ?? null,
      dropPlace: addressValue
        ? {
            address: addressValue,
            formatted_address: addressValue,
            lat,
            lng,
            placeId: placeId ?? prev.dropPlaceId ?? null,
          }
        : prev.dropPlace ?? null,
    }));
  };

  const handleGetCurrentDropLocation = () => {
    if (!coordinates || !address) {
      toast.message("Use pickup auto detect first", {
        description: "Then adjust the drop search to the destination."
      });
      requestLocation();
      return;
    }
    handleDropLocationSelect(coordinates.lat, coordinates.lng, address);
  };

  const geocodeAddress = async (addressText: string) => {
    try {
      if (requiresDropLocation) {
        return await geocodeAddressWithGoogle(addressText);
      }
      const [result] = await searchLocations(addressText, 1);
      return result ? { lat: result.lat, lng: result.lng, address: result.address } : null;
    } catch {
      return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return validateStep1(formData);
    }
    if (currentStep === 2) {
      const pickupAddress = normalizeAddressValue(formData.location);
      const dropAddress = normalizeAddressValue(formData.dropLocation);
      const pickupCoordinatesReady = hasFiniteCoordinate(formData.locationLat) && hasFiniteCoordinate(formData.locationLng);
      const dropCoordinatesReady = hasFiniteCoordinate(formData.dropLat) && hasFiniteCoordinate(formData.dropLng);
      const currentEstimateInputKey = buildTowingEstimateInputKey({ formData, serviceId, vehicleType });
      const towingPreviewSatisfied =
        Boolean(towingEstimate && !towingEstimateError && towingEstimateInputKey === currentEstimateInputKey) ||
        Boolean(towingEstimateWarning && towingEstimateWarningInputKey === currentEstimateInputKey);
      if (!pickupAddress) return false;
      if (!requiresDropLocation) return true;
      return !!(
        dropAddress &&
        pickupCoordinatesReady &&
        dropCoordinatesReady &&
        towingPreviewSatisfied
      );
    }
    if (currentStep === 3) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !!(
        formData.name &&
        formData.phone &&
        formData.phone.length === 10 &&
        formData.email &&
        emailRegex.test(formData.email)
      );
    }
    return false;
  };

  const submitRequest = async (techId?: string) => {
    if (isSubmitting) return;
    if (!serviceId) {
      toast.error("Service unavailable", { description: "Service ID missing." });
      return;
    }

    setIsSubmitting(true);

    try {
      const description =
        buildDescription?.(formData, serviceId) ||
        formData.details ||
        `Request for ${serviceId}`;
      const pickupAddress = normalizeAddressValue(formData.location);
      const dropAddress = normalizeAddressValue(formData.dropLocation);
      const pickupLat = normalizeCoordinateValue(formData.locationLat);
      const pickupLng = normalizeCoordinateValue(formData.locationLng);
      const dropLat = normalizeCoordinateValue(formData.dropLat);
      const dropLng = normalizeCoordinateValue(formData.dropLng);

      const payload = {
        service_type: `${vehicleType}-${serviceId}`,
        vehicle_type: vehicleType,
        vehicle_model: buildVehicleModel(formData),
        address: pickupAddress,
        description,
        contact_phone: formData.phone,
        contact_email: formData.email,
        contact_name: formData.name,
        technician_id: allowDirectTechnician ? (techId || formData.selectedTechnicianId || null) : null,
        location_lat: pickupLat,
        location_lng: pickupLng
      };

      if (requiresDropLocation) {
        Object.assign(payload, {
          pickupPlaceId: formData.locationPlaceId || formData.locationPlace?.placeId || null,
          locationPlaceId: formData.locationPlaceId || formData.locationPlace?.placeId || null,
          dropLocation: dropAddress,
          dropAddress,
          dropPlaceId: formData.dropPlaceId || formData.dropPlace?.placeId || null,
          dropLat,
          dropLng,
          distanceKm: formData.routeDistanceKm ?? towingEstimate?.distanceKm ?? towingEstimate?.quote?.distance_km ?? null,
          estimatedDuration: formData.estimatedDuration ?? towingEstimate?.estimatedDuration ?? towingEstimate?.quote?.estimated_duration ?? null,
          pricingBreakdown: formData.pricingBreakdown ?? towingEstimate?.pricingBreakdown ?? towingEstimate?.quote?.pricing_breakdown ?? null,
          finalEstimatedPrice: formData.finalEstimatedPrice ?? towingEstimate?.finalEstimatedPrice ?? towingEstimate?.quote?.final_estimated_price ?? null,
          timeOfDay: new Date().toISOString()
        });
      }

      const res = await apiFetch("/api/service-requests", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let msg = "Failed to create service request";
        try {
          const errData = await res.json();
          msg = errData.error || msg;
        } catch {
          // ignore parse failure
        }
        throw new Error(msg);
      }

      const data = await res.json();
      localStorage.removeItem(storageKey);

      if (user && !user.phone && formData.phone && updateProfile) {
        updateProfile({ phone: formData.phone }).catch(() => {
          // no-op
        });
      }

      toast.success(successTitle, { description: successDescription });
      navigate(`/request-service-tracking/${data.id}`);
    } catch (error: any) {
      toast.error("Submission Failed", {
        description: error?.message || "Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Initialize history state for the step if it doesn't exist
    if (!window.history.state?.serviceStep) {
      window.history.replaceState({ serviceStep: currentStep }, "");
    } else if (window.history.state.serviceStep !== currentStep) {
      window.history.replaceState({ serviceStep: currentStep }, "");
    }

    const handlePopState = (e: PopStateEvent) => {
      // If the user uses a native back swipe or Android back button
      if (e.state && typeof e.state.serviceStep === "number") {
        setCurrentStep(e.state.serviceStep);
      } else {
        // If they navigate back before step 1, we let the browser handle it (navigate away)
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentStep]);

  const handleNext = async () => {
    if (currentStep < 3) {
      const pickupAddress = normalizeAddressValue(formData.location);
      const dropAddress = normalizeAddressValue(formData.dropLocation);
      if (currentStep === 2 && pickupAddress && (!hasFiniteCoordinate(formData.locationLat) || !hasFiniteCoordinate(formData.locationLng))) {
        const coords = await geocodeAddress(pickupAddress);
        if (coords) {
          setFormData((prev) => ({
            ...prev,
            location: coords.address || prev.location,
            locationLat: coords.lat,
            locationLng: coords.lng,
            locationCoordinates: { lat: coords.lat, lng: coords.lng },
            locationPlaceId: "placeId" in coords ? coords.placeId || prev.locationPlaceId || null : prev.locationPlaceId || null,
            locationPlace: {
              address: coords.address || normalizeAddressValue(prev.location),
              formatted_address: coords.address || normalizeAddressValue(prev.location),
              lat: coords.lat,
              lng: coords.lng,
              placeId: "placeId" in coords ? coords.placeId || prev.locationPlaceId || null : prev.locationPlaceId || null,
            },
          }));
        }
      }
      if (currentStep === 2 && requiresDropLocation && dropAddress && (!hasFiniteCoordinate(formData.dropLat) || !hasFiniteCoordinate(formData.dropLng))) {
        const coords = await geocodeAddress(dropAddress);
        if (coords) {
          setFormData((prev) => ({
            ...prev,
            dropLocation: coords.address || prev.dropLocation,
            dropLat: coords.lat,
            dropLng: coords.lng,
            dropLocationCoordinates: { lat: coords.lat, lng: coords.lng },
            dropPlaceId: "placeId" in coords ? coords.placeId || prev.dropPlaceId || null : prev.dropPlaceId || null,
            dropPlace: {
              address: coords.address || normalizeAddressValue(prev.dropLocation),
              formatted_address: coords.address || normalizeAddressValue(prev.dropLocation),
              lat: coords.lat,
              lng: coords.lng,
              placeId: "placeId" in coords ? coords.placeId || prev.dropPlaceId || null : prev.dropPlaceId || null,
            },
          }));
        }
      }
      const nextStep = currentStep + 1;
      // Push history state so the mobile physical back button will pop back cleanly
      window.history.pushState({ serviceStep: nextStep }, "");
      setCurrentStep(nextStep);
      return;
    }
    await submitRequest();
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      window.history.replaceState({ serviceStep: prevStep }, "");
    }
  };

  useEffect(() => {
    if (!requiresDropLocation) {
      setTowingEstimate(null);
      setTowingEstimateError(null);
      setTowingEstimateWarning(null);
      setTowingEstimateInputKey(null);
      setTowingEstimateWarningInputKey(null);
      setFormData((prev) => clearTowingEstimateDerivedFields(prev));
      return;
    }

    const pickupAddress = normalizeAddressValue(formData.location);
    const dropAddress = normalizeAddressValue(formData.dropLocation);
    const pickupLat = normalizeCoordinateValue(formData.locationLat);
    const pickupLng = normalizeCoordinateValue(formData.locationLng);
    const dropLat = normalizeCoordinateValue(formData.dropLat);
    const dropLng = normalizeCoordinateValue(formData.dropLng);
    const pickupReady = pickupAddress && pickupLat !== null && pickupLng !== null;
    const dropReady = dropAddress && dropLat !== null && dropLng !== null;
    const vehicleReady = formData.vehicleType && formData.vehicleSubtype;
    if (!pickupReady || !dropReady || !vehicleReady) {
      setTowingEstimate(null);
      setTowingEstimateError(null);
      setTowingEstimateWarning(null);
      setTowingEstimateInputKey(null);
      setTowingEstimateWarningInputKey(null);
      setFormData((prev) => clearTowingEstimateDerivedFields(prev));
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const estimateInputKey = buildTowingEstimateInputKey({ formData, serviceId, vehicleType });
    setFormData((prev) => clearTowingEstimateDerivedFields(prev));
    const timer = window.setTimeout(async () => {
      setIsEstimatingTowing(true);
      setTowingEstimateError(null);
      setTowingEstimateWarning(null);
      setTowingEstimateInputKey(null);
      setTowingEstimateWarningInputKey(null);
      try {
        const response = await apiFetch("/api/pricing/towing-estimate", {
          method: "POST",
          body: JSON.stringify({
            serviceType: `${vehicleType}-towing`,
            vehicleType,
            vehicleModel: buildVehicleModel(formData),
            pickupAddress,
            pickupLat,
            pickupLng,
            dropAddress,
            dropLat,
            dropLng,
            paymentMode: "upi",
            timeOfDay: new Date().toISOString()
          }),
          signal: controller.signal
        } as RequestInit);

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const estimateError = new Error(data?.error || "Unable to estimate towing fare.") as Error & {
            status?: number;
            code?: string;
          };
          estimateError.status = response.status;
          estimateError.code = data?.code;
          throw estimateError;
        }
        if (cancelled) return;
        const quote = data?.quote || data;
        const pricingBreakdown = quote?.pricing_breakdown || data?.pricingBreakdown || null;
        setTowingEstimate(data);
        setTowingEstimateInputKey(estimateInputKey);
        setTowingEstimateWarningInputKey(null);
        setFormData((prev) => ({
          ...prev,
          routeDistanceKm: quote?.distance_km ?? data?.distanceKm ?? prev.routeDistanceKm,
          estimatedDuration: quote?.estimated_duration ?? data?.estimatedDuration ?? prev.estimatedDuration,
          pricingBreakdown,
          finalEstimatedPrice: quote?.final_estimated_price ?? data?.finalEstimatedPrice ?? prev.finalEstimatedPrice
        }));
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setTowingEstimate(null);
        if (isNonBlockingTowingEstimateEndpointFailure(error)) {
          setTowingEstimateWarning(TOWING_ESTIMATE_UNAVAILABLE_MESSAGE);
          setTowingEstimateWarningInputKey(estimateInputKey);
          setTowingEstimateInputKey(null);
          setTowingEstimateError(null);
          setFormData((prev) => clearTowingEstimateDerivedFields(prev));
          return;
        }
        setTowingEstimateWarning(null);
        setTowingEstimateInputKey(null);
        setTowingEstimateWarningInputKey(null);
        setFormData((prev) => clearTowingEstimateDerivedFields(prev));
        setTowingEstimateError(error?.message || "Unable to estimate towing fare.");
      } finally {
        if (!cancelled) setIsEstimatingTowing(false);
      }
    }, 650);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    buildVehicleModel,
    formData.location,
    formData.locationLat,
    formData.locationLng,
    formData.dropLocation,
    formData.dropLat,
    formData.dropLng,
    formData.vehicleType,
    formData.vehicleSubtype,
    formData.vehicleModel,
    requiresDropLocation,
    serviceId,
    vehicleType
  ]);

  return {
    formData,
    setFormData,
    currentStep,
    setCurrentStep,
    currentLocation,
    isSubmitting,
    loadingGeo: loadingGeo || isDetectingGoogleLocation,
    requiresDropLocation,
    towingEstimate,
    isEstimatingTowing,
    towingEstimateError,
    towingEstimateWarning,
    handleInputChange,
    handleLocationSelect,
    handleGetCurrentLocation,
    handleDropLocationSelect,
    handleGetCurrentDropLocation,
    canProceed,
    submitRequest,
    handleNext,
    handleBack
  };
}

