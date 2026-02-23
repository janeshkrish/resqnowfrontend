
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ServiceRequestFormData, VehicleType } from "./types";
import { Car, Bike, Truck, ChevronDown } from "lucide-react";
import { getCarBrands, getBikeBrands, getCommercialBrands, getEVBrands, getBrandModels, VehicleBrand } from "../../data/indianVehicles";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { Vehicle } from "../MyGarage";
import { getBrandLogoSrc, handleBrandLogoError } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

const vehicleTypes: VehicleType[] = [
  {
    id: "car",
    name: "Cars",
    icon: Car,
    subtypes: ["SUV", "Hatchback", "Sedan", "MPV", "Other Cars"]
  },
  {
    id: "bike",
    name: "Motorcycles/Bikes",
    icon: Bike,
    subtypes: ["Sport Bike", "Cruiser", "Commuter", "Scooter", "Other Bikes"]
  },
  {
    id: "commercial",
    name: "Commercial Vehicles",
    icon: Truck,
    subtypes: ["Truck", "Van", "Bus", "Construction Vehicle", "Other Commercial"]
  },
  {
    id: "ev",
    name: "Electric Vehicles",
    icon: Car,
    subtypes: ["Electric Cars", "Electric Bikes", "Electric Scooters", "Electric Auto"]
  },
];

interface VehicleInfoStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVehicleTypeSelect: (type: string) => void;
  onVehicleSubtypeSelect: (subtype: string) => void;
  onGarageVehicleSelected?: () => void;
  hideCategorySelection?: boolean;
}

interface ExtendedFormData extends ServiceRequestFormData {
  vehicleBrand?: string;
}

