import { Clock, Globe2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "Command Center", to: "/#platform" },
      { label: "Live Tracking", to: "/#fleet" },
      { label: "Service Catalog", to: "/services" },
      { label: "Marketplace", to: "/marketplace" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Fleet Operators", to: "/#solutions" },
      { label: "EV Ecosystems", to: "/#ecosystem" },
      { label: "Insurance Providers", to: "/#ecosystem" },
      { label: "Towing Partners", to: "/technician/register" },
    ],
  },
  {
    title: "Technology",
    links: [
      { label: "Smart Dispatch", to: "/#technology" },
      { label: "Operations Analytics", to: "/#solutions" },
      { label: "Live Radar", to: "/map" },
      { label: "API Integrations", to: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Partner With Us", to: "/technician/register" },
      { label: "Technician Login", to: "/technician/login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy-policy" },
      { label: "Terms of Service", to: "/terms-of-service" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="border-t border-slate-800 bg-[linear-gradient(180deg,#0f172a,#020617)] text-white">
      <div className="container mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1.85fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3" aria-label="ResQNow home">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white text-slate-950">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-2xl font-black tracking-tight">ResQNow</span>
                <span className="mt-1 block text-[0.68rem] font-black uppercase tracking-[0.24em] text-red-200">
                  Mobility Infrastructure
                </span>
              </span>
            </Link>

            <p className="mt-6 max-w-md text-sm font-medium leading-7 text-slate-300">
              Premium roadside assistance infrastructure for drivers, fleets, technicians, towing partners, and mobility businesses.
            </p>

            <div className="mt-7 grid gap-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <span>KGiSL Campus, Coimbatore, Tamil Nadu, India</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <span className="flex flex-col gap-1">
                  <a href="tel:+919566510080" className="transition hover:text-white">+91 9566510080</a>
                  <a href="tel:+919994806667" className="transition hover:text-white">+91 9994806667</a>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-red-300" />
                <a href="mailto:resqnow01@gmail.com" className="transition hover:text-white">resqnow01@gmail.com</a>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0 text-red-300" />
                <span>Available 24/7</span>
              </div>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{group.title}</h3>
                <ul className="mt-5 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-sm font-semibold text-slate-300 transition hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-slate-400">
            &copy; {new Date().getFullYear()} ResQNow. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {["LinkedIn", "X", "Instagram"].map((item) => (
              <a
                key={item}
                href="#"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-black text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <Globe2 className="h-3.5 w-3.5" />
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
