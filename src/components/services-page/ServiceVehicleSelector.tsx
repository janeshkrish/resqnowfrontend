import { useState } from "react";
import { MapPin, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { VehicleCategory } from "./types";
import { tamilNaduDistricts } from "@/types/technician-registration";
import EVVehicleSelector from "./EVVehicleSelector";

type ServiceVehicleSelectorProps = {
  vehicleCategories: VehicleCategory[];
  selectedVehicleType: string | null;
  selectedVehicleSubtype: string | null;
  serviceId: string;
  onVehicleTypeSelect: (type: string) => void;
  onVehicleSubtypeSelect: (subtype: string) => void;
};

const ServiceVehicleSelector = ({
  vehicleCategories,
  selectedVehicleType,
  selectedVehicleSubtype,
  serviceId,
  onVehicleTypeSelect,
  onVehicleSubtypeSelect,
}: ServiceVehicleSelectorProps) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedEVVehicle, setSelectedEVVehicle] = useState<any>(null);

  // Get the selected vehicle category
  const selectedVehicleCategory = selectedVehicleType
    ? vehicleCategories.find(c => c.id === selectedVehicleType)
    : null;

  // Make sure subtypes exist before trying to map over them
  const vehicleSubtypes = selectedVehicleCategory?.subtypes || [];

  // Handle EV charging service specially
  if (serviceId === "ev-charging") {
    return (
      <div className="mt-8 p-8 bg-gradient-to-br from-emerald-50 via-white to-blue-50 rounded-3xl shadow-xl border border-emerald-200/50 animate-fade-in relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/30 to-blue-200/30 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-blue-200/30 to-emerald-200/30 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-gray-800">EV Emergency Charging Service</h4>
              <p className="text-emerald-600 font-medium">Eco-friendly roadside assistance</p>
            </div>
          </div>

          <EVVehicleSelector
            onVehicleSelect={setSelectedEVVehicle}
            onRequestService={() => {
              // Navigate to service request with EV details
              window.location.href = `/request-service/${serviceId}?vehicle=${encodeURIComponent(JSON.stringify(selectedEVVehicle))}`;
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 p-8 bg-gradient-to-br from-white via-gray-50 to-red-50/30 rounded-3xl shadow-xl border border-gray-200/50 animate-fade-in relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-100/40 to-orange-100/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-3xl"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-gray-800">Select Vehicle & Details</h4>
            <p className="text-red-600 font-medium">Let us know how we can help you</p>
          </div>
        </div>
        <div className="space-y-8">
          {/* Vehicle Type Selection */}
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-800 mb-4">
              Choose Your Vehicle Type
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {vehicleCategories.slice(1).map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "group relative flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 hover-scale",
                    "hover:shadow-lg hover:-translate-y-1",
                    selectedVehicleType === category.id
                      ? "border-red-400 bg-gradient-to-br from-red-50 to-red-100 shadow-lg scale-105"
                      : "border-gray-200 bg-card dark:bg-slate-900 hover:border-red-200 hover:bg-red-50/50"
                  )}
                  onClick={() => onVehicleTypeSelect(category.id)}
                >
                  <div className={cn(
                    "p-4 rounded-xl mb-3 transition-all duration-300",
                    selectedVehicleType === category.id
                      ? "bg-gradient-to-br from-red-500 to-red-600 shadow-lg"
                      : "bg-gray-100 group-hover:bg-red-100"
                  )}>
                    <category.icon className={cn(
                      "h-8 w-8 transition-colors duration-300",
                      selectedVehicleType === category.id ? "text-white" : "text-gray-600 group-hover:text-red-600"
                    )} />
                  </div>
                  <span className={cn(
                    "text-sm font-semibold text-center transition-colors duration-300",
                    selectedVehicleType === category.id ? "text-red-700" : "text-gray-700 group-hover:text-red-600"
                  )}>
                    {category.name}
                  </span>
                  {/* Selection indicator */}
                  {selectedVehicleType === category.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <div className="w-2 h-2 bg-card dark:bg-slate-900 rounded-full"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Vehicle Subtype Selection */}
          {selectedVehicleType && (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-lg font-semibold text-gray-800">
                Vehicle Subtype
              </label>
              <Select onValueChange={onVehicleSubtypeSelect}>
                <SelectTrigger className="h-14 rounded-xl border-2 border-gray-200 hover:border-red-300 focus:border-red-400 bg-card dark:bg-slate-900 shadow-sm text-base">
                  <SelectValue placeholder="Select your specific vehicle type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-2 border-gray-200 shadow-xl bg-card dark:bg-slate-900/95 backdrop-blur-sm">
                  {vehicleSubtypes.map((subtype) => (
                    <SelectItem
                      key={subtype}
                      value={subtype}
                      className="py-3 px-4 text-base hover:bg-red-50 focus:bg-red-50 rounded-lg margin-1"
                    >
                      {subtype}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Form Fields */}
          {selectedVehicleSubtype && (
            <form className="space-y-6 animate-fade-in">
              {/* Location Section */}
              <div className="bg-card dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-sm">
                <h5 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-500" />
                  Location Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                    <Select onValueChange={setSelectedDistrict}>
                      <SelectTrigger className="h-12 rounded-xl border-2 border-gray-200 hover:border-red-300 focus:border-red-400">
                        <SelectValue placeholder="Select your district" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto rounded-xl shadow-xl">
                        {tamilNaduDistricts.map(district => (
                          <SelectItem key={district} value={district} className="py-2 hover:bg-red-50">
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Location</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter your current location"
                        className="h-12 rounded-xl border-2 border-gray-200 hover:border-red-300 focus:border-red-400"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50"
                      >
                        <MapPin className="h-5 w-5 text-red-500" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Click the location icon to use your current location</p>
                  </div>
                </div>
              </div>

              {/* Contact & Details Section */}
              <div className="bg-card dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-sm">
                <h5 className="text-lg font-semibold text-gray-800 mb-4">Contact & Additional Information</h5>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                    <Input
                      type="tel"
                      placeholder="Enter your contact number (+91)"
                      className="h-12 rounded-xl border-2 border-gray-200 hover:border-red-300 focus:border-red-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Information <span className="text-gray-400">(Optional)</span>
                    </label>
                    <Input
                      placeholder="Describe your situation or any special requirements"
                      className="h-12 rounded-xl border-2 border-gray-200 hover:border-red-300 focus:border-red-400"
                    />
                  </div>
                </div>
              </div>
              {/* Terms and Submit */}
              <div className="space-y-6">
                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-200/50">
                  <div className="flex items-start gap-3">
                    <Checkbox id="terms" className="mt-1" />
                    <div className="grid gap-2 leading-relaxed">
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        I agree to the terms and conditions
                      </label>
                      <p className="text-xs text-gray-600">
                        • Payment only after successful service completion<br />
                        • All prices are in ₹ (INR) and include applicable taxes<br />
                        • Emergency services available 24/7
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-14 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-700 hover:via-red-600 hover:to-orange-600 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 group"
                  asChild
                >
                  <Link to={`/request-service/${serviceId}`} className="flex items-center justify-center gap-3">
                    <span>Confirm Service Request</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceVehicleSelector;
