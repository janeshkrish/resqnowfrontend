import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon } from 'lucide-react';

// MNC Grade Premium Node Icon (Geometric, sleek, glowing)
const PremiumNode = ({ isHub = false, delay = 0, label = "" }) => {
  return (
    <motion.div
      className="absolute flex flex-col items-center justify-center origin-bottom"
      style={{ left: '50%', top: '50%', x: '-50%', y: '-50%' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative group cursor-pointer">
        {/* Ambient Glow */}
        {isHub && (
          <motion.div 
            className="absolute -inset-8 bg-red-500/20 rounded-full blur-md -z-10"
            animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        
        {/* Core Geometry */}
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl backdrop-blur-md border border-white/20 shadow-xl ${isHub ? 'bg-red-600 shadow-red-500/50' : 'bg-slate-900 shadow-slate-900/50'}`}>
          <Hexagon className={`w-4 h-4 ${isHub ? 'text-white' : 'text-slate-300'}`} />
          {isHub && (
            <div className="absolute inset-0 border border-white/40 rounded-xl animate-ping" />
          )}
        </div>

        {/* Minimalist Floating Label */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[130%] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl border border-slate-100 whitespace-nowrap transition-all duration-500 origin-bottom scale-90 ${isHub ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 group-hover:scale-100'}`}>
          <p className="text-[10px] font-black tracking-widest text-slate-800 uppercase">{label}</p>
          {isHub && <div className="w-4 h-0.5 bg-red-500 mt-0.5 mx-auto rounded-full" />}
        </div>
      </div>
    </motion.div>
  );
};

const cities = [
  { id: 'che', name: 'Chennai', left: '75%', top: '20%' },
  { id: 'mdu', name: 'Madurai', left: '45%', top: '75%' },
  { id: 'tri', name: 'Trichy', left: '60%', top: '55%' },
  { id: 'kky', name: 'Kanyakumari', left: '35%', top: '90%' },
];

const NarrativeMapSequence = () => {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    // Act 1: 0 - 3.5s (Origin)
    // Act 2: 3.5 - 7.5s (Expansion)
    // Act 3: 7.5 - 12s (National Vision)
    const timers = [
      setTimeout(() => setPhase(2), 3500),
      setTimeout(() => setPhase(3), 7500),
      setTimeout(() => setPhase(1), 12000)
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Ultra-smooth easing curve
  const smoothEase = [0.22, 1, 0.36, 1];

  return (
    // Borderless, free-flowing container
    <div className="relative w-full h-[600px] flex items-center justify-center isolate overflow-hidden pointer-events-none">
      
      {/* 3D Map Camera Container */}
      <motion.div 
        className="absolute inset-0 w-full h-full transform-gpu origin-center"
        initial={false}
        animate={{
          scale: phase === 1 ? 2.2 : phase === 2 ? 1 : 0.8,
          rotateX: phase === 1 ? 0 : phase === 2 ? 55 : 65,
          rotateZ: phase === 1 ? 0 : phase === 2 ? -25 : -30,
          y: phase === 1 ? 80 : phase === 2 ? 20 : 0,
          x: phase === 1 ? 100 : 0
        }}
        transition={{ duration: 2.5, ease: smoothEase }}
        style={{ transformStyle: 'preserve-3d', perspective: '1200px' }}
      >
        {/* Free-flowing Grid / Map Base (No borders) */}
        <div className="absolute inset-[-50%] bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 rounded-full blur-[1px] [mask-image:radial-gradient(circle,black_40%,transparent_70%)]" />

        {/* Ambient Light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,57,53,0.08)_0%,transparent_60%)]" />

        {/* Origin: Coimbatore */}
        <div className="absolute z-20 pointer-events-auto" style={{ left: '25%', top: '45%', transformStyle: 'preserve-3d' }}>
          <motion.div
            className="absolute origin-bottom"
            style={{ left: '50%', top: '50%', x: '-50%', y: '-50%' }}
            animate={{ 
              rotateX: phase === 1 ? 0 : phase === 2 ? -55 : -65, 
              rotateZ: phase === 1 ? 0 : phase === 2 ? 25 : 30 
            }}
            transition={{ duration: 2.5, ease: smoothEase }}
          >
            <PremiumNode isHub={true} label="Coimbatore HQ" />
          </motion.div>
        </div>

        {/* Phase 2: Expansion Nodes & Sleek Arcs */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div className="absolute inset-0 w-full h-full pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              <svg className="absolute inset-0 w-full h-full overflow-visible z-10" viewBox="0 0 500 500">
                <defs>
                  <linearGradient id="premiumArc" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#E53935" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="premiumGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Highly refined paths (CBE approx 125, 225) */}
                <motion.path d="M 125 225 Q 250 -50 375 100" fill="none" stroke="url(#premiumArc)" strokeWidth="3" filter="url(#premiumGlow)" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2, ease: smoothEase }} />
                <motion.path d="M 125 225 Q 280 200 225 375" fill="none" stroke="url(#premiumArc)" strokeWidth="2.5" filter="url(#premiumGlow)" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, delay: 0.2, ease: smoothEase }} />
                <motion.path d="M 125 225 Q 250 150 300 275" fill="none" stroke="url(#premiumArc)" strokeWidth="2.5" filter="url(#premiumGlow)" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, delay: 0.4, ease: smoothEase }} />
                <motion.path d="M 125 225 Q 100 350 175 450" fill="none" stroke="url(#premiumArc)" strokeWidth="2.5" filter="url(#premiumGlow)" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.8, delay: 0.6, ease: smoothEase }} />
              </svg>

              {cities.map((city, idx) => (
                <div key={city.id} className="absolute z-20 pointer-events-auto" style={{ left: city.left, top: city.top, transformStyle: 'preserve-3d' }}>
                  <motion.div
                    className="absolute origin-bottom"
                    style={{ left: '50%', top: '50%', x: '-50%', y: '-50%' }}
                    animate={{ 
                      rotateX: phase === 2 ? -55 : -65, 
                      rotateZ: phase === 2 ? 25 : 30 
                    }}
                    transition={{ duration: 2.5, ease: smoothEase }}
                  >
                    <PremiumNode label={city.name} delay={0.5 + (idx * 0.2)} />
                  </motion.div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Narrative Typography overlaying the right section only */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8 text-center z-30">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0, filter: "blur(10px)", scale: 0.9 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 1.05 }}
              transition={{ duration: 1, ease: smoothEase }}
              className="mt-64 bg-white/70 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-2xl border border-white"
            >
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                Starting from the<br />
                <span className="text-red-600 text-5xl drop-shadow-sm">Heart of Kovai.</span>
              </h2>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(5px)", scale: 1.05 }}
              transition={{ duration: 1, ease: smoothEase }}
              className="absolute top-12 left-0 text-left bg-white/70 backdrop-blur-xl px-8 py-6 rounded-3xl shadow-2xl border border-white"
            >
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-[1.1]">
                Connecting <br />
                <span className="text-red-600">Tamil Nadu.</span>
              </h2>
              <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Live Dispatch Grid</p>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div
              key="phase3"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(20px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }}
              transition={{ duration: 1.2, ease: smoothEase }}
              className="bg-white/90 backdrop-blur-2xl px-12 py-10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(229,57,53,0.3)] border border-red-100/50"
            >
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none text-slate-900 mb-2">
                BUILT IN <span className="text-red-600">TAMIL NADU.</span>
              </h1>
              <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-none text-red-600">
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
