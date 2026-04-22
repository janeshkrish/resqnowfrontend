import React, { useCallback, useEffect, useState } from "react";
import { Bell, Home, IndianRupee, Trophy } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAutoHideBottomNav } from "@/hooks/useAutoHideBottomNav";

type NavItemKey = "home" | "earnings" | "notifications" | "rewards";

const TechnicianBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [navEnabled, setNavEnabled] = useState(true);
  const [autoHideEnabled, setAutoHideEnabled] = useState(true);
  const [activeItem, setActiveItem] = useState<NavItemKey>("home");

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

  useEffect(() => {
    const hash = String(location.hash || "").trim();
    if (hash === "#dashboard-notifications") setActiveItem("notifications");
    else if (hash === "#dashboard-rewards") setActiveItem("rewards");
    else if (currentPath === "/technician/dashboard") setActiveItem("home");
  }, [currentPath, location.hash]);

  const scrollToSection = useCallback((sectionId: string, item: NavItemKey) => {
    setActiveItem(item);

    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${sectionId}`);
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navItems = [
    {
      key: "home" as const,
      label: "Home",
      icon: Home,
      onClick: () => scrollToSection("dashboard-home", "home"),
    },
    {
      key: "earnings" as const,
      label: "Total Earnings",
      icon: IndianRupee,
      onClick: () => {
        setActiveItem("earnings");
        navigate("/technician/earnings");
      },
    },
    {
      key: "notifications" as const,
      label: "Notification",
      icon: Bell,
      onClick: () => scrollToSection("dashboard-notifications", "notifications"),
    },
    {
      key: "rewards" as const,
      label: "Reward",
      icon: Trophy,
      onClick: () => scrollToSection("dashboard-rewards", "rewards"),
    },
  ];

  if (!navEnabled) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-18px_45px_-25px_rgba(15,23,42,0.25)] backdrop-blur md:hidden",
        "transition-transform transition-opacity duration-300 ease-out",
        visibilityClasses
      )}
      onPointerDown={revealNav}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-2">
        {navItems.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={cn(
                "flex min-w-[72px] flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors",
                isActive ? "text-blue-700" : "text-slate-400 hover:text-slate-700"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                  isActive ? "bg-blue-50" : "bg-transparent"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "fill-current" : "")} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={cn("text-[10px] leading-tight", isActive ? "font-bold" : "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TechnicianBottomNav;
