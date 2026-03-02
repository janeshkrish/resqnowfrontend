import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";

const TechnicianProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { technician, isAuthenticated, isLoading } = useTechnicianAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingAnimation />;
  }

  if (!isAuthenticated) {
    const returnPath = `${location.pathname}${location.search}`;
    sessionStorage.setItem("technicianReturnUrl", returnPath);
    return <Navigate to="/technician/login" replace />;
  }

  const role = String((technician as any)?.role || "technician").trim().toLowerCase();
  if (role !== "technician") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default TechnicianProtectedRoute;
