import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Building2,
  Car,
  CheckCircle2,
  Clock3,
  CloudCog,
  Gauge,
  Globe2,
  Headphones,
  Layers3,
  LineChart,
  MapPin,
  Network,
  PlugZap,
  Radar,
  Route,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerReset,
  Truck,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";

type IconType = typeof Activity;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const partners: Array<{
  title: string;
  body: string;
  icon: IconType;
  tone: string;
}> = [
  {
    title: "Fleet Operators",
    body: "Centralized assistance, ETA visibility, and service evidence for distributed vehicles.",
    icon: Truck,
    tone: "text-blue-600 bg-blue-50",
  },
  {
    title: "Automobile Companies",
    body: "White-label roadside support layer for OEM warranty, after-sales, and loyalty programs.",
    icon: Car,
    tone: "text-slate-700 bg-slate-100",
  },
  {
    title: "EV Ecosystems",
    body: "Charging, battery support, and technician routing for connected electric mobility.",
    icon: BatteryCharging,
    tone: "text-emerald-600 bg-emerald-50",
  },
  {
    title: "Insurance Providers",
    body: "Claim-aware dispatch workflows with traceable incidents, photos, and response history.",
    icon: ShieldCheck,
    tone: "text-indigo-600 bg-indigo-50",
  },
  {
    title: "Service Networks",
    body: "Verified garages, technicians, and towing operators organized into live availability grids.",
    icon: Wrench,
    tone: "text-rose-600 bg-rose-50",
  },
  {
    title: "Towing Partners",
    body: "Fleet assignment, partner activity, pricing transparency, and completion tracking.",
    icon: Route,
    tone: "text-amber-600 bg-amber-50",
  },
  {
    title: "Business Integrations",
    body: "API-ready infrastructure for apps, marketplaces, fleet stacks, and mobility programs.",
    icon: PlugZap,
    tone: "text-cyan-600 bg-cyan-50",
  },
];

const workflow = [
  {
    title: "Request",
    body: "Customer, fleet, or partner creates an assistance request.",
    icon: Smartphone,
  },
  {
    title: "Smart Match",
    body: "Availability, service type, distance, and vehicle context are resolved.",
    icon: Sparkles,
  },
  {
    title: "Live Dispatch",
    body: "The nearest qualified technician or towing unit receives the job.",
    icon: Zap,
  },
  {
    title: "Tracking",
    body: "ETA, technician progress, and status updates stay visible.",
    icon: Radar,
  },
  {
    title: "Resolution",
    body: "Completion, payment, review, and operational history are captured.",
    icon: CheckCircle2,
  },
];

const solutionFeatures = [
  "Fleet incident command center",
  "Partner API integrations",
  "Business support workflows",
  "Technician and towing orchestration",
  "Live tracking and ETA monitoring",
  "Service analytics and SLA visibility",
];

const analytics = [
  { label: "Avg. response", value: "14.8m", trend: "-18%", icon: TimerReset },
  { label: "Partner uptime", value: "97.6%", trend: "+6%", icon: Activity },
  { label: "Requests monitored", value: "12.4k", trend: "+31%", icon: BarChart3 },
  { label: "Verified network", value: "200+", trend: "live", icon: UsersRound },
];

const visionItems = [
  {
    title: "AI-powered mobility infrastructure",
    body: "Dispatch intelligence that can recommend the right partner based on location, vehicle, service domain, and availability.",
    icon: CloudCog,
  },
  {
    title: "Connected assistance ecosystem",
    body: "A shared support layer across fleets, EV platforms, insurers, service centers, and towing operators.",
    icon: Network,
  },
  {
    title: "Nationwide support grid",
    body: "A scalable operating network designed to expand city by city while keeping SLA visibility intact.",
    icon: Globe2,
  },
  {
    title: "Smart emergency response network",
    body: "Roadside events tracked with operational context, customer updates, and auditable completion data.",
    icon: Headphones,
  },
];

