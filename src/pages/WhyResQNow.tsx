import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, Activity, Clock, CheckCircle2, Navigation,
  Banknote, AlertTriangle, Zap,
  Car, Building2, Shield, Truck as TruckIcon
} from "lucide-react";

// --- Framer Motion variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    className={className}
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-100px" }}
    transition={{ delay }}
  >
    {children}
  </motion.div>
);

// --- Sections ---

const HeroSection = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <section ref={ref} className="relative pt-40 pb-32 overflow-hidden bg-[#fafafa] text-slate-900 min-h-[90vh] flex items-center border-b border-slate-200/60">
      <motion.div style={{ y, opacity }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />
      </motion.div>

      <div className="container relative mx-auto max-w-7xl px-8 z-10">
        <div className="grid grid-cols-12 gap-12 items-center">
          <div className="col-span-12 lg:col-span-7">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 mb-8 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-600">Mission Control</span>
              </div>
              <h1 className="text-5xl lg:text-[5.5rem] font-black leading-[1.05] tracking-tighter mb-8 text-slate-900">
                Built for people who <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  can't afford to stop.
                </span>
              </h1>
              <p className="text-xl lg:text-2xl text-slate-500 font-medium leading-relaxed max-w-2xl mb-12">
                Real-time roadside assistance platform designed for modern mobility. 
                We replace chaos with transparent, algorithmic dispatch.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="xl" className="h-14 px-8 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300" asChild>
                  <Link to="/map">
                    Open Live Radar <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" className="h-14 px-8 rounded-xl bg-white border-slate-200 font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm" asChild>
                  <Link to="/services">
                    Explore Services
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <div className="col-span-12 lg:col-span-5 relative hidden lg:block">
            <Reveal delay={0.2}>
              <div className="relative rounded-[2rem] bg-white border border-slate-200 p-2 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)] transform rotate-y-[-10deg] rotate-x-[5deg] perspective-1000">
                <div className="bg-slate-50 rounded-[1.5rem] p-6 relative overflow-hidden border border-slate-100 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Dispatch</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      LIVE
                    </div>
                  </div>
                  
                  <div className="bg-white h-[280px] rounded-xl mb-6 relative overflow-hidden border border-slate-200 shadow-sm">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
                    
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <motion.path 
                        d="M 20 80 Q 50 20 80 40" 
                        fill="none" 
                        stroke="url(#grad)" 
                        strokeWidth="1.5" 
                        strokeDasharray="4 4"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                      <defs>
                        <linearGradient id="grad" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    <div className="absolute top-[35%] right-[15%] w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                    <motion.div 
                      className="absolute bottom-[15%] left-[15%] w-8 h-8 bg-slate-900 rounded-full border-[3px] border-white flex items-center justify-center shadow-lg"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Zap size={12} className="text-white fill-white" />
                    </motion.div>
                  </div>

                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm font-bold text-slate-900 mb-1">Tech Assigned: Raj Kumar</p>
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Distance: 4.2 km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">12<span className="text-sm font-bold text-slate-400 ml-1">min</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
};

