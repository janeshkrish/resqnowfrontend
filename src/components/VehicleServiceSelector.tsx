import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Car, Bike, Truck, Zap, ArrowRight, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getUserToken } from "@/lib/api";
import { getServiceCatalogItem } from "@/config/serviceCatalog";

const vehicleCategories = [
  {
    id: "car",
    name: "Cars",
    icon: Car,
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    description: "Sedan, Hatchback, SUV, MPV",
    subtypes: ["SUV", "Hatchback", "Sedan", "MPV", "Other Cars"]
  },
  {
    id: "bike",
    name: "Motorcycles & Bikes",
    icon: Bike,
    color: "bg-gradient-to-br from-orange-500 to-orange-600",
    description: "Sport, Cruiser, Commuter, Scooter",
    subtypes: ["Sport Bike", "Cruiser", "Commuter", "Scooter", "Other Bikes"]
  },
  {
    id: "commercial",
    name: "Commercial Vehicles",
    icon: Truck,
    color: "bg-gradient-to-br from-green-500 to-green-600",
    description: "Trucks, Vans, Buses",
    subtypes: ["Truck", "Van", "Bus", "Construction Vehicle", "Other Commercial"]
  },
  {
    id: "ev",
    name: "Electric Vehicles",
    icon: Zap,
    color: "bg-gradient-to-br from-purple-500 to-purple-600",
    description: "Electric Cars, E-Bikes, E-Scooters",
    subtypes: ["Electric Cars", "Electric Bikes", "Electric Scooters", "Electric Auto"]
  }
];

const VehicleServiceSelector = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const service = getServiceCatalogItem(serviceId);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);

    // Auto-advance on mobile for better UX
    if (isMobile) {
      setTimeout(() => {
        handleContinue(vehicleId);
      }, 300);
    }
  };

  const handleContinue = (overrideId?: string) => {
    const idToUse = overrideId || selectedVehicle;

    if (idToUse && serviceId) {
      const urlParams = new URLSearchParams(window.location.search);
      const techId = urlParams.get('techId');
      const techParam = techId ? `?techId=${techId}` : '';

      const targetUrl = `/request-service/${serviceId}/${idToUse}${techParam}`;

      // Prefer token check over a simple localStorage flag for robustness
      const token = getUserToken();
      if (!token) {
        // Store the intended destination
        sessionStorage.setItem('returnUrl', targetUrl);
        navigate('/login');
      } else {
        navigate(targetUrl, { state: { reset: true } });
      }
    }
  };

  return (
    <div className={cn(
      "min-h-screen bg-muted",
      isMobile ? "pt-6 pb-safe" : "bg-gradient-to-b from-background to-accent/10 py-4 md:py-8 pb-20 md:pb-8"
    )}>
      <div className={cn("container max-w-4xl", isMobile ? "px-0" : "px-3 md:px-4")}>
        <div className={cn(
          isMobile ? "text-left mb-6 px-5" : "text-center mb-6 md:mb-8"
        )}>
          <h1 className={cn(
            "font-black tracking-tight text-foreground mb-1",
            isMobile ? "text-2xl" : "text-2xl md:text-4xl mb-3 md:mb-4"
          )}>
            {isMobile ? "Choose Vehicle" : "Select Your Vehicle Type"}
          </h1>
          <p className={cn(
            "text-muted-foreground/80 font-medium",
            isMobile ? "text-sm" : "text-lg md:text-xl md:mb-2"
          )}>
            For <span className="text-primary font-bold">{service.name}</span>
          </p>
          {!isMobile && (
            <p className="text-muted-foreground text-sm md:text-base mt-2">
              {service.description}
            </p>
          )}
        </div>

        <div className={cn(
          isMobile
            ? "flex flex-col bg-card dark:bg-slate-900 border-y border-border/60 shadow-sm"
            : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8"
        )}>
          {vehicleCategories.map((category, idx) => (
            isMobile ? (
              // Premium MNC List Row for Mobile
              <div
                key={category.id}
                className={cn(
                  "relative flex items-center p-5 cursor-pointer active:bg-muted transition-colors duration-200",
                  idx !== vehicleCategories.length - 1 && "border-b border-border/60"
                )}
                onClick={() => handleVehicleSelect(category.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Icon with soft tinted background */}
                  <div className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-transform",
                    selectedVehicle === category.id ? category.color : "bg-muted/50 text-muted-foreground/80"
                  )}>
                    <category.icon className={cn("h-6 w-6", selectedVehicle === category.id ? "text-white" : "text-muted-foreground")} />
                  </div>

                  <div className="flex-1 pr-6">
                    <h3 className={cn(
                      "font-bold text-[15px] leading-tight mb-1 transition-colors",
                      selectedVehicle === category.id ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {category.name}
                    </h3>
                    <p className="text-[12px] text-muted-foreground/80 font-medium leading-snug line-clamp-1">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Selection indicator / Chevron */}
                <div className="absolute right-5">
                  {selectedVehicle === category.id ? (
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-in zoom-in spin-in-12 duration-300">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  )}
                </div>
              </div>
            ) : (
              // Original desktop card
              <Card
                key={category.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${selectedVehicle === category.id
                  ? 'ring-2 ring-primary bg-primary/5 scale-105'
                  : 'hover:bg-accent/50'
                  }`}
                onClick={() => handleVehicleSelect(category.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${category.color}`}>
                      <category.icon className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{category.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.subtypes.slice(0, 4).map((subtype) => (
                      <span
                        key={subtype}
                        className="text-xs bg-accent/50 px-2 py-1 rounded-full"
                      >
                        {subtype}
                      </span>
                    ))}
                    {category.subtypes.length > 4 && (
                      <span className="text-xs bg-accent/50 px-2 py-1 rounded-full">
                        +{category.subtypes.length - 4} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>

        {/* Desktop Continue Button (Hidden on Mobile) */}
        {!isMobile && (
          <div className="flex justify-center mt-8">
            <Button
              onClick={() => handleContinue()}
              disabled={!selectedVehicle}
              size="lg"
              className="px-8 py-6 text-lg"
            >
              Continue with {selectedVehicle ? vehicleCategories.find(v => v.id === selectedVehicle)?.name : 'Vehicle'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleServiceSelector;
