import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnifiedServiceRequestFlow } from "@/hooks/useUnifiedServiceRequestFlow";

import { Button } from "../ui/button";
import { SlideButton } from "../ui/slide-button";
import VehicleInfoStep from "../service-request/VehicleInfoStep";
import LocationStep from "../service-request/LocationStep";
import PersonalInfoStep from "../service-request/PersonalInfoStep";
import ProgressStepper from "../service-request/ProgressStepper";
import { ServiceRequestFormData } from "../service-request/types";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CarServiceRequest = () => {
  const { serviceId } = useParams();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const STORAGE_KEY = `resqnow_service_request_${serviceId}_car`;
  const steps = [
    { id: 1, name: "Vehicle Details", description: "" },
    { id: 2, name: "Location", description: "" },
    { id: 3, name: "Contact Info", description: "" }
  ];

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
    handleDropLocationSelect,
    handleGetCurrentDropLocation,
    requiresDropLocation,
    towingEstimate,
    isEstimatingTowing,
    towingEstimateError,
    towingEstimateWarning,
    canProceed,
    submitRequest,
    handleNext,
    handleBack
  } = useUnifiedServiceRequestFlow({
    serviceId,
    vehicleType: "car",
    storageKey: STORAGE_KEY,
    resetRequested: !!(location.state as any)?.reset,
    user,
    updateProfile,
    navigate,
    createInitialFormData: (techId) => ({
      vehicleType: "car",
      vehicleSubtype: "",
      vehicleModel: "",
      location: "",
      locationLat: 0,
      locationLng: 0,
      dropLocation: "",
      dropLat: 0,
      dropLng: 0,
      name: "",
      phone: "",
      email: "",
      details: "",
      selectedTechnicianId: techId || null
    }),
    validateStep1: (data) => !!(data.vehicleType && data.vehicleSubtype && data.vehicleModel),
    buildVehicleModel: (data) => `${data.vehicleSubtype} - ${data.vehicleModel}`,
    successTitle: "Request Broadcasted!",
    successDescription: "Searching for nearby technicians...",
    allowDirectTechnician: false
  });

  const handleVehicleTypeSelect = (type: string) => {
    setFormData((prev: ServiceRequestFormData) => ({ ...prev, vehicleType: type }));
  };

  const handleVehicleSubtypeSelect = (subtype: string) => {
    setFormData((prev: ServiceRequestFormData) => ({ ...prev, vehicleSubtype: subtype }));
  };

  return (
    <div className={cn("min-h-screen bg-[#F5F7FA]", isMobile ? "pb-24" : "py-8 pb-8")}>
      <div className={cn("mx-auto transition-all duration-300", isMobile ? "w-full px-0" : "container px-4 max-w-4xl")}>
        <div className={cn("bg-white transition-all duration-300", isMobile ? "min-h-screen shadow-none rounded-none" : "rounded-[2rem] shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)] border border-slate-100 overflow-hidden")}>
          <div className={cn(isMobile ? "border-b border-slate-100 bg-white" : "border-b border-slate-100 bg-white")}>
            <ProgressStepper currentStep={currentStep} steps={steps} />
          </div>

          <div className={cn(isMobile ? (currentStep === 1 ? "pt-2 pb-8" : "px-5 pt-5 pb-8") : "px-8 py-6")}>
            {currentStep === 1 && (
              <VehicleInfoStep
                formData={formData}
                onInputChange={handleInputChange}
                onVehicleTypeSelect={handleVehicleTypeSelect}
                onVehicleSubtypeSelect={handleVehicleSubtypeSelect}
                onGarageVehicleSelected={handleNext}
                hideCategorySelection={true}
              />
            )}

            {currentStep === 2 && (
              <LocationStep
                formData={formData}
                onInputChange={handleInputChange}
                currentLocation={currentLocation}
                isGettingLocation={loadingGeo}
                onGetCurrentLocation={handleGetCurrentLocation}
                onLocationSelect={handleLocationSelect}
                requiresDropLocation={requiresDropLocation}
                onDropLocationSelect={handleDropLocationSelect}
                onGetCurrentDropLocation={handleGetCurrentDropLocation}
                towingEstimate={towingEstimate}
                isEstimatingTowing={isEstimatingTowing}
                towingEstimateError={towingEstimateError}
                towingEstimateWarning={towingEstimateWarning}
              />
            )}

            {currentStep === 3 && (
              <PersonalInfoStep
                formData={formData}
                onInputChange={handleInputChange}
              />
            )}
          </div>

          {currentStep <= 3 && (
            <div className={cn(
              "fixed bottom-0 left-0 right-0 z-[100] border-t border-slate-100 bg-white/96 px-5 pt-3 shadow-[0_-14px_34px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]",
              isMobile ? "translate-y-0" : "md:relative md:border-none md:bg-transparent md:shadow-none md:backdrop-blur-0 md:p-0 md:mt-6 md:translate-y-0"
            )}>
              <div className="flex gap-3 max-w-4xl mx-auto">
                {currentStep === 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="h-14 flex-1 rounded-[1.2rem] border-slate-200 bg-white text-base font-semibold text-[#0B1F3A] shadow-none"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                {currentStep === 3 ? (
                  <div className="flex-1">
                    <SlideButton
                      onSlideComplete={() => {
                        if (!canProceed()) {
                          toast.error("Please complete your contact info");
                          return;
                        }
                        submitRequest();
                      }}
                      text="Slide to Find Technician"
                      isSubmitting={isSubmitting}
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!canProceed()) {
                        if (currentStep === 1) toast.error("Please complete vehicle details first");
                        else if (currentStep === 2) toast.error(requiresDropLocation ? "Please complete pickup, drop, and fare estimate" : "Please provide your location");
                        return;
                      }
                      handleNext();
                    }}
                    disabled={isSubmitting}
                    className={cn(
                      "h-14 flex-1 rounded-[1.2rem] text-base font-bold shadow-[0_24px_40px_-24px_rgba(229,57,53,0.65)]",
                      "bg-gradient-to-r from-primary via-[#EF4444] to-[#FF3B30] hover:brightness-105 transition-all",
                      currentStep === 1 ? "w-full" : ""
                    )}
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarServiceRequest;

