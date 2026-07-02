import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Google Maps Immersive Color Palette
const COLORS = {
  land: '#E8EAED',
  water: '#AADAFF',
  road: '#FFFFFF',
  highway: '#FDE293',
  buildingRoof: '#F1F3F4',
  buildingFront: '#E8EAED',
  buildingSide: '#DADCE0',
  text: '#3C4043',
  pinRed: '#EA4335',
  pinDark: '#B31412'
};

const cinematicEase = [0.25, 1, 0.35, 1];

// Procedural 3D CSS Building Block
const Block3D = ({ x, y, w, h, d }) => (
  <div className="absolute pointer-events-none" style={{ left: x, top: y, width: w, height: h, transformStyle: 'preserve-3d' }}>
    {/* Roof */}
    <div className="absolute inset-0 border border-slate-300/30" style={{ backgroundColor: COLORS.buildingRoof, transform: `translateZ(${d}px)` }} />
    {/* South/Front Face */}
    <div className="absolute bottom-0 left-0 origin-bottom border-x border-b border-slate-300/30" style={{ width: w, height: d, backgroundColor: COLORS.buildingFront, transform: 'rotateX(-90deg)' }} />
    {/* East/Right Face */}
    <div className="absolute top-0 right-0 origin-right border-y border-l border-slate-300/30" style={{ width: d, height: h, backgroundColor: COLORS.buildingSide, transform: 'rotateY(90deg)' }} />
  </div>
);

// Cluster of 3D buildings around a city point
const CityCluster = ({ left, top, scale = 1, isHub = false }) => {
  // Deterministic abstract city blocks
  const blocks = [
    { x: -15, y: -15, w: 20, h: 20, d: isHub ? 45 : 25 },
    { x: 10, y: -25, w: 15, h: 20, d: isHub ? 55 : 30 },
    { x: -25, y: 10, w: 25, h: 15, d: isHub ? 35 : 20 },
    { x: 5, y: 5, w: 35, h: 35, d: isHub ? 80 : 40 }, // Main tower
    { x: 20, y: 25, w: 15, h: 15, d: 25 },
    { x: -10, y: 30, w: 20, h: 15, d: 20 },
  ].map(b => ({ ...b, x: b.x*scale, y: b.y*scale, w: b.w*scale, h: b.h*scale, d: b.d*scale }));

  return (
    <div className="absolute z-10" style={{ left, top, transformStyle: 'preserve-3d' }}>
      {blocks.map((b, i) => <Block3D key={i} {...b} />)}
    </div>
  );
};

// Authentic Google Maps Style Teardrop Pin
const GooglePin = ({ label, left, top, delay, isHub = false, phase }) => {
  return (
    <div className="absolute pointer-events-auto z-30" style={{ left, top, transformStyle: 'preserve-3d' }}>
       {/* Anchor point to ground (Entrance Animation) */}
       <motion.div 
         className="absolute flex flex-col items-center justify-end origin-bottom"
         style={{ transformStyle: 'preserve-3d', x: '-50%', y: '-100%', z: isHub ? 85 : 45 }}
         initial={{ scale: 0, opacity: 0, y: '-80%' }}
         animate={{ scale: 1, opacity: 1, y: '-100%' }}
         transition={{ type: "spring", stiffness: 200, damping: 20, delay }}
       >
         {/* Counter-rotate to always face camera perfectly (syncs with map camera) */}
         <motion.div 
           className="relative flex flex-col items-center" 
           animate={{ 
             rotateX: phase === 1 ? -45 : phase === 2 ? -72 : -55,
             rotateZ: phase === 1 ? 0 : phase === 2 ? 25 : 10
           }} 
           transition={{ duration: 3.5, ease: cinematicEase }}
         >
            {/* White Pill Label */}
            <div className="mb-1 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-slate-100 whitespace-nowrap">
               <span className="text-[12px] font-bold text-[#3C4043] tracking-tight">{label}</span>
            </div>

            {/* Red Teardrop Marker */}
            <div className="w-8 h-8 bg-[#EA4335] rounded-full rounded-br-none rotate-45 flex items-center justify-center border-[2.5px] border-white shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
               <div className="-rotate-45 w-2.5 h-2.5 bg-[#B31412] rounded-full" />
            </div>

            {/* Connecting shadow stalk to visually tie floating pin to the 3D ground */}
            <div className="w-1 h-12 bg-black/10 origin-top blur-[1px] -mt-1 rounded-full" />
         </motion.div>
       </motion.div>
    </div>
  );
};

const cities = [
  { id: 'che', name: 'Chennai', top: '15%', left: '85%' },
  { id: 'mdu', name: 'Madurai', top: '75%', left: '40%' },
  { id: 'tri', name: 'Trichy', top: '50%', left: '55%' },
  { id: 'kky', name: 'Kanyakumari', top: '95%', left: '30%' },
];

