import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, MapPin, Grid, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useAutoHideBottomNav } from "@/hooks/useAutoHideBottomNav";
import { isTrackingExperiencePath } from "@/lib/appShellRoutes";

const MobileBottomNav = () => {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const [navEnabled, setNavEnabled] = useState(true);
    const [autoHideEnabled, setAutoHideEnabled] = useState(true);

    const { isVisible, revealNav } = useAutoHideBottomNav({
        enabled: navEnabled && autoHideEnabled,
    });

    useEffect(() => {
        let isCancelled = false;

        const loadNavigationSettings = async () => {
            if (!isAuthenticated) {
                setNavEnabled(true);
                setAutoHideEnabled(true);
                return;
            }

            try {
                const res = await apiFetch("/api/users/me/settings");
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
    }, [isAuthenticated]);

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const navItems = [
        { name: "Home", path: "/", icon: Home },
        { name: "Map", path: "/map", icon: MapPin },
        { name: "Services", path: "/services", icon: Grid },
        { name: "Activity", path: "/my-requests", icon: Clock },
        { name: "Profile", path: isAuthenticated ? "/settings" : "/login?from=profile", icon: User },
    ];

    const isServiceRequest = location.pathname.startsWith("/request-service");
    const isTrackingExperience = isTrackingExperiencePath(location.pathname);

    if (isServiceRequest || isTrackingExperience || !navEnabled) {
        return null;
    }

    return (
        <div
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-50 lg:hidden",
                "bg-white/60 dark:bg-[#121212]/70 backdrop-blur-[40px] backdrop-saturate-[200%]",
                "border border-white/50 dark:border-white/10",
                "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                "rounded-[2.5rem] p-1.5",
                "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center justify-between",
                isVisible ? "bottom-6 w-[92%] max-w-[400px] scale-100 opacity-100" : "bottom-4 w-[75%] max-w-[300px] scale-95 opacity-70"
            )}
            onPointerDown={revealNav}
        >
            {navItems.map((item) => {
                const active = isActive(item.path);
                const hasNotification = item.name === "Activity";
                
                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={cn(
                            "relative flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            active 
                                ? "w-16 h-12 bg-white/60 dark:bg-white/15 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                                : "w-12 h-12 bg-transparent rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
                        )}
                    >
                        <div className="relative flex items-center justify-center w-full h-full">
                            <item.icon 
                                className={cn(
                                    "transition-all duration-500",
                                    active 
                                        ? "text-slate-900 dark:text-white h-[26px] w-[26px]" 
                                        : "text-slate-500 dark:text-[#a0a0a0] h-[24px] w-[24px]"
                                )} 
                                strokeWidth={active ? 2.5 : 2}
                            />
                            {hasNotification && (
                                <div className={cn(
                                    "absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 transition-all duration-300",
                                    active ? "opacity-0 scale-0" : "opacity-100 scale-100"
                                )} />
                            )}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
};

export default MobileBottomNav;
