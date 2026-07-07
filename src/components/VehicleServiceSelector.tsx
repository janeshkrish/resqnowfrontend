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
    // Removed auto-advance to allow users to see the premium selection state and explicitly confirm, matching global app UX.
  };

  const handleContinue = (overrideId?: string) => {
    const idToUse = overrideId || selectedVehicle;

    if (idToUse && serviceId) {
      const urlParams = new URLSearchParams(window.location.search);
      const techId = urlParams.get('techId');
      const techParam = techId ? `?techId=${techId}` : '';

      const targetUrl = `/request-service/${serviceId}/${idToUse}${techParam}`;

      const token = getUserToken();
      if (!token) {
        sessionStorage.setItem('returnUrl', targetUrl);
        navigate('/login');
      } else {
        navigate(targetUrl, { state: { reset: true } });
      }
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[#F3F4F6] relative overflow-hidden font-sans">
        {/* Premium Top Area - Minimalist Radar Concept */}
        <div className="flex-1 relative bg-[#F3F4F6] overflow-hidden min-h-[45dvh]">
          {/* Subtle Dot Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#d1d5db_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60"></div>
          
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F3F4F6]"></div>

          {/* High-end Radar/Pin */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-[280px] h-[280px] bg-blue-500/5 rounded-full animate-ping [animation-duration:4s]"></div>
              <div className="absolute w-[200px] h-[200px] border border-blue-500/15 rounded-full"></div>
              <div className="absolute w-[120px] h-[120px] border border-blue-500/20 rounded-full"></div>
              {/* Premium Pin */}
              <div className="relative z-10 w-12 h-12 bg-slate-900 rounded-full shadow-2xl flex items-center justify-center">
                 <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="mt-8 bg-white/90 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-sm border border-white">
              <span className="text-[11px] font-bold text-slate-800 tracking-[0.15em] flex items-center gap-2.5">
                 <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                 FINDING TECHNICIANS
              </span>
            </div>
          </div>
        </div>

        {/* Ultra-Premium Bottom Sheet */}
        <div className="bg-white rounded-t-[2rem] shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.08)] px-5 pt-3 pb-8 relative z-20 -mt-12 flex flex-col">
          {/* Minimal Drag Handle */}
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
          
          <div className="mb-5 px-1">
            <h1 className="font-bold text-[1.65rem] text-slate-900 tracking-tight mb-1">Choose a vehicle</h1>
            <p className="text-[14px] text-slate-500 font-medium">For {service.name.toLowerCase()} assistance</p>
          </div>

          <div className="flex flex-col gap-1.5 pb-6">
            {vehicleCategories.map((category) => {
              const isSelected = selectedVehicle === category.id;
              
              // Mock ETA for premium feel
              const eta = category.id === 'car' ? '12 min' : category.id === 'bike' ? '8 min' : category.id === 'commercial' ? '20 min' : '15 min';

              return (
                <div
                  key={category.id}
                  className={cn(
                    "group relative flex items-center p-3.5 rounded-[1.25rem] cursor-pointer transition-all duration-200",
                    isSelected ? "bg-slate-50 border-[1.5px] border-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)]" : "border-[1.5px] border-transparent hover:bg-slate-50/50"
                  )}
                  onClick={() => handleVehicleSelect(category.id)}
                >
                  {/* Icon Container */}
                  <div className={cn(
                    "flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 transition-colors",
                    isSelected ? "bg-slate-900 text-white" : "bg-[#F3F4F6] text-slate-600 group-hover:bg-slate-200"
                  )}>
                    <category.icon 
                      className="w-7 h-7" 
                      strokeWidth={1.5} 
                    />
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={cn(
                        "font-bold text-[16px] truncate tracking-tight",
                        isSelected ? "text-slate-900" : "text-slate-800"
                      )}>
                        {category.name}
                      </h3>
                      {/* Premium ETA Badge */}
                      <span className="text-[13px] font-semibold text-slate-600">{eta}</span>
                    </div>
                    <p className="text-[13px] text-slate-500 truncate leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Floating Action Button for selection */}
          <div className="mt-1 px-1">
             <Button
                onClick={() => handleContinue()}
                disabled={!selectedVehicle}
                className="w-full h-14 rounded-[1.25rem] bg-slate-900 text-white font-bold text-[16px] hover:bg-slate-800 transition-all disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 shadow-md"
             >
                Confirm {selectedVehicle ? vehicleCategories.find(v => v.id === selectedVehicle)?.name : ''}
             </Button>
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
