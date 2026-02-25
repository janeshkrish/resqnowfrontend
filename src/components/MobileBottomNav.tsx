import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, MapPin, Grid, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MobileBottomNav = () => {
    const location = useLocation();

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const navItems = [
        { name: "Home", path: "/", icon: Home },
        { name: "Map", path: "/map", icon: MapPin },
        { name: "Services", path: "/services", icon: Grid },
        { name: "Activity", path: "/my-requests", icon: Clock },
        { name: "Profile", path: "/settings", icon: User },
    ];

    const isServiceRequest = location.pathname.startsWith('/request-service') || location.pathname.startsWith('/request-service-tracking');

    if (isServiceRequest) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card dark:bg-slate-900 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden pb-safe">
            <div className="grid grid-cols-5 h-16">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                                active ? "text-primary" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 rounded-full transition-all",
                                active ? "bg-primary/10 translate-y-[-2px]" : ""
                            )}>
                                <item.icon className={cn("h-5 w-5", active && "fill-current")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium leading-none",
                                active ? "font-bold" : ""
                            )}>
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
