import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, ArrowRight, CheckCircle2, Clock3, Navigation, ShieldCheck,
  Smartphone, Sparkles, Truck, Wrench, IndianRupee, Map, Zap
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

const PremiumDashboardMockup = () => {
  return (
    <div className="relative w-full max-w-[800px] mx-auto perspective-1000">
      <div className="absolute inset-0 -m-20 bg-gradient-to-tr from-blue-500/20 via-transparent to-emerald-500/20 rounded-full blur-3xl opacity-50" />
      
      <motion.div 
        className="relative rounded-2xl border border-slate-200/50 bg-white/70 p-6 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)] backdrop-blur-3xl overflow-hidden"
        initial={{ rotateX: 10, y: 60, opacity: 0, scale: 0.95 }}
        animate={{ rotateX: 0, y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="h-4 w-px bg-slate-300 mx-2" />
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-blue-600" />
              <p className="text-xs font-bold tracking-wide text-slate-800">DispatchEngine_v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-[10px] font-bold text-white tracking-widest uppercase">System Live</p>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          {/* Main Visual/Map Area */}
          <div className="relative h-[380px] rounded-xl bg-slate-50 border border-slate-200/60 overflow-hidden shadow-inner">
            {/* Minimal Grid */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            {/* Dynamic Graph Line */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 300" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M -50 250 C 100 250, 150 150, 250 120 C 350 90, 400 130, 550 50"
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
              <motion.path
                d="M -50 250 C 100 250, 150 150, 250 120 C 350 90, 400 130, 550 50 L 550 300 L -50 300 Z"
                fill="url(#areaGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
              />
            </svg>

            {/* Pulsing Node */}
            <motion.div 
              className="absolute left-[45%] top-[40%] flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.5, type: "spring" }}
            >
              <div className="absolute w-24 h-24 bg-blue-500/20 rounded-full animate-ping" />
              <div className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center z-10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-50 translate-y-full group-hover:translate-y-0 transition-transform" />
                <Truck size={20} className="text-blue-600 relative z-10" />
              </div>
              
              {/* Floating Tooltip */}
              <motion.div 
                className="absolute bottom-full mb-4 bg-slate-900 text-white p-3 rounded-xl shadow-2xl min-w-[140px] z-20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8 }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Unit 42</span>
                  <span className="text-xs font-black text-emerald-400">2.4km</span>
                </div>
                <div className="text-sm font-bold">En Route</div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45" />
              </motion.div>
            </motion.div>
            
            {/* Status Panel Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-md border border-white p-4 rounded-xl shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Latency Optimization</p>
                <p className="text-sm font-bold text-slate-900">Routing around Tier-2 Detours</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Activity size={14} className="text-blue-600" />
              </div>
            </div>
          </div>

          {/* Side Metrics */}
          <div className="flex flex-col gap-4">
            <motion.div 
              className="bg-slate-900 rounded-xl p-5 shadow-lg relative overflow-hidden group"
              whileHover={{ y: -2 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:bg-blue-500/30 transition-colors" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Avg ETA</p>
              <p className="text-4xl font-black text-white mb-1">22<span className="text-xl text-slate-500">m</span></p>
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <Navigation size={12} />
                <span>65% faster than market</span>
              </div>
            </motion.div>

            <motion.div 
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60 transition-transform hover:-translate-y-0.5"
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Network Trust</p>
              <p className="text-3xl font-black text-slate-900 mb-1">100%</p>
              <p className="text-xs font-bold text-slate-500">Verified Technicians Only</p>
            </motion.div>

            <motion.div 
              className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 shadow-sm border border-emerald-100 flex-1 flex flex-col justify-center transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Audit Active</p>
              </div>
              <p className="text-sm font-bold text-emerald-800">Zero hidden fees detected on active dispatches.</p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const EnterpriseHero = () => (
  <section id="platform" className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 overflow-hidden bg-[#fafafa]">
    {/* Premium Background Elements */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full" />
      <div className="absolute top-[20%] -right-40 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
    </div>

    <div className="container relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 lg:gap-12 items-center">
        <Reveal>
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600 shadow-sm mb-8 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              Phase 1: Tier-2 Emergency Grid
            </motion.div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tighter text-slate-900 mb-6">
              Intelligent Roadside Assistance for <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-300% animate-gradient">
                Modern Mobility.
              </span>
            </h1>
            
            <p className="text-lg lg:text-xl font-medium leading-relaxed text-slate-500 mb-10 max-w-[540px]">
              We're replacing unorganized service chaos and 3-hour waits with a premium, digitally native dispatch network engineered for sub-45 minute response times.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <Button size="xl" className="h-14 px-8 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300" asChild>
                <Link to="/contact">
                  Schedule Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="h-14 px-8 rounded-xl bg-white border-slate-200 font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm" asChild>
                <Link to="/request-service/emergency">
                  Emergency SOS
                </Link>
              </Button>
            </div>
            
            <div className="mt-16 flex items-center gap-10 border-t border-slate-200/60 pt-8">
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">45<span className="text-xl text-slate-500 font-medium">m</span></p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Guaranteed ETA</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">100%</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Price Transparency</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">24/7</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Active Grid</p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="relative z-10 w-full hidden lg:block">
          <PremiumDashboardMockup />
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
    <section id="trust" className="py-24 lg:py-32 bg-white relative">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            Solving the Trust & Latency Collapse
          </h2>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            While vehicle registrations skyrocket in hubs like Coimbatore, the physical support layer remains dangerously broken. ResQNow is the digital remedy.
          </p>
        </Reveal>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid md:grid-cols-3 gap-8"
        >
          {problems.map((problem, i) => (
            <motion.div key={i} variants={fadeUp} className="group cursor-pointer">
              <div className="h-full bg-slate-50/50 border border-slate-100 p-8 rounded-[2rem] transition-all duration-300 hover:bg-white hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-5 transition-opacity duration-500 transform group-hover:scale-110">
                  <problem.icon size={100} />
                </div>
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-8 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  <problem.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{problem.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{problem.desc}</p>
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
    <section id="technology" className="py-24 lg:py-32 bg-[#fafafa] border-y border-slate-200/60 relative overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="container mx-auto max-w-7xl px-4 lg:px-8 relative z-10">
        <Reveal className="text-center max-w-3xl mx-auto mb-24">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            Phase 1 Architecture
          </h2>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            An on-demand system engineered explicitly for the digital-first Indian consumer facing critical roadside emergencies.
          </p>
        </Reveal>

        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          
          <div className="grid lg:grid-cols-4 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="relative flex flex-col items-center text-center group">
                  <div className="w-24 h-24 bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-center mb-8 relative z-10 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300">
                    <step.icon size={32} className="text-slate-700 group-hover:text-blue-600 transition-colors" />
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
  <section className="py-24 lg:py-32 bg-white">
    <div className="container mx-auto max-w-5xl px-4 lg:px-8">
      <Reveal>
        <div className="bg-slate-900 rounded-[3rem] p-12 lg:p-24 text-center relative overflow-hidden shadow-2xl">
          
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm border border-white/10">
              <Wrench size={32} />
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
              Build the Support Grid with Us
            </h2>
            <p className="text-lg text-slate-300 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
              We are replacing the unorganized service nightmare with a high-trust, verified gig network. Join ResQNow and multiply your earning potential through our transparent dispatch system.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full sm:w-auto">
              <Button size="xl" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-500 hover:-translate-y-1 transition-all shadow-[0_10px_30px_rgba(37,99,235,0.4)]" asChild>
                <Link to="/technician/register">Become a Partner</Link>
              </Button>
              <Button size="xl" variant="outline" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-white/10 border-white/20 text-white text-lg font-bold hover:bg-white/20 hover:-translate-y-1 transition-all backdrop-blur-md" asChild>
                <Link to="/about">Read Our Story</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
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
