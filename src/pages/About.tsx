import { Shield, Clock, CheckSquare, MapPin, User, Users, Car, Award, Target, Eye, Sparkles } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import msmeLogo from "../../assets/msme-logo.png";

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

const About = () => {
  const [stats, setStats] = useState({
    users: 0,
    technicians: 0,
    completedServices: 0
  });

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
    <div className="min-h-screen bg-[#FAFCFF] selection:bg-blue-100 selection:text-blue-900 font-sans pb-24">
      {/* Hero Section */}
      <div className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-b from-blue-50/80 to-transparent blur-3xl" />
          <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-gradient-to-t from-emerald-50/60 to-transparent blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-5xl px-4 lg:px-8 text-center flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-blue-600 shadow-sm mb-6"
          >
            <Sparkles className="h-3 w-3" />
            Our Origins
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl lg:text-7xl font-black text-slate-900 tracking-tight leading-none mb-6"
          >
            Engineering the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Future of Mobility</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg lg:text-2xl font-medium text-slate-600 max-w-3xl leading-relaxed"
          >
            From a solitary breakdown in 2025 to a nationwide support grid. We are on a mission to eradicate roadside vulnerability.
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
        
        {/* MSME Udyam Card */}
        <Reveal>
          <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col sm:flex-row items-center gap-6 lg:gap-10 max-w-4xl mx-auto mb-20 hover:shadow-[0_20px_50px_-15px_rgba(37,99,235,0.1)] transition-all">
            <div className="w-32 h-32 shrink-0 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden p-4">
              <img src={msmeLogo} alt="MSME Udyam Registered" className="w-full h-full object-contain" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 mb-2">Government Recognized</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mb-3">MSME Udyam Registered</h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                ResQNow is a recognized Indian startup actively contributing to the formalization of the automotive aftermarket and gig-economy enablement in Tier-2 districts.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Vision & Mission */}
        <div className="grid lg:grid-cols-2 gap-8 mb-24">
          <Reveal delay={0.1}>
            <div className="bg-white h-full rounded-[2.5rem] p-10 lg:p-14 shadow-sm border border-slate-100 hover:shadow-xl transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Target size={120} />
              </div>
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 border border-blue-100">
                <Target size={32} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Our Mission</h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium">
                To revolutionize roadside assistance by building a seamless, AI-driven dispatch network that connects stranded travelers with vetted technicians in real-time. We are committed to eradicating operational latency and creating a zero-trust-deficit ecosystem.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="bg-white h-full rounded-[2.5rem] p-10 lg:p-14 shadow-sm border border-slate-100 hover:shadow-xl transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Eye size={120} />
              </div>
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 border border-emerald-100">
                <Eye size={32} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Our Vision</h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium">
                To become the central, interconnected mobility grid for India's vehicular future. A singular operational layer relied upon by fleets, OEMs, and daily drivers to keep the nation moving securely.
              </p>
            </div>
          </Reveal>
        </div>

        {/* The Story */}
        <Reveal>
          <div className="bg-slate-900 rounded-[3rem] p-10 lg:p-16 text-white relative overflow-hidden mb-24 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:40px_40px] opacity-20 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/3" />
            
            <div className="relative z-10 max-w-4xl mx-auto text-center">
              <h2 className="text-3xl lg:text-5xl font-black mb-8">The Catalyst</h2>
              <div className="space-y-6 text-lg lg:text-xl text-slate-300 font-medium leading-relaxed">
                <p>
                  The concept of ResQNow was born from a pivotal moment in 2025 experienced by Arokiya Aswanth A. Stranded in an isolated area with a vehicle breakdown and no immediate assistance available, the terrifying vulnerability of such a situation became starkly apparent.
                </p>
                <p>
                  It highlighted a critical gap in the traditional roadside assistance landscape: the catastrophic disconnect between drivers in distress and local, available mechanical skill. Stranded motorists were forced into high-anxiety searches leading to unverified local garages that exploited their desperation.
                </p>
                <p className="text-white font-bold">
                  This experience became the foundation for ResQNow. The goal was simple—engineer a hyper-local, digitally native dispatch network that enforces trust and speed, ensuring no traveler is left helpless.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Impact Stats */}
        <div className="mb-16">
          <Reveal className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Platform Impact</h2>
            <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Real-time Network Statistics</p>
          </Reveal>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { icon: User, count: stats.users, suffix: "+", label: "Registered Users", tone: "blue" },
              { icon: Users, count: stats.technicians, suffix: "+", label: "Verified Technicians", tone: "emerald" },
              { icon: Car, count: stats.completedServices, suffix: "+", label: "Services Completed", tone: "indigo" },
              { icon: Award, count: 24, suffix: "/7", label: "Support Availability", tone: "rose" },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 text-center flex flex-col items-center hover:shadow-lg transition-shadow h-full">
                  <div className={`w-12 h-12 rounded-xl bg-${stat.tone}-50 text-${stat.tone}-600 flex items-center justify-center mb-6`}>
                    <stat.icon size={24} />
                  </div>
                  <p className="text-4xl font-black text-slate-900 mb-2">
                    <AnimatedCounter end={stat.count} suffix={stat.suffix} duration={2000} />
                  </p>
                  <p className="text-sm font-bold text-slate-500">{stat.label}</p>
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