const Reveal = ({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial={reduceMotion ? undefined : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
};

const SectionHeader = ({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: "center" | "left";
}) => (
  <Reveal className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur-xl">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      {eyebrow}
    </div>
    <h2 className="text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
      {title}
    </h2>
    <p className="mt-5 text-lg font-medium leading-8 text-slate-600">{body}</p>
  </Reveal>
);

const GlassPanel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`rounded-lg border border-white/70 bg-white/[0.74] shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur-2xl ${className}`}
  >
    {children}
  </div>
);

const HeroCommandCenter = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[620px]" aria-label="Live mobility operations dashboard mockup">
      <div className="absolute -inset-6 rounded-[24px] bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0),rgba(16,185,129,0.12))] blur-2xl" />

      <GlassPanel className="relative overflow-hidden p-4">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Command Center</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Live Assistance Grid</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
        </div>

        <div className="grid gap-4 pt-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="relative min-h-[380px] overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#eef5fb)]">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:40px_40px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 380" aria-hidden="true">
              <defs>
                <linearGradient id="routeLine" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="55%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path
                d="M42 294 C110 250 132 306 186 246 C245 181 265 202 326 126 C350 96 370 82 394 70"
                fill="none"
                stroke="url(#routeLine)"
                strokeDasharray="8 9"
                strokeLinecap="round"
                strokeWidth="5"
              />
              <path
                d="M70 80 C96 126 112 150 148 170 C190 194 207 232 246 250 C286 270 318 260 360 304"
                fill="none"
                stroke="#cbd5e1"
                strokeDasharray="4 10"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>

            <motion.div
              className="absolute left-[9%] top-[73%] flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-white shadow-xl"
              animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <MapPin className="h-5 w-5" />
            </motion.div>

            <motion.div
              className="absolute left-[43%] top-[55%] rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-lg"
              animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              ETA 11 min
            </motion.div>

            <motion.div
              className="absolute left-[75%] top-[28%] flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white shadow-xl"
              animate={reduceMotion ? undefined : { x: [0, 18, 0], y: [0, -8, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Truck className="h-5 w-5" />
            </motion.div>

            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/80 bg-white/[0.82] p-4 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Active request</p>
                  <p className="mt-1 text-sm font-black text-slate-950">Flatbed dispatched to NH-48 corridor</p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  In route
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#10b981)]"
                  animate={reduceMotion ? undefined : { width: ["42%", "68%", "42%"] }}
                  transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                  style={reduceMotion ? { width: "62%" } : undefined}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              ["Network availability", "97.6%", "Verified partner uptime"],
              ["Median arrival", "14.8m", "Across active cities"],
              ["Open incidents", "38", "7 high-priority"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
              </div>
            ))}

            <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Smart match</p>
                  <p className="mt-2 text-sm font-black">Technician verified</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {["Skill", "ETA", "Rating"].map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-white/[0.08] px-2 py-2 text-[11px] font-bold text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
};

const EnterpriseHero = () => (
  <section id="platform" className="relative scroll-mt-24 overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_58%,#eef5fb_100%)]">
    <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
    <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(59,130,246,0.16),rgba(255,255,255,0))]" />

    <div className="container relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-24">
      <Reveal>
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/[0.76] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-700 shadow-sm backdrop-blur-xl">
            <Network className="h-4 w-4" />
            Enterprise mobility infrastructure
          </div>

          <h1 className="text-5xl font-black leading-[0.96] tracking-tight text-slate-950 lg:text-7xl xl:text-[5.7rem]">
            India&apos;s Smart Mobility Assistance Infrastructure
          </h1>

          <p className="mt-7 max-w-2xl text-xl font-medium leading-9 text-slate-600">
            ResQNow connects drivers, fleets, technicians, towing partners, and businesses through a live roadside support platform built for scale, trust, and operational visibility.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button
              size="xl"
              className="h-14 rounded-lg bg-slate-950 px-8 text-base font-black text-white shadow-[0_20px_40px_-26px_rgba(15,23,42,0.75)] hover:bg-slate-800"
              asChild
            >
              <Link to="/contact">
                Schedule Demo
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="h-14 rounded-lg border-slate-200 bg-white/80 px-8 text-base font-black text-slate-900 shadow-sm backdrop-blur-xl hover:bg-white"
              asChild
            >
              <Link to="/technician/register">
                Partner With Us
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            {[
              ["24/7", "Operations layer"],
              ["200+", "Verified partners"],
              ["Live", "ETA tracking"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-2xl font-black tracking-tight text-slate-950">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <HeroCommandCenter />
      </Reveal>
    </div>
  </section>
);

const EcosystemSection = () => (
  <section id="ecosystem" className="scroll-mt-24 border-b border-slate-200 bg-white py-24">
    <div className="container mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeader
        eyebrow="Mobility ecosystem"
        title="Built for the Mobility Ecosystem"
        body="ResQNow is positioned as the connective infrastructure between roadside demand, service capacity, fleet operations, and business integrations."
      />

      <motion.div
        className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {partners.map((partner, index) => (
          <motion.div
            key={partner.title}
            variants={fadeUp}
            transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.02 }}
            className={index === 6 ? "md:col-span-2 lg:col-span-2" : ""}
          >
            <Link
              to={partner.title === "Towing Partners" || partner.title === "Service Networks" ? "/technician/register" : "/contact"}
              className="group block h-full rounded-lg border border-slate-200 bg-white/[0.76] p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_65px_-42px_rgba(37,99,235,0.38)]"
            >
              <div className={`mb-7 flex h-12 w-12 items-center justify-center rounded-lg ${partner.tone}`}>
                <partner.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">{partner.title}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{partner.body}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-blue-700 opacity-0 transition duration-300 group-hover:opacity-100">
                Explore fit
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

const WorkflowSection = () => (
  <section id="technology" className="scroll-mt-24 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#ffffff)] py-24">
    <div className="container mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeader
        eyebrow="Operating model"
        title="How ResQNow Works"
        body="A structured assistance flow turns roadside chaos into a monitored dispatch lifecycle with transparent state changes."
      />

      <div className="relative mt-16">
        <div className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-[linear-gradient(90deg,transparent,#bfdbfe,#10b981,#bfdbfe,transparent)] lg:block" />
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {workflow.map((step, index) => (
            <motion.div key={step.title} variants={fadeUp} className="relative">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_22px_55px_-45px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:border-blue-200">
                <div className="relative z-10 mb-7 flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-950 text-white shadow-lg">
                  <step.icon className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-blue-600 text-xs font-black">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

const EnterpriseDashboardGraphic = () => (
  <GlassPanel className="overflow-hidden p-4">
    <div className="flex items-center justify-between border-b border-slate-200/70 pb-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Enterprise console</p>
        <h3 className="mt-1 text-xl font-black text-slate-950">Fleet Operations</h3>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
        <Gauge className="h-4 w-4 text-blue-600" />
        SLA active
      </div>
    </div>

    <div className="grid gap-4 pt-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-4">
        {[
          ["Fleet incidents", "18", "6 assigned"],
          ["Partner coverage", "91%", "city grid"],
          ["Escalations", "03", "priority"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black text-slate-950">{value}</p>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black">Response Analytics</p>
          <LineChart className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="mt-8 flex h-48 items-end gap-3">
          {[38, 56, 44, 72, 62, 86, 76, 92].map((height, index) => (
            <motion.div
              key={`${height}-${index}`}
              className="flex-1 rounded-t-md bg-[linear-gradient(180deg,#38bdf8,#2563eb)]"
              initial={{ height: 20 }}
              whileInView={{ height }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {["Dispatch", "ETA", "Close"].map((item) => (
            <div key={item} className="rounded-md border border-white/10 bg-white/[0.08] px-2 py-2 text-xs font-bold text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </GlassPanel>
);

const SolutionsSection = () => (
  <section id="solutions" className="scroll-mt-24 border-b border-slate-200 bg-white py-24">
    <div className="container mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
      <Reveal>
        <EnterpriseDashboardGraphic />
      </Reveal>

      <Reveal delay={0.08}>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">
            <Building2 className="h-4 w-4 text-blue-600" />
            B2B solutions
          </div>
          <h2 className="text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
            Enterprise mobility support, from one dashboard.
          </h2>
          <p className="mt-5 text-lg font-medium leading-8 text-slate-600">
            Move beyond one-off roadside assistance into a measurable support layer for fleets, partners, platforms, and service networks.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {solutionFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-bold leading-6 text-slate-700">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-4">
            <Button className="rounded-lg bg-blue-600 px-7 font-black text-white hover:bg-blue-700" asChild>
              <Link to="/contact">Talk to Business Team</Link>
            </Button>
            <Button variant="outline" className="rounded-lg border-slate-200 px-7 font-black" asChild>
              <Link to="/map">Open Live Radar</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

const TrackingShowcase = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section id="fleet" className="scroll-mt-24 border-b border-slate-200 bg-[linear-gradient(180deg,#f7fbff,#ffffff)] py-24">
      <div className="container mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Hero feature"
          title="Live Tracking That Feels Like Mobility Infrastructure"
          body="ResQNow turns every roadside event into a visible operational stream with ETA progress, assistance state, technician context, and completion readiness."
        />

        <Reveal className="mt-14">
          <GlassPanel className="overflow-hidden p-4 lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(180deg,#f9fcff,#edf5fb)]">
                <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 520" aria-hidden="true">
                  <defs>
                    <linearGradient id="trackingGradient" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#1d4ed8" />
                      <stop offset="55%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <path d="M96 430 C188 382 220 418 306 332 C390 247 425 272 520 178 C583 114 625 104 682 72" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                  <path d="M96 430 C188 382 220 418 306 332 C390 247 425 272 520 178 C583 114 625 104 682 72" fill="none" stroke="url(#trackingGradient)" strokeWidth="5" strokeDasharray="12 13" strokeLinecap="round" />
                  <path d="M122 90 C190 152 234 132 288 190 C344 250 380 248 432 300 C500 369 594 346 672 422" fill="none" stroke="#dbeafe" strokeWidth="3" strokeDasharray="7 12" strokeLinecap="round" />
                </svg>

                <div className="absolute left-[10%] top-[79%] flex items-center gap-3 rounded-lg border border-white/80 bg-white/[0.88] px-4 py-3 shadow-xl backdrop-blur-xl">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer</p>
                    <p className="text-sm font-black text-slate-950">Awaiting support</p>
                  </div>
                </div>

                <motion.div
                  className="absolute left-[66%] top-[24%] flex items-center gap-3 rounded-lg border border-white/80 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-xl"
                  animate={reduceMotion ? undefined : { x: [0, 18, 0], y: [0, -10, 0] }}
                  transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Responder</p>
                    <p className="text-sm font-black text-slate-950">11 min away</p>
                  </div>
                </motion.div>

                <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/80 bg-white/[0.86] p-5 shadow-xl backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Assistance progress</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Tow unit is approaching pickup point</h3>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-4 py-3 text-right">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">ETA</p>
                      <p className="text-2xl font-black text-emerald-700">11m</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {["Requested", "Matched", "Dispatched", "Arriving"].map((item, index) => (
                      <div key={item} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                        <div className="mb-2 h-1.5 rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${index < 3 ? "w-full bg-blue-600" : "w-2/3 bg-emerald-500"}`} />
                        </div>
                        <p className="text-xs font-black text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid content-start gap-4">
                {[
                  { label: "Live status", value: "En route", icon: Activity, tone: "text-emerald-600 bg-emerald-50" },
                  { label: "Technician rating", value: "4.9/5", icon: ShieldCheck, tone: "text-blue-600 bg-blue-50" },
                  { label: "Incident SLA", value: "On track", icon: Clock3, tone: "text-amber-600 bg-amber-50" },
                  { label: "Update stream", value: "6 events", icon: Layers3, tone: "text-indigo-600 bg-indigo-50" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.tone}`}>
                        <item.icon className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ))}

                <Button className="h-[3.25rem] rounded-lg bg-slate-950 font-black text-white hover:bg-slate-800" asChild>
                  <Link to="/map">
                    View Live Radar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </GlassPanel>
        </Reveal>
      </div>
    </section>
  );
};

const AnalyticsSection = () => (
  <section className="border-b border-slate-200 bg-white py-24">
    <div className="container mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeader
        eyebrow="Operational intelligence"
        title="Enterprise Dashboard for Service Visibility"
        body="Monitor response timing, partner activity, incident lifecycle, and assistance quality across the network."
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {analytics.map((metric) => (
          <Reveal key={metric.label}>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between">
                <metric.icon className="h-6 w-6 text-blue-600" />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{metric.trend}</span>
              </div>
              <p className="mt-8 text-4xl font-black tracking-tight text-slate-950">{metric.value}</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-5">
        <div className="grid gap-5 rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#111827)] p-6 text-white shadow-[0_30px_80px_-55px_rgba(15,23,42,0.85)] lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">System health</p>
              <h3 className="mt-4 text-3xl font-black tracking-tight">Live partner operations view</h3>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-300">
                Designed for business teams that need measurable dispatch performance instead of a black-box service workflow.
              </p>
            </div>
            <div className="mt-8 flex gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">SLA</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">Dispatch</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">Revenue</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Coimbatore", "Bengaluru", "Chennai"].map((city, index) => (
              <div key={city} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
                <p className="text-sm font-black">{city}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Coverage grid</p>
                <div className="mt-8 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#34d399)]"
                    style={{ width: `${72 + index * 8}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-bold text-emerald-300">{72 + index * 8}% active</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

const VisionSection = () => (
  <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] py-24">
    <div className="container mx-auto max-w-7xl px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionHeader
          align="left"
          eyebrow="Vision"
          title="The Future of Roadside Support Is a Connected Grid"
          body="ResQNow is evolving into a mobility-tech backbone for emergency response, service networks, fleet uptime, and business-ready assistance programs."
        />

        <motion.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {visionItems.map((item) => (
            <motion.div key={item.title} variants={fadeUp} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{item.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

const EnterpriseCTA = () => (
  <section className="bg-white py-24">
    <div className="container mx-auto max-w-7xl px-6 lg:px-8">
      <Reveal>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fbff,#ffffff_45%,#edf7ff)] p-10 shadow-[0_30px_90px_-65px_rgba(15,23,42,0.6)] lg:p-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">Enterprise collaboration</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 lg:text-6xl">
                Partner With ResQNow
              </h2>
              <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-slate-600">
                Build roadside assistance into your fleet, service network, insurance flow, or mobility product with an operating platform made for visibility.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Button className="h-[3.25rem] rounded-lg bg-slate-950 px-7 font-black text-white hover:bg-slate-800" asChild>
                <Link to="/contact">Schedule Demo</Link>
              </Button>
              <Button className="h-[3.25rem] rounded-lg bg-blue-600 px-7 font-black text-white hover:bg-blue-700" asChild>
                <Link to="/technician/register">Become a Partner</Link>
              </Button>
              <Button variant="outline" className="h-[3.25rem] rounded-lg border-slate-200 bg-white px-7 font-black" asChild>
                <Link to="/contact">Contact Business Team</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

const EnterpriseDesktopHome = () => {
  return (
    <div className="min-h-screen bg-white font-['Inter'] text-slate-950">
      <EnterpriseHero />
      <EcosystemSection />
      <WorkflowSection />
      <SolutionsSection />
      <TrackingShowcase />
      <AnalyticsSection />
      <VisionSection />
      <EnterpriseCTA />
    </div>
  );
};

export default EnterpriseDesktopHome;
