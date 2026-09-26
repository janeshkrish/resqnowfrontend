import { Suspense } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { HOME_HEADER_HEIGHT } from "@/components/home/HomeGlassHeader";
import { HomeBanners, HomeSearch } from "@/components/home/HomeTop";
import HomeServices from "@/components/home/HomeServices";
import FuelPricesCard from "@/components/home/FuelPricesCard";
import { GarageCard, OffersRail, PartnerCard, ReviewsRail } from "@/components/home/HomeCards";
import VehicleShowcase from "@/components/home/VehicleShowcase";
import LiveNetwork from "@/components/home/LiveNetwork";
import ActiveRequestCard from "@/components/home/ActiveRequestCard";

const EnterpriseDesktopHome = lazyWithReload(() => import("@/components/desktop/EnterpriseDesktopHome"));

const MobileDashboard = () => (
  <div className="rq-home relative min-h-screen" style={{ paddingTop: HOME_HEADER_HEIGHT }}>
    {/* Brand colour under the floating glass header (rendered by MobileAppHeader). */}
    <div aria-hidden="true" className="rq-home-backdrop" />

    <div className="rq-home-stack">
      <HomeSearch />
      <ActiveRequestCard />
      <HomeBanners />
      <HomeServices />
      <FuelPricesCard />
      <GarageCard />
      <OffersRail />
      <VehicleShowcase />
      <LiveNetwork />
      <ReviewsRail />
      <PartnerCard />
    </div>
  </div>
);

const Index = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileDashboard />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-white text-sm font-semibold text-slate-500">
          Loading enterprise platform...
        </div>
      }
    >
      <EnterpriseDesktopHome />
    </Suspense>
  );
};

export default Index;
