
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { ArrowRight, Menu, PhoneCall, ShieldCheck, X } from "lucide-react";
import UserMenu from "./UserMenu";

import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated: isTechAuthenticated } = useTechnicianAuth();
  const isLiveMapPage = location.pathname === "/map";

  const partnerRoute = isTechAuthenticated ? "/technician/dashboard" : "/technician/register";
  const navItems = [
    { label: "Platform", to: "/#platform", activePath: "/" },
    { label: "Solutions", to: "/#solutions", activePath: "/services" },
    { label: "Fleet", to: "/#fleet", activePath: "/map" },
    { label: "Industries", to: "/#ecosystem", activePath: "/about" },
    { label: "Technology", to: "/#technology", activePath: "/technology" },
    { label: "Contact", to: "/contact", activePath: "/contact" },
    { label: "Partner With Us", to: partnerRoute, activePath: "/technician" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolled
          ? "border-slate-200/80 bg-white/[0.86] shadow-[0_18px_45px_-38px_rgba(15,23,42,0.6)] backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/90"
          : "border-slate-200/70 bg-white/[0.78] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/[0.88]"
        }`}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:h-20 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="ResQNow home">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tight text-slate-950 dark:text-white lg:text-2xl">ResQNow</span>
            <span className="mt-1 hidden text-[0.62rem] font-black uppercase tracking-[0.22em] text-slate-400 lg:block">
              Mobility Grid
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur-xl lg:flex">
          {navItems.map((item) => {
            const active = isActive(item.activePath);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {!isLiveMapPage && (
            <Button
              size="lg"
              className="hidden rounded-lg bg-red-50 px-5 font-black text-red-600 shadow-sm ring-1 ring-red-100 hover:bg-red-100 lg:flex"
              asChild
            >
              <Link to="/request-service/emergency">
                <PhoneCall className="h-4 w-4" />
                SOS
              </Link>
            </Button>
          )}

          <Button
            size="lg"
            className="hidden rounded-lg bg-blue-600 px-5 font-black text-white shadow-[0_18px_30px_-22px_rgba(37,99,235,0.75)] hover:bg-blue-700 lg:flex"
            asChild
          >
            <Link to="/contact">
              Schedule Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <div className="hidden lg:block">
            <UserMenu />
          </div>

          <button
            className="lg:hidden text-muted-foreground p-2 hover:bg-muted/50 rounded-lg transition-colors"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-card dark:bg-slate-900 border-b border-border shadow-xl animate-fade-in">
          <div className="container py-6 px-4 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${
                  isActive(item.activePath)
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            <div className="py-4 px-4">
              <UserMenu />
            </div>

            {!isLiveMapPage && (
              <Button
                size="xl"
                className="bg-gradient-to-r from-primary to-blue-700 hover:from-blue-700 hover:to-blue-800 w-full mt-4 shadow-lg"
                asChild
              >
                <Link
                  to="/request-service/emergency"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <PhoneCall className="mr-3 h-6 w-6" />
                  Emergency Call
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
