
import { Car, Bike, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const vehicleTypes = [
  {
    id: "car",
    name: "Cars",
    icon: Car,
    color: "bg-gradient-to-r from-blue-500 to-blue-600",
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
    <section className="py-16 bg-white">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Vehicles We Service
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Comprehensive roadside assistance for all vehicle types
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
                "bg-white transition-all duration-300",
                isMobile
                  ? "flex flex-col items-center text-center p-2 rounded-xl border border-gray-100 shadow-sm"
                  : "rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:border-primary/20 hover:-translate-y-2"
              )}
              onMouseEnter={() => setHoveredType(type.id)}
              onMouseLeave={() => setHoveredType(null)}
            >
              {isMobile ? (
                // Mobile View
                <>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                    "bg-gray-50 text-primary" // Simple background
                  )}>
                    <type.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[11px] font-bold text-gray-800 leading-tight">
                    {type.name}
                  </h3>
                </>
              ) : (
                // Desktop View
                <div className="p-8">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 mb-6 shadow-lg">
                      <type.icon className={`h-10 w-10 transition-colors duration-300 ${hoveredType === type.id ? 'text-primary' : 'text-gray-600'}`} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">{type.name}</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">{type.description}</p>

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-4 text-lg">Includes:</h4>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {type.subtypes.map((subtype) => (
                          <span
                            key={subtype}
                            className={`text-sm px-3 py-2 rounded-full font-medium transition-all duration-300 ${hoveredType === type.id
                              ? 'bg-primary text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
