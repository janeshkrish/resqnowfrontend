import React from 'react';
import { motion } from 'framer-motion';

// Minimalist, premium Tow Truck SVG icon
const TowTruckIcon = ({ className, size = 24 }: { className?: string, size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="2" y="12" width="7" height="5" rx="1" />
    <rect x="9" y="14" width="13" height="3" rx="1" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M5 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
    <path d="M22 14v-2l-3-3h-4v5" />
    <path d="M12 9l6-6" />
    <path d="M18 3v2" />
  </svg>
);

const VehicleMotion = ({ activePath }: { activePath: string }) => {
  return (
    <div className="absolute inset-0 pointer-events-none w-full h-full" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      
      {/* The glowing trailing light */}
      <motion.div
        className="absolute top-0 left-0 w-24 h-24 -ml-12 -mt-12 rounded-full bg-red-600/30 blur-2xl"
        style={{
          offsetPath: `path('${activePath}')`,
          offsetRotate: "auto",
        } as any}
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* High-tech telemetry node */}
      <motion.div
        className="absolute top-0 left-0 w-3 h-3 -ml-1.5 -mt-1.5 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,1)] z-20"
        style={{ offsetPath: `path('${activePath}')` } as any}
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      >
        {/* Core pulse */}
        <span className="animate-ping absolute inset-0 w-full h-full rounded-full bg-red-400 opacity-75"></span>

        {/* Data Tag branching off the node */}
        <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 flex items-center bg-white/95 backdrop-blur-xl rounded-lg px-3 py-2 border border-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] whitespace-nowrap">
          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center mr-2.5">
            <TowTruckIcon size={12} className="text-slate-800" />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-400 tracking-widest uppercase leading-none mb-1">Unit 42</span>
            <span className="text-[11px] font-black text-slate-800 leading-none tracking-tight">En Route</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VehicleMotion;
