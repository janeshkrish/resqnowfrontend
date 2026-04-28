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

    const { visibilityClasses, revealNav } = useAutoHideBottomNav({
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
                "fixed bottom-0 left-0 right-0 z-50 bg-card dark:bg-slate-900 border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden pb-safe",
                "transition-transform transition-opacity duration-300 ease-out",
                visibilityClasses
            )}
            onPointerDown={revealNav}
        >
            <div className="grid grid-cols-5 h-16">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                                active ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
                            )}
                        >
                            <div
                                className={cn(
                                    "p-1.5 rounded-full transition-all",
                                    active ? "bg-primary/10 translate-y-[-2px]" : ""
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", active && "fill-current")} />
                            </div>
                            <span
                                className={cn(
                                    "text-[10px] font-medium leading-none",
                                    active ? "font-bold" : ""
                                )}
                            >
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileBottomNav;
