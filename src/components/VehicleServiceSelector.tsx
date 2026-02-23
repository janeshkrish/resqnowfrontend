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
      "min-h-screen bg-gradient-to-b from-background to-accent/10",
      isMobile ? "py-3 pb-safe" : "py-4 md:py-8 pb-20 md:pb-8"
    )}>
      <div className={cn("container max-w-4xl", isMobile ? "px-3" : "px-3 md:px-4")}>
        <div className={cn(
          isMobile ? "text-left mb-5" : "text-center mb-6 md:mb-8"
        )}>
          <h1 className={cn(
            "font-bold mb-2",
            isMobile ? "text-xl" : "text-2xl md:text-4xl mb-3 md:mb-4"
          )}>
            {isMobile ? "Choose Vehicle" : "Select Your Vehicle Type"}
          </h1>
          <p className={cn(
            "text-muted-foreground mb-1",
            isMobile ? "text-sm" : "text-lg md:text-xl mb-2"
          )}>
            For <span className="text-primary font-semibold">{service.name}</span>
          </p>
          <p className={cn(
            "text-muted-foreground",
            isMobile ? "text-xs" : "text-sm md:text-base"
          )}>
            {service.description}
          </p>
        </div>

        <div className={cn(
          isMobile
            ? "flex flex-col gap-3 mb-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8"
        )}>
          {vehicleCategories.map((category) => (
            isMobile ? (
              // Swiggy/Zomato style card for mobile
              <div
                key={category.id}
                className={cn(
                  "relative bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border cursor-pointer active:scale-95 transition-all duration-200",
                  selectedVehicle === category.id
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-gray-100/50'
                )}
                onClick={() => handleVehicleSelect(category.id)}
              >
                {/* Selected Check Mark */}
                {selectedVehicle === category.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-in zoom-in">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className={`flex-shrink-0 p-3 rounded-xl ${category.color}`}>
                    <category.icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-base mb-1">
                      {category.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Subtypes Pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {category.subtypes.slice(0, 3).map((subtype) => (
                    <span
                      key={subtype}
                      className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-medium"
                    >
                      {subtype}
                    </span>
                  ))}
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
