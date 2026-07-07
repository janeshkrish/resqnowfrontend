import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Car, Bike, Truck, Zap, ArrowRight, Check, ShieldCheck } from "lucide-react";
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

  return (
    <div className={cn(
      "min-h-[100dvh] relative overflow-hidden",
      isMobile ? "pt-8 pb-safe bg-slate-50 dark:bg-slate-950" : "bg-gradient-to-b from-background to-accent/10 py-4 md:py-8 pb-20 md:pb-8"
    )}>
      {/* Premium Decorative Background for Mobile */}
      {isMobile && (
        <div className="absolute top-0 inset-x-0 h-64 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[60px]"></div>
          <div className="absolute top-10 -left-24 w-64 h-64 bg-orange-500/10 rounded-full blur-[60px]"></div>
        </div>
      )}
      
      <div className={cn("container relative z-10 max-w-4xl", isMobile ? "px-4" : "px-3 md:px-4")}>
        <div className={cn(
          isMobile ? "text-left mb-8" : "text-center mb-6 md:mb-8"
        )}>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-full mb-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{service.name}</span>
          </div>
          <h1 className={cn(
            "font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white leading-tight",
            isMobile ? "text-[2rem]" : "text-2xl md:text-4xl mb-3 md:mb-4"
          )}>
            {isMobile ? "Choose Vehicle." : "Select Your Vehicle Type"}
          </h1>
          <p className={cn(
            "text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed max-w-[280px]",
            isMobile ? "text-[13px]" : "text-lg md:text-xl md:mb-2"
          )}>
            Select the type of vehicle that needs {service.name.toLowerCase()} assistance.
          </p>
        </div>

        <div className={cn(
          isMobile
            ? "flex flex-col gap-3"
            : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8"
        )}>
          {vehicleCategories.map((category, idx) => (
            isMobile ? (
              // Premium Gold Standard Detached Card for Mobile
              <div
                key={category.id}
                className={cn(
                  "relative flex items-center p-5 cursor-pointer transition-all duration-300 rounded-[1.25rem] bg-white dark:bg-slate-900 border",
                  selectedVehicle === category.id 
                    ? "border-primary shadow-[0_8px_24px_rgba(242,66,66,0.12)] ring-1 ring-primary scale-[1.02]"
                    : "border-slate-100 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:scale-[1.01] active:scale-[0.98]"
                )}
                onClick={() => handleVehicleSelect(category.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Ultra-Premium Glassmorphic Icon Container */}
                  <div className={cn(
                    "relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-[0_4px_10px_rgba(0,0,0,0.08)] border border-white/60 dark:border-slate-700/50 overflow-hidden isolate",
                    selectedVehicle === category.id ? "scale-110" : ""
                  )}>
                    {/* Background Gradient */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-90",
                      selectedVehicle === category.id ? "from-primary to-orange-500" : category.color
                    )}></div>
                    {/* Glass Highlight */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent"></div>
                    <category.icon className="h-[1.6rem] w-[1.6rem] relative z-10 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>

                  <div className="flex-1 pr-6">
                    <h3 className={cn(
                      "font-extrabold text-[15px] leading-tight mb-1 transition-colors tracking-tight",
                      selectedVehicle === category.id ? "text-primary" : "text-slate-800 dark:text-slate-100"
                    )}>
                      {category.name}
                    </h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-snug line-clamp-2 pr-2">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Selection indicator / Chevron */}
                <div className="absolute right-5">
                  {selectedVehicle === category.id ? (
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md animate-in zoom-in spin-in-12 duration-300">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
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

        {/* Premium Rapido-style Safety/Trust Banner for Mobile */}
        {isMobile && (
          <div className="mt-2 px-1">
            <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-4 flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 relative overflow-hidden isolate">
              {/* Subtle background glow */}
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/10 blur-[30px] rounded-full"></div>
              
              <div className="w-[3.25rem] h-[3.25rem] rounded-[1rem] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(16,185,129,0.25)] relative isolate overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"></div>
                <ShieldCheck className="h-6 w-6 text-white drop-shadow-sm relative z-10" strokeWidth={2.5} />
              </div>
              <div className="flex-1 relative z-10">
                <h4 className="font-extrabold text-[14px] text-slate-900 dark:text-white tracking-tight leading-tight mb-0.5">
                  ResQNow Promise
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-[1.3] font-medium pr-2">
                  Verified experts, highly secure payments, and 24/7 dedicated support.
                </p>
              </div>
            </div>
          </div>
        )}


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
