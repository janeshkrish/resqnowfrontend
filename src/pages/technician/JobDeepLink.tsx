import { Navigate, useParams } from "react-router-dom";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";

const JobDeepLink = () => {
  const { jobId } = useParams();
  const { isAuthenticated } = useTechnicianAuth();

  if (!jobId) {
    return <Navigate to="/technician/dashboard" replace />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={`/technician/active-job?jobId=${encodeURIComponent(jobId)}`}
        replace
        state={{ job: { id: jobId, requestId: jobId } }}
      />
    );
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem("resqnow_pending_job_deeplink", String(jobId));
  }

  return <Navigate to="/technician/login" replace />;
};

export default JobDeepLink;
