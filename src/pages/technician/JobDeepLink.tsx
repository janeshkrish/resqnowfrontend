import { Navigate, useLocation, useParams } from "react-router-dom";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";

const JobDeepLink = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useTechnicianAuth();
  const params = new URLSearchParams(location.search);
  const alertAction = String(
    params.get("alertAction") || params.get("alert_action") || ""
  ).trim().toLowerCase();

  if (!jobId) {
    return <Navigate to="/technician/dashboard" replace />;
  }

  if (isAuthenticated) {
    const dashboardParams = new URLSearchParams();
    dashboardParams.set("jobId", String(jobId));
    if (alertAction) {
      dashboardParams.set("alertAction", alertAction);
    }
    return (
      <Navigate
        to={`/technician/dashboard?${dashboardParams.toString()}`}
        replace
        state={{ jobId, alertAction: alertAction || undefined }}
      />
    );
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem("resqnow_pending_job_deeplink", String(jobId));
    if (alertAction) {
      sessionStorage.setItem("resqnow_pending_job_alert_action", alertAction);
    } else {
      sessionStorage.removeItem("resqnow_pending_job_alert_action");
    }
  }

  return <Navigate to="/technician/login" replace />;
};

export default JobDeepLink;
