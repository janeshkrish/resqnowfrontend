import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CategoryFilters from "@/components/services-page/CategoryFilters";
import { services, vehicleCategories } from "@/components/services-page/ServicesData";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const ServicesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [hoveredService, setHoveredService] = useState<string | null>(null);

  const handleServiceClick = (serviceId: string) => {
    navigate(`/request-service/${serviceId}`);
  };

  const filteredServices = selectedCategory === "all"
    ? services
    : services.filter(service => true); // Assume logic handles it or it's just dummy in this demo

  return (
    <div className="min-h-screen bg-[#FAFCFF] selection:bg-blue-100 selection:text-blue-900 font-sans pb-32">
      {/* MNC Grade Enterprise Hero */}
      <div className="relative pt-28 pb-20 lg:pt-40 lg:pb-32 overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,rgba(255,255,255,0)_70%)] blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.05)_0%,rgba(255,255,255,0)_70%)] blur-3xl translate-y-1/2 -translate-x-1/4" />
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-60" />
        </div>

        <div className="container relative mx-auto max-w-7xl px-4 lg:px-8 text-center flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 backdrop-blur-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.05)] mb-8"
          >
            <Sparkles className="h-3 w-3 text-blue-600" />
            Enterprise Services
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-8"
          >
            Intelligent Infrastructure <br className="hidden lg:block"/>
            for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Mobility Recovery</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg lg:text-2xl font-medium text-slate-600 max-w-3xl leading-relaxed"
          >
            A comprehensive suite of emergency recovery and mobility solutions, dispatched algorithmically in under 45 minutes to eradicate operational latency.
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 lg:px-8 mt-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-30 mb-16"
        >
          <div className="bg-white/70 backdrop-blur-2xl rounded-3xl p-4 lg:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.04)] border border-white/80 max-w-fit mx-auto">
            <CategoryFilters
              categories={vehicleCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </motion.div>

        <motion.div 
          layout
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence>
            {filteredServices.map((service, index) => (
              <motion.div 
                key={service.id}
                layout
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95 }}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="group h-full"
                onMouseEnter={() => setHoveredService(service.id)}
                onMouseLeave={() => setHoveredService(null)}
              >
                <div 
                  className="relative bg-white/60 backdrop-blur-xl border border-slate-100 rounded-[2.5rem] p-8 h-full flex flex-col cursor-pointer transition-all duration-500 overflow-hidden hover:bg-white hover:border-blue-100 hover:shadow-[0_40px_80px_-20px_rgba(37,99,235,0.12)]"
                  onClick={() => handleServiceClick(service.id)}
                >
                  {/* Glassmorphic Glow Effect */}
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 transition-opacity duration-500 ${hoveredService === service.id ? 'opacity-100' : 'opacity-0'}`} />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Icon Container with Vector Art Feel */}
                    <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-[inset_0_2px_10px_rgba(255,255,255,1),0_10px_20px_rgba(15,23,42,0.03)] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:shadow-[inset_0_2px_10px_rgba(255,255,255,1),0_15px_30px_rgba(37,99,235,0.1)] transition-all duration-500">
                      <service.icon size={36} strokeWidth={1.5} className="text-blue-600 transition-colors duration-500 group-hover:text-indigo-600" />
                    </div>

                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4 group-hover:text-blue-700 transition-colors duration-300">
                      {service.name}
                    </h3>
                    
                    <p className="text-slate-600 font-medium leading-relaxed mb-8 flex-grow line-clamp-3">
                      {service.description}
                    </p>

                    <div className="flex items-center text-sm font-bold text-blue-600 mt-auto opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                      <span>Initialize Request</span>
                      <ArrowRight size={16} className="ml-2" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default ServicesPage;
