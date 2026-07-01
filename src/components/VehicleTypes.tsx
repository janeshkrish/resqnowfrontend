
import { Car, Bike, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const vehicleTypes = [
  {
    id: "car",
    name: "Cars",
    icon: Car,
    color: "bg-gradient-to-r from-red-500 to-red-600",
    description: "Service for all types of cars including SUVs, hatchbacks, sedans, and MPVs.",
    subtypes: ["SUV", "Hatchback", "Sedan", "MPV", "Other Cars"]
  },
  {
    id: "bike",
    name: "Bikes",
    icon: Bike,
    color: "bg-gradient-to-r from-green-500 to-green-600",
    description: "Assistance for all types of motorcycles and scooters.",
    subtypes: ["Sport Bike", "Cruiser", "Commuter", "Scooter", "Other Bikes"]
  },
  {
    id: "commercial",
    name: "Commercial Vehicles",
    icon: Truck,
    color: "bg-gradient-to-r from-orange-500 to-orange-600",
    description: "Support for trucks, vans, buses, and other commercial vehicles.",
    subtypes: ["Truck", "Van", "Bus", "Construction Vehicle", "Other Commercial"]
  },
];

const VehicleTypes = () => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const isMobile = useIsMobile();


  return (
    <section>
      <div className="container px-4">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-full mb-6 border border-red-100 dark:border-red-500/20">
             <Car className="w-4 h-4 text-red-600 dark:text-red-400" />
             <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Supported Vehicles</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground mb-4 tracking-tight leading-tight">
            We Service <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-600">Every Vehicle</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium">
            From two-wheelers to heavy commercial trucks, our partners are equipped to handle it all.
          </p>
        </div>

        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3 lg:gap-8"
        )}>
          {vehicleTypes.map((type) => (
            <div
              key={type.id}
              className={cn(
                "group relative bg-white dark:bg-card transition-all duration-300",
                isMobile
                  ? "flex flex-col items-center text-center p-2 rounded-xl border border-border shadow-sm"
                  : "rounded-[2rem] border border-slate-100 dark:border-slate-800/60 overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2 hover:border-transparent dark:hover:border-transparent"
              )}
              onMouseEnter={() => setHoveredType(type.id)}
              onMouseLeave={() => setHoveredType(null)}
            >
              {isMobile ? (
                // Mobile View
                <>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                    "bg-muted text-primary" // Simple background
                  )}>
                    <type.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[11px] font-bold text-foreground leading-tight">
                    {type.name}
                  </h3>
                </>
              ) : (
                // Desktop View (MNC Standard)
                <div className="p-8 h-full flex flex-col">
                  {/* Subtle hover gradient background */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 ${type.color}`}></div>
                  
                  <div className="text-center relative z-10 flex-1 flex flex-col">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mb-8 mx-auto transition-transform duration-500 group-hover:scale-110 shadow-sm`}>
                      <type.icon className={`h-10 w-10 transition-colors duration-300 ${hoveredType === type.id ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`} />
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 group-hover:text-primary transition-colors">{type.name}</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium flex-1">{type.description}</p>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 text-sm uppercase tracking-wider">Common Types Covered</h4>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {type.subtypes.map((subtype) => (
                          <span
                            key={subtype}
                            className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all duration-300 ${hoveredType === type.id
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                          >
                            {subtype}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VehicleTypes;
