import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CategoryFilters from "@/components/services-page/CategoryFilters";
import ServiceCard from "@/components/services-page/ServiceCard";
import { services, vehicleCategories } from "@/components/services-page/ServicesData";

const ServicesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const handleServiceClick = (serviceId: string) => {
    navigate(`/request-service/${serviceId}`);
  };

  const filteredServices = selectedCategory === "all"
    ? services
    : services.filter(service => true);

  return (
    <div className="min-h-screen bg-slate-50 fade-in-0 animate-in duration-300 pb-20">
      <div className="bg-white pt-12 pb-6 px-4 rounded-b-[2rem] shadow-sm border-b border-slate-100 flex flex-col items-center text-center">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Explore Services</h1>
        <p className="text-sm font-semibold text-slate-500 max-w-[280px]">
          Fast, reliable roadside assistance services available 24/7.
        </p>
      </div>

      <div className="px-4 mt-6">
        <CategoryFilters
          categories={vehicleCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <div className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgba(15,23,42,0.04)] border border-slate-100 overflow-hidden mb-8 mt-2">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onServiceClick={handleServiceClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;
