import { Suspense, useState, useEffect } from "react";
import Services from "@/components/Services";
import VehicleTypes from "@/components/VehicleTypes";
import Testimonials from "@/components/Testimonials";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, Bell, Briefcase, Download, Smartphone, User, Users, Car, Clock } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { lazyWithReload } from "@/lib/lazyWithReload";
import AnimatedCounter from "@/components/AnimatedCounter";
import msmeLogo from "../../assets/msme-logo.png";

const EnterpriseDesktopHome = lazyWithReload(() => import("@/components/desktop/EnterpriseDesktopHome"));

const MsmeAccreditationCard = () => (
  <section className="my-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
    <img
      src={msmeLogo}
      alt="MSME Certified"
      className="h-16 w-16 shrink-0 object-contain"
    />
    <div>
      <h3 className="text-sm font-semibold tracking-wide text-gray-800">
        MSME Certified Startup
      </h3>
      <p className="text-xs text-gray-500">Government of India Recognized</p>
    </div>
  </section>
);

type TelemetryStats = {
  users: number;
  technicians: number;
  incidents: number;
  completedServices: number;
  generatedAt: string;
};

type TelemetryConnectionStatus = "connecting" | "online" | "delayed";

const TELEMETRY_REFRESH_INTERVAL_MS = 15_000;
const TELEMETRY_CACHE_KEY = "resqnow_live_telemetry_stats";

const parseTelemetryCount = (value: unknown): number => {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("Telemetry API returned an invalid count.");
  }
  return Math.trunc(count);
};

const formatTelemetryTime = (value?: string): string => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const buildTelemetryStats = (data: Partial<TelemetryStats>): TelemetryStats => {
  const completedServices = parseTelemetryCount(data.completedServices ?? data.incidents);

  return {
    users: parseTelemetryCount(data.users),
    technicians: parseTelemetryCount(data.technicians),
    incidents: parseTelemetryCount(data.incidents ?? completedServices),
    completedServices,
    generatedAt: typeof data.generatedAt === "string"
      ? data.generatedAt
      : new Date().toISOString(),
  };
};

const readCachedTelemetryStats = (): TelemetryStats | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TELEMETRY_CACHE_KEY);
    if (!raw) return null;
    return buildTelemetryStats(JSON.parse(raw) as Partial<TelemetryStats>);
  } catch {
    return null;
  }
};

const cacheTelemetryStats = (stats: TelemetryStats) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TELEMETRY_CACHE_KEY, JSON.stringify(stats));
  } catch {
    // A cache miss should never block live telemetry rendering.
  }
};

const LiveTelemetryGrid = () => {
  const [telemetry, setTelemetry] = useState(() => {
    const cachedStats = readCachedTelemetryStats();
    return {
      stats: cachedStats,
      connectionStatus: cachedStats ? "delayed" : "connecting",
    } satisfies {
      stats: TelemetryStats | null;
      connectionStatus: TelemetryConnectionStatus;
    };
  });

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;

    const fetchStats = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const res = await apiFetch("/api/public/stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Telemetry request failed with status ${res.status}.`);
        }

        const data = await res.json() as Partial<TelemetryStats>;
        const nextStats = buildTelemetryStats(data);
        cacheTelemetryStats(nextStats);

        if (disposed) return;
        setTelemetry({
          stats: nextStats,
          connectionStatus: "online",
        });
      } catch (err) {
        if (controller.signal.aborted || disposed) return;
        setTelemetry((current) => ({
          ...current,
          connectionStatus: "delayed",
        }));
        console.error("Failed to refresh live telemetry", err);
      }
    };

    fetchStats();

    const interval = window.setInterval(fetchStats, TELEMETRY_REFRESH_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        fetchStats();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", fetchStats);
    window.addEventListener("focus", fetchStats);

    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", fetchStats);
      window.removeEventListener("focus", fetchStats);
    };
  }, []);

  const { stats, connectionStatus } = telemetry;
  const statusText = connectionStatus === "online"
    ? "Systems Online"
    : connectionStatus === "delayed"
      ? stats
        ? "Sync Delayed"
        : "Backend Offline"
      : "Connecting";
  const statusClasses = connectionStatus === "online"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
    : connectionStatus === "delayed"
      ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
      : "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
  const statusDotClasses = connectionStatus === "online"
    ? "bg-emerald-500"
    : connectionStatus === "delayed"
      ? "bg-amber-500"
      : "bg-slate-400";

  const renderCount = (value?: number) => (
    value == null
      ? <span className="animate-pulse text-slate-300 dark:text-slate-600">—</span>
      : <AnimatedCounter end={value} duration={800} />
  );

  return (
    <div className="bg-transparent mt-8 mb-2">
      {/* Header Row */}
      <div className="flex justify-between items-start mb-4 px-1 gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none mb-1.5">
            Network Telemetry
          </h2>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[200px] leading-snug">
            Live metrics across the ResQNow grid.
          </p>
        </div>
        
        {/* Status Pill */}
        <div
          className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-full shadow-sm shrink-0 ${statusClasses}`}
          title={stats?.generatedAt ? `Last updated ${new Date(stats.generatedAt).toLocaleString()}` : statusText}
        >
          <span className="relative flex h-1.5 w-1.5">
            {connectionStatus === "online" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusDotClasses}`}></span>
          </span>
          <span className="text-[9px] font-bold tracking-wide">{statusText}</span>
        </div>
      </div>

      {/* Unified Stats Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 relative overflow-hidden isolate mb-4">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 relative z-10">
          
          {/* Item 1 */}
          <div className="flex flex-col items-center justify-center px-1 group">
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2.5 group-hover:bg-slate-100 transition-colors border border-slate-100 dark:border-white/5">
              <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white mb-1 leading-none">
              {renderCount(stats?.users)}
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center leading-tight">Users</p>
          </div>

          {/* Item 2 */}
          <div className="flex flex-col items-center justify-center px-1 group">
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2.5 group-hover:bg-slate-100 transition-colors border border-slate-100 dark:border-white/5">
              <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white mb-1 leading-none">
              {renderCount(stats?.technicians)}
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center leading-tight">Partners</p>
          </div>

          {/* Item 3 */}
          <div className="flex flex-col items-center justify-center px-1 group">
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2.5 group-hover:bg-slate-100 transition-colors border border-slate-100 dark:border-white/5">
              <Car className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white mb-1 leading-none">
              {renderCount(stats?.incidents)}
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center leading-tight">Incidents</p>
          </div>

          {/* Item 4 */}
          <div className="flex flex-col items-center justify-center px-1 group">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2.5 group-hover:bg-emerald-100 transition-colors border border-emerald-100 dark:border-emerald-500/20">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white mb-1 leading-none tabular-nums">
              {formatTelemetryTime(stats?.generatedAt)}
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center leading-tight">Updated</p>
          </div>

        </div>
      </div>
    </div>
  );
};

