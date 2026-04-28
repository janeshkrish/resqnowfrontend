import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav"; // Use new Nav
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
      {/* Conditional header for mobile vs desktop */}
      {isMobile ? !isTrackingExperience && <MobileAppHeader /> : <Header />}

      {/* Main content with app-like styling on mobile */}
      {/* Added pb-20 to ensure content isn't hidden behind bottom nav */}
      <main className={`flex-grow ${isMobile ? `mobile-main ${isTrackingExperience ? "" : "pb-20"}` : ''}`}>
        <Outlet />
      </main>

      {/* Footer - hidden on mobile for app-like experience */}
      <div className={isMobile ? 'hidden' : 'block'}>
        <Footer />
      </div>

      {/* Mobile-specific features */}
      {isMobile && !isTrackingExperience && <MobileBottomNav />}

      {/* Chatbot - positioned differently on mobile */}
      {!shouldHideShellSupport && (
        <div className={isMobile ? 'mobile-chatbot bottom-20' : ''}>
          <Chatbot />
        </div>
      )}
    </div>
  );
};

export default AppLayout;
