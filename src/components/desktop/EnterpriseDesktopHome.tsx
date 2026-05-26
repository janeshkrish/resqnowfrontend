import React, { ReactNode, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, ArrowRight, BarChart3, BatteryCharging, Building2, Car,
  CheckCircle2, Clock3, CloudCog, Gauge, Globe2, Headphones, Layers3,
  LineChart, MapPin, Network, PlugZap, Radar, Route, ShieldCheck,
  Smartphone, Sparkles, TimerReset, Truck, UsersRound, Wrench, Zap
} from "lucide-react";

type IconType = typeof Activity;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const partners = [
  { title: "Fleet Operators", body: "Centralized assistance, ETA visibility, and service evidence for distributed vehicles.", icon: Truck },
  { title: "Automobile Companies", body: "White-label roadside support layer for OEM warranty, after-sales, and loyalty programs.", icon: Car },
  { title: "EV Ecosystems", body: "Charging, battery support, and technician routing for connected electric mobility.", icon: BatteryCharging },
  { title: "Insurance Providers", body: "Claim-aware dispatch workflows with traceable incidents, photos, and response history.", icon: ShieldCheck },
  { title: "Service Networks", body: "Verified garages, technicians, and towing operators organized into live availability grids.", icon: Wrench },
  { title: "Towing Partners", body: "Fleet assignment, partner activity, pricing transparency, and completion tracking.", icon: Route },
];

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

const GlassCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl ${className}`}>
    {children}
  </div>
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
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Command Center</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            System Live
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
                ETA 11 min
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
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Active Assignment</p>
                  <p className="text-sm font-black text-slate-800">Flatbed to NH-48 Sector</p>
                </div>
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold">En Route</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-600 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "65%" }}
                  transition={{ duration: 1.5, delay: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Network Uptime</p>
              <p className="text-3xl font-black text-slate-800 tracking-tight">99.8%</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <Activity size={12} /> Optimal state
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Active Incidents</p>
              <p className="text-3xl font-black text-slate-800 tracking-tight">42</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Live tracking active</p>
            </div>
            
            <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-20 rounded-full blur-2xl -translate-y-10 translate-x-10" />
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Smart Match</p>
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="text-emerald-400" size={24} />
                <p className="text-sm font-bold">Technician Verified</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-bold">Skill Match</span>
                <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-bold">ETA Fast</span>
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
              Premium B2B Platform
            </motion.div>
            
            <h1 className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight text-slate-900 mb-6">
              The Smart Mobility <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Assistance Grid
              </span>
            </h1>
            
            <p className="text-lg lg:text-xl font-medium leading-relaxed text-slate-600 mb-8 max-w-[540px]">
              ResQNow connects fleets, OEM platforms, and insurers through a high-fidelity roadside support infrastructure built for operational visibility and trust.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <Button size="xl" className="h-14 px-8 rounded-xl bg-slate-900 text-white font-bold hover:bg-blue-600 hover:scale-105 transition-all shadow-[0_10px_20px_-10px_rgba(15,23,42,0.5)]" asChild>
                <Link to="/contact">
                  Schedule Enterprise Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="h-14 px-8 rounded-xl bg-white border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm" asChild>
                <Link to="/technician/register">
                  Join Partner Network
                </Link>
              </Button>
            </div>
            
            <div className="mt-12 flex items-center gap-8">
              <div>
                <p className="text-3xl font-black text-slate-900">200+</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Verified Partners</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div>
                <p className="text-3xl font-black text-slate-900">99%</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Network Uptime</p>
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

const FeaturesSection = () => {
  return (
    <section id="ecosystem" className="py-24 bg-white relative">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900 mb-6">
            Ecosystem Integration
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            A unified assistance layer seamlessly bridging the gap between demand and highly-vetted service capacity.
          </p>
        </Reveal>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {partners.map((partner, i) => (
            <motion.div key={i} variants={fadeUp} className="group">
              <div className="h-full bg-[#f8fafc] border border-slate-100 p-8 rounded-3xl transition-all duration-300 hover:bg-white hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                  <partner.icon size={80} />
                </div>
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                  <partner.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{partner.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{partner.body}</p>
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
    { title: "Intelligent Request", desc: "API, app, or call center initiates context-rich SOS.", icon: Smartphone },
    { title: "AI Dispatch", desc: "Algorithmic matching based on skills, location, and SLA.", icon: Network },
    { title: "Live Tracking", desc: "Real-time visibility for operators and end-users.", icon: Radar },
    { title: "Digital Audit", desc: "Tamper-proof service evidence and billing generation.", icon: ShieldCheck }
  ];

  return (
    <section id="technology" className="py-24 bg-[#FAFCFF] border-y border-slate-100">
      <div className="container mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900 mb-6">
            Flawless Operations
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            Turn unpredictable roadside incidents into a streamlined, trackable workflow.
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

const AnalyticsMockup = () => (
  <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
    <div className="relative z-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-2xl font-black text-white">Network Analytics</h3>
          <p className="text-slate-400 text-sm font-semibold mt-1">Live SLA Monitoring</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 flex gap-2">
          <span className="px-4 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold">Today</span>
          <span className="px-4 py-1.5 rounded-lg text-slate-300 text-xs font-bold">Week</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Avg Response</p>
          <p className="text-4xl font-black text-white">14.2<span className="text-xl text-slate-400">m</span></p>
          <div className="mt-3 flex items-center gap-1 text-emerald-400 text-xs font-bold">
            <ArrowRight className="w-3 h-3 rotate-45" /> -12% vs last month
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Completion Rate</p>
          <p className="text-4xl font-black text-white">98.5<span className="text-xl text-slate-400">%</span></p>
          <div className="mt-3 flex items-center gap-1 text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-3 h-3" /> SLA Met
          </div>
        </div>
      </div>

      <div className="h-40 flex items-end gap-3 px-2">
        {[40, 70, 55, 90, 65, 80, 100].map((h, i) => (
          <motion.div 
            key={i}
            className="flex-1 bg-gradient-to-t from-blue-600/50 to-blue-400 rounded-t-md"
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
            viewport={{ once: true }}
          />
        ))}
      </div>
    </div>
  </div>
);

const PerformanceSection = () => (
  <section className="py-24 bg-white overflow-hidden">
    <div className="container mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-slate-900 mb-6">
            Data-Driven Fleet Uptime
          </h2>
          <p className="text-lg text-slate-600 font-medium mb-8">
            Access enterprise-grade dashboards to monitor response timing, partner activity, and service quality across the entire network in real-time.
          </p>
          
          <div className="space-y-6">
            {[
              { title: "Real-time SLA tracking", desc: "Monitor partner performance against contracts instantly." },
              { title: "Geospatial heatmaps", desc: "Understand demand concentration and position fleets proactively." },
              { title: "Automated billing reconciliation", desc: "Digital audits attached to every completed job." }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="text-slate-900 font-bold mb-1">{item.title}</h4>
                  <p className="text-slate-500 font-medium text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        
        <Reveal delay={0.2}>
          <AnalyticsMockup />
        </Reveal>
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="py-24 bg-white">
    <div className="container mx-auto max-w-5xl px-4 lg:px-8">
      <div className="bg-slate-900 rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/13/4096/2727.png')] opacity-10 bg-cover mix-blend-overlay" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-3/4 bg-blue-500 opacity-20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 tracking-tight">
            Ready to upgrade your mobility support?
          </h2>
          <p className="text-xl text-slate-300 font-medium mb-10 max-w-2xl mx-auto">
            Join the ecosystem of forward-thinking automotive and fleet companies leveraging ResQNow infrastructure.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button size="xl" className="h-16 px-10 rounded-2xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)]" asChild>
              <Link to="/contact">Contact Enterprise Sales</Link>
            </Button>
            <Button size="xl" variant="outline" className="h-16 px-10 rounded-2xl bg-white/10 border-white/20 text-white text-lg font-bold hover:bg-white/20 transition-all backdrop-blur-md" asChild>
              <Link to="/map">View Live Radar</Link>
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
      <FeaturesSection />
      <WorkflowSection />
      <PerformanceSection />
      <CTASection />
    </div>
  );
};

export default EnterpriseDesktopHome;
