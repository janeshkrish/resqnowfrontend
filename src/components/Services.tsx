
import {
  Wrench, ArrowRight, Zap, PhoneCall,
  Truck as TowTruck, Gauge, Settings, Unlock, Droplets, ShieldCheck, BatteryCharging
} from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SERVICE_CATALOG } from "@/config/serviceCatalog";

const serviceStyles: Record<string, { icon: any; color: string }> = {
  "towing": { icon: TowTruck, color: "bg-gradient-to-br from-red-500 to-red-600" },
  "flat-tire": { icon: Gauge, color: "bg-gradient-to-br from-blue-500 to-blue-600" },
  "battery": { icon: BatteryCharging, color: "bg-gradient-to-br from-purple-500 to-purple-600" },
  "mechanical": { icon: Settings, color: "bg-gradient-to-br from-orange-500 to-orange-600" },
  "fuel": { icon: Droplets, color: "bg-gradient-to-br from-green-500 to-green-600" },
  "lockout": { icon: Unlock, color: "bg-gradient-to-br from-yellow-500 to-yellow-600" },
  "winching": { icon: ShieldCheck, color: "bg-gradient-to-br from-indigo-500 to-indigo-600" },
  "ev-charging": { icon: Zap, color: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
  "other": { icon: Wrench, color: "bg-gradient-to-br from-gray-500 to-gray-600" }
};

const services = SERVICE_CATALOG
  .filter((s) => ["towing", "flat-tire", "battery", "mechanical", "fuel", "lockout", "winching", "ev-charging"].includes(s.id))
  .map((s) => ({
    ...s,
    icon: serviceStyles[s.id]?.icon || Wrench,
    color: serviceStyles[s.id]?.color || "bg-gradient-to-br from-gray-500 to-gray-600"
  }));

const Services = ({ compact = false }: { compact?: boolean }) => {
  const isMobile = useIsMobile();

  return (
    <section className={cn(
      !compact && "bg-gradient-to-b from-background to-gray-50/50",
      !compact ? (isMobile ? "py-6 pb-24" : "py-16") : ""
    )} id="services">
      <div className={cn(!compact && "container", !compact ? (isMobile ? "px-3" : "px-4") : "")}>
        {/* Modern Header */}
        {!compact && (
          <div className={cn("mb-6", isMobile ? "text-left px-1" : "text-left mb-16 mt-8")}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl">
                {!isMobile && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-full mb-6 border border-rose-100 dark:border-rose-500/20">
                    <Wrench className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Service Catalog</span>
                  </div>
                )}
                <h2 className={cn(
                  "font-black text-foreground tracking-tight",
                  isMobile ? "text-xl mb-2" : "text-4xl md:text-5xl mb-4 leading-tight"
                )}>
                  {isMobile ? "Quick Services" : "Professional Roadside Assistance & Repairs."}
                </h2>
                <p className={cn(
                  "text-slate-500 dark:text-slate-400 font-medium",
                  isMobile ? "text-sm" : "text-lg md:text-xl"
                )}>
                  {isMobile ? "Available 24/7 near you" : "From flat tires to complete breakdowns, our verified mechanics are ready to dispatch in minutes."}
                </p>
              </div>
              
              {!isMobile && (
                 <Button variant="outline" className="hidden md:flex bg-white dark:bg-card rounded-2xl border-slate-200 dark:border-slate-800 py-6 px-6 font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    View All Services <ArrowRight className="ml-2 w-4 h-4" />
                 </Button>
              )}
            </div>
          </div>
        )}

        {/* App-Style Services Grid for Mobile, Modern Grid for Desktop */}
        <div className={cn(
          isMobile
            ? "grid grid-cols-4 gap-2" // Mobile: 4 columns
            : "grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        )}>
          {services.slice(0, 8).map((service, index) => (
            <Link
              key={service.id}
              to={`/request-service/${service.id}`}
              className={cn(
                "group relative animate-fade-in",
                isMobile && "active:scale-95 transition-transform"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {isMobile ? (
                // Compact Mobile Item (Icon + Text)
                <div className="flex flex-col items-center text-center gap-2 p-1 relative z-10">
                  {/* Icon Container with Glassmorphism highlights */}
                  <div className={cn(
                    "w-[3.5rem] h-[3.5rem] rounded-[1.1rem] flex items-center justify-center shadow-md border border-white/20 relative overflow-hidden isolate",
                    service.color
                  )}>
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"></div>
                    <service.icon className="h-6 w-6 text-white drop-shadow-sm relative z-10" />
                  </div>

                  {/* Title */}
                  <span className="text-[11px] font-bold text-foreground leading-tight tracking-tight">
                    {service.name}
                  </span>
                </div>
              ) : (
                // Original desktop card updated to MNC standard
                <div className="bg-white dark:bg-card rounded-[2rem] p-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800/60 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2 hover:border-transparent dark:hover:border-transparent transition-all duration-300 relative overflow-hidden group/card">
                  {/* Subtle hover gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover/card:opacity-[0.03] transition-opacity duration-500`}></div>

                  {/* Popular Badge */}
                  {index < 3 && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-1.5 rounded-full shadow-md z-10">
                      <span className="text-[10px] font-black uppercase tracking-wider text-white">
                        Popular
                      </span>
                    </div>
                  )}

                  <div className="text-left relative z-10 flex flex-col h-full">
                    {/* Icon Container - Premium Circle */}
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-6 group-hover/card:scale-110 transition-transform duration-500 group-hover/card:shadow-sm">
                      <service.icon className="h-7 w-7 text-slate-400 dark:text-slate-500 group-hover/card:text-primary transition-colors duration-300" />
                    </div>
                    
                    <div>
                      <h3 className="font-extrabold text-xl text-slate-800 dark:text-slate-100 mb-2 group-hover/card:text-primary transition-colors duration-300">
                        {service.name}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {service.description || "Professional 24/7 service by verified experts."}
                      </p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between opacity-0 group-hover/card:opacity-100 -translate-y-2 group-hover/card:translate-y-0 transition-all duration-300">
                       <span className="text-sm font-bold text-primary">Book Now</span>
                       <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                         <ArrowRight className="w-4 h-4 text-primary" />
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Emergency CTA */}
        {!isMobile && (
          <div className="text-center mt-12">
            <div className="bg-gradient-to-r from-primary to-accent text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden max-w-2xl mx-auto">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 left-4 w-20 h-20 bg-card dark:bg-slate-900/20 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 right-4 w-16 h-16 bg-card dark:bg-slate-900/20 rounded-full blur-xl"></div>
              </div>

              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">
                  Need Immediate Help?
                </h3>
                <p className="text-white/90 mb-6 text-lg">
                  Our emergency response team is ready 24/7
                </p>
                <Button
                  size="lg"
                  className="bg-card dark:bg-slate-900 text-primary hover:bg-card dark:bg-slate-900/90 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 px-8"
                  asChild
                >
                  <Link to="/emergency">
                    <PhoneCall className="mr-2 h-5 w-5" />
                    Call Emergency Line
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Services;
