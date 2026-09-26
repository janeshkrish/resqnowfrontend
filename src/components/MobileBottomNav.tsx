import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useAutoHideBottomNav } from "@/hooks/useAutoHideBottomNav";
import { isTrackingExperiencePath } from "@/lib/appShellRoutes";
import MaterialSymbol from "@/components/home/MaterialSymbol";

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

    const accountPath = isAuthenticated ? "/settings" : "/login?from=profile";
    const tabs = [
        { name: "Home", path: "/", icon: "home" },
        { name: "Map", path: "/map", icon: "map" },
        { name: "Activity", path: "/my-requests", icon: "receipt_long" },
        { name: "Account", path: accountPath, icon: "person" },
    ];

    const isServiceRequest = location.pathname.startsWith("/request-service");
    const isTrackingExperience = isTrackingExperiencePath(location.pathname);

    if (isServiceRequest || isTrackingExperience || !navEnabled) {
        return null;
    }

    const renderTab = (tab: (typeof tabs)[number]) => {
        const active = isActive(tab.path);
        return (
            <Link
                key={tab.name}
                to={tab.path}
                className={cn("rq-nav-tab", active && "is-on")}
                aria-current={active ? "page" : undefined}
            >
                <span className="rq-nav-ind">
                    <MaterialSymbol name={tab.icon} />
                </span>
                <span className="rq-nav-label">{tab.name}</span>
            </Link>
        );
    };

    return (
        <nav
            aria-label="Main"
            className={cn("rq-nav lg:hidden", !isVisible && "is-compact")}
            onPointerDown={revealNav}
        >
            {tabs.slice(0, 2).map(renderTab)}
            {/* Primary action in thumb reach: pick a service and get help. */}
            <Link to="/services" className="rq-nav-help rq-press" aria-label="Get help: choose a service">
                <span className="rq-nav-help-btn">
                    <MaterialSymbol name="car_repair" />
                </span>
                <span className="rq-nav-label">Get help</span>
            </Link>
            {tabs.slice(2).map(renderTab)}
        </nav>
    );
};

export default MobileBottomNav;
