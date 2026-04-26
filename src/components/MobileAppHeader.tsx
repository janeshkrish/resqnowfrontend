import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
// Dropdown imports removed for cleaner mobile header with bottom nav

const MobileAppHeader = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const isLiveMapPage = location.pathname === "/map";
  const isServiceRequestFlow =
    location.pathname.startsWith("/request-service/") &&
    !location.pathname.startsWith("/request-service-tracking");

  if (!isMobile) return null;

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          {isServiceRequestFlow && (
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/");
                }
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <Link to="/" className="flex items-center">
            <span className="text-lg font-bold text-primary">ResQNow</span>
          </Link>
        </div>

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
