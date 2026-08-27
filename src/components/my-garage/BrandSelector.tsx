import React, { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  logo: string;
}

const MOCK_BRANDS: Brand[] = [
  { id: "audi", name: "Audi", logo: "https://logo.clearbit.com/audi.com" },
  { id: "bmw", name: "BMW", logo: "https://logo.clearbit.com/bmw.com" },
  { id: "byd", name: "BYD", logo: "https://logo.clearbit.com/byd.com" },
  { id: "fiat", name: "Fiat", logo: "https://logo.clearbit.com/fiat.com" },
  { id: "honda", name: "Honda", logo: "https://logo.clearbit.com/honda.com" },
  { id: "hyundai", name: "Hyundai", logo: "https://logo.clearbit.com/hyundai.com" },
  { id: "jeep", name: "Jeep", logo: "https://logo.clearbit.com/jeep.com" },
  { id: "kia", name: "Kia", logo: "https://logo.clearbit.com/kia.com" },
  { id: "mahindra", name: "Mahindra", logo: "https://logo.clearbit.com/mahindra.com" },
  { id: "suzuki", name: "Suzuki", logo: "https://logo.clearbit.com/globalsuzuki.com" },
  { id: "mercedes", name: "Mercedes", logo: "https://logo.clearbit.com/mercedes-benz.com" },
  { id: "nissan", name: "Nissan", logo: "https://logo.clearbit.com/nissan.com" },
  { id: "renault", name: "Renault", logo: "https://logo.clearbit.com/renault.com" },
  { id: "skoda", name: "Skoda", logo: "https://logo.clearbit.com/skoda-auto.com" },
  { id: "tata", name: "Tata", logo: "https://logo.clearbit.com/tatamotors.com" },
];

interface BrandSelectorProps {
  vehicleType: "bike" | "car";
  onSelect: (brandId: string) => void;
  onBack: () => void;
}

const BrandSelector: React.FC<BrandSelectorProps> = ({ vehicleType, onSelect, onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBrands = MOCK_BRANDS.filter((brand) =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#0a3a33]" />
          </button>
          <span className="font-bold text-lg text-[#0a3a33]">Select Brand</span>
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
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Section Title */}
        <h2 className="text-[#0a3a33] font-semibold text-lg mb-4">All Brands</h2>

        {/* Grid of Brands */}
        <div className="grid grid-cols-3 gap-3">
          {filteredBrands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => onSelect(brand.id)}
              className="flex items-center justify-center p-4 aspect-square border border-gray-100 rounded-2xl hover:border-[#73c354] hover:shadow-sm transition-all bg-white"
            >
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-full h-full object-contain max-h-[60px]"
                onError={(e) => {
                  // Fallback if logo fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = `<span class="text-sm font-semibold text-gray-600">${brand.name}</span>`;
                }}
              />
            </button>
          ))}
          {filteredBrands.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500">
              No brands found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandSelector;
