import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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

interface ServicePricing {
  [serviceId: string]: {
    [vehicleType: string]: {
      [subService: string]: string;
    };
  };
}

interface ServicePricingStepProps {
  selectedServices: string[];
  selectedVehicleTypes: string[];
  pricing: ServicePricing;
  onChange: (pricing: ServicePricing) => void;
  errors: Record<string, string>;
  showErrors: boolean;
}

const VEHICLE_TYPE_LABELS: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  car: { label: "Car", icon: Car },
  bike: { label: "Bike", icon: Bike },
  commercial: { label: "Commercial", icon: Bus },
};

const SERVICE_PRICING_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    subServices: { id: string; label: string; unit?: string }[];
  }
> = {
  mechanical: {
    label: "Mechanical Services",
    icon: Wrench,
    subServices: [
      { id: "general", label: "General Service" },
      { id: "breakdown", label: "Breakdown Repair" },
      { id: "engine", label: "Engine Repair" },
      { id: "ac", label: "AC Repair" },
      { id: "electrical", label: "Electrical Work" },
      { id: "diagnostics", label: "Diagnostics" },
    ],
  },
  battery: {
    label: "Battery Jumpstart",
    icon: Battery,
    subServices: [
      { id: "jumpstart", label: "Jumpstart Service" },
      { id: "replacement", label: "Battery Replacement" },
      { id: "testing", label: "Battery Testing" },
    ],
  },
  fuel: {
    label: "Fuel Delivery",
    icon: Fuel,
    subServices: [
      { id: "petrol", label: "Petrol Delivery", unit: "/liter" },
      { id: "diesel", label: "Diesel Delivery", unit: "/liter" },
      { id: "deliveryCharge", label: "Delivery Charge" },
    ],
  },
  lockout: {
    label: "Lockout Assistance",
    icon: Key,
    subServices: [
      { id: "unlocking", label: "Door Unlocking" },
      { id: "keyMaking", label: "Key Making" },
      { id: "keyDuplication", label: "Key Duplication" },
    ],
  },
  tire: {
    label: "Flat Tire Repair",
    icon: CircleDot,
    subServices: [
      { id: "puncture", label: "Puncture Repair" },
      { id: "tireChange", label: "Tire Change" },
      { id: "tubelessRepair", label: "Tubeless Repair" },
      { id: "wheelBalancing", label: "Wheel Balancing" },
    ],
  },
  ev: {
    label: "EV Portable Charger",
    icon: Zap,
    subServices: [
      { id: "charging", label: "On-site Charging", unit: "/kWh" },
      { id: "evDiagnostics", label: "EV Diagnostics" },
      { id: "chargerSetup", label: "Charger Setup Fee" },
    ],
  },
  winching: {
    label: "Winching Services",
    icon: Anchor,
    subServices: [
      { id: "basicWinch", label: "Basic Winching" },
      { id: "mudRecovery", label: "Mud/Ditch Recovery" },
      { id: "accidentRecovery", label: "Accident Recovery" },
    ],
  },
  towing: {
    label: "Towing Services",
    icon: Truck,
    subServices: [
      { id: "baseCharge", label: "Base Charge" },
      { id: "perKm", label: "Per Kilometer", unit: "/km" },
      { id: "flatbed", label: "Flatbed Towing" },
    ],
  },
};

export function ServicePricingStep({
  selectedServices,
  selectedVehicleTypes,
  pricing,
  onChange,
  errors,
  showErrors,
}: ServicePricingStepProps) {
  const handlePriceChange = (
    serviceId: string,
    vehicleType: string,
    subServiceId: string,
    value: string
  ) => {
    const newPricing = {
      ...pricing,
      [serviceId]: {
        ...pricing[serviceId],
        [vehicleType]: {
          ...pricing[serviceId]?.[vehicleType],
          [subServiceId]: value,
        },
      },
    };
    onChange(newPricing);
  };

  const activeServices = selectedServices.filter(
    (service) => SERVICE_PRICING_CONFIG[service]
  );

  if (activeServices.length === 0) {
    return (
      <Card className="border-2 border-primary/10">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">No Services Selected</h3>
          <p className="text-muted-foreground">
            Please go back to Step 2 and select at least one service to set
            pricing.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedVehicleTypes.length === 0) {
    return (
      <Card className="border-2 border-primary/10">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">
            No Vehicle Types Selected
          </h3>
          <p className="text-muted-foreground">
            Please go back to Step 2 and select at least one vehicle type.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Service Pricing
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set your prices for each selected service and vehicle type
            </p>
          </div>

          {showErrors && errors.pricing && (
            <p className="text-sm text-destructive">{errors.pricing}</p>
          )}

          <div className="space-y-8">
            {activeServices.map((serviceId) => {
              const service = SERVICE_PRICING_CONFIG[serviceId];
              if (!service) return null;
              const Icon = service.icon;

              return (
                <div key={serviceId} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h4 className="font-medium">{service.label}</h4>
                    <div className="flex gap-2 ml-2">
                      {selectedVehicleTypes.map((vt) => {
                        const vtConfig = VEHICLE_TYPE_LABELS[vt];
                        const VtIcon = vtConfig?.icon || Car;
                        return (
                          <span
                            key={vt}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                          >
                            <VtIcon className="h-3 w-3" />
                            {vtConfig?.label || vt}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">
                            Service Type
                          </th>
                          {selectedVehicleTypes.map((vt) => {
                            const vtConfig = VEHICLE_TYPE_LABELS[vt];
                            return (
                              <th
                                key={vt}
                                className="text-left py-2 px-3 font-medium"
                              >
                                {vtConfig?.label || vt}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {service.subServices.map((subService) => (
                          <tr key={subService.id} className="border-b">
                            <td className="py-2 px-3">
                              <Label className="font-normal">
                                {subService.label}
                                {subService.unit && (
                                  <span className="text-muted-foreground ml-1">
                                    ({subService.unit})
                                  </span>
                                )}
                              </Label>
                            </td>
                            {selectedVehicleTypes.map((vt) => (
                              <td key={vt} className="py-2 px-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">₹</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={
                                      pricing[serviceId]?.[vt]?.[subService.id] ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      handlePriceChange(
                                        serviceId,
                                        vt,
                                        subService.id,
                                        e.target.value
                                      )
                                    }
                                    className="w-24 h-8"
                                  />
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="mt-0.5">ℹ</span>
            <span>
              Prices are base rates and may vary based on location and
              complexity. Leave fields empty if you don&apos;t offer that specific
              service for a vehicle type.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