const MobileDashboard = () => {
  const [isDownloadingApp, setIsDownloadingApp] = useState(false);

  const handleDownloadAndroidApp = () => {
    if (isDownloadingApp) return;
    setIsDownloadingApp(true);
    const downloadUrl = apiUrl("/api/public/android-app/download");
    window.location.href = downloadUrl;
    window.setTimeout(() => setIsDownloadingApp(false), 3000);
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

          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-br from-red-600 to-sky-500 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(2,132,199,0.5)] relative overflow-hidden isolate">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-card dark:bg-slate-900 blur-[50px] opacity-25 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">NEW USER</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">10% Off Any<br />Two Services</h2>
            <p className="text-red-100 text-xs mb-6 font-medium max-w-[200px]">Use code RESQ10 at checkout for instant savings.</p>

            <Link to="/services" className="inline-flex items-center bg-card dark:bg-slate-900 text-red-600 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]">
              Explore Services
            </Link>
          </div>

          <div className="snap-center shrink-0 w-[85vw] sm:w-[300px] bg-gradient-to-br from-emerald-700 to-teal-500 rounded-3xl p-6 text-white shadow-[0_12px_24px_-8px_rgba(5,150,105,0.5)] relative overflow-hidden isolate">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-card dark:bg-slate-900 blur-[50px] opacity-20 rounded-full"></div>

            <span className="inline-block bg-white/20 text-white border-0 mb-3 backdrop-blur-md font-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded-md">ANDROID APP</span>
            <h2 className="font-black text-3xl mb-1 leading-tight text-white shadow-sm drop-shadow-md">Download<br />ResQNow App</h2>
            <p className="text-emerald-100 text-xs mb-6 font-medium max-w-[220px]">Install the Android app for faster alerts and smoother live tracking.</p>

            <button
              type="button"
              onClick={handleDownloadAndroidApp}
              className="inline-flex items-center bg-card dark:bg-slate-900 text-emerald-700 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]"
            >
              {isDownloadingApp ? <Download className="mr-2 h-4 w-4 animate-bounce" /> : <Smartphone className="mr-2 h-4 w-4" />}
              Download Android App
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

        {/* Network Telemetry */}
        <LiveTelemetryGrid />

        {/* Vehicle Types Grid */}
        <div>
          <h3 className="font-black text-[1.35rem] text-foreground mb-4 px-1 tracking-tight">Select Vehicle</h3>
          <div className="-mx-4 px-4">
            <VehicleTypes />
          </div>
        </div>

        <div className="pb-1">
          <MsmeAccreditationCard />
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
            <div className="absolute -top-12 -right-8 w-40 h-40 bg-red-500 blur-[60px] opacity-40 rounded-full"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary blur-[50px] opacity-30 rounded-full"></div>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-card dark:bg-slate-900/10 rounded-2xl backdrop-blur-md border border-white/10">
                <Briefcase className="h-6 w-6 text-red-400" />
              </div>
              <span className="font-bold text-xs uppercase tracking-widest text-red-300">Partner Program</span>
            </div>

            <h3 className="font-black text-2xl mb-2 leading-tight">Earn with<br />ResQNow</h3>
            <p className="text-slate-400 text-sm font-medium mb-6 max-w-[240px]">
              Join our network of elite professional mechanics and tow operators.
            </p>

            <div className="flex items-center gap-3">
              <Link to="/technician/login" className="flex-1 bg-card dark:bg-slate-900 text-foreground text-center py-3.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2">
                Tech Login
              </Link>
              <Link to="/technician/register" className="flex-[1.5] bg-red-600 border mx-auto border-red-500 text-white text-center py-3.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
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
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-white text-sm font-semibold text-slate-500">
          Loading enterprise platform...
        </div>
      }
    >
      <EnterpriseDesktopHome />
    </Suspense>
  );
};

export default Index;
