import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VehicleTypeSelectorProps {
  onSelect: (type: "bike" | "car") => void;
  onBack?: () => void;
}

const VehicleTypeSelector: React.FC<VehicleTypeSelectorProps> = ({ onSelect, onBack }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-4 border-b border-gray-100">
        <button onClick={onBack || (() => navigate(-1))} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-[#0a3a33]" />
        </button>
        <span className="font-semibold text-lg text-[#0a3a33]">Add Vehicle</span>
      </div>

      <div className="flex-1 p-6 flex flex-col">
        {/* Title Section */}
        <div className="mb-8 mt-2">
          <h1 className="text-4xl font-bold text-[#0a3a33] leading-tight mb-3">
            Choose Your <br />
            <span className="text-[#73c354]">Vehicle</span> Type
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            You Can Add More Vehicles From The Home Screen
          </p>
        </div>

        {/* Vehicle Options */}
        <div className="flex flex-col gap-5 mt-4">
          {/* Bike Card */}
          <button
            onClick={() => onSelect("bike")}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-2xl hover:border-[#73c354] hover:shadow-md transition-all group bg-white text-left overflow-hidden relative min-h-[160px]"
          >
            <div className="w-1/2 relative z-10 flex items-center justify-center h-full">
               {/* Placeholder for Bike Illustration */}
               <img 
                  src="https://images.unsplash.com/photo-1558981403-c5f9899ba92c?q=80&w=600&auto=format&fit=crop" 
                  alt="Bike" 
                  className="w-full h-[120px] object-cover rounded-xl"
               />
            </div>
            <div className="w-1/2 flex flex-col items-end justify-center pr-4 relative z-10 gap-1">
              <span className="text-sm font-bold text-gray-800">I have</span>
              <span className="text-3xl font-bold text-[#73c354] tracking-wide">BIKE</span>
            </div>
          </button>

          {/* Car Card */}
          <button
            onClick={() => onSelect("car")}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-2xl hover:border-[#73c354] hover:shadow-md transition-all group bg-white text-left overflow-hidden relative min-h-[160px]"
          >
            <div className="w-1/2 relative z-10 flex items-center justify-center h-full">
               {/* Placeholder for Car Illustration */}
               <img 
                  src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=600&auto=format&fit=crop" 
                  alt="Car" 
                  className="w-full h-[120px] object-cover rounded-xl"
               />
            </div>
            <div className="w-1/2 flex flex-col items-end justify-center pr-4 relative z-10 gap-1">
              <span className="text-sm font-bold text-gray-800">I have</span>
              <span className="text-3xl font-bold text-[#73c354] tracking-wide">CAR</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleTypeSelector;
