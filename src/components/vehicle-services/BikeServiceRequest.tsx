import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUnifiedServiceRequestFlow } from "@/hooks/useUnifiedServiceRequestFlow";
import { Button } from "../ui/button";
import LocationStep from "../service-request/LocationStep";
import PersonalInfoStep from "../service-request/PersonalInfoStep";
import ProgressStepper from "../service-request/ProgressStepper";
import VehicleInfoStep from "../service-request/VehicleInfoStep";
import { ServiceRequestFormData } from "../service-request/types";
import { Loader2, Bike, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getServiceCatalogItem, getServicePriceForVehicle } from "@/config/serviceCatalog";
import { usePricingConfig } from "@/hooks/usePricingConfig";

const BikeServiceRequest = () => {
  const { serviceId } = useParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const STORAGE_KEY = `resqnow_service_request_${serviceId}_bike`;

  const {
    formData,
    setFormData,
    currentStep,
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
  } = useUnifiedServiceRequestFlow({
    serviceId,
    vehicleType: "bike",
    storageKey: STORAGE_KEY,
    resetRequested: !!(location.state as any)?.reset,
    user,
    navigate,
    createInitialFormData: (techId) => ({
      vehicleType: "bike",
      vehicleSubtype: "",
      vehicleModel: "",
      location: "",
      locationLat: 0,
      locationLng: 0,
      name: "",
      phone: "",
      email: "",
      details: "",
      selectedTechnicianId: techId || null
    }),
    validateStep1: (data) => !!(data.vehicleSubtype && data.vehicleModel),
    buildVehicleModel: (data) => `${data.vehicleSubtype} - ${data.vehicleModel}`,
    successTitle: "Request Broadcasted!",
    successDescription: "Searching for nearby technicians...",
    allowDirectTechnician: false
  });

  const steps = [
    { id: 1, name: "Vehicle Info", description: "Your Two-Wheeler" },
    { id: 2, name: "Location", description: "Where are you?" },
    { id: 3, name: "Contact Info", description: "How to reach you" }
  ];

  const handleVehicleSubtypeSelect = (subtype: string) => {
    setFormData((prev: ServiceRequestFormData) => ({ ...prev, vehicleSubtype: subtype }));
  };

  const handleVehicleTypeSelect = (type: string) => {
    setFormData((prev: ServiceRequestFormData) => ({ ...prev, vehicleType: type, vehicleSubtype: "", vehicleModel: "" }));
  };

  const serviceInfo = getServiceCatalogItem(serviceId);
  const { data: pricingConfig } = usePricingConfig();
  const servicePrice = getServicePriceForVehicle(
    serviceId,
    "bike",
    pricingConfig?.service_base_prices,
    pricingConfig?.currency || "INR"
  );

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-orange-50 to-amber-50", isMobile ? "py-3 pb-safe" : "py-4 md:py-8 pb-24 md:pb-8")}>
      <div className={cn("container mx-auto max-w-4xl", isMobile ? "px-3" : "px-3 md:px-4")}>
        <Button variant="ghost" onClick={() => navigate("/")} className={cn("mb-4", isMobile && "px-2")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>

        <div className={cn("bg-white border border-orange-100", isMobile ? "rounded-2xl shadow-lg p-4" : "rounded-3xl shadow-2xl p-4 md:p-12")}>
          <div className={cn(isMobile ? "text-left mb-5" : "text-center mb-8")}>
            <div className={cn("inline-flex items-center justify-center p-3 bg-orange-100 rounded-full", isMobile ? "mb-3" : "mb-4")}>
              <Bike className={cn(isMobile ? "h-6 w-6" : "h-8 w-8", "text-orange-600")} />
            </div>
            <h1 className={cn(isMobile ? "text-xl" : "text-2xl md:text-3xl", "font-bold text-gray-800")}>{serviceInfo.name}</h1>
            <p className={cn("text-gray-500 mt-2", isMobile && "text-sm")}>Est. Price: {servicePrice}</p>
          </div>

          <ProgressStepper currentStep={currentStep} steps={steps} />

          <>
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <VehicleInfoStep
                  formData={formData}
                  onInputChange={handleInputChange}
                  onVehicleTypeSelect={handleVehicleTypeSelect}
                  onVehicleSubtypeSelect={handleVehicleSubtypeSelect}
                  hideCategorySelection={true}
                />
              </div>
            )}

            {currentStep === 2 && (
              <LocationStep
                formData={formData}
                onInputChange={handleInputChange}
                currentLocation={currentLocation}
                isGettingLocation={loadingGeo}
                onGetCurrentLocation={handleGetCurrentLocation}
                onLocationSelect={handleLocationSelect}
              />
            )}

            {currentStep === 3 && (
              <PersonalInfoStep formData={formData} onInputChange={handleInputChange} />
            )}

            {currentStep <= 3 && (
              <div className={cn("mt-8", isMobile ? "sticky bottom-3 z-20 bg-white/95 backdrop-blur rounded-xl border border-orange-100 p-3 shadow-lg space-y-2" : "flex gap-3")}>
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} className={cn("flex-1 py-6 text-base font-semibold", isMobile && "w-full py-3")}>
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (!canProceed()) {
                      if (currentStep === 1) toast.error("Please complete vehicle details first");
                      else if (currentStep === 2) toast.error("Please provide your location");
                      else toast.error("Please complete your contact info");
                      return;
                    }
                    if (currentStep === 3) submitRequest();
                    else handleNext();
                  }}
                  disabled={isSubmitting}
                  className={cn("flex-1 py-6 text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white", isMobile && "w-full py-3")}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : currentStep === 3 ? (
                    "Request Service"
                  ) : (
                    <>
                      Continue <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        </div>
      </div>
    </div>
  );
};

export default BikeServiceRequest;
