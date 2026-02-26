import { useEffect, useState } from "react";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import VehicleTypes from "@/components/VehicleTypes";
import Testimonials from "@/components/Testimonials";
import TechnicianCTA from "@/components/TechnicianCTA";
import Map from "@/components/Map";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import { MapPin, Search, ArrowRight, Bell, Briefcase, Download } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const MobileDashboard = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Chrome sometimes fires this before React mounts
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      (window as any).deferredPrompt = event;
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
    };

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const canInstallApp = Boolean(deferredPrompt) && !isStandalone;

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      if (isStandalone) {
        toast.info("ResQNow App is already installed on your device.");
        return;
      }

      if (!window.isSecureContext) {
        toast.error("Installation blocked: PWA requires HTTPS or localhost.", {
            description: "If testing on a mobile device on your local network, you must use a secure tunnel or deploy to Netlify."
        });
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast("Install ResQNow on iOS", {
          description: "Tap the Share icon at the bottom of the screen and select 'Add to Home Screen'."
        });
      } else {
        toast.error("Installation is not supported on this browser.");
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        toast.success("App installed successfully!");
      }
    } catch (error) {
      console.error("App install prompt failed:", error);
    }
  };

  return (
    <div className="bg-muted min-h-screen pb-20 animate-fade-in">
      {/* Sticky Top App Bar */}
      <div className="sticky top-0 z-50 bg-card dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex justify-between items-center transition-all border-b border-border">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-rose-600 p-2 rounded-xl shadow-sm text-white">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
              Current Location <ArrowRight className="h-3 w-3 rotate-90" />
            </span>
            <span className="text-sm font-bold text-foreground truncate max-w-[180px]">
              Searching nearby...
            </span>
          </div>
        </div>
        <Link to="/notifications" className="p-2.5 bg-muted rounded-full border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative active:scale-95 transition-transform flex-shrink-0">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-slate-50"></span>
        </Link>
      </div>

      <div className="p-4 space-y-6">
        {/* Promotional Hero Banner (Swiggy Style Edge-to-Edge) */}
        <div className="-mx-4 px-4 overflow-x-auto snap-x snap-mandatory flex gap-4 hide-scrollbar pb-2">
          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(15,23,42,0.5)] relative overflow-hidden isolate">
            {/* Background decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary blur-[50px] opacity-50 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">FAST RESPONSE</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">Emergency<br />Assistance</h2>
            <p className="text-slate-300 text-xs mb-6 font-medium max-w-[200px]">Mechanics and Tow Trucks dispatched instantly.</p>

            <Link to="/request-service/emergency" className="inline-flex items-center bg-primary text-white px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(239,68,68,0.3)]">
              Request Now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-br from-blue-600 to-sky-500 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(2,132,199,0.5)] relative overflow-hidden isolate">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-card dark:bg-slate-900 blur-[50px] opacity-25 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">NEW USER</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">10% Off Any<br />Two Services</h2>
            <p className="text-blue-100 text-xs mb-6 font-medium max-w-[200px]">Use code RESQ10 at checkout for instant savings.</p>

            <Link to="/services" className="inline-flex items-center bg-card dark:bg-slate-900 text-blue-600 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]">
              Explore Services
            </Link>
          </div>

          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-br from-emerald-700 to-teal-500 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(5,150,105,0.5)] relative overflow-hidden isolate">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-card dark:bg-slate-900 blur-[50px] opacity-20 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">APP INSTALL</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">Install<br />ResQNow</h2>
            <p className="text-emerald-100 text-xs mb-6 font-medium max-w-[220px]">Get faster access and a smoother experience from your home screen.</p>

            <button
              type="button"
              onClick={handleInstallApp}
              className="inline-flex items-center bg-card dark:bg-slate-900 text-emerald-700 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]"
            >
              <Download className="mr-2 h-4 w-4" />
              Install App
            </button>
          </div>

          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-br from-indigo-700 to-purple-600 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(79,70,229,0.5)] relative overflow-hidden isolate">
            <div className="absolute top-0 right-0 w-32 h-32 bg-card dark:bg-slate-900 blur-[40px] opacity-20 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">PARTNER WITH US</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">Join As A<br />Technician</h2>
            <p className="text-indigo-100 text-xs mb-6 font-medium max-w-[200px]">Earn reliable income. Work flexibly on your schedule.</p>

            <Link to="/technician/register" className="inline-flex items-center bg-card dark:bg-slate-900 text-indigo-700 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]">
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Quick Services Grid Container */}
        <div className="bg-card dark:bg-slate-900 rounded-[2rem] p-5 shadow-sm border border-border/60">
          <div className="flex justify-between items-center mb-0">
            <h3 className="font-black text-[1.35rem] text-foreground tracking-tight">Top Services</h3>
            <Link to="/services" className="text-[11px] font-bold text-primary flex items-center bg-rose-50 px-3 py-1.5 rounded-full hover:bg-rose-100 transition-colors">See all</Link>
          </div>
          {/* We will update Services.tsx to render a tighter 2x4 grid inside this container */}
          <div className="-mx-5">
            <Services compact={true} />
          </div>
        </div>

        {/* Mini Map Widget */}
        <div className="bg-card dark:bg-slate-900 rounded-[2rem] border border-border/60 shadow-sm p-5 relative overflow-hidden flex flex-col items-start isolate">
          <div className="absolute inset-0 bg-[url('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/13/4096/2727.png')] bg-cover bg-center opacity-40 z-0"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-white/10 z-10"></div>

          <div className="w-full flex justify-between items-center mb-10 z-20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100/50 shadow-sm">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-black text-lg text-foreground tracking-tight">Active Techs</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-card dark:bg-slate-900 shadow-sm border border-border px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">LIVE</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-semibold z-20 mb-4 max-w-[220px]">
            12 verified mechanics and tow trucks online around you.
          </p>

          <Link to="/map" className="w-full bg-slate-900 text-white rounded-2xl py-3.5 text-sm font-bold text-center z-20 shadow-[0_8px_16px_rgba(15,23,42,0.25)] flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Search className="w-4 h-4" /> Open Live Radar
          </Link>
        </div>

        {/* Vehicle Types Grid */}
        <div>
          <h3 className="font-black text-[1.35rem] text-foreground mb-4 px-1 tracking-tight">Select Vehicle</h3>
          <div className="-mx-4 px-4">
            <VehicleTypes />
          </div>
        </div>

        {/* Testimonials (Carousel) */}
        <div className="pb-4">
          <h3 className="font-black text-[1.35rem] text-foreground mb-4 px-1 tracking-tight">Recent Reviews</h3>
          <div className="-mx-4 px-4 overflow-hidden">
            <Testimonials />
          </div>
        </div>

        {/* Technician Promo (Mobile Partner Integration) */}
        <div className="pt-2 pb-6">
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-[0_12px_30px_rgba(15,23,42,0.3)] relative overflow-hidden isolate">
            <div className="absolute -top-12 -right-8 w-40 h-40 bg-blue-500 blur-[60px] opacity-40 rounded-full"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary blur-[50px] opacity-30 rounded-full"></div>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-card dark:bg-slate-900/10 rounded-2xl backdrop-blur-md border border-white/10">
                <Briefcase className="h-6 w-6 text-blue-400" />
              </div>
              <span className="font-bold text-xs uppercase tracking-widest text-blue-300">Partner Program</span>
            </div>

            <h3 className="font-black text-2xl mb-2 leading-tight">Earn with<br />ResQNow</h3>
            <p className="text-slate-400 text-sm font-medium mb-6 max-w-[240px]">
              Join our network of elite professional mechanics and tow operators.
            </p>

            <div className="flex items-center gap-3">
              <Link to="/technician/login" className="flex-1 bg-card dark:bg-slate-900 text-foreground text-center py-3.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2">
                Tech Login
              </Link>
              <Link to="/technician/register" className="flex-[1.5] bg-blue-600 border mx-auto border-blue-500 text-white text-center py-3.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileDashboard />;
  }

  return (
    <div className="mobile-compact">
      <Hero />
      <div className="mobile-section">
        <Services />
      </div>
      <div className="hidden md:block">
        <Map />
      </div>
      <div className="mobile-section">
        <HowItWorks />
      </div>
      <div className="mobile-section">
        <VehicleTypes />
      </div>
      <div className="mobile-section">
        <Testimonials />
      </div>
      <div className="mobile-section">
        <TechnicianCTA />
      </div>
    </div>
  );
};

export default Index;
