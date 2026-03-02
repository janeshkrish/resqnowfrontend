import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, setUserToken, setUserProfile, getUserToken, getUserProfile, setAdminToken } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  subscription: "free" | "basic" | "premium" | "enterprise" | "none";
  isVerified?: boolean;
  googleId?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (name: string, email: string, password: string) => Promise<any>;
  verifyOtp: (email: string, otp: string, name: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateSubscription: (subscription: "free" | "basic" | "premium" | "enterprise" | "none") => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({}),
  register: async () => ({}),
  verifyOtp: async () => ({}),
  logout: async () => { },
  updateProfile: async () => { },
  updateSubscription: async () => { },
});

export const useAuth = () => useContext(AuthContext);
const ADMIN_STORAGE_KEY = "resqnow_admin_user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getUserToken();
      if (token) {
        try {
          // Verify token with backend
          const res = await apiFetch("/api/auth/me");
          if (res.ok) {
            const userData = await res.json();
            setUser({
              id: String(userData.id),
              name: userData.name,
              email: userData.email,
              subscription: "free",
              isVerified: userData.isVerified,
              googleId: userData.googleId,
              phone: userData.phone,
              birthday: userData.birthday,
              gender: userData.gender
            });
            // Persist a simple flag for older checks and non-React parts
            localStorage.setItem('isAuthenticated', 'true');
          } else {
            console.warn("Token invalid or expired");
            setUserToken(null);
            setUserProfile(null);
            localStorage.removeItem('isAuthenticated');
          }
        } catch (err) {
          console.error("Auth initialization error:", err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
    options?: { signal?: AbortSignal }
  ) => {
    try {
      const res = await apiFetch("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        signal: options?.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || "Login failed.";
        throw new Error(msg);
      }

      console.log("[Auth] login response", data);
      const resolvedRole = String(data?.role || data?.user?.role || "").trim().toLowerCase();
      if (resolvedRole === "admin") {
        const adminProfile = {
          id: String(data?.user?.id || "admin"),
          name: String(data?.user?.name || "Admin"),
          email: String(data?.user?.email || email),
          role: "admin",
        };

        setAdminToken(data.token || null);
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminProfile));
        setUserToken(null);
        setUserProfile(null);
        setUser(null);
        localStorage.removeItem("isAuthenticated");

        return {
          ...data,
          role: "admin",
          user: adminProfile,
        };
      }

      // Ensure stale admin auth doesn't leak into user sessions.
      setAdminToken(null);
      localStorage.removeItem(ADMIN_STORAGE_KEY);

      setUserToken(data.token);
      setUserProfile(data.user);
      setUser({
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        subscription: "free",
        isVerified: true
      });
      // Persist auth flag for legacy checks
      localStorage.setItem('isAuthenticated', 'true');
      return data;
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await apiFetch("/api/users/send-otp", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }
      return { message: data.message };
    } catch (error: any) {
      console.error("OTP Send error:", error);
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string, name: string, password: string) => {
    try {
      const res = await apiFetch("/api/users/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp, name, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setUserToken(data.token);
      setUserProfile(data.user);

      setUser({
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        subscription: "free",
        isVerified: true
      });

      // Persist a friendly flag for non-React checks
      localStorage.setItem('isAuthenticated', 'true');

      return data;
    } catch (error: any) {
      console.error("Verification error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call backend to invalidate if needed
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout backend call failed", err);
    } finally {
      setUserToken(null);
      setUserProfile(null);
      setUser(null);
      localStorage.removeItem('isAuthenticated');
      // Redirect to home
      window.location.href = "/";
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }

      const result = await res.json();

      // Update local state with the returned updated user or merge locally
      const updatedUser = { ...user, ...data }; // optimistically merge or stick to result
      // Ideally backend returns full user object:
      if (result.user) {
        // Map backend fields to frontend if needed or assume consistency (our backend returns consistent keys now)
        // Backend: name, email, phone, birthday, gender, isVerified, subscription, googleId
        const u = result.user;
        setUser({
          id: String(u.id),
          name: u.name,
          email: u.email,
          phone: u.phone,
          birthday: u.birthday,
          gender: u.gender,
          subscription: u.subscription,
          isVerified: u.isVerified,
          googleId: u.googleId
        });
        setUserProfile(result.user);
      } else {
        setUser(updatedUser);
        setUserProfile(updatedUser);
      }

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Update profile error:", error);
      toast.error(error.message || "Failed to update profile");
      throw error;
    }
  };

  const updateSubscription = async (subscription: "free" | "basic" | "premium" | "enterprise" | "none") => {
    // In a real app, this would be an API call
    // await apiFetch("/api/users/subscription", { method: "PUT", body: JSON.stringify({ subscription }) });

    // For now, update local state to reflect the change immediately
    if (user) {
      const updatedUser = { ...user, subscription };
      setUser(updatedUser);
      setUserProfile(updatedUser); // Update in localStorage/lib helper if needed

      // Persist to localStorage to survive refreshes if that's how the app initializes
      // (Note: This depends on how initAuth works, but updating state is key for the current session)
    }

    // toast.success(`Subscribed to ${subscription} plan!`); // Let the calling component handle the toast
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        verifyOtp,
        logout,
        updateProfile,
        updateSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