const NarrativeMapSequence = () => {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(2), 4000),
      setTimeout(() => setPhase(3), 10000),
      setTimeout(() => setPhase(1), 15000)
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="relative w-full h-[600px] md:h-[750px] flex items-center justify-center isolate overflow-hidden bg-[#D4E8F8]">
      
      {/* Horizon Fog / Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#D4E8F8] via-[#D4E8F8]/80 to-transparent h-1/2 z-20 pointer-events-none" />

      {/* Immersive 3D World */}
      <motion.div 
        className="absolute inset-0 w-full h-full transform-gpu origin-[50%_60%]"
        initial={false}
        animate={{
          scale: phase === 1 ? 1.5 : phase === 2 ? 3.2 : 1.6, 
          rotateX: phase === 1 ? 45 : phase === 2 ? 72 : 55, 
          rotateZ: phase === 1 ? 0 : phase === 2 ? -25 : -10,
          y: phase === 1 ? 40 : phase === 2 ? 220 : 80,
          x: phase === 1 ? 0 : phase === 2 ? 100 : -20,
        }}
        transition={{ duration: 3.5, ease: cinematicEase }}
        style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      >
        {/* Base Ground / Landmass */}
        <div className="absolute inset-[-100%] bg-[#E8EAED]" style={{ transformStyle: 'preserve-3d' }}>
           
           {/* Abstract Water Bodies */}
           <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Bay of Bengal */}
              <path d="M 85 0 L 100 0 L 100 100 L 70 100 Q 80 50 85 0 Z" fill={COLORS.water} />
              {/* Arabian Sea */}
              <path d="M 0 60 L 25 100 L 0 100 Z" fill={COLORS.water} />
           </svg>
           
           {/* Road Grid Overlay */}
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFFFFF_1px,transparent_1px),linear-gradient(to_bottom,#FFFFFF_1px,transparent_1px)] bg-[size:40px_40px] opacity-80" />
           
           {/* Major Highways */}
           <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M 30 40 Q 50 15 85 15" stroke={COLORS.highway} strokeWidth="0.8" fill="none" />
              <path d="M 30 40 Q 40 60 40 80" stroke={COLORS.highway} strokeWidth="0.8" fill="none" />
              <path d="M 30 40 Q 45 40 55 50" stroke={COLORS.road} strokeWidth="1.2" fill="none" />
              <path d="M 30 40 Q 20 70 30 95" stroke={COLORS.road} strokeWidth="0.8" fill="none" />
           </svg>

           {/* 3D City Building Clusters */}
           <CityCluster left="30%" top="40%" scale={1.2} isHub={true} /> {/* Coimbatore */}
           {phase >= 2 && (
             <>
               <CityCluster left="85%" top="15%" scale={0.8} /> {/* Chennai */}
               <CityCluster left="40%" top="75%" scale={0.7} /> {/* Madurai */}
               <CityCluster left="55%" top="50%" scale={0.9} /> {/* Trichy */}
               <CityCluster left="30%" top="95%" scale={0.6} /> {/* Kanyakumari */}
             </>
           )}
        </div>

        {/* Origin Marker */}
        <GooglePin label="Coimbatore HQ" left="30%" top="40%" delay={0} isHub={true} phase={phase} />

        {/* Network Markers */}
        <AnimatePresence>
          {phase >= 2 && cities.map((city, idx) => (
            <GooglePin 
              key={city.id}
              label={city.name} 
              left={city.left} 
              top={city.top} 
              delay={0.4 + (idx * 0.2)} 
              phase={phase}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Screen UI Overlays (Text & Hype) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-16 z-40">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.8, ease: cinematicEase }}
              className="max-w-md bg-white/95 backdrop-blur-xl px-8 py-8 rounded-3xl shadow-xl border border-slate-100"
            >
              <h2 className="text-4xl font-black text-[#3C4043] tracking-tight leading-none mb-4">
                Starting from the<br />
                <span className="text-[#EA4335]">Heart of Kovai.</span>
              </h2>
              <p className="text-slate-500 text-base font-medium leading-relaxed">
                Coimbatore isn't just our launchpad; it's our proving ground. The Manchester of South India demands resilience, speed, and trust. 
              </p>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.8, ease: cinematicEase }}
              className="self-end mt-auto max-w-sm bg-white/95 backdrop-blur-xl px-8 py-8 rounded-3xl shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EA4335] animate-pulse" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Grid Active</p>
              </div>
              <h2 className="text-3xl font-black text-[#3C4043] tracking-tight leading-tight mb-3">
                Connecting the <br />
                entirety of <span className="text-[#EA4335]">Tamil Nadu.</span>
              </h2>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div
              key="phase3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 1, ease: cinematicEase }}
              className="m-auto bg-white/95 backdrop-blur-2xl px-12 py-12 rounded-[2.5rem] shadow-[0_40px_100px_rgba(234,67,53,0.15)] border border-red-50 text-center"
            >
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none text-[#3C4043] mb-2">
                BUILT IN <span className="text-[#EA4335]">TAMIL NADU.</span>
              </h1>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-slate-300">
                FOR INDIA.
              </h1>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NarrativeMapSequence;
