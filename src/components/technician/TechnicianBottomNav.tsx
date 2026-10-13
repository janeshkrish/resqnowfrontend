import { useNavigate } from "react-router-dom";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { useAutoHideBottomNav } from "@/hooks/useAutoHideBottomNav";
import { useTechText } from "@/lib/technicianLanguage";
import { useTechnicianNavSettings } from "@/lib/technicianNavSettings";
import type { TechTextKey } from "@/lib/technicianText";
import { cn } from "@/lib/utils";

export type TechnicianTab = "home" | "money" | "jobs" | "me";

const TABS: Array<{ key: TechnicianTab; label: TechTextKey; icon: string; to: string }> = [
  { key: "home", label: "nav.home", icon: "home", to: "/technician/dashboard" },
  { key: "money", label: "nav.money", icon: "account_balance_wallet", to: "/technician/earnings" },
  { key: "jobs", label: "nav.jobs", icon: "build", to: "/technician/history" },
  { key: "me", label: "nav.me", icon: "person", to: "/technician/profile" },
];

/** The four places of the technician app. Hidden when the technician has switched the bar off. */
const TechnicianBottomNav = ({ active }: { active: TechnicianTab }) => {
  const navigate = useNavigate();
  const { t } = useTechText();
  const { enabled, autoHide } = useTechnicianNavSettings();
  const { isVisible, revealNav } = useAutoHideBottomNav({ enabled: enabled && autoHide });

  if (!enabled) return null;

  return (
    <nav
      className={cn("tp-nav", !isVisible && "is-hidden")}
      aria-label={t("nav.label")}
      data-testid="technician-nav"
      onPointerDown={revealNav}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cn("tp-tab tp-press", active === tab.key && "is-on")}
          aria-current={active === tab.key ? "page" : undefined}
          onClick={() => navigate(tab.to)}
        >
          <MaterialSymbol name={tab.icon} />
          <span>{t(tab.label)}</span>
        </button>
      ))}
    </nav>
  );
};

export default TechnicianBottomNav;
