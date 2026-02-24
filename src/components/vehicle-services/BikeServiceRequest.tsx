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
                {currentStep > 1 && (
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
                  className={cn(
                    "flex-1 py-6 text-base font-bold rounded-xl shadow-lg shadow-primary/25",
                    "bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 transition-all",
                    currentStep === 1 ? "w-full" : ""
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : currentStep === 3 ? (
                    "Find Technician"
                  ) : (
                    <>
                      Continue <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BikeServiceRequest;
