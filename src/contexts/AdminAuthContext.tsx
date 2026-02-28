import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { apiFetch, setAdminToken, getAdminToken } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  checkAdminAccess: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  isAdminAuthenticated: false,
  isLoading: true,
  loginAdmin: async () => {},
  logoutAdmin: async () => {},
  checkAdminAccess: async () => false,
});

const ADMIN_STORAGE_KEY = "resqnow_admin_user";

const decodeJwtPayload = (token: string): any | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(normalized + padding));
  } catch {
    return null;
  }
};

const hasAdminRoleToken = (token: string | null): boolean => {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  const role = String(payload?.role || payload?.type || "").trim().toLowerCase();
  return role === "admin";
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    const token = getAdminToken();
    const hasAdminToken = hasAdminRoleToken(token);
    if (stored && hasAdminToken) {
      try {
        const user = JSON.parse(stored) as AdminUser;
        setAdminUser(user);
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        setAdminToken(null);
      }
    } else if (token && !hasAdminToken) {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      setAdminToken(null);
    }
    setIsLoading(false);
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Invalid email or password.");
      }
      const data = await res.json();
      setAdminToken(data.token);
      const admin = data.admin as AdminUser;
      setAdminUser(admin);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
      toast.success("Admin login successful");
      navigate("/admin/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin login failed";
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logoutAdmin = async () => {
    setAdminToken(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminUser(null);
    toast.success("Admin logged out");
    navigate("/");
  };

  const checkAdminAccess = async (): Promise<boolean> => {
    return hasAdminRoleToken(getAdminToken());
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isAdminAuthenticated: !!adminUser,
        isLoading,
        loginAdmin,
        logoutAdmin,
        checkAdminAccess,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdminAuthenticated, isLoading, checkAdminAccess } = useAdminAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!isLoading) {
        const hasAccess = await checkAdminAccess();
        setVerified(hasAccess);
        if (!hasAccess) {
          toast.error("Admin access required");
          navigate("/admin/login");
        }
      }
    };
    verify();
  }, [isLoading, isAdminAuthenticated, navigate, checkAdminAccess]);

  if (isLoading || verified === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  return verified ? <>{children}</> : null;
};
