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

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored && getAdminToken()) {
      try {
        const user = JSON.parse(stored) as AdminUser;
        setAdminUser(user);
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        setAdminToken(null);
      }
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
    return !!getAdminToken();
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
