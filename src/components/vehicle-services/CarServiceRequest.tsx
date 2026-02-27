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
import { Loader2, ArrowLeft, ChevronRight } from "lucide-react";
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
    { id: 1, name: "Vehicle", description: "Details" },
    { id: 2, name: "Location", description: "Pinpoint" },
    { id: 3, name: "Confirm", description: "Review" }
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
    <div className={cn("min-h-screen bg-background", isMobile ? "pb-16" : "py-8 pb-8")}>
      <div className={cn("mx-auto transition-all duration-300", isMobile ? "w-full px-0" : "container px-4 max-w-4xl")}>
        <div className={cn("bg-card transition-all duration-300", isMobile ? "min-h-screen shadow-none rounded-none" : "rounded-3xl shadow-xl border border-border p-8")}>
          <div className={cn(isMobile ? "sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border" : "")}>
            <ProgressStepper currentStep={currentStep} steps={steps} />
          </div>

          <div className={cn(isMobile ? "px-4 pt-4 pb-8" : "mt-6")}>
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
              "fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-[100] transition-transform duration-300 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] pb-[max(1rem,env(safe-area-inset-bottom))]",
              isMobile ? "translate-y-0 text-center" : "md:relative md:border-none md:shadow-none md:p-0 md:mt-8 md:translate-y-0"
            )}>
              <div className="flex gap-3 max-w-4xl mx-auto">
                {currentStep === 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 py-6 text-base font-semibold rounded-xl border-2"
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
                        else if (currentStep === 2) toast.error("Please provide your location");
                        return;
                      }
                      handleNext();
                    }}
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 py-6 text-base font-bold rounded-xl shadow-lg shadow-primary/25",
                      "bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 transition-all",
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

