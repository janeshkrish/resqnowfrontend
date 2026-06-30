import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoState } from './AppDemoContainer';
import { CUSTOMER_COORDS, ASSIGNED_MECH_COORDS } from './AppMapNodes';

const TowTruckIcon = ({ size = 24 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
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

const AppRouteMotion = ({ demoState }: { demoState: DemoState }) => {
  const showRoute = demoState === 'EN_ROUTE' || demoState === 'ARRIVED';
  
  // Curved path snapping through streets from Mechanic to Customer
  const pathData = `M ${ASSIGNED_MECH_COORDS.x} ${ASSIGNED_MECH_COORDS.y} L 270 450 L 220 480 L 160 520 L 160 280`;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <AnimatePresence>
        {showRoute && (
          <svg width="100%" height="100%" viewBox="0 0 320 650" className="absolute inset-0 overflow-visible">
            {/* Background solid line */}
            <motion.path
              d={pathData}
              fill="none"
              stroke="#E53935"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
            {/* Glowing active line */}
            <motion.path
              d={pathData}
              fill="none"
              stroke="#E53935"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_8px_rgba(229,57,53,0.8)] opacity-60"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </svg>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoute && (
          <motion.div
            initial={{ offsetDistance: "0%", opacity: 0, scale: 0.5 }}
            animate={{ 
              offsetDistance: "100%", 
              opacity: 1, 
              scale: 1 
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              offsetDistance: { duration: 4, ease: "easeInOut", delay: 0.4 }, // Drives to customer over 4 seconds
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 }
            }}
            className="absolute top-0 left-0 w-8 h-8 -ml-4 -mt-4 bg-white rounded-full shadow-lg border-2 border-slate-900 flex items-center justify-center z-20"
            style={{
              offsetPath: `path('${pathData}')`,
            } as any}
          >
            <div className="text-slate-900">
              <TowTruckIcon size={14} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppRouteMotion;
