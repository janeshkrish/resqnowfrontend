import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CategoryFilters from "@/components/services-page/CategoryFilters";
import ServiceCard from "@/components/services-page/ServiceCard";
import { services, vehicleCategories } from "@/components/services-page/ServicesData";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

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
    <div className="min-h-screen bg-[#FAFCFF] selection:bg-blue-100 selection:text-blue-900 font-sans pb-24">
      {/* Premium Hero Section for Services */}
      <div className="relative pt-24 pb-16 lg:pt-32 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-b from-blue-50/80 to-transparent blur-3xl" />
          <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-gradient-to-t from-indigo-50/60 to-transparent blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-7xl px-4 lg:px-8 text-center flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 shadow-sm mb-6"
          >
            <Sparkles className="h-3 w-3" />
            On-Demand Assistance
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none mb-6"
          >
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Enterprise Services</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg lg:text-xl font-medium text-slate-600 max-w-[600px]"
          >
            A comprehensive suite of emergency recovery and mobility solutions, dispatched algorithmically in under 45 minutes.
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-4 lg:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 mb-10 sticky top-24 z-30">
            <CategoryFilters
              categories={vehicleCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredServices.map((service, index) => (
            <motion.div 
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="group"
            >
              <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.15)] transition-all duration-300 hover:-translate-y-1 h-full overflow-hidden flex flex-col">
                <ServiceCard
                  service={service}
                  onServiceClick={handleServiceClick}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default ServicesPage;
