import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Briefcase, DollarSign, User, LayoutDashboard } from "lucide-react";

const TechnicianBottomNav = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navItems = [
        { label: "Home", path: "/technician/dashboard", icon: Home },
        { label: "Jobs", path: "/technician/history", icon: Briefcase },
        { label: "Earnings", path: "/technician/earnings", icon: DollarSign },
        { label: "Profile", path: "/technician/profile", icon: User },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 shadow-[0_-8px_30px_-5px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom,0px)] md:hidden">
            <div className="flex justify-between items-center max-w-sm mx-auto px-6 py-2">
                {navItems.map((item) => {
                    const isActive = currentPath === item.path;
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 min-w-[64px] transition-colors py-1 ${isActive ? "text-blue-700" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            <div className={`relative flex items-center justify-center w-12 h-8 rounded-full transition-colors ${isActive ? "bg-blue-50" : ""}`}>
                                <item.icon className={`w-5 h-5 ${isActive ? "fill-current" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
};

export default TechnicianBottomNav;