const VehicleInfoStep = ({
  formData,
  onInputChange,
  onVehicleTypeSelect,
  onVehicleSubtypeSelect,
  onGarageVehicleSelected,
  hideCategorySelection = false
}: VehicleInfoStepProps) => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [availableBrands, setAvailableBrands] = useState<VehicleBrand[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load brands when component mounts if vehicleType is already set
  useEffect(() => {
    if (formData.vehicleType && availableBrands.length === 0) {
      if (formData.vehicleType === "car") {
        setAvailableBrands(getCarBrands());
      } else if (formData.vehicleType === "bike") {
        setAvailableBrands(getBikeBrands());
      } else if (formData.vehicleType === "commercial") {
        setAvailableBrands(getCommercialBrands());
      } else if (formData.vehicleType === "ev") {
        setAvailableBrands(getEVBrands());
      }
    }
  }, [formData.vehicleType, availableBrands.length]);

  const handleVehicleTypeChange = (type: string) => {
    onVehicleTypeSelect(type);
    setSelectedBrand("");
    setAvailableModels([]);
    // Set available brands based on vehicle type
    if (type === "car") {
      setAvailableBrands(getCarBrands());
    } else if (type === "bike") {
      setAvailableBrands(getBikeBrands());
    } else if (type === "commercial") {
      setAvailableBrands(getCommercialBrands());
    } else if (type === "ev") {
      setAvailableBrands(getEVBrands());
    }
  };

  const handleBrandChange = (brandId: string) => {
    setSelectedBrand(brandId);
    const models = getBrandModels(brandId);
    setAvailableModels(models);
    // Clear the selected model when brand changes
    const event = {
      target: { name: 'vehicleModel', value: '' }
    } as React.ChangeEvent<HTMLInputElement>;
    onInputChange(event);
  };

  const handleModelChange = (model: string) => {
    const event = {
      target: { name: 'vehicleModel', value: model }
    } as React.ChangeEvent<HTMLInputElement>;
    onInputChange(event);
  };

  const { user } = useAuth();
  const [garageVehicles, setGarageVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (user?.id) {
      apiFetch(`/api/vehicles`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setGarageVehicles(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [user]);

  const handleGarageSelect = (vehicleId: string) => {
    const vehicle = garageVehicles.find(v => v.id.toString() === vehicleId);
    if (vehicle) {
      const selectedType = hideCategorySelection ? formData.vehicleType : vehicle.type;
      onVehicleTypeSelect(selectedType);

      const modelString = `${vehicle.make} ${vehicle.model}`;
      const event = {
        target: { name: 'vehicleModel', value: modelString }
      } as React.ChangeEvent<HTMLInputElement>;
      onInputChange(event);

      // Auto-select a generic subtype to satisfy validation
      let defaultSubtype = "";
      if (selectedType === "car") defaultSubtype = "Other Cars";
      else if (selectedType === "bike") defaultSubtype = "Other Bikes";
      else if (selectedType === "ev") defaultSubtype = "Electric Cars";
      else defaultSubtype = "Other Commercial";

      onVehicleSubtypeSelect(defaultSubtype);

      setSelectedBrand("");
      setAvailableModels([]);

      // Notify parent to proceed if callback provided
      if (onGarageVehicleSelected) {
        onGarageVehicleSelected();
      }
    }
  };



  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-1 tracking-tight">Vehicle Details</h3>
        <p className="text-sm font-medium text-slate-500">Tell us about your vehicle for personalized service</p>
      </div>

      {garageVehicles.length > 0 && (
        <Card className="p-4 border-slate-200 bg-white shadow-sm rounded-2xl mb-6">
          <Label className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-2 block">Quick Select from Garage</Label>
          <Select onValueChange={handleGarageSelect}>
            <SelectTrigger className="bg-white border-primary/20">
              <SelectValue placeholder="Choose a saved vehicle..." />
            </SelectTrigger>
            <SelectContent>
              {garageVehicles
                .filter((v) => !hideCategorySelection || !formData.vehicleType || v.type === formData.vehicleType)
                .map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.make} {v.model} ({v.type})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      <div className="space-y-6">
        {/* Mobile First: Hide category selection if already defined (which it is for specific routes) */}
        {!hideCategorySelection && (
          <div className="space-y-4">
            <Label className="text-xs uppercase font-bold tracking-widest text-slate-400">Select Vehicle Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vehicleTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-3 p-5 transition-all duration-300 active:scale-95 border",
                    formData.vehicleType === type.id
                      ? "bg-blue-50/50 border-blue-600 shadow-md shadow-blue-600/10 rounded-[1.5rem]"
                      : "bg-white border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md rounded-[1.5rem]"
                  )}
                  onClick={() => handleVehicleTypeChange(type.id)}
                >
                  <div className={cn(
                    "p-3.5 rounded-2xl transition-all duration-300",
                    formData.vehicleType === type.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600"
                  )}>
                    <type.icon className="h-7 w-7" strokeWidth={formData.vehicleType === type.id ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-xs md:text-sm font-bold text-center transition-colors duration-300",
                    formData.vehicleType === type.id ? "text-blue-700" : "text-slate-600"
                  )}>
                    {type.name}
                  </span>
                  {formData.vehicleType === type.id && (
                    <div className="absolute top-3 right-3 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {formData.vehicleType && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            <div className="space-y-4">
              <Label className="text-xs uppercase font-bold tracking-widest text-slate-400">Body Type</Label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {vehicleTypes.find(t => t.id === formData.vehicleType)?.subtypes.map((subtype) => (
                  <button
                    key={subtype}
                    type="button"
                    className={cn(
                      "flex items-center justify-center p-3.5 rounded-2xl border transition-all duration-300 active:scale-95",
                      formData.vehicleSubtype === subtype
                        ? "border-blue-600 bg-blue-50/50 shadow-sm text-blue-700 font-bold"
                        : "border-slate-100 bg-white shadow-sm hover:border-blue-200 text-slate-600 font-semibold"
                    )}
                    onClick={() => onVehicleSubtypeSelect(subtype)}
                  >
                    <span className="text-sm">
                      {subtype}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {formData.vehicleSubtype && (
              <div className="space-y-4 animate-in fade-in-50 duration-500">
                <div className="p-5 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm space-y-4">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase font-bold tracking-widest text-slate-400">Make & Model</Label>
                    <div className="grid grid-cols-1 gap-4">
                      {/* Brand Selection */}
                      <div className="relative">
                        <Select onValueChange={handleBrandChange} value={selectedBrand}>
                          <SelectTrigger className="h-14 rounded-2xl border-slate-200 hover:border-blue-300 focus:border-blue-500 bg-slate-50/50 pl-4 font-bold text-slate-800 shadow-sm">
                            <SelectValue placeholder="Select Brand (e.g. Toyota)" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-200 shadow-xl max-h-[300px]">
                            {availableBrands.map((brand) => (
                              <SelectItem key={brand.id} value={brand.id} className="py-3 px-4 focus:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                                    <img
                                      src={getBrandLogoSrc(brand.logo)}
                                      alt={brand.name}
                                      className="w-5 h-5 object-contain"
                                      onError={handleBrandLogoError}
                                    />
                                  </div>
                                  <span className="font-bold text-slate-700">{brand.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Model Selection */}
                      {selectedBrand && (
                        <div className="relative animate-in slide-in-from-top-2 duration-300">
                          <Select onValueChange={handleModelChange} value={formData.vehicleModel}>
                            <SelectTrigger className="h-14 rounded-2xl border-slate-200 hover:border-blue-300 focus:border-blue-500 bg-slate-50/50 pl-4 font-bold text-slate-800 shadow-sm">
                              <SelectValue placeholder="Select Model (e.g. Fortuner)" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-200 shadow-xl max-h-[300px]">
                              {availableModels.map((model) => (
                                <SelectItem key={model} value={model} className="py-3 px-4 focus:bg-slate-50 cursor-pointer">
                                  <span className="font-bold text-slate-700 text-base">{model}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleInfoStep;