const ProblemSection = () => (
  <section className="py-32 bg-white relative overflow-hidden">
    <div className="container mx-auto max-w-7xl px-8">
      <Reveal>
        <div className="grid grid-cols-12 gap-12 lg:gap-20 mb-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-blue-600"></span>
              The Status Quo
            </h2>
            <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Breakdowns stop income. <br />
              <span className="text-slate-400">Traditional systems don't care.</span>
            </h3>
          </div>
          <div className="col-span-12 lg:col-span-7 flex flex-col justify-end">
            <p className="text-xl lg:text-2xl text-slate-600 font-medium leading-relaxed">
              Legacy aggregators treat dispatch as a call-center cost. Drivers wait 180+ minutes with zero visibility, while gig workers and fleets bleed capital by the hour. We rebuilt the infrastructure from the ground up.
            </p>
          </div>
        </div>
      </Reveal>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
      >
        {[
          { icon: Clock, title: "180m Average Wait", desc: "Traditional services rely on manual call trees, creating massive latency." },
          { icon: Banknote, title: "Predatory Pricing", desc: "Unverified local garages exploit vulnerability when you're stranded." },
          { icon: AlertTriangle, title: "Zero Visibility", desc: "No tracking, no accountability, high anxiety during emergencies." }
        ].map((item, i) => (
          <motion.div key={i} variants={fadeUp} className="group cursor-pointer">
            <div className="h-full bg-white border border-slate-200/60 rounded-[2rem] p-10 transition-all duration-500 hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-2 relative overflow-hidden group-hover:border-blue-100">
              <div className="w-16 h-16 rounded-2xl bg-blue-50/50 shadow-sm flex items-center justify-center mb-8 group-hover:bg-blue-600 transition-colors duration-500 border border-slate-100">
                <item.icon className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors duration-500" />
              </div>
              <h4 className="text-2xl font-bold mb-4 text-slate-900 group-hover:text-blue-900 transition-colors">{item.title}</h4>
              <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

const LiveTrackingSection = () => (
  <section className="py-32 bg-slate-50 border-y border-slate-200/50">
    <div className="container mx-auto max-w-7xl px-8">
      <div className="grid grid-cols-12 gap-16 lg:gap-24 items-center">
        <div className="col-span-12 lg:col-span-6 order-2 lg:order-1">
          <Reveal>
            <div className="bg-white rounded-[2rem] border border-slate-200/50 p-10 lg:p-12 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10 flex flex-col gap-12">
                <div className="flex items-start gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Algorithmic Matching</h4>
                    <p className="text-slate-500 font-medium">Pings closest verified tech within 500ms based on skill matrix and real-time traffic.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Navigation className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Live Telemetry</h4>
                    <p className="text-slate-500 font-medium">Millisecond-precise GPS tracking on a web interface. No app download required.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-6 group">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Digital Resolution</h4>
                    <p className="text-slate-500 font-medium">Transparent billing via automated audits. What you see is exactly what you pay.</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        
        <div className="col-span-12 lg:col-span-6 order-1 lg:order-2">
          <Reveal delay={0.2}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6">Operations Layer</h2>
            <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] mb-8">
              Dispatch Intelligence.
            </h3>
            <p className="text-xl text-slate-600 font-medium leading-relaxed mb-10">
              We replaced the call center with a hyper-local routing engine. When you request aid, the platform automatically calculates ETA, matches required skills, and streams location data instantly.
            </p>
            <ul className="space-y-5">
              {["Sub-45 minute guaranteed ETA", "Zero app installation barrier", "Direct secure channel to technician"].map((text, i) => (
                <li key={i} className="flex items-center gap-4 text-slate-900 font-bold text-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

const TargetAudienceSection = () => {
  const partners = [
    { title: "Fleet Operators", desc: "Commercial fleet owners minimizing downtime and protecting margins.", icon: TruckIcon, color: "blue" },
    { title: "OEM & Dealerships", desc: "Automobile manufacturers providing white-labeled roadside support.", icon: Building2, color: "indigo" },
    { title: "Insurance Firms", desc: "Seamless claim integration and instant dispatch for policyholders.", icon: Shield, color: "emerald" },
    { title: "Individual Owners", desc: "Car and bike owners seeking premium, high-trust emergency care.", icon: Car, color: "orange" }
  ];

  const getColorClasses = (color: string) => {
    switch(color) {
      case 'blue': return 'text-blue-600 bg-blue-50 border-blue-100 group-hover:bg-blue-600';
      case 'indigo': return 'text-indigo-600 bg-indigo-50 border-indigo-100 group-hover:bg-indigo-600';
      case 'emerald': return 'text-emerald-600 bg-emerald-50 border-emerald-100 group-hover:bg-emerald-600';
      case 'orange': return 'text-orange-600 bg-orange-50 border-orange-100 group-hover:bg-orange-600';
      default: return 'text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-600';
    }
  };

  return (
    <section className="py-32 bg-[#fafafa] relative overflow-hidden border-t border-slate-200/50">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="container mx-auto max-w-7xl px-8 relative z-10">
        <Reveal className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-6">Strategic Partners</h2>
          <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
            Who builds with ResQNow?
          </h3>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            Our algorithmic dispatch network is engineered for scale. From individual vehicle owners to massive enterprise fleets, we ensure mobility never stops.
          </p>
        </Reveal>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {partners.map((partner, i) => (
            <motion.div 
              key={i}
              variants={fadeUp}
              whileHover={{ y: -10, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white border border-slate-200/60 rounded-[2rem] p-8 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] transition-shadow duration-300 group cursor-default relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center mb-8 transition-colors duration-500 border ${getColorClasses(partner.color)}`}>
                  <partner.icon className="h-6 w-6 group-hover:text-white transition-colors duration-500" />
                </div>
                
                <h4 className="text-xl font-bold text-slate-900 mb-3">{partner.title}</h4>
                <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6 flex-grow">{partner.desc}</p>
                
                <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span>Learn More</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const ServicesSection = () => (
  <section className="py-32 bg-white text-slate-900 overflow-hidden relative border-t border-slate-200/50">
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    <div className="container mx-auto max-w-7xl px-8 relative z-10">
      <Reveal className="mb-20 text-center">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-6">Capabilities</h2>
        <h3 className="text-4xl lg:text-6xl font-black tracking-tight leading-tight">
          Comprehensive recovery.
        </h3>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200/60 rounded-[2rem] overflow-hidden border border-slate-200">
        {[
          "Towing", "Battery", "Flat Tire", "Fuel Delivery",
          "Lockout", "Winching", "Mechanical", "EV Charging"
        ].map((service, i) => (
          <div key={i} className="bg-slate-50 backdrop-blur-sm p-10 hover:bg-white transition-colors flex flex-col justify-center items-center text-center group cursor-pointer">
            <span className="text-xl font-bold text-slate-600 group-hover:text-slate-900 group-hover:scale-105 transition-all">{service}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const FinalCTASection = () => (
  <section className="py-40 bg-white text-center relative overflow-hidden">
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    <div className="absolute -bottom-[400px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-50 rounded-full blur-[100px] pointer-events-none" />

    <div className="container mx-auto max-w-4xl px-8 relative z-10">
      <Reveal>
        <h2 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.05]">
          Roadside assistance, <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">reimagined.</span>
        </h2>
        <p className="text-xl lg:text-2xl text-slate-500 font-medium mb-12 max-w-2xl mx-auto">
          Fast. Transparent. Built for modern mobility.
        </p>
        <Button size="xl" className="h-16 px-12 rounded-full bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all" asChild>
          <Link to="/">Explore the Platform</Link>
        </Button>
      </Reveal>
    </div>
  </section>
);

const WhyResQNow = () => {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-200 selection:text-slate-900 font-sans">
      <HeroSection />
      <ProblemSection />
      <LiveTrackingSection />
      <TargetAudienceSection />
      <ServicesSection />
      <FinalCTASection />
    </div>
  );
};

export default WhyResQNow;
