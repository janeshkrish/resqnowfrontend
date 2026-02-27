import { PhoneCall, Wrench, Anchor, Cog, MessageCircle, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

const MobileQuickActions = () => {
  return (
    <>
      {/* Chat Button - Positioned above bottom nav */}
      <div className="fixed bottom-20 right-4 z-50 lg:hidden">
        <button className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-full shadow-2xl w-14 h-14 flex items-center justify-center hover:scale-110 transition-all duration-300 active:scale-95">
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom Navigation for Mobile - App Style */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border lg:hidden">
        <div className="grid grid-cols-5 gap-1 py-2 px-2 safe-area-pb">
          <Link
            to="/map"
            className="flex flex-col items-center justify-center py-2 px-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-accent active:scale-95"
          >
            <MapPin className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">Map</span>
          </Link>

          <Link
            to="/request-service/towing"
            className="flex flex-col items-center justify-center py-2 px-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-accent active:scale-95"
          >
            <Anchor className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">Towing</span>
          </Link>
          
          <Link
            to="/request-service/flat-tire"
            className="flex flex-col items-center justify-center py-2 px-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-accent active:scale-95"
          >
            <Wrench className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">Tire</span>
          </Link>
          
          <Link
            to="/request-service/mechanical"
            className="flex flex-col items-center justify-center py-2 px-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-accent active:scale-95"
          >
            <Cog className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">Repair</span>
          </Link>
          
          <Link
            to="/services"
            className="flex flex-col items-center justify-center py-2 px-2 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-accent active:scale-95"
          >
            <Wrench className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">More</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default MobileQuickActions;