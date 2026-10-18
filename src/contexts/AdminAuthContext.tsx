import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { apiFetch, setAdminToken, getAdminToken } from "@/lib/api";
import { ADMIN_SESSION_ENDED, adminTokenExpired, rememberAdminPage, takeAdminPage } from "@/lib/adminSession";

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
  /** True when the last sign-in ran out (it lasts a day), so the sign-in page can say so. */
  sessionEnded: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  isAdminAuthenticated: false,
  isLoading: true,
  loginAdmin: async () => {},
  logoutAdmin: async () => {},
  checkAdminAccess: async () => false,
  sessionEnded: false,
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
  return role === "admin" && !adminTokenExpired(token);
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    const token = getAdminToken();
    const hasAdminToken = hasAdminRoleToken(token);
    if (token && adminTokenExpired(token)) setSessionEnded(true);
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

  // The server refused the sign-in while the portal was open: back to the sign-in page, and
  // back to this page afterwards, instead of "Unauthorized" on every card.
  useEffect(() => {
    const ended = () => {
      if (!getAdminToken() && !localStorage.getItem(ADMIN_STORAGE_KEY)) return;
      setAdminToken(null);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      setAdminUser(null);
      setSessionEnded(true);
      rememberAdminPage(window.location.pathname + window.location.search);
      navigate("/admin/login", { replace: true });
    };
    window.addEventListener(ADMIN_SESSION_ENDED, ended);
    return () => window.removeEventListener(ADMIN_SESSION_ENDED, ended);
  }, [navigate]);

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
      setSessionEnded(false);
      toast.success("Admin login successful");
      navigate(takeAdminPage());
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
    toast.success("Signed out");
    navigate("/admin/login", { replace: true });
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
        sessionEnded,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdminAuthenticated, isLoading, checkAdminAccess, sessionEnded } = useAdminAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!isLoading) {
        const hasAccess = await checkAdminAccess();
        setVerified(hasAccess);
        if (!hasAccess) {
          rememberAdminPage(window.location.pathname + window.location.search);
          // An ended sign-in is explained on the sign-in page itself.
          if (!sessionEnded) toast.error("Admin access required");
          navigate("/admin/login");
        }
      }
    };
    verify();
  }, [isLoading, isAdminAuthenticated, navigate, checkAdminAccess, sessionEnded]);

  if (isLoading || verified === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  return verified ? <>{children}</> : null;
};
