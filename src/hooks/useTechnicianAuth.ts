import { useState, useEffect, useCallback } from "react";
import { Technician } from "@/types/technician";
import { technicianAuthService } from "@/services/technicianAuthService";
import { technicianAdminService } from "@/services/technicianAdminService";
import { getTechnicianToken } from "@/lib/api";

export const useTechnicianAuth = () => {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  const refreshTechnician = useCallback(async (options?: { signal?: AbortSignal }) => {
    const token = getTechnicianToken();
    if (!token) {
      localStorage.removeItem("resqnow_technician");
      setTechnician(null);
      return null;
    }

    try {
      const techData = await technicianAuthService.fetchTechnicianProfile("", options);
      if (techData) {
        setTechnician(techData);
        localStorage.setItem("resqnow_technician", JSON.stringify(techData));
        return techData;
      }
      localStorage.removeItem("resqnow_technician");
      setTechnician(null);
      return null;
    } catch {
      localStorage.removeItem("resqnow_technician");
      setTechnician(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const checkTechnicianAuth = async () => {
      const techData = await refreshTechnician();
      if (techData) {
        try {
          await technicianAuthService.heartbeat({
            source: "auth_restore",
            path: window.location.pathname,
          });
        } catch (heartbeatError) {
          console.warn("[TechnicianAuth] restore heartbeat failed:", heartbeatError);
        }
      }
      setIsLoading(false);
    };
    checkTechnicianAuth();
  }, [refreshTechnician]);

  useEffect(() => {
    if (!technician?.id) return;

    let disposed = false;
    const sendHeartbeat = () => {
      if (disposed) return;
      technicianAuthService.heartbeat({
        path: window.location.pathname,
      }).catch((heartbeatError) => {
        console.warn("[TechnicianAuth] heartbeat failed:", heartbeatError);
      });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    const onFocus = () => sendHeartbeat();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [technician?.id]);

  const login = async (email: string, password: string, options?: { signal?: AbortSignal }) => {
    const technicianData = await technicianAuthService.login(email, password, options);
    setTechnician(technicianData);
    localStorage.setItem("resqnow_technician", JSON.stringify(technicianData));
    return technicianData;
  };

  const register = async (data: any) => {
    const technicianData = await technicianAuthService.register(data);
    setTechnician(technicianData);
    localStorage.setItem("resqnow_technician", JSON.stringify(technicianData));
    return technicianData;
  };

  const logout = async () => {
    await technicianAuthService.logout();
    setTechnician(null);
  };

  return {
    technician,
    isAuthenticated: !!technician,
    isLoading,
    login,
    register,
    approveTechnician: technicianAdminService.approveTechnician,
    rejectTechnician: technicianAdminService.rejectTechnician,
    refreshTechnician,
    isOnline,
    setIsOnline,
    logout,
    token: getTechnicianToken(),
  };
};
