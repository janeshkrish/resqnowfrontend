import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import VehicleMotion from './VehicleMotion';
import GPSNodes from './GPSNodes';

// A single, elegant cinematic sweep from bottom-left to top-right
export const routePath1 = "M -100 900 C 300 700, 400 200, 1000 100";
export const routePath2 = "M -100 950 C 350 750, 450 250, 1000 150";

const AnimatedRoad = () => {
  const [activePath, setActivePath] = useState(routePath1);
  const controls = useAnimation();

  // Intelligent Route Recalculation every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePath(prev => (prev === routePath1 ? routePath2 : routePath1));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="roadGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E53935" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Thick Base Route (Google Maps Style) */}
        <motion.path
          d={activePath}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="16"
          strokeLinecap="round"
          className="opacity-30"
          animate={{ d: activePath }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        
        {/* Glowing Gradient Core */}
        <motion.path
          d={activePath}
          fill="none"
          stroke="url(#roadGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glow)"
          animate={{ d: activePath }}
          transition={{ duration: 3, ease: "easeInOut" }}
          className="opacity-60"
        />

        {/* Directional Scrolling Dashes (Highway Lanes) */}
        <motion.path
          d={activePath}
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="6 12"
          initial={{ strokeDashoffset: 1000 }}
          animate={{ strokeDashoffset: 0, d: activePath }}
          transition={{ 
            strokeDashoffset: { duration: 20, ease: "linear", repeat: Infinity },
            d: { duration: 3, ease: "easeInOut" }
          }}
          className="opacity-40"
        />

        {/* High-Energy Tracking Blip */}
        <motion.path
          d={activePath}
          fill="none"
          stroke="#E53935"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="1 1200"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 6, ease: "linear", repeat: Infinity }}
          className="drop-shadow-2xl"
          filter="url(#glow)"
        />

        <GPSNodes activePath={activePath} />
      </svg>
      
      {/* HTML elements positioned along the path via Framer Motion */}
      <VehicleMotion activePath={activePath} />
    </div>
  );
};

export default AnimatedRoad;
