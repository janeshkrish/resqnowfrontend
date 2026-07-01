import React from "react";
import { motion } from "framer-motion";
import { MapPin, Route, Milestone, Heart } from "lucide-react";
import NarrativeMapSequence from "../components/desktop/cities/NarrativeMapSequence";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
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

const Node = ({ x, y, label, active = false, delay = 0 }: { x: string, y: string, label: string, active?: boolean, delay?: number }) => (
  <motion.div 
    className="absolute flex flex-col items-center"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, scale: 0 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ delay, type: "spring", stiffness: 200, damping: 15 }}
  >
    <div className={`w-4 h-4 rounded-full ${active ? 'bg-red-600' : 'bg-slate-300'} border-2 border-white shadow-lg relative z-10`}>
      {active && (
        <span className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-75 duration-1000"></span>
      )}
    </div>
    <div className={`mt-2 text-sm font-bold ${active ? 'text-red-900 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm' : 'text-slate-500'}`}>
      {label}
    </div>
  </motion.div>
);

const PremiumPath = ({ d, delay = 0 }: { d: string, delay?: number }) => (
  <>
    <motion.path 
      d={d}
      fill="none"
      stroke="url(#pathGrad)"
      strokeWidth="2"
      strokeDasharray="4 4"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 0.5 }}
      viewport={{ once: true }}
      transition={{ duration: 2, delay, ease: "easeInOut" }}
    />
    <motion.path 
      d={d}
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeDasharray="15 1000"
      initial={{ strokeDashoffset: 1015, opacity: 0 }}
      animate={{ strokeDashoffset: -15, opacity: [0, 1, 0] }}
      transition={{ duration: 2.5, delay, repeat: Infinity, ease: "linear" }}
    />
  </>
);

const CitiesPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-red-200 selection:text-slate-900 font-sans pt-32 pb-24">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        
        {/* Header Section */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-100 mb-8">
              <MapPin size={14} className="text-red-600" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-red-600">The ResQNow Grid</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.05]">
              Starting from the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-indigo-600">
                Heart of Kovai.
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-slate-600 font-medium leading-relaxed mb-8">
              Coimbatore isn't just our launchpad; it's our proving ground. The Manchester of South India demands resilience, speed, and trust. We built ResQNow to match the pulse of this city, preparing a blueprint to connect the entirety of Tamil Nadu.
            </p>

            <div className="flex items-center gap-4 text-slate-500 font-bold">
              <Heart size={20} className="text-red-500 fill-red-500/20" />
              <span>Engineered with pride in Tamil Nadu</span>
            </div>
          </Reveal>

          <Reveal delay={0.2} className="relative w-full flex items-center justify-center">
            <NarrativeMapSequence />
          </Reveal>
        </div>

        {/* Expansion Section */}
        <Reveal>
          <div className="mt-32">
            <div className="relative bg-white rounded-[3rem] p-12 lg:p-20 border border-slate-200/60 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.05)] overflow-hidden text-center flex flex-col items-center">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border border-red-100 mb-8 shadow-sm">
                <MapPin size={32} className="text-red-600" />
              </div>
              
              <h2 className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]">
                Coming soon across all of <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-indigo-600">Tamil Nadu.</span>
              </h2>
              
              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed mb-12">
                We're aggressively expanding our premium dispatch network. Soon, you'll experience sub-45 minute, high-trust roadside assistance no matter where you travel in the state.
              </p>
              
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-900 to-red-950 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                Statewide Network Active Soon
              </div>
            </div>
          </div>
        </Reveal>

      </div>
    </div>
  );
};

export default CitiesPage;
