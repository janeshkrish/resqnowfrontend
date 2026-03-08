import { useState, useEffect } from "react";
import { Technician } from "@/types/technician";
import { technicianAuthService } from "@/services/technicianAuthService";
import { technicianAdminService } from "@/services/technicianAdminService";
import { getTechnicianToken } from "@/lib/api";

export const useTechnicianAuth = () => {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const checkTechnicianAuth = async () => {
      const token = getTechnicianToken();
      if (token) {
        try {
          const techData = await technicianAuthService.fetchTechnicianProfile("");
          if (techData) {
            setTechnician(techData);
            localStorage.setItem("resqnow_technician", JSON.stringify(techData));
          } else {
            localStorage.removeItem("resqnow_technician");
          }
        } catch {
          localStorage.removeItem("resqnow_technician");
        }
      } else {
        localStorage.removeItem("resqnow_technician");
      }
      setIsLoading(false);
    };
    checkTechnicianAuth();
  }, []);

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
    isOnline,
    setIsOnline,
    logout,
    token: getTechnicianToken(),
  };
};
