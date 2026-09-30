import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkJobAlerts, fixJobAlertIssue, type JobAlertIssue } from "@/lib/jobAlertReadiness";

const COPY: Record<JobAlertIssue, { text: string; action?: string }> = {
  notifications_off: {
    text: "Turn on notifications so new requests reach you when the app is closed or the screen is off.",
    action: "Turn on",
  },
  notifications_blocked: {
    text: "Notifications are blocked for this site. Allow them from the lock icon next to the address, then reload.",
  },
  full_screen_off: {
    text: "Allow full-screen alerts so a new request wakes the screen when the phone is locked.",
    action: "Allow",
  },
  battery_restricted: {
    text: "Set ResQNow's battery use to Unrestricted so the phone doesn't hold back requests while the screen is off.",
    action: "Open settings",
  },
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
    <section
      aria-label="Job alerts"
      className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm font-bold">Don't miss a request</p>
          <ul className="space-y-3">
            {issues.map((issue) => (
              <li key={issue} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">{COPY[issue].text}</span>
                {COPY[issue].action ? (
                  <Button
                    size="sm"
                    className="shrink-0 rounded-xl bg-amber-600 font-bold text-white hover:bg-amber-700"
                    disabled={busy !== null}
                    onClick={() => void fix(issue)}
                  >
                    {COPY[issue].action}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          Later
        </button>
      </div>
    </section>
  );
}
