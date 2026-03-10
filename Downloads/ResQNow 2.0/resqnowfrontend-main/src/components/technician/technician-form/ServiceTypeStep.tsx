import React from "react";
import { Label } from "@/components/ui/label";
import {
  Wrench,
  Battery,
  Fuel,
  Key,
  CircleDot,
  Zap,
  Anchor,
  Truck,
  Car,
  Bike,
  Bus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceTypeData {
  services: string[];
  vehicleTypes: string[];
}

interface ServiceTypeStepProps {
  data: ServiceTypeData;
  onChange: (data: ServiceTypeData) => void;
  errors: Record<string, string>;
  showErrors: boolean;
}

const SERVICES = [
  {
    id: "mechanical",
    label: "Mechanical Issues",
    icon: Wrench,
    description: "General repairs & diagnostics",
  },
  {
    id: "battery",
    label: "Battery Jumpstart",
    icon: Battery,
    description: "Dead battery assistance",
  },
  {
    id: "fuel",
    label: "Fuel Delivery",
    icon: Fuel,
    description: "Emergency fuel service",
  },
  {
    id: "lockout",
    label: "Lockout Assistance",
    icon: Key,
    description: "Vehicle lockout help",
  },
  {
    id: "tire",
    label: "Flat Tire Repair",
    icon: CircleDot,
    description: "Tire change & repair",
  },
  {
    id: "ev",
    label: "EV Portable Charger",
    icon: Zap,
    description: "Electric vehicle charging",
  },
  {
    id: "winching",
    label: "Winching",
    icon: Anchor,
    description: "Vehicle recovery",
  },
  {
    id: "towing",
    label: "Towing",
    icon: Truck,
    description: "Vehicle towing service",
  },
];

const VEHICLE_TYPES = [
  {
    id: "car",
    label: "Car",
    icon: Car,
    description: "Sedans, SUVs, Hatchbacks",
  },
  {
    id: "bike",
    label: "Bike",
    icon: Bike,
    description: "Motorcycles & Scooters",
  },
  {
    id: "commercial",
    label: "Commercial Vehicle",
    icon: Bus,
    description: "Trucks, Buses, Vans",
  },
];

export function ServiceTypeStep({
  data,
  onChange,
  errors,
  showErrors,
}: ServiceTypeStepProps) {
  const toggleService = (serviceId: string) => {
    const newServices = data.services.includes(serviceId)
      ? data.services.filter((s) => s !== serviceId)
      : [...data.services, serviceId];
    onChange({ ...data, services: newServices });
  };

  const toggleVehicleType = (typeId: string) => {
    const newTypes = data.vehicleTypes.includes(typeId)
      ? data.vehicleTypes.filter((t) => t !== typeId)
      : [...data.vehicleTypes, typeId];
    onChange({ ...data, vehicleTypes: newTypes });
  };

  return (
    <div className="space-y-8">
      {/* Services Section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Services You Offer *
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select all services you can provide
          </p>
        </div>
        {showErrors && errors.services && (
          <p className="text-sm text-destructive mb-2">{errors.services}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SERVICES.map((service) => {
            const isSelected = data.services.includes(service.id);
            const Icon = service.icon;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                className={cn(
                  "relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
                  showErrors &&
                    errors.services &&
                    !isSelected &&
                    "border-destructive/30"
                )}
              >
                <Icon className="h-8 w-8 mb-2 text-primary" />
                <span className="font-medium text-sm">{service.label}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {service.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vehicle Types Section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Types You Handle *
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select the types of vehicles you service
          </p>
        </div>
        {showErrors && errors.vehicleTypes && (
          <p className="text-sm text-destructive mb-2">
            {errors.vehicleTypes}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VEHICLE_TYPES.map((type) => {
            const isSelected = data.vehicleTypes.includes(type.id);
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleVehicleType(type.id)}
                className={cn(
                  "relative flex flex-col items-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
                  showErrors &&
                    errors.vehicleTypes &&
                    !isSelected &&
                    "border-destructive/30"
                )}
              >
                <Icon className="h-10 w-10 mb-2 text-primary" />
                <span className="font-medium">{type.label}</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {type.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
