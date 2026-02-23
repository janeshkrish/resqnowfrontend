
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
          <div className={cn("mb-6", isMobile ? "text-left px-1" : "text-center mb-12")}>
            {!isMobile && (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-3xl mb-6 shadow-lg">
                <ArrowRight className="h-8 w-8 text-white" />
              </div>
            )}
            <h2 className={cn(
              "font-bold text-gray-800",
              isMobile ? "text-xl mb-2" : "text-3xl md:text-4xl mb-4"
            )}>
              {isMobile ? "Quick Services" : "Our Professional Services"}
            </h2>
            <p className={cn(
              "text-gray-600",
              isMobile ? "text-sm" : "text-lg max-w-2xl mx-auto"
            )}>
              {isMobile ? "Available 24/7 near you" : "Comprehensive roadside assistance available 24/7 across all locations"}
            </p>
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
                  <span className="text-[11px] font-bold text-slate-800 leading-tight tracking-tight">
                    {service.name}
                  </span>
                </div>
              ) : (
                // Original desktop card
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                  {/* Popular Badge */}
                  {index < 3 && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-primary to-accent px-2 py-1 rounded-full shadow-lg">
                      <span className="text-xs font-bold text-white">
                        Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-primary/10 group-hover:to-accent/10 transition-all duration-300 mb-4">
                      <service.icon className="h-8 w-8 text-gray-600 group-hover:text-primary transition-colors duration-300" />
                    </div>
                    <h3 className="font-bold text-gray-800 group-hover:text-primary transition-colors duration-300 text-sm leading-tight">
                      {service.name}
                    </h3>
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
                <div className="absolute top-4 left-4 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 right-4 w-16 h-16 bg-white/20 rounded-full blur-xl"></div>
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
                  className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 px-8"
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
