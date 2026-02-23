import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Truck, Bike, Zap, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VehicleOption {
  id: string;
  name: string;
  icon: React.ElementType;
  gradient: string;
  description: string;
}

interface ModernVehicleSelectorProps {
  onVehicleSelect: (vehicleType: string) => void;
  selectedVehicle?: string;
}

const vehicleOptions: VehicleOption[] = [
  {
    id: "car",
    name: "Car / SUV",
    icon: Car,
    gradient: "from-blue-500 to-blue-600",
    description: "Personal vehicles, sedans, hatchbacks"
  },
  {
    id: "bike",
    name: "Motorcycle",
    icon: Bike,
    gradient: "from-orange-500 to-red-500",
    description: "Bikes, scooters, motorcycles"
  },
  {
    id: "commercial",
    name: "Commercial",
    icon: Truck,
    gradient: "from-green-500 to-green-600",
    description: "Trucks, vans, commercial vehicles"
  },
  {
    id: "ev",
    name: "Electric Vehicle",
    icon: Zap,
    gradient: "from-purple-500 to-pink-500",
    description: "Electric cars, e-bikes, hybrids"
  }
];

const ModernVehicleSelector = ({ onVehicleSelect, selectedVehicle }: ModernVehicleSelectorProps) => {
  const [hoveredVehicle, setHoveredVehicle] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Select Your Vehicle Type</h2>
        <p className="text-gray-600">Choose the vehicle category that matches your needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicleOptions.map((vehicle, index) => {
          const Icon = vehicle.icon;
          const isSelected = selectedVehicle === vehicle.id;
          const isHovered = hoveredVehicle === vehicle.id;

          return (
            <motion.div
              key={vehicle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <motion.button
                className={cn(
                  "w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left relative overflow-hidden group",
                  isSelected
                    ? "border-red-400 bg-red-50 shadow-lg"
                    : "border-gray-200 bg-white hover:border-red-200 hover:shadow-md"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onHoverStart={() => setHoveredVehicle(vehicle.id)}
                onHoverEnd={() => setHoveredVehicle(null)}
                onClick={() => onVehicleSelect(vehicle.id)}
              >
                {/* Background gradient overlay */}
                <div
                  className={cn(
                    "absolute inset-0 opacity-0 transition-opacity duration-300",
                    `bg-gradient-to-br ${vehicle.gradient}`,
                    (isSelected || isHovered) && "opacity-5"
                  )}
                />

                {/* Content */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-xl transition-all duration-300",
                      isSelected
                        ? `bg-gradient-to-br ${vehicle.gradient} text-white shadow-lg`
                        : "bg-gray-100 text-gray-600 group-hover:bg-red-100 group-hover:text-red-600"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn(
                        "font-semibold text-lg transition-colors",
                        isSelected ? "text-red-700" : "text-gray-800"
                      )}>
                        {vehicle.name}
                      </h3>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-green-500"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{vehicle.description}</p>
                  </div>

                  <motion.div
                    className={cn(
                      "opacity-0 transition-opacity duration-300",
                      (isSelected || isHovered) && "opacity-100"
                    )}
                  >
                    <ArrowRight className="h-5 w-5 text-red-500" />
                  </motion.div>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    className="absolute top-2 right-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  </motion.div>
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {selectedVehicle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Vehicle type selected! You can now proceed with your service request.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ModernVehicleSelector;