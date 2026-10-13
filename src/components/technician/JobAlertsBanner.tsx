import { useCallback, useEffect, useState } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { checkJobAlerts, fixJobAlertIssue, type JobAlertIssue } from "@/lib/jobAlertReadiness";
import { useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";

// What each thing in the way is called, and the button that fixes it. A blocked browser has no button:
// only the technician can allow it, from the address bar.
const COPY: Record<JobAlertIssue, { text: TechTextKey; sub?: TechTextKey; action?: TechTextKey }> = {
  notifications_off: { text: "alerts.notifications_off", action: "alerts.notifications_off.action" },
  notifications_blocked: { text: "alerts.notifications_blocked" },
  full_screen_off: { text: "alerts.full_screen_off", action: "alerts.full_screen_off.action" },
  battery_restricted: { text: "alerts.battery_restricted", sub: "alerts.battery_restricted.sub", action: "alerts.battery_restricted.action" },
};

const DISMISSED_KEY = "resqnow_job_alerts_banner_dismissed";

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** Shows only when this phone or browser would keep job alerts from reaching the technician. */
export default function JobAlertsBanner() {
  const { t } = useTechText();
  const [issues, setIssues] = useState<JobAlertIssue[]>([]);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState<JobAlertIssue | null>(null);

  const refresh = useCallback(() => {
    void checkJobAlerts().then(setIssues).catch(() => setIssues([]));
  }, []);

  useEffect(() => {
    refresh();
    // Coming back from the settings screen.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (dismissed || issues.length === 0) return null;

  const fix = async (issue: JobAlertIssue) => {
    setBusy(issue);
    try {
      await fixJobAlertIssue(issue);
    } catch {
      // The banner stays up; the technician can try again.
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Hidden for this visit only.
    }
  };

  return (
    <section className="tp-note" aria-label={t("alerts.title")} data-testid="job-alerts-banner">
      <div className="tp-note-row">
        <MaterialSymbol name="notifications_active" />
        <div>
          <b>{t("alerts.title")}</b>
          <span>{t("alerts.sub")}</span>
        </div>
        <button type="button" className="tp-x" aria-label={t("alerts.hide")} onClick={dismiss}>
          <MaterialSymbol name="close" />
        </button>
      </div>
      <ol className="tp-fixes">
        {issues.map((issue, index) => {
          const copy = COPY[issue];
          return (
            <li key={issue} className="tp-fix" data-issue={issue}>
              <i aria-hidden="true">{index + 1}</i>
              <span>
                {t(copy.text)}
                {copy.sub ? <small>{t(copy.sub)}</small> : null}
              </span>
              {copy.action ? (
                <button type="button" className="tp-pill tp-press" disabled={busy !== null} onClick={() => void fix(issue)}>
                  {t(copy.action)}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
