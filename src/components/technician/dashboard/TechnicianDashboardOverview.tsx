import DashboardHeader from "@/components/technician/dashboard/DashboardHeader";
import EarningsSection from "@/components/technician/dashboard/EarningsSection";
import FleetManagementCard from "@/components/technician/dashboard/FleetManagementCard";
import OrderOverviewGrid from "@/components/technician/dashboard/OrderOverviewGrid";
import OrderPerformanceCard from "@/components/technician/dashboard/OrderPerformanceCard";
import TeamManagementCard from "@/components/technician/dashboard/TeamManagementCard";
import TechnicianNotifications from "@/components/technician/TechnicianNotifications";

type TechnicianDashboardOverviewProps = {
  showTowingManagement: boolean;
  technicianName: string;
  technicianId: string;
  profileImageUrl?: string | null;
  isOnline: boolean;
  pointsBalance: number;
  unreadNotifications: number;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  }>;
  fleetCount: number;
  teamCount: number;
  orderOverview: {
    newOrders: number;
    assigned: number;
    acknowledged: number;
    inProgress: number;
    completed: number;
  };
  orderPerformance: {
    totalOrders: number;
    onTimeOrders: number;
    lateOrders: number;
    lastOrder: {
      id: string;
      serviceType: string;
      lateByMinutes: number | null;
      statusLabel: string;
    } | null;
  };
  earnings: {
    total: number;
    withdrawable: number;
    pending: number;
    paid: number;
    disputed: number;
  };
  onToggleAvailability: (checked: boolean) => void;
  onOpenNotifications: () => void;
  onViewProfile: () => void;
  onOpenAppearanceSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenSecuritySettings: () => void;
  onManageFleet: () => void;
  onAddVehicle: () => void;
  onViewHistory: () => void;
  onOpenFinancialReport: () => void;
  onManageTeam: () => void;
  onAddServiceProvider: () => void;
};

const TechnicianDashboardOverview = ({
  showTowingManagement,
  technicianName,
  technicianId,
  profileImageUrl,
  isOnline,
  pointsBalance,
  unreadNotifications,
  notifications,
  fleetCount,
  teamCount,
  orderOverview,
  orderPerformance,
  earnings,
  onToggleAvailability,
  onOpenNotifications,
  onViewProfile,
  onOpenAppearanceSettings,
  onOpenNotificationSettings,
  onOpenSecuritySettings,
  onManageFleet,
  onAddVehicle,
  onViewHistory,
  onOpenFinancialReport,
  onManageTeam,
  onAddServiceProvider,
}: TechnicianDashboardOverviewProps) => {
  return (
    <div className="space-y-6">
      <DashboardHeader
        technicianName={technicianName}
        technicianId={technicianId}
        profileImageUrl={profileImageUrl}
        pointsBalance={pointsBalance}
        unreadNotifications={unreadNotifications}
        isOnline={isOnline}
        onToggleAvailability={onToggleAvailability}
        onOpenNotifications={onOpenNotifications}
        onViewProfile={onViewProfile}
        onOpenAppearanceSettings={onOpenAppearanceSettings}
        onOpenNotificationSettings={onOpenNotificationSettings}
        onOpenSecuritySettings={onOpenSecuritySettings}
      />

      <OrderOverviewGrid counts={orderOverview} onViewHistory={onViewHistory} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <EarningsSection
            totalEarnings={earnings.total}
            withdrawableBalance={earnings.withdrawable}
            breakdown={{
              pending: earnings.pending,
              paid: earnings.paid,
              disputed: earnings.disputed,
            }}
            onOpenFinancialReport={onOpenFinancialReport}
          />

          <div id="dashboard-notifications">
            <TechnicianNotifications notifications={notifications.slice(0, 5)} />
          </div>
        </div>

        <div className="space-y-6">
          <OrderPerformanceCard
            totalOrders={orderPerformance.totalOrders}
            onTimeOrders={orderPerformance.onTimeOrders}
            lateOrders={orderPerformance.lateOrders}
            lastOrder={orderPerformance.lastOrder}
          />

          {showTowingManagement ? (
            <FleetManagementCard
              activeVehicles={fleetCount}
              onManageFleet={onManageFleet}
              onAddVehicle={onAddVehicle}
            />
          ) : null}

          {showTowingManagement ? (
            <TeamManagementCard
              serviceProvidersCount={teamCount}
              onManageTeam={onManageTeam}
              onAddServiceProvider={onAddServiceProvider}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboardOverview;
