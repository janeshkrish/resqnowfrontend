import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, ArrowRight, Car,
  CheckCircle2, Clock3, Route, ShieldCheck,
  Smartphone, Sparkles, Truck, Wrench, Navigation, IndianRupee, Map
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const Reveal = ({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => (
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

const AnimatedDashboardMockup = () => {
  return (
    <div className="relative w-full max-w-[700px] mx-auto perspective-1000">
      <div className="absolute inset-0 -m-8 bg-gradient-to-tr from-blue-100 via-indigo-50 to-emerald-50 rounded-[3rem] blur-3xl opacity-60" />
      
      <motion.div 
        className="relative rounded-3xl border border-white bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
        initial={{ rotateX: 20, y: 50, opacity: 0 }}
        animate={{ rotateX: 0, y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex gap-2 items-center">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-slate-200" />
              <div className="w-3 h-3 rounded-full bg-slate-200" />
              <div className="w-3 h-3 rounded-full bg-slate-200" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">AI Dispatch Engine</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Sub-45m ETA Grid
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative min-h-[340px] overflow-hidden rounded-2xl bg-[#f4f7f9] border border-slate-100 shadow-inner">
            {/* Minimal Map Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:40px_40px]" />
            
            {/* Animated SVG Route */}
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 400 300">
              <defs>
                <linearGradient id="routeGrad" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path
                d="M50 250 C120 220 150 150 200 130 C260 100 300 120 350 80"
                fill="none"
                stroke="url(#routeGrad)"
                strokeDasharray="6 8"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>

            {/* Active Marker */}
            <motion.div
              className="absolute left-[38%] top-[40%] bg-white rounded-full p-2 shadow-xl border border-slate-100 flex flex-col items-center justify-center z-10"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                <Truck size={16} />
              </div>
              <div className="absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">
                ETA 22 min
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
              </div>
            </motion.div>
            
            {/* Destination Marker */}
            <div className="absolute right-[8%] top-[20%] w-10 h-10 rounded-full bg-white shadow-xl border border-slate-100 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            </div>

            {/* Floating Glass Panel inside Map */}
            <motion.div 
              className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Avinashi Rd. Corridor</p>
                  <p className="text-sm font-black text-slate-800">Navigating Tier-2 Detours</p>
                </div>
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold">Fastest Route</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "45%" }}
                  transition={{ duration: 1.5, delay: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Avg Wait Time</p>
              <p className="text-3xl font-black text-slate-800 tracking-tight">30m</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <Activity size={12} /> Beating market avg (180m)
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Verified Network</p>
              <p className="text-3xl font-black text-slate-800 tracking-tight">100%</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Zero unverified garages</p>
            </div>
            
            <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-20 rounded-full blur-2xl -translate-y-10 translate-x-10" />
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Pricing Audit</p>
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="text-emerald-400" size={24} />
                <p className="text-sm font-bold">Transparent Billing</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-bold">Zero Hidden Fees</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const EnterpriseHero = () => (
  <section id="platform" className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden bg-[#FAFCFF]">
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[800px] h-[800px] rounded-full bg-gradient-to-b from-blue-50/80 to-transparent blur-3xl" />
      <div className="absolute top-40 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-t from-indigo-50/60 to-transparent blur-3xl" />
    </div>

    <div className="container relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-8 items-center">
        <Reveal>
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 shadow-sm mb-6"
            >
              <Sparkles className="h-3 w-3" />
              Phase 1: Tier-2 Emergency Roadside Grid
            </motion.div>
            
            <h1 className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight text-slate-900 mb-6">
              Eradicating Operational Latency in <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Tier-2 Mobility
              </span>
            </h1>
            
            <p className="text-lg lg:text-xl font-medium leading-relaxed text-slate-600 mb-8 max-w-[540px]">
              Replacing fragmented, unorganized garages and 3-hour wait times with a hyper-local, digitally native dispatch network engineered for sub-45 minute response.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <Button size="xl" className="h-14 px-8 rounded-xl bg-slate-900 text-white font-bold hover:bg-blue-600 hover:scale-105 transition-all shadow-[0_10px_20px_-10px_rgba(15,23,42,0.5)]" asChild>
                <Link to="/contact">
                  Schedule Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="h-14 px-8 rounded-xl bg-white border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm" asChild>
                <Link to="/request-service/emergency">
                  Emergency SOS
                </Link>
              </Button>
            </div>
            
            <div className="mt-12 flex items-center gap-8">
              <div>
                <p className="text-3xl font-black text-slate-900">45<span className="text-xl text-slate-500">m</span></p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Guaranteed ETA</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div>
                <p className="text-3xl font-black text-slate-900">100%</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Price Transparency</p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="relative z-10 w-full hidden md:block">
          <AnimatedDashboardMockup />
        </div>
      </div>
    </div>
  </section>
);

const TrustDeficitSection = () => {
  const problems = [
    { title: "Eradicating the Trust Deficit", desc: "No more aggressive upselling or artificial estimates. ResQNow enforces strict, pre-approved pricing models validated before the mechanic arrives.", icon: IndianRupee },
    { title: "Navigating Tier-2 Infrastructure", desc: "Our AI dispatch actively monitors hyper-local restrictions like Avinashi Road detours to route our fleet optimally, dodging night-time flyover bans.", icon: Map },
    { title: "Overcoming Operational Latency", desc: "Legacy aggregators treat dispatch as a call-center cost. ResQNow uses algorithmic matching to slash response times from 180 minutes to under 45 minutes.", icon: Clock3 }
  ];

  return (
    <section id="trust" className="py-24 bg-white relative">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900 mb-6">
            Solving the Trust & Latency Collapse
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            While vehicle registrations skyrocket in hubs like Coimbatore, the physical support layer remains dangerously broken. ResQNow is the digital remedy.
          </p>
        </Reveal>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid md:grid-cols-3 gap-6"
        >
          {problems.map((problem, i) => (
            <motion.div key={i} variants={fadeUp} className="group">
              <div className="h-full bg-[#f8fafc] border border-slate-100 p-8 rounded-3xl transition-all duration-300 hover:bg-white hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                  <problem.icon size={80} />
                </div>
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                  <problem.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{problem.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{problem.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const WorkflowSection = () => {
  const steps = [
    { title: "SOS Initiated", desc: "Stranded driver requests aid via high-intent digital discovery or app.", icon: Smartphone },
    { title: "Algorithmic Routing", desc: "AI predicts fastest response unit avoiding local Tier-2 traffic bottlenecks.", icon: Navigation },
    { title: "Verified Dispatch", desc: "Vetted mechanic dispatched instantly. No unorganized sector chaos.", icon: ShieldCheck },
    { title: "Safe Resolution", desc: "Transparent billing and digital audit completion upon job finish.", icon: CheckCircle2 }
  ];

  return (
    <section id="technology" className="py-24 bg-[#FAFCFF] border-y border-slate-100">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900 mb-6">
            The ResQNow Phase 1 Architecture
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            An on-demand system engineered explicitly for the digital-first Indian consumer facing critical roadside emergencies.
          </p>
        </Reveal>

        <div className="relative">
          <div className="hidden lg:block absolute top-12 left-20 right-20 h-0.5 bg-gradient-to-r from-blue-100 via-blue-500 to-blue-100 opacity-30" />
          
          <div className="grid lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="relative flex flex-col items-center text-center group">
                  <div className="w-24 h-24 bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-center mb-6 relative z-10 group-hover:-translate-y-2 transition-transform duration-300">
                    <step.icon size={32} className="text-blue-600" />
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-lg">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CTASection = () => (
  <section className="py-24 bg-white">
    <div className="container mx-auto max-w-5xl px-4 lg:px-8">
      {/* Premium Redesigned Partner CTA */}
      <div className="bg-white rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] border border-slate-100">
        
        {/* Subtle decorative background elements */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-50 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-sm border border-blue-100">
            <Wrench size={40} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight">
            Build the Support Grid with Us
          </h2>
          <p className="text-lg text-slate-600 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            We are replacing the unorganized service nightmare with a high-trust, verified gig network. Join ResQNow as a certified technician or fleet partner and multiply your earning potential through our transparent dispatch system.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full sm:w-auto">
            <Button size="xl" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 hover:-translate-y-1 transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)]" asChild>
              <Link to="/technician/register">Become a Partner</Link>
            </Button>
            <Button size="xl" variant="outline" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-white border-slate-200 text-slate-700 text-lg font-bold hover:bg-slate-50 hover:-translate-y-1 transition-all shadow-sm" asChild>
              <Link to="/about">Read Our Story</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const EnterpriseDesktopHome = () => {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 font-sans">
      <EnterpriseHero />
      <TrustDeficitSection />
      <WorkflowSection />
      <CTASection />
    </div>
  );
};

export default EnterpriseDesktopHome;
