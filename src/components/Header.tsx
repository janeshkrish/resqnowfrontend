import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { ArrowRight, Menu, PhoneCall, ShieldCheck, X } from "lucide-react";
import UserMenu from "./UserMenu";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated: isTechAuthenticated } = useTechnicianAuth();
  const isLiveMapPage = location.pathname === "/map";

  const partnerRoute = isTechAuthenticated ? "/technician/dashboard" : "/technician/register";
  const navItems = [
    { label: "Platform", to: "/", activePath: "/" },
    { label: "Services", to: "/services", activePath: "/services" },
    { label: "Our Story", to: "/about", activePath: "/about" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" && !location.hash;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-500 ease-in-out ${
        isScrolled
          ? "border-b border-slate-200/40 bg-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl"
          : "bg-white/60 backdrop-blur-md border-b border-transparent"
      }`}
    >
      <div className="container mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0" aria-label="ResQNow home">
          <img 
            src="/logo.png" 
            alt="ResQNow Logo" 
            className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/150x40/transparent/3b82f6?text=ResQNow';
            }}
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-9 mx-4">
          {navItems.map((item) => {
            const active = isActive(item.activePath);
            return (
              <Link
                key={item.label}
                to={item.to}
                className="relative text-[14px] font-bold text-slate-500 hover:text-slate-900 transition-colors py-2"
              >
                {item.label}
                {active && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-[24px] left-0 right-0 h-[3px] rounded-t-full bg-blue-600"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0">
          <div className="hidden lg:flex items-center gap-3 xl:gap-5">
            <Link 
              to={partnerRoute}
              className="text-[14px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              Partner Network
            </Link>
            <Link 
              to="/contact"
              className="text-[14px] font-bold text-slate-500 hover:text-slate-900 transition-colors mr-2"
            >
              Contact
            </Link>
            
            {!isLiveMapPage && (
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 bg-white/50 backdrop-blur-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                asChild
              >
                <Link to="/request-service/emergency">
                  <PhoneCall className="mr-2 h-4 w-4 text-red-500" />
                  SOS
                </Link>
              </Button>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <UserMenu />
          </div>

          <button
            className="lg:hidden text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden absolute top-[76px] left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-2xl"
          >
            <div className="container py-6 px-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`font-bold py-4 px-4 text-base rounded-xl transition-colors ${
                    isActive(item.activePath)
                      ? "text-blue-700 bg-blue-50/80"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              
              <Link
                  to={partnerRoute}
                  className={`font-bold py-4 px-4 text-base rounded-xl transition-colors ${
                    isActive("/technician")
                      ? "text-blue-700 bg-blue-50/80"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Partner With Us
              </Link>
              <Link
                  to="/contact"
                  className={`font-bold py-4 px-4 text-base rounded-xl transition-colors ${
                    isActive("/contact")
                      ? "text-blue-700 bg-blue-50/80"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact Sales
              </Link>

              <div className="py-4 px-4 border-t border-slate-100 mt-2">
                <UserMenu />
              </div>

              {!isLiveMapPage && (
                <Button
                  size="xl"
                  className="bg-red-600 hover:bg-red-700 text-white w-full mt-2 rounded-xl shadow-lg shadow-red-600/20 font-bold"
                  asChild
                >
                  <Link
                    to="/request-service/emergency"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <PhoneCall className="mr-3 h-5 w-5" />
                    Emergency SOS
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
