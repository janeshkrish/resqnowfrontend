import React from 'react';
import { motion } from 'framer-motion';

const RadarPulse = () => {
  // Scattered mechanic coordinates relative to radar center (top-left is 0,0)
  const mechanics = [
    { top: '30%', left: '40%', delay: 0.5 },
    { top: '65%', left: '75%', delay: 2.2 },
    { top: '25%', left: '70%', delay: 1.1 },
    { top: '75%', left: '35%', delay: 3.4 },
    { top: '50%', left: '20%', delay: 4.1 },
  ];

  return (
    <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-visible">
      {/* Central glow to anchor the radar */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-slate-900/5 blur-3xl rounded-full" />
      
      {/* The pulsing rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-indigo-900 border-dashed opacity-10"
          initial={{ scale: 0.05, opacity: 0 }}
          animate={{
            scale: [0.05, 1],
            opacity: [0, 0.2, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            delay: i * 4,
            ease: "easeOut",
          }}
        />
      ))}

      {/* The Sweeping Radar Sonar */}
      <motion.div 
        className="absolute inset-0 rounded-full opacity-30"
        style={{
          background: 'conic-gradient(from 0deg, transparent 70%, rgba(99,102,241,0.1) 90%, rgba(99,102,241,0.6) 100%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* Scattered Mechanic Nodes - Glowing Telemetry Dots instead of childish icons */}
      {mechanics.map((mech, i) => (
        <div 
          key={i} 
          className="absolute"
          style={{ top: mech.top, left: mech.left }}
        >
          {/* Node appearance animation synchronized roughly with the radar sweep */}
          <motion.div 
            className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-sm"
            animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 6, repeat: Infinity, delay: mech.delay, ease: "easeInOut" }}
          />
          {/* The glowing dot */}
          <div className="w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] relative z-10" />
          
          {/* Expanding radar ping */}
          <motion.div 
            className="absolute inset-0 border border-indigo-400 rounded-full"
            animate={{ scale: [1, 4], opacity: [0.8, 0] }}
            transition={{ duration: 6, repeat: Infinity, delay: mech.delay + 0.1, ease: "easeOut" }}
          />
        </div>
      ))}
    </div>
  );
};

export default RadarPulse;
