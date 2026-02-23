
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { PhoneCall, Menu, X } from "lucide-react";
import UserMenu from "./UserMenu";

import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated: isTechAuthenticated } = useTechnicianAuth();

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
    return location.pathname === path;
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100"
          : "bg-white border-b border-gray-200"
        }`}
    >
      <div className="container flex h-16 lg:h-20 items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <span className="text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-700">ResQNow</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          <Link
            to="/"
            className={`font-medium text-lg transition-colors ${isActive('/')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            Home
          </Link>
          <Link
            to="/services"
            className={`font-medium text-lg transition-colors ${isActive('/services')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            Services
          </Link>
          <Link
            to="/about"
            className={`font-medium text-lg transition-colors ${isActive('/about')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            About
          </Link>
          <Link
            to="/contact"
            className={`font-medium text-lg transition-colors ${isActive('/contact')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            Contact
          </Link>
          <Link
            to={isTechAuthenticated ? "/technician/dashboard" : "/technician/login"}
            className={`font-medium text-lg transition-colors ${isActive('/technician')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            Technician Portal
          </Link>
          <Link
            to="/marketplace"
            className={`font-medium text-lg transition-colors ${isActive('/marketplace')
                ? "text-primary font-semibold"
                : "text-gray-700 hover:text-primary"
              }`}
          >
            Marketplace
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="bg-gradient-to-r from-primary to-blue-700 hover:from-blue-700 hover:to-blue-800 hidden lg:flex animate-pulse-blue shadow-lg"
            asChild
          >
            <Link to="/request-service/emergency">
              <PhoneCall className="mr-2 h-5 w-5" />
              Emergency Call
            </Link>
          </Button>

          <div className="hidden lg:block">
            <UserMenu />
          </div>

          <button
            className="lg:hidden text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-xl animate-fade-in">
          <div className="container py-6 px-4 flex flex-col gap-2">
            <Link
              to="/"
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/services"
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/services')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              to="/about"
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/about')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/contact')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <Link
              to={isTechAuthenticated ? "/technician/dashboard" : "/technician/login"}
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/technician')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Technician Portal
            </Link>
            <Link
              to="/marketplace"
              className={`font-medium py-4 px-4 text-lg rounded-lg transition-colors ${isActive('/marketplace')
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Marketplace
            </Link>

            <div className="py-4 px-4">
              <UserMenu />
            </div>

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
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
