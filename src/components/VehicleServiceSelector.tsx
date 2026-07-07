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
    color: "bg-gradient-to-br from-red-500 to-red-600",
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

  if (isMobile) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-100 relative overflow-hidden">
        {/* Map Header Area */}
        <div className="flex-1 relative bg-[#f8f9fa] overflow-hidden min-h-[40dvh]">
          {/* Subtle grid to simulate a map surface */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e130_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e130_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          
          {/* Decorative radar/map circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] border border-slate-200/60 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14rem] h-[14rem] border border-slate-200/80 rounded-full bg-white/30 backdrop-blur-[2px]"></div>
          
          {/* Mock Location Pin */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 mt-[-10px]">
            <div className="w-16 h-16 bg-primary/20 rounded-full animate-ping absolute -inset-4"></div>
            <div className="w-8 h-8 bg-primary rounded-full border-[3px] border-white shadow-lg flex items-center justify-center relative">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
            <div className="w-0.5 h-6 bg-gradient-to-b from-primary/80 to-transparent mx-auto"></div>
          </div>
        </div>

        {/* Bottom Sheet selection UI */}
        <div className="bg-white rounded-t-[1.75rem] shadow-[0_-12px_40px_rgba(0,0,0,0.06)] px-6 pt-4 pb-safe relative z-20 -mt-8">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
          
          <div className="mb-6">
            <h1 className="font-extrabold text-[1.65rem] text-slate-900 tracking-[-0.03em] leading-tight mb-1">Choose Vehicle</h1>
            <p className="text-[13px] text-slate-500 font-medium">For <span className="font-bold text-slate-700">{service.name}</span> assistance.</p>
          </div>

          <div className="flex flex-col pb-4">
            {vehicleCategories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  "relative flex items-center py-4 border-b border-slate-100 last:border-0 cursor-pointer transition-all duration-300",
                  selectedVehicle === category.id ? "opacity-100" : "opacity-50 hover:opacity-100"
                )}
                onClick={() => handleVehicleSelect(category.id)}
              >
                {/* Ultra minimal icon without generic background boxes */}
                <div className="flex-shrink-0 w-12 flex justify-start mr-2">
                  <category.icon 
                    className={cn(
                      "w-8 h-8 transition-transform duration-300", 
                      selectedVehicle === category.id ? "text-primary scale-110" : "text-slate-800"
                    )} 
                    strokeWidth={1.5} 
                  />
                </div>

                <div className="flex-1 pr-6">
                  <h3 className={cn(
                    "font-bold text-[16px] leading-tight mb-0.5 tracking-tight transition-colors duration-300",
                    selectedVehicle === category.id ? "text-primary" : "text-slate-900"
                  )}>
                    {category.name}
                  </h3>
                  <p className="text-[13px] text-slate-500 font-medium line-clamp-1">
                    {category.description}
                  </p>
                </div>

                <div className="absolute right-0">
                  {selectedVehicle === category.id && (
                    <Check className="w-5 h-5 text-primary animate-in zoom-in spin-in-12 duration-300" strokeWidth={3} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 py-4 md:py-8 pb-20 md:pb-8">
      <div className="container max-w-4xl px-3 md:px-4">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white leading-tight text-2xl md:text-4xl mb-3 md:mb-4">
            Select Your Vehicle Type
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed text-lg md:text-xl md:mb-2">
            Select the type of vehicle that needs {service.name.toLowerCase()} assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {vehicleCategories.map((category) => (
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
          ))}
        </div>

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
      </div>
    </div>
  );
};

export default VehicleServiceSelector;
