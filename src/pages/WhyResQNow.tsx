import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, Activity, Clock, Shield, MapPin, CheckCircle2, Navigation,
  Banknote, AlertTriangle, Smartphone, Target, Wrench
} from "lucide-react";

// --- Framer Motion variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
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

// --- Sections ---

const HeroSection = () => (
  <section className="pt-32 pb-24 border-b border-slate-200">
    <div className="container mx-auto max-w-[1400px] px-8">
      <div className="grid grid-cols-12 gap-16 items-center">
        {/* Left Side: 7 columns for text */}
        <div className="col-span-12 lg:col-span-7">
          <Reveal>
            <h1 className="text-[4rem] font-black leading-[1.05] tracking-tight text-slate-900 mb-6">
              Built for people who <br />
              <span className="text-red-600">can't afford to stop.</span>
            </h1>
            <p className="text-2xl text-slate-600 font-medium leading-relaxed max-w-2xl mb-10">
              Real-time roadside assistance platform designed for modern mobility. 
              We replace chaos with transparent, algorithmic dispatch.
            </p>
            <div className="flex items-center gap-4">
              <Button size="xl" className="h-14 px-8 rounded-none bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors" asChild>
                <Link to="/map">
                  Open Live Radar <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="h-14 px-8 rounded-none border-slate-300 text-slate-900 font-bold hover:bg-slate-50 transition-colors" asChild>
                <Link to="/services">
                  Explore Services
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Right Side: 5 columns for Dashboard Graphic */}
        <div className="col-span-12 lg:col-span-5 relative">
          <Reveal delay={0.2}>
            <div className="w-full bg-white border border-slate-200 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Dispatch</div>
                <div className="flex items-center gap-2 text-xs font-bold text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  LIVE
                </div>
              </div>
              
              <div className="bg-slate-50 h-[240px] mb-4 relative overflow-hidden border border-slate-100">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                
                {/* Route Line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 20 80 Q 50 20 80 40" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                
                <div className="absolute top-[35%] right-[15%] w-4 h-4 bg-slate-900 rounded-full border-2 border-white shadow-sm" />
                <div className="absolute bottom-[15%] left-[15%] w-6 h-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                  <Wrench size={10} className="text-white" />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-900">Tech Assigned: Raj Kumar</p>
                  <p className="text-xs text-slate-500">Distance: 4.2 km</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">12 <span className="text-sm font-bold text-slate-500">min</span></p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

const ProblemSection = () => (
  <section className="py-24 border-b border-slate-200 bg-[#FAFAFA]">
    <div className="container mx-auto max-w-[1400px] px-8">
      <Reveal>
        <div className="grid grid-cols-12 gap-8 mb-16">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">The Status Quo</h2>
            <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Breakdowns stop income. <br />
              Traditional systems don't care.
            </h3>
          </div>
          <div className="col-span-12 lg:col-span-7 flex flex-col justify-end">
            <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-2xl">
              Legacy aggregators treat dispatch as a call-center cost. Drivers wait 180+ minutes with zero visibility, while gig workers and fleets bleed capital by the hour. We rebuilt the infrastructure from the ground up.
            </p>
          </div>
        </div>
      </Reveal>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[
          { icon: Clock, title: "180m Average Wait", desc: "Traditional services rely on manual call trees." },
          { icon: Banknote, title: "Predatory Pricing", desc: "Unverified local garages exploit vulnerability." },
          { icon: AlertTriangle, title: "Zero Visibility", desc: "No tracking, no accountability, high anxiety." }
        ].map((item, i) => (
          <motion.div key={i} variants={fadeUp} className="bg-white p-8 border border-slate-200">
            <item.icon className="h-8 w-8 text-red-600 mb-6" />
            <h4 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h4>
            <p className="text-slate-600 font-medium leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

const LiveTrackingSection = () => (
  <section className="py-24 border-b border-slate-200">
    <div className="container mx-auto max-w-[1400px] px-8">
      <div className="grid grid-cols-12 gap-16 items-center">
        <div className="col-span-12 lg:col-span-6 order-2 lg:order-1">
          <Reveal>
            <div className="bg-slate-50 border border-slate-200 p-8">
              {/* Abstract Uber-style tracking visualization */}
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 text-slate-900" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Algorithmic Matching</h4>
                    <p className="text-sm text-slate-500">Pings closest verified tech within 500ms.</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200 ml-5" />
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Navigation className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Live Telemetry</h4>
                    <p className="text-sm text-slate-500">Real-time GPS tracking on a web interface.</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200 ml-5" />
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Digital Resolution</h4>
                    <p className="text-sm text-slate-500">Transparent billing via automated audits.</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="col-span-12 lg:col-span-6 order-1 lg:order-2">
          <Reveal delay={0.1}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Operations Layer</h2>
            <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight mb-6">
              Dispatch Intelligence.
            </h3>
            <p className="text-xl text-slate-600 font-medium leading-relaxed mb-8">
              We replaced the call center with a hyper-local routing engine. When you request aid, the platform automatically calculates ETA, matches required skills, and streams location data instantly.
            </p>
            <ul className="space-y-4">
              {["Sub-45 minute guaranteed ETA", "No app download required to track", "Direct secure channel to technician"].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-900 font-bold">
                  <div className="w-1.5 h-1.5 bg-red-600" />
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

const ServicesSection = () => (
  <section className="py-24 border-b border-slate-200 bg-[#FAFAFA]">
    <div className="container mx-auto max-w-[1400px] px-8">
      <Reveal className="mb-16">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Capabilities</h2>
        <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Comprehensive recovery.
        </h3>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-slate-200 border border-slate-200">
        {[
          "Towing", "Battery", "Flat Tire", "Fuel Delivery",
          "Lockout", "Winching", "Mechanical", "EV Charging"
        ].map((service, i) => (
          <div key={i} className="bg-white p-8 hover:bg-slate-50 transition-colors flex flex-col justify-center items-center text-center">
            <span className="text-lg font-bold text-slate-900">{service}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const AudienceSection = () => (
  <section className="py-24 border-b border-slate-200">
    <div className="container mx-auto max-w-[1400px] px-8">
      <Reveal className="mb-16">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Audiences</h2>
        <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Who we built this for.
        </h3>
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-6">
        {[
          { title: "Gig Workers", desc: "Minimize downtime and protect daily earnings." },
          { title: "Fleet Operators", desc: "B2B dashboard for bulk monitoring and dispatch." },
          { title: "Commuters", desc: "Zero-anxiety recovery without predatory pricing." }
        ].map((item, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div className="border border-slate-200 p-8 h-full flex flex-col">
              <h4 className="text-2xl font-black text-slate-900 mb-4">{item.title}</h4>
              <p className="text-slate-600 font-medium leading-relaxed mt-auto">{item.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const HyperlocalSection = () => (
  <section className="py-24 border-b border-slate-200 bg-slate-900 text-white">
    <div className="container mx-auto max-w-[1400px] px-8">
      <div className="grid grid-cols-12 gap-16 items-center">
        <div className="col-span-12 lg:col-span-5">
          <Reveal>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Coverage</h2>
            <h3 className="text-4xl font-black tracking-tight leading-tight mb-6">
              Hyperlocal deployment.
            </h3>
            <p className="text-xl text-slate-300 font-medium leading-relaxed mb-8">
              Starting in Coimbatore, mapping the entire Tamil Nadu mobility grid. We build density first to ensure the network is robust before expanding.
            </p>
            <div className="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold">
              <MapPin className="h-4 w-4 text-red-500" />
              Phase 1: Coimbatore Grid Active
            </div>
          </Reveal>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <Reveal delay={0.2}>
            {/* Minimal dark map representation */}
            <div className="w-full h-[400px] border border-slate-800 bg-slate-950 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
              {/* Nodes */}
              <div className="relative w-full h-full">
                <div className="absolute top-[40%] left-[50%] w-3 h-3 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,1)]" />
                <div className="absolute top-[30%] left-[40%] w-1.5 h-1.5 bg-slate-600" />
                <div className="absolute top-[60%] left-[55%] w-1.5 h-1.5 bg-slate-600" />
                <div className="absolute top-[45%] left-[65%] w-1.5 h-1.5 bg-slate-600" />
                
                {/* Connecting lines */}
                <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="50" y1="40" x2="40" y2="30" stroke="#475569" strokeWidth="0.5" />
                  <line x1="50" y1="40" x2="55" y2="60" stroke="#475569" strokeWidth="0.5" />
                  <line x1="50" y1="40" x2="65" y2="45" stroke="#475569" strokeWidth="0.5" />
                </svg>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

const ComparisonSection = () => (
  <section className="py-24 border-b border-slate-200">
    <div className="container mx-auto max-w-[1000px] px-8">
      <Reveal className="text-center mb-16">
        <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
          A fundamental shift.
        </h3>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="border border-slate-200 bg-white">
          <div className="grid grid-cols-2 border-b border-slate-200 bg-[#FAFAFA]">
            <div className="p-6 font-bold text-slate-500 uppercase tracking-widest text-sm">Traditional</div>
            <div className="p-6 font-bold text-slate-900 uppercase tracking-widest text-sm border-l border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-900"></span> ResQNow
            </div>
          </div>
          
          {[
            ["Call-center routing", "Algorithmic matching"],
            ["Unknown technician", "Vetted fleet partner"],
            ["Manual phone updates", "Live web telemetry"],
            ["Opaque pricing", "Fixed transparent billing"],
            ["120-180 min wait", "Sub-45 min guarantee"]
          ].map(([oldWay, newWay], i) => (
            <div key={i} className="grid grid-cols-2 border-b border-slate-100 last:border-0">
              <div className="p-6 text-slate-500 font-medium">{oldWay}</div>
              <div className="p-6 font-bold text-slate-900 border-l border-slate-200">{newWay}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  </section>
);

const FinalCTASection = () => (
  <section className="py-32 bg-slate-50 text-center">
    <div className="container mx-auto max-w-[1400px] px-8">
      <Reveal>
        <h2 className="text-5xl font-black tracking-tight text-slate-900 mb-6">
          Roadside assistance, <br /> reimagined.
        </h2>
        <p className="text-xl text-slate-600 font-medium mb-10 max-w-lg mx-auto">
          Fast. Transparent. Built for modern mobility.
        </p>
        <Button size="xl" className="h-16 px-12 rounded-none bg-red-600 text-white font-bold text-lg hover:bg-red-700 transition-colors" asChild>
          <Link to="/">Open resqnow.org</Link>
        </Button>
      </Reveal>
    </div>
  </section>
);

const WhyResQNow = () => {
  return (
    <div className="min-h-screen bg-white selection:bg-slate-200 selection:text-slate-900 font-sans">
      <HeroSection />
      <ProblemSection />
      <LiveTrackingSection />
      <ServicesSection />
      <AudienceSection />
      <HyperlocalSection />
      <ComparisonSection />
      <FinalCTASection />
    </div>
  );
};

export default WhyResQNow;
