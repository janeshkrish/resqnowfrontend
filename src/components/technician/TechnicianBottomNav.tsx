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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-6 pb-safe md:hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center max-w-sm mx-auto">
                {navItems.map((item) => {
                    const isActive = currentPath === item.path;
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 min-w-[64px] transition-colors ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            <item.icon className={`w-6 h-6 ${isActive ? "fill-current" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
};

export default TechnicianBottomNav;
