import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoState } from './AppDemoContainer';
import { MapPin, Wrench } from 'lucide-react';

export const CUSTOMER_COORDS = { x: 160, y: 280 };
export const ASSIGNED_MECH_COORDS = { x: 270, y: 450 };

const mechanics = [
  { x: 100, y: 120 },
  { x: 260, y: 160 },
  { x: 60, y: 520 },
  ASSIGNED_MECH_COORDS,
];

const AppMapNodes = ({ demoState }: { demoState: DemoState }) => {
  const showMechanics = demoState !== 'SEARCHING';
  const showRadar = demoState === 'SEARCHING';

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      
      {/* Radar Rings (Only when searching) */}
      <AnimatePresence>
        {showRadar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute"
            style={{ left: CUSTOMER_COORDS.x, top: CUSTOMER_COORDS.y }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-red-500 bg-red-500/5 -translate-x-1/2 -translate-y-1/2"
                initial={{ width: 0, height: 0, opacity: 0.8 }}
                animate={{ width: 320, height: 320, opacity: 0 }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Pin */}
      <div 
        className="absolute w-8 h-8 -ml-4 -mt-8 flex flex-col items-center justify-center drop-shadow-md z-20"
        style={{ left: CUSTOMER_COORDS.x, top: CUSTOMER_COORDS.y }}
      >
        <div className="bg-slate-900 text-white rounded-full p-1 border-2 border-white flex items-center justify-center">
          <MapPin size={14} className="fill-current" />
        </div>
        <div className="w-1 h-1 rounded-full bg-slate-900/40 mt-1" />
      </div>

      {/* Mechanic Pins */}
      <AnimatePresence>
        {showMechanics && mechanics.map((mech, i) => {
          const isAssigned = mech.x === ASSIGNED_MECH_COORDS.x && mech.y === ASSIGNED_MECH_COORDS.y;
          // Hide the assigned mechanic pin when EN_ROUTE because the moving truck represents them now
          if (isAssigned && (demoState === 'EN_ROUTE' || demoState === 'ARRIVED')) return null;

          return (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", delay: i * 0.1 }}
              className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm z-10 ${isAssigned ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}
              style={{ left: mech.x, top: mech.y }}
            >
              <Wrench size={10} strokeWidth={isAssigned ? 3 : 2} />
            </motion.div>
          );
        })}
      </AnimatePresence>

    </div>
  );
};

export default AppMapNodes;
