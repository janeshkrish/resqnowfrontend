import { Shield, Clock, CheckSquare, MapPin, User, Users, Car, Award, Target, Eye, Sparkles, Building2, Globe2, Briefcase, ChevronRight } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { motion, useScroll, useTransform } from "framer-motion";
import msmeLogo from "../../assets/msme-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    className={className}
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-100px" }}
    transition={{ delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const About = () => {
  const [stats, setStats] = useState({
    users: 0,
    technicians: 0,
    completedServices: 0
  });

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch("/api/public/stats");
        if (res.ok) {
          const data = await res.json();
          setStats({
            users: data.users || 0,
            technicians: data.technicians || 0,
            completedServices: data.completedServices || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFCFF] selection:bg-blue-100 selection:text-blue-900 font-sans pb-32">
      {/* Heavy Corporate Hero Section */}
      <div className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden border-b border-slate-200/50">
        <motion.div style={{ y }} className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,rgba(255,255,255,0)_70%)] blur-[100px]" />
          <div className="absolute top-[30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.08)_0%,rgba(255,255,255,0)_70%)] blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-70 mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)" />
        </motion.div>

        <div className="container relative mx-auto max-w-6xl px-4 lg:px-8 text-center flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="inline-flex items-center gap-3 rounded-full border border-slate-200/60 bg-white/80 backdrop-blur-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.25em] text-slate-800 shadow-sm mb-10"
          >
            <Building2 className="h-4 w-4 text-blue-600" />
            Corporate Overview
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl lg:text-[5rem] font-black text-slate-900 tracking-tight leading-[1.05] mb-8"
          >
            Pioneering India's <br className="hidden lg:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600">
              Mobility Infrastructure
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-xl lg:text-2xl font-medium text-slate-600 max-w-4xl leading-relaxed"
          >
            A high-availability, digitally native super-app engineering the systemic eradication of roadside vulnerability and operational latency across the nation.
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-24">
        
        {/* Enterprise MSME Certification */}
        <Reveal>
          <div className="relative bg-white/60 backdrop-blur-3xl rounded-[3rem] p-10 lg:p-14 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col lg:flex-row items-center gap-10 lg:gap-16 mx-auto mb-32 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/30 to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 w-40 h-40 lg:w-48 lg:h-48 shrink-0 bg-white rounded-3xl flex items-center justify-center border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-6 group-hover:scale-105 transition-transform duration-700">
              <img src={msmeLogo} alt="MSME Udyam Registered" className="w-full h-full object-contain filter contrast-125" />
            </div>
            <div className="relative z-10 text-center lg:text-left flex-1">
              <div className="inline-flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-emerald-600" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Government Verified</p>
              </div>
              <h3 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight">MSME Udyam Registration</h3>
              <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-3xl">
                ResQNow operates as a fully compliant, state-recognized entity, driving massive formalization within the Indian automotive aftermarket. We are actively deploying scalable infrastructure that fuels the gig-economy in Tier-2 demographic centers.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Corporate Pillars (Vision & Mission) */}
        <div className="grid lg:grid-cols-2 gap-10 mb-32">
          <Reveal delay={0.1}>
            <div className="relative bg-white/80 backdrop-blur-xl h-full rounded-[3rem] p-12 lg:p-16 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.08)] border border-slate-100 overflow-hidden group hover:bg-white transition-all duration-700">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-blue-600/10 transition-colors duration-700" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center mb-10 shadow-[0_10px_30px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform duration-500">
                  <Target size={40} strokeWidth={1.5} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Enterprise Mission</h2>
                <p className="text-xl text-slate-600 leading-relaxed font-medium">
                  To systematically engineer a seamless, AI-driven dispatch network that connects stranded travelers with vetted technicians in real-time. We are unconditionally committed to eradicating operational latency and enforcing a zero-trust-deficit ecosystem nationwide.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="relative bg-slate-900 h-full rounded-[3rem] p-12 lg:p-16 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-800 overflow-hidden group">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/30 transition-colors duration-700" />
              
              <div className="relative z-10 text-white">
                <div className="w-20 h-20 bg-white text-slate-900 rounded-[1.5rem] flex items-center justify-center mb-10 shadow-[0_10px_30px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">
                  <Globe2 size={40} strokeWidth={1.5} />
                </div>
                <h2 className="text-4xl font-black text-white mb-6 tracking-tight">Global Vision</h2>
                <p className="text-xl text-slate-300 leading-relaxed font-medium">
                  To become the central, interconnected mobility grid for India's vehicular future. A singular operational layer relied upon by corporate fleets, OEMs, and daily drivers to keep the nation moving with absolute security and unprecedented efficiency.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* The Enterprise Catalyst */}
        <Reveal>
          <div className="relative bg-white/70 backdrop-blur-3xl rounded-[4rem] p-12 lg:p-24 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] border border-white mb-32 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_50%)]" />
            
            <div className="relative z-10 max-w-5xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-[2px] bg-blue-600" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">The Catalyst</h2>
              </div>
              
              <h3 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-12">
                Forged from <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-900">Systemic Failure.</span>
              </h3>

              <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
                <div className="space-y-8 text-xl text-slate-600 font-medium leading-relaxed">
                  <p>
                    The structural foundation of ResQNow was established following a pivotal breakdown in 2025 experienced by Arokiya Aswanth A. Stranded in an isolated corridor with zero immediate assistance, the terrifying vulnerability of the Indian roadside became starkly apparent.
                  </p>
                  <p>
                    This incident exposed a catastrophic failure in the traditional aftermarket landscape: an absolute disconnect between drivers in distress and localized mechanical skill, forcing victims into high-anxiety environments dominated by unverified, predatory local garages.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 relative">
                  <div className="absolute top-8 left-8">
                    <Briefcase className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="mt-12 text-2xl font-black text-slate-900 leading-snug">
                    "The objective was uncompromising—engineer a hyper-local, digitally native dispatch network that enforces strict compliance, trust, and speed at scale."
                  </p>
                  <p className="mt-8 text-sm font-bold text-slate-500 uppercase tracking-widest">
                    — Executive Board, ResQNow
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Real-time Enterprise Telemetry */}
        <div className="mb-16">
          <Reveal className="flex flex-col lg:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Network Telemetry</h2>
              <p className="text-lg text-slate-500 font-medium">Live operational metrics across the ResQNow platform grid.</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Systems Online
            </div>
          </Reveal>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { icon: User, count: stats.users, suffix: "+", label: "Active Enterprise Users" },
              { icon: Users, count: stats.technicians, suffix: "+", label: "Vetted Fleet Partners" },
              { icon: Car, count: stats.completedServices, suffix: "+", label: "Resolved Incidents" },
              { icon: Clock, count: 24, suffix: "/7", label: "Algorithmic Uptime" },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} className="group">
                <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_15px_40px_-15px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col items-start hover:shadow-[0_30px_60px_-15px_rgba(37,99,235,0.1)] transition-all duration-500 h-full relative overflow-hidden">
                  <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-150 transition-transform duration-700">
                    <stat.icon size={160} />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center mb-8 border border-slate-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                    <stat.icon size={26} strokeWidth={2} />
                  </div>
                  <p className="text-5xl font-black text-slate-900 mb-3 tracking-tighter">
                    <AnimatedCounter end={stat.count} suffix={stat.suffix} duration={2000} />
                  </p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default About;
