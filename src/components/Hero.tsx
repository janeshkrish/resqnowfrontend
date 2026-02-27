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
              <h1 className="text-5xl lg:text-[5rem] font-black text-foreground tracking-tighter leading-[1] drop-shadow-sm">
                Fastest <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-rose-500 animate-gradient-x">
                  Roadside Rescue.
                </span>
              </h1>

              <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-semibold">
                Professional mechanics and tow trucks dispatched to your exact location in minutes. Available 24/7 across the city.
              </p>
            </div>

            {/* MNC Standard Action Area */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
              <Button
                size="xl"
                className="group relative bg-rose-600 hover:bg-rose-700 text-white font-black px-10 py-7 text-lg rounded-[1.25rem] shadow-[0_0_40px_rgba(225,29,72,0.4)] hover:shadow-[0_0_60px_rgba(225,29,72,0.6)] transition-all overflow-hidden"
                asChild
              >
                <Link to="/emergency">
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-t from-black/20 to-transparent mix-blend-overlay"></span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent transition-opacity duration-500"></div>
                  <PhoneCall className="w-5 h-5 mr-3 relative z-10 animate-[pulse_1.5s_ease-in-out_infinite]" />
                  <span className="relative z-10">Emergency SOS</span>
                </Link>
              </Button>

              <Button
                size="xl"
                variant="outline"
                className="bg-white/80 backdrop-blur-md dark:bg-slate-900/80 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 font-bold px-10 py-7 text-lg rounded-[1.25rem] shadow-sm hover:shadow-md transition-all group"
                asChild
              >
                <Link to="/services">
                  Browse Services
                  <ArrowRight className="w-5 h-5 ml-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
          <div className="lg:col-span-6 relative mt-16 lg:mt-0 px-4 sm:px-0 flex justify-center lg:justify-end isolate">

            {/* Ultra-Modern Radar/Map Background Abstraction */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 dark:opacity-40">
              <div className="absolute w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] border border-primary/20 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute w-[200px] h-[200px] sm:w-[350px] sm:h-[350px] border border-primary/30 rounded-full animate-[pulse_3s_ease-in-out_infinite]"></div>
              <div className="absolute w-[100px] h-[100px] sm:w-[200px] sm:h-[200px] border border-primary/40 rounded-full"></div>
            </div>

            {/* Glowing Map Pin in Background */}
            <div className="absolute top-[10%] right-[20%] w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center animate-bounce blur-[1px]">
              <MapPin className="text-rose-500/50 w-8 h-8" />
            </div>

            {/* Floating Live Dispatch Widget */}
            <div className="absolute -left-4 sm:-left-12 top-12 sm:top-24 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4)] animate-fade-in hover:-translate-y-1 transition-transform hidden sm:block">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Technician" className="w-12 h-12 rounded-full ring-2 ring-primary/20 object-cover" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></div>
                </div>
                <div className="pr-2">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Dispatched</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Mike • Tow Truck</p>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-primary" /> Arriving in 12 min
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-20 w-full max-w-md bg-white/90 dark:bg-card/90 backdrop-blur-2xl rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/60 dark:border-slate-800/80 overflow-hidden">
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
