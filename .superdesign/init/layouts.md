# Shared layouts

## AppLayout
- Path: `src/components/AppLayout.tsx`
- Used by the customer tracking route. The tracking experience suppresses mobile header, bottom navigation, and support surfaces so the map can be full-screen.

```tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import MobileAppHeader from "./MobileAppHeader";
import Chatbot from "./Chatbot";
import { useIsMobile } from "@/hooks/use-mobile";
import { isTrackingExperiencePath, shouldHideSupportSurfaces } from "@/lib/appShellRoutes";

const AppLayout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const shouldHideShellSupport = shouldHideSupportSurfaces(location.pathname);
  const isTrackingExperience = isTrackingExperiencePath(location.pathname);
  return (
    <div className={`flex flex-col min-h-screen ${isMobile ? 'mobile-app-layout bg-background' : ''}`}>
      {isMobile ? !isTrackingExperience && <MobileAppHeader /> : <Header />}
      <main className={`flex-grow ${isMobile ? `mobile-main ${isTrackingExperience ? "" : "pb-20"}` : ''}`}><Outlet /></main>
      <div className={isMobile ? 'hidden' : 'block'}><Footer /></div>
      {isMobile && !isTrackingExperience && <MobileBottomNav />}
      {!shouldHideShellSupport && <div className={isMobile ? 'mobile-chatbot bottom-20' : ''}><Chatbot /></div>}
    </div>
  );
};
export default AppLayout;
```

## TechnicianLayout
- Path: `src/components/technician/TechnicianLayout.tsx`
- Used by the technician active-job route.

```tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import TechnicianHeader from "./TechnicianHeader";
const TechnicianLayout = () => {
  const location = useLocation();
  const isDashboardRoute = location.pathname === "/technician/dashboard";
  return (
    <div className="flex flex-col min-h-screen">
      {!isDashboardRoute ? <TechnicianHeader /> : null}
      <main className="flex-grow"><Outlet /></main>
      {!isDashboardRoute ? (
        <footer className="border-t py-6 md:py-0">
          <div className="container flex flex-col md:h-16 items-center md:flex-row md:justify-between">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} ResQNow Technician Portal. All rights reserved.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Contact</a>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
};
export default TechnicianLayout;
```
