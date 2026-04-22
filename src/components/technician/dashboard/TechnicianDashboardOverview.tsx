import DashboardHeader from "@/components/technician/dashboard/DashboardHeader";
import EarningsSection from "@/components/technician/dashboard/EarningsSection";
import FleetManagementCard from "@/components/technician/dashboard/FleetManagementCard";
import OrderOverviewGrid from "@/components/technician/dashboard/OrderOverviewGrid";
import OrderPerformanceCard from "@/components/technician/dashboard/OrderPerformanceCard";
import QuickActions from "@/components/technician/dashboard/QuickActions";
import RewardsSection from "@/components/technician/dashboard/RewardsSection";
import TeamManagementCard from "@/components/technician/dashboard/TeamManagementCard";
import TechnicianNotifications from "@/components/technician/TechnicianNotifications";

type TechnicianDashboardOverviewProps = {
  showTowingManagement: boolean;
  technicianName: string;
  technicianId: string;
  isOnline: boolean;
  pointsBalance: number;
  unreadNotifications: number;
  language: string;
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
  rewardItems: Array<{
    id: string;
    title: string;
    subtitle: string;
    pointsRequired: number;
    progress: number;
    redeemable: boolean;
  }>;
  onToggleAvailability: (checked: boolean) => void;
  onOpenNotifications: () => void;
  onLanguageChange: (value: string) => void;
  onOpenUcp: () => void;
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
  isOnline,
  pointsBalance,
  unreadNotifications,
  language,
  notifications,
  fleetCount,
  teamCount,
  orderOverview,
  orderPerformance,
  earnings,
  rewardItems,
  onToggleAvailability,
  onOpenNotifications,
  onLanguageChange,
  onOpenUcp,
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
        pointsBalance={pointsBalance}
        unreadNotifications={unreadNotifications}
        isOnline={isOnline}
        onToggleAvailability={onToggleAvailability}
        onOpenNotifications={onOpenNotifications}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <div className={`grid gap-6 ${showTowingManagement ? "lg:grid-cols-2" : ""}`}>
            {showTowingManagement ? (
              <FleetManagementCard
                activeVehicles={fleetCount}
                onManageFleet={onManageFleet}
                onAddVehicle={onAddVehicle}
              />
            ) : null}
            <OrderPerformanceCard
              totalOrders={orderPerformance.totalOrders}
              onTimeOrders={orderPerformance.onTimeOrders}
              lateOrders={orderPerformance.lateOrders}
              lastOrder={orderPerformance.lastOrder}
            />
          </div>

          <QuickActions
            notificationCount={unreadNotifications}
            selectedLanguage={language}
            onOpenUcp={onOpenUcp}
            onOpenNotifications={onOpenNotifications}
            onLanguageChange={onLanguageChange}
          />

          <OrderOverviewGrid counts={orderOverview} onViewHistory={onViewHistory} />

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
        </div>

        <div className="space-y-6">
          <RewardsSection pointsBalance={pointsBalance} items={rewardItems} />

          {showTowingManagement ? (
            <TeamManagementCard
              serviceProvidersCount={teamCount}
              onManageTeam={onManageTeam}
              onAddServiceProvider={onAddServiceProvider}
            />
          ) : null}

          <div id="dashboard-notifications">
            <TechnicianNotifications notifications={notifications.slice(0, 5)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboardOverview;
