import React from 'react';
import { motion } from 'framer-motion';

const AppDemoSplash = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      className="absolute inset-0 z-[80] bg-white flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Route Line with Pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="none" className="opacity-20">
              <motion.path
                  d="M -50 350 C 100 350, 150 200, 200 200 C 250 200, 300 50, 450 50"
                  fill="transparent"
                  stroke="#D32F2F"
                  strokeWidth="1.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  style={{ willChange: "stroke-dashoffset" }}
              />
              <motion.path
                  d="M -50 350 C 100 350, 150 200, 200 200 C 250 200, 300 50, 450 50"
                  fill="transparent"
                  stroke="#D32F2F"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1 1000"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                  style={{ willChange: "stroke-dashoffset, opacity" }}
              />
          </motion.svg>
      </div>

      {/* Removed scale-[0.75] and manually adjusted sizes for better GPU performance */}
      <div className="relative flex flex-col items-center justify-center w-full h-full">
          {/* Main Logo Container */}
          <div className="flex items-center justify-center text-4xl font-black tracking-tighter">
              <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden whitespace-nowrap text-slate-900 flex justify-end"
              >
                  <span className="shrink-0 pr-[1px]">Res</span>
              </motion.div>
              <motion.div
                  initial={{ y: -40, opacity: 0, scale: 0.5 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.5 }}
                  className="relative z-10 flex items-center justify-center text-[#D32F2F] font-black"
              >
                  <span>Q</span>
                  <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [0.5, 3], opacity: [0, 0.3, 0] }}
                      transition={{ duration: 1.5, delay: 0.5, repeat: 1, ease: "easeOut" }}
                      className="absolute w-10 h-10 border-2 border-[#D32F2F] bg-[#D32F2F]/10 rounded-full z-[-1]"
                  />
                  <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [0.5, 4], opacity: [0, 0.15, 0] }}
                      transition={{ duration: 2, delay: 0.8, repeat: 1, ease: "easeOut" }}
                      className="absolute w-10 h-10 bg-[#D32F2F] rounded-full z-[-1]"
                  />
              </motion.div>
              <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden whitespace-nowrap text-slate-900 flex justify-start"
              >
                  <span className="shrink-0 pl-[1px]">Now</span>
              </motion.div>
          </div>
          
          <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-1/2 mt-10 z-20"
          >
              {/* Removed backdrop-blur-xl for 60fps performance on mobile mockups */}
              <p className="text-[8px] font-bold text-slate-500 tracking-[0.35em] uppercase text-center bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                  When the road stops, we start.
              </p>
          </motion.div>
      </div>

      {/* Premium Loading Beam Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-slate-200 rounded-full overflow-hidden">
          <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, delay: 1.5, ease: "easeInOut" }}
              className="w-full h-full bg-gradient-to-r from-transparent via-[#D32F2F] to-transparent rounded-full"
          />
      </div>
    </motion.div>
  );
};
export default AppDemoSplash;
