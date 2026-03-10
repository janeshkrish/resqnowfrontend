import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Briefcase, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAutoHideBottomNav } from "@/hooks/useAutoHideBottomNav";

const TechnicianBottomNav = () => {
    const location = useLocation();
    const currentPath = location.pathname;
    const [navEnabled, setNavEnabled] = useState(true);
    const [autoHideEnabled, setAutoHideEnabled] = useState(true);

    const { visibilityClasses, revealNav } = useAutoHideBottomNav({
        enabled: navEnabled && autoHideEnabled,
    });

    useEffect(() => {
        let isCancelled = false;

        const loadNavigationSettings = async () => {
            try {
                const res = await apiFetch("/api/technicians/me/settings", { technician: true });
                if (!res.ok) {
                    if (!isCancelled) {
                        setNavEnabled(true);
                        setAutoHideEnabled(true);
                    }
                    return;
                }

                const settings = await res.json();
                const navigation = settings?.navigation || {};
                if (isCancelled) return;
                setNavEnabled(navigation.mobile_bottom_nav_enabled !== false);
                setAutoHideEnabled(navigation.auto_hide_bottom_nav !== false);
            } catch {
                if (!isCancelled) {
                    setNavEnabled(true);
                    setAutoHideEnabled(true);
                }
            }
        };

        loadNavigationSettings();
        return () => {
            isCancelled = true;
        };
    }, []);

    const navItems = [
        { label: "Home", path: "/technician/dashboard", icon: Home },
        { label: "Jobs", path: "/technician/history", icon: Briefcase },
        { label: "Earnings", path: "/technician/earnings", icon: DollarSign },
        { label: "Profile", path: "/technician/profile", icon: User },
    ];

    if (!navEnabled) {
        return null;
    }

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-0 bg-card dark:bg-slate-900 border-t border-border z-50 shadow-[0_-8px_30px_-5px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom,0px)] md:hidden",
                "transition-transform transition-opacity duration-300 ease-out",
                visibilityClasses
            )}
            onPointerDown={revealNav}
        >
            <div className="flex justify-between items-center max-w-sm mx-auto px-6 py-2">
                {navItems.map((item) => {
                    const isActive = currentPath === item.path;
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center gap-1 min-w-[64px] transition-colors py-1",
                                isActive ? "text-blue-700" : "text-slate-400 hover:text-muted-foreground"
                            )}
                        >
                            <div
                                className={cn(
                                    "relative flex items-center justify-center w-12 h-8 rounded-full transition-colors",
                                    isActive ? "bg-blue-50" : ""
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "fill-current" : "")} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default TechnicianBottomNav;
