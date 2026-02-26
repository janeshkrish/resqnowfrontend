import { Button } from "./ui/button";
import { ArrowRight, PhoneCall, MapPin, Wrench, Anchor, Battery, ShoppingCart, ShieldCheck, Clock, Star } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 overflow-hidden pt-16 pb-24 border-b border-border/40">
      {/* Premium MNC Background Elements */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0 bg-grid-pattern"></div>
      </div>
      
      {/* Dynamic Glows */}
      <div className="absolute top-0 right-[10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center">
          
          {/* Left Column: Copy & CTAs (Swiggy/Zomato Left-Aligned Style) */}
          <div className="lg:col-span-6 space-y-10 animate-fade-in text-center lg:text-left pt-10 lg:pt-0">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-full text-sm font-semibold border border-slate-200 dark:border-slate-800 shadow-sm mx-auto lg:mx-0 transition-transform hover:scale-105">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-slate-700 dark:text-slate-300">200+ Technicians Active Now</span>
            </div>

            <div className="space-y-6">
              <h1 className="text-5xl lg:text-7xl font-black text-foreground tracking-tight leading-[1.1] drop-shadow-sm">
                Fastest <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-600">
                  Roadside Rescue.
                </span>
              </h1>
              
              <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Professional mechanics and tow trucks dispatched to your exact location in minutes. Available 24/7 across the city.
              </p>
            </div>

            {/* MNC Standard Action Area */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                size="xl"
                className="bg-primary hover:bg-primary/90 text-white font-bold px-10 py-7 text-lg rounded-2xl shadow-[0_8px_30px_rgb(220,38,38,0.25)] hover:shadow-[0_8px_40px_rgb(220,38,38,0.35)] transition-all transform hover:-translate-y-1"
                asChild
              >
                <Link to="/emergency">
                  <PhoneCall className="w-5 h-5 mr-2.5 animate-pulse" />
                  Emergency SOS
                </Link>
              </Button>
              
              <Button
                size="xl"
                variant="outline"
                className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 font-bold px-10 py-7 text-lg rounded-2xl shadow-sm hover:shadow-md transition-all"
                asChild
              >
                <Link to="/services">
                  Browse Services
                  <ArrowRight className="w-5 h-5 ml-2.5 text-slate-400" />
                </Link>
              </Button>
            </div>

            {/* Social Proof Mini */}
            <div className="flex items-center gap-6 justify-center lg:justify-start pt-4 border-t border-slate-200 dark:border-slate-800/60 max-w-md mx-auto lg:mx-0">
               <div className="flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">15 Min ETA</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Verified Pros</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">4.9/5 Rating</span>
               </div>
            </div>
          </div>

          {/* Right Column: Premium Visual & Quick Access (MNC App Style) */}
          <div className="lg:col-span-6 relative mt-12 lg:mt-0 px-4 sm:px-0">
            {/* Decorative Map/Radar background abstraction */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-[3rem] transform rotate-3 scale-105 opacity-50 shadow-inner"></div>
            
            <div className="relative bg-white dark:bg-card rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 isolate overflow-hidden">
               {/* Shine effect */}
               <div className="absolute top-0 left-[-100%] w-[50%] h-[100%] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent skew-x-[-20deg] animate-shimmer"></div>

               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-foreground tracking-tight">Quick Services</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Book instantly, no account needed.</p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                     <Wrench className="w-6 h-6 text-primary" />
                  </div>
               </div>

               {/* Modern High-End Grid */}
               <div className="grid grid-cols-2 gap-4">
                 {[
                   { icon: Anchor, name: "Towing", desc: "Flatbed & Wheel-lift", color: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", link: "/request-service/towing" },
                   { icon: Wrench, name: "Flat Tire", desc: "Repair & Replace", color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", link: "/request-service/flat-tire" },
                   { icon: Battery, name: "Battery", desc: "Jumpstart & Swap", color: "from-amber-500 to-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", link: "/request-service/battery" },
                   { icon: ArrowRight, name: "View All", desc: "Explore Catalog", color: "from-slate-700 to-slate-800", bg: "bg-slate-100 dark:bg-slate-800", text: "text-foreground", link: "/services" }
                 ].map((service, index) => (
                   <Link
                     key={index}
                     to={service.link}
                     className="group relative flex flex-col p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/50 hover:border-transparent hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                   >
                     {/* Hover Gradient Background */}
                     <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                     
                     <div className={`w-12 h-12 rounded-2xl ${service.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                       <service.icon className={`w-6 h-6 ${service.text}`} />
                     </div>
                     <span className="font-bold text-foreground text-lg mb-1">{service.name}</span>
                     <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">{service.desc}</span>
                   </Link>
                 ))}
               </div>

               {/* Parts Store Promo Banner inside card */}
               <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <Link to="/marketplace" className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                           <ShoppingCart className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                           <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Auto Parts Store</h4>
                           <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">OEM & Aftermarket Parts</p>
                        </div>
                     </div>
                     <div className="p-2 rounded-full bg-white dark:bg-slate-950 group-hover:bg-primary group-hover:text-white transition-colors border border-slate-100 dark:border-slate-800 shadow-sm">
                        <ArrowRight className="w-4 h-4" />
                     </div>
                  </Link>
               </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default Hero;
