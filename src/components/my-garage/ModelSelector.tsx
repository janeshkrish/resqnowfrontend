import React, { useState, useMemo } from "react";
import { ChevronLeft, Search } from "lucide-react";

interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  image: string;
}

// A mix of mock car and bike models to demonstrate the UI
const MOCK_MODELS: VehicleModel[] = [
  // BMW Cars
  { id: "m-3series", brandId: "bmw", name: "3 Series", image: "https://images.unsplash.com/photo-1555096531-1823bb35ce98?q=80&w=300&auto=format&fit=crop" },
  { id: "m-5series", brandId: "bmw", name: "5 Series", image: "https://images.unsplash.com/photo-1616422285623-aa309c0f3317?q=80&w=300&auto=format&fit=crop" },
  { id: "m-7series", brandId: "bmw", name: "7 Series", image: "https://images.unsplash.com/photo-1523983388277-336a66bf9bcd?q=80&w=300&auto=format&fit=crop" },
  { id: "m-i4", brandId: "bmw", name: "i4", image: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?q=80&w=300&auto=format&fit=crop" },
  { id: "m-ix", brandId: "bmw", name: "iX", image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=300&auto=format&fit=crop" },
  { id: "m-x1", brandId: "bmw", name: "X1", image: "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?q=80&w=300&auto=format&fit=crop" },
  { id: "m-x3", brandId: "bmw", name: "X3", image: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?q=80&w=300&auto=format&fit=crop" },
  
  // Generic Cars
  { id: "m-dzire", brandId: "suzuki", name: "Swift Dzire", image: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=300&auto=format&fit=crop" },
  
  // Bikes
  { id: "m-rs457", brandId: "aprilia", name: "RS 457", image: "https://images.unsplash.com/photo-1558981403-c5f9899ba92c?q=80&w=300&auto=format&fit=crop" },
  { id: "m-sr125", brandId: "aprilia", name: "Sr 125", image: "https://images.unsplash.com/photo-1566008885218-90abf9200dd9?q=80&w=300&auto=format&fit=crop" },
  { id: "m-sr160", brandId: "aprilia", name: "Sr 160", image: "https://images.unsplash.com/photo-1590485641775-60c78a3c8e54?q=80&w=300&auto=format&fit=crop" },
];

// Fallback models if a brand has none in our mock data
const FALLBACK_MODELS = [
  { id: "f-1", name: "Standard Model", image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=300&auto=format&fit=crop" },
  { id: "f-2", name: "Premium Model", image: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=300&auto=format&fit=crop" },
  { id: "f-3", name: "Sport Model", image: "https://images.unsplash.com/photo-1503376713915-d91244199c00?q=80&w=300&auto=format&fit=crop" },
];

interface ModelSelectorProps {
  vehicleType: "bike" | "car";
  brandId: string;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ vehicleType, brandId, onSelect, onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const brandModels = useMemo(() => {
    let models = MOCK_MODELS.filter(m => m.brandId === brandId);
    if (models.length === 0) {
      models = FALLBACK_MODELS.map(m => ({ ...m, brandId }));
    }
    return models;
  }, [brandId]);

  const filteredModels = brandModels.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#0a3a33]" />
          </button>
          <span className="font-bold text-lg text-[#0a3a33]">Select Model</span>
        </div>
        <button className="bg-[#e6f7ef] text-[#0a3a33] px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 hover:bg-[#d5f0e3] transition-colors">
          <Search className="w-3.5 h-3.5" />
          Can't find vehicle?
        </button>
      </div>

      <div className="p-4 flex-1">
        {/* Search Input */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-[#f5f5f5] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#73c354] transition-all"
            placeholder={vehicleType === "car" ? "Search (e.g. Swift Dzire)" : "Search (e.g. Jupiter)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Section Title */}
        <h2 className="text-[#0a3a33] font-semibold text-lg mb-4">All Models</h2>

        {/* Grid of Models */}
        <div className="grid grid-cols-3 gap-3">
          {filteredModels.map((model) => (
            <button
              key={model.id}
              onClick={() => onSelect(model.id)}
              className="flex flex-col items-center p-3 border border-gray-100 rounded-2xl hover:border-[#73c354] hover:shadow-sm transition-all bg-white"
            >
              <div className="w-full aspect-square bg-[#e2e3e5] rounded-xl flex items-center justify-center overflow-hidden mb-2 relative">
                <img
                  src={model.image}
                  alt={model.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-gray-800 text-center w-full truncate">
                {model.name}
              </span>
            </button>
          ))}
          {filteredModels.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500">
              No models found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
