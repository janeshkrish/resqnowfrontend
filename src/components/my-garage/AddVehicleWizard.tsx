import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import VehicleTypeSelector from "./VehicleTypeSelector";
import BrandSelector from "./BrandSelector";
import ModelSelector from "./ModelSelector";
import { toast } from "sonner";

type WizardStep = "type" | "brand" | "model";

const AddVehicleWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("type");
  const [vehicleType, setVehicleType] = useState<"bike" | "car" | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  const handleTypeSelect = (type: "bike" | "car") => {
    setVehicleType(type);
    setStep("brand");
  };

  const handleBrandSelect = (id: string) => {
    setBrandId(id);
    setStep("model");
  };

  const handleModelSelect = (modelId: string) => {
    // In a real application, you would save this to the user's profile/backend here.
    toast.success("Vehicle added successfully!");
    // For now, redirect back to the home screen or garage dashboard
    navigate("/");
  };

  const handleBack = () => {
    if (step === "type") {
      navigate(-1);
    } else if (step === "brand") {
      setStep("type");
      setVehicleType(null);
    } else if (step === "model") {
      setStep("brand");
      setBrandId(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white shadow-sm min-h-screen relative overflow-hidden">
      {step === "type" && (
        <VehicleTypeSelector onSelect={handleTypeSelect} onBack={handleBack} />
      )}
      
      {step === "brand" && vehicleType && (
        <BrandSelector 
          vehicleType={vehicleType} 
          onSelect={handleBrandSelect} 
          onBack={handleBack} 
        />
      )}
      
      {step === "model" && vehicleType && brandId && (
        <ModelSelector 
          vehicleType={vehicleType} 
          brandId={brandId} 
          onSelect={handleModelSelect} 
          onBack={handleBack} 
        />
      )}
    </div>
  );
};

export default AddVehicleWizard;
