import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Wrench, Zap, IndianRupee, Clock, ShieldCheck, ArrowRight, LineChart } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
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

const TechnicianLanding = () => {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-200 selection:text-slate-900 font-sans">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-white border-b border-slate-200/60">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full -translate-y-1/4 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4" />
        </div>

        <div className="container relative mx-auto max-w-7xl px-4 lg:px-8 z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-8">
                <Wrench size={14} className="text-blue-600" />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-blue-700">ResQNow Partner Network</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 mb-6 leading-[1.05]">
                Turn your skills into <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">predictable income.</span>
              </h1>
              <p className="text-xl lg:text-2xl text-slate-500 font-medium leading-relaxed mb-10 max-w-xl">
                Join Tamil Nadu's fastest-growing digital roadside assistance grid. We provide the jobs, the tech, and guaranteed payouts. You focus on the fix.
              </p>
              
              <div className="flex flex-wrap items-center gap-4">
                <Button size="xl" className="h-14 px-8 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300" asChild>
                  <Link to="/technician/register">
                    Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" className="h-14 px-8 rounded-xl bg-white border-slate-200 font-bold text-slate-700 hover:bg-slate-50 shadow-sm" asChild>
                  <Link to="/technician/login">
                    Partner Login
                  </Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="relative hidden lg:block">
              {/* Floating Dashboard Element */}
              <motion.div 
                className="relative bg-white border border-slate-200 rounded-[2rem] p-8 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)]"
                initial={{ rotateY: -10, rotateX: 5 }}
                animate={{ rotateY: 0, rotateX: 0 }}
                transition={{ duration: 1.5, type: "spring" }}
              >
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <LineChart size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Weekly Earnings</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Auto-Deposited</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">₹14,500</p>
                    <p className="text-sm font-bold text-emerald-500">+12% this week</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { title: "Toyota Innova - Battery Jump", time: "Today, 10:45 AM", amount: "₹450" },
                    { title: "Honda City - Flat Tire", time: "Today, 08:30 AM", amount: "₹300" },
                    { title: "Hyundai Creta - Towing", time: "Yesterday", amount: "₹1,200" }
                  ].map((job, i) => (
                    <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="font-bold text-slate-900">{job.title}</p>
                        <p className="text-xs font-bold text-slate-400">{job.time}</p>
                      </div>
                      <p className="font-black text-slate-900">{job.amount}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 lg:py-32 relative">
        <div className="container mx-auto max-w-7xl px-4 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-6">Why Join Us?</h2>
            <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Built for mechanics who want to grow.
            </h3>
          </Reveal>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {[
              { icon: IndianRupee, title: "Zero Commission Fees", desc: "Keep 100% of the service charge on standard dispatches. No hidden aggregator cuts." },
              { icon: Zap, title: "Instant Algorithmic Dispatch", desc: "No haggling with call centers. Receive high-intent jobs straight to your phone based on your location." },
              { icon: ShieldCheck, title: "Guaranteed Payouts", desc: "Digital payments are secured in escrow and deposited weekly without delays." },
              { icon: Clock, title: "Flexible Schedule", desc: "Log in when you want, log out when you're done. You are in complete control of your hours." }
            ].map((benefit, i) => (
              <motion.div 
                key={i}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/60 hover:border-blue-200 transition-colors"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 border border-blue-100">
                  <benefit.icon size={24} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h4>
                <p className="text-slate-500 font-medium leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-24 bg-white border-t border-slate-200/50">
        <div className="container mx-auto max-w-4xl px-4 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-4xl font-black text-slate-900 mb-6">Ready to upgrade your garage?</h2>
            <p className="text-lg text-slate-500 mb-10">Verification takes less than 24 hours. Start earning immediately after approval.</p>
            <Button size="xl" className="h-14 px-10 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg" asChild>
              <Link to="/technician/register">Create Partner Account</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default TechnicianLanding;
