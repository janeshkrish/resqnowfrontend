import { useEffect, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { ServiceRequestFormData } from "@/components/service-request/types";
import { apiFetch } from "@/lib/api";
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
    if (!coordinates || !address) return;
    setCurrentLocation(address);
    setFormData((prev) => ({
      ...prev,
      location: address,
      locationLat: coordinates.lat,
      locationLng: coordinates.lng
    }));
  }, [coordinates, address]);

  useEffect(() => {
    if (geoError) {
      toast.error(geoError);
    }
  }, [geoError]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, locationLat: lat, locationLng: lng }));
  };

  const handleGetCurrentLocation = () => {
    requestLocation();
  };

  const geocodeAddress = async (addressText: string) => {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return null;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      }
      return null;
    } catch {
      return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return validateStep1(formData);
    }
    if (currentStep === 2) {
      return !!formData.location;
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

      const payload = {
        service_type: `${vehicleType}-${serviceId}`,
        vehicle_type: vehicleType,
        vehicle_model: buildVehicleModel(formData),
        address: formData.location,
        description,
        contact_phone: formData.phone,
        contact_email: formData.email,
        contact_name: formData.name,
        technician_id: allowDirectTechnician ? (techId || formData.selectedTechnicianId || null) : null,
        location_lat: formData.locationLat || null,
        location_lng: formData.locationLng || null
      };

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
      if (currentStep === 2 && formData.location && (!formData.locationLat || !formData.locationLng)) {
        const coords = await geocodeAddress(formData.location);
        if (coords) {
          setFormData((prev) => ({
            ...prev,
            locationLat: coords.lat,
            locationLng: coords.lng
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

  return {
    formData,
    setFormData,
    currentStep,
    setCurrentStep,
    currentLocation,
    isSubmitting,
    loadingGeo,
    handleInputChange,
    handleLocationSelect,
    handleGetCurrentLocation,
    canProceed,
    submitRequest,
    handleNext,
    handleBack
  };
}

