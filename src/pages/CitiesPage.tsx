import React from "react";
import { motion } from "framer-motion";
import { Wrench, Route } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    className={className}
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-40px" }}
    transition={{ delay }}
  >
    {children}
  </motion.div>
);

const CitiesPage = () => {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 font-sans flex flex-col pt-24">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8 relative z-10 text-center mb-12">
        <Reveal>
          <div className="w-20 h-20 mx-auto bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <div className="relative">
              <Wrench size={32} className="text-slate-400" />
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                <Route size={16} className="text-blue-600" />
              </div>
            </div>
          </div>
          <h1 className="text-5xl lg:text-[4rem] font-black tracking-tight text-slate-900 mb-6 leading-tight">
            Initial Service Area
          </h1>
          <p className="text-xl lg:text-2xl text-slate-500 font-medium max-w-2xl mx-auto">
            Coimbatore City to Start, Expansion to Tamil Nadu next
          </p>
        </Reveal>
      </div>

      <div className="relative w-full mt-auto h-[500px] lg:h-[700px] flex-grow">
        {/* SVG Wavy Top Divider */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] z-20">
          <svg
            className="relative block w-[calc(130%+1.3px)] h-[120px] lg:h-[200px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C60.29,48.24,142.13,91.43,214.4,96.65,249.77,99.2,285.58,85.2,321.39,56.44Z"
              className="fill-white"
            ></path>
          </svg>
        </div>

        {/* Map Background */}
        <div className="absolute inset-0 bg-slate-100 z-10 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Coimbatore Map Concept" 
            className="w-full h-full object-cover opacity-60 mix-blend-multiply filter contrast-125 grayscale-[30%] object-center"
          />
          <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay" />
          
          {/* Coimbatore Marker */}
          <motion.div 
            className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className="bg-white/90 backdrop-blur-md px-8 py-4 rounded-3xl shadow-2xl border border-white flex flex-col items-center mb-6">
              <span className="text-3xl font-black text-slate-900 tracking-tight">Coimbatore</span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-2">HQ / Phase 1 Grid</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.8)] border-[6px] border-white z-10 relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75 duration-1000" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CitiesPage;
