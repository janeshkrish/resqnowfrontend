import React from "react";
import { motion } from "framer-motion";
import { MapPin, Route, Milestone, Heart } from "lucide-react";

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
    <div className={`w-4 h-4 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300'} border-2 border-white shadow-lg relative z-10`}>
      {active && (
        <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-75 duration-1000"></span>
      )}
    </div>
    <div className={`mt-2 text-sm font-bold ${active ? 'text-blue-900 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm' : 'text-slate-500'}`}>
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
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200 selection:text-slate-900 font-sans pt-32 pb-24">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        
        {/* Header Section */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-8">
              <MapPin size={14} className="text-blue-600" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-blue-600">The ResQNow Grid</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.05]">
              Starting from the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
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

          <Reveal delay={0.2} className="relative h-[500px] w-full bg-white rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(15,23,42,0.1)] border border-slate-200/60 overflow-hidden p-8 flex items-center justify-center">
            {/* Abstract TN Map Grid */}
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:40px_40px]" />
            
            <div className="relative w-full max-w-[400px] h-full">
              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 400 400">
                <defs>
                  <linearGradient id="pathGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#94a3b8" />
                  </linearGradient>
                </defs>
                {/* Paths emanating from Coimbatore (approximate relative positions) */}
                <PremiumPath d="M 120 200 Q 150 150 250 100" delay={0.5} /> {/* To Chennai approx */}
                <PremiumPath d="M 120 200 Q 180 220 200 280" delay={0.7} /> {/* To Madurai approx */}
                <PremiumPath d="M 120 200 Q 140 280 150 320" delay={0.9} /> {/* To Kanyakumari approx */}
                <PremiumPath d="M 120 200 Q 180 180 220 160" delay={1.1} /> {/* To Trichy approx */}
              </svg>

              <Node x="30%" y="50%" label="Coimbatore (Phase 1)" active={true} delay={0.3} />
              <Node x="62.5%" y="25%" label="Chennai" delay={0.6} />
              <Node x="50%" y="70%" label="Madurai" delay={0.8} />
              <Node x="37.5%" y="80%" label="Kanyakumari" delay={1.0} />
              <Node x="55%" y="40%" label="Tiruchirappalli" delay={1.2} />
            </div>

            <div className="absolute bottom-8 left-8 right-8 bg-slate-900/5 backdrop-blur-md rounded-2xl p-4 border border-slate-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Grid Coverage</p>
                  <p className="text-lg font-black text-slate-900">Avinashi Rd. Corridor Active</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                  <Route size={14} className="text-blue-600" />
                  <span className="text-xs font-bold text-blue-900">100% Coverage</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Expansion Section */}
        <Reveal>
          <div className="mt-32">
            <div className="relative bg-white rounded-[3rem] p-12 lg:p-20 border border-slate-200/60 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.05)] overflow-hidden text-center flex flex-col items-center">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 border border-blue-100 mb-8 shadow-sm">
                <MapPin size={32} className="text-blue-600" />
              </div>
              
              <h2 className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]">
                Coming soon across all of <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Tamil Nadu.</span>
              </h2>
              
              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed mb-12">
                We're aggressively expanding our premium dispatch network. Soon, you'll experience sub-45 minute, high-trust roadside assistance no matter where you travel in the state.
              </p>
              
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
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
