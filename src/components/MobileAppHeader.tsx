import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { PhoneCall } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
// Dropdown imports removed for cleaner mobile header with bottom nav

const MobileAppHeader = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isLiveMapPage = location.pathname === "/map";

  if (!isMobile) return null;

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <span className="text-lg font-bold text-primary">ResQNow</span>
        </Link>

        {!isLiveMapPage && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 shadow-sm text-xs font-bold px-4 h-9 rounded-full"
              asChild
            >
              <Link to="/request-service/emergency">
                <PhoneCall className="mr-1.5 h-3.5 w-3.5 fill-current animate-pulse" />
                SOS
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default MobileAppHeader;
