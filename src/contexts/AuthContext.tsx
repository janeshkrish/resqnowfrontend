import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch, setUserToken, setUserProfile, getUserToken, setAdminToken } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  subscription: string;
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
  login: (email: string, password: string, options?: { signal?: AbortSignal }) => Promise<any>;
  loginWithPhone: (idToken: string, name?: string) => Promise<PhoneLoginOutcome>;
  register: (name: string, email: string, password: string) => Promise<any>;
  verifyOtp: (email: string, otp: string, name: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
}

/** A new number is asked for a name first; otherwise the customer is now logged in. */
export type PhoneLoginOutcome = { needsName: boolean; isNew: boolean };

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({}),
  loginWithPhone: async () => ({ needsName: false, isNew: false }),
  register: async () => ({}),
  verifyOtp: async () => ({}),
  logout: async () => { },
  updateProfile: async () => { },
  refreshUser: async () => null,
});

export const useAuth = () => useContext(AuthContext);
const ADMIN_STORAGE_KEY = "resqnow_admin_user";

function serverUserProfile(data: any): UserProfile {
  if (data?.id == null || !String(data.id).trim()) throw new Error("Unable to load your account. Please try again.");
  return {
    id: String(data.id), name: data.name, email: data.email || "",
    subscription: typeof data.subscription === "string" && data.subscription.trim()
      ? data.subscription.trim().toLowerCase() : "free",
    isVerified: data.isVerified, googleId: data.googleId, phone: data.phone,
    birthday: data.birthday, gender: data.gender,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const sessionVersion = useRef(0);
  const profileRequest = useRef(0);
  const profileReady = useRef(false);

  const clearCustomerSession = useCallback(() => {
    sessionVersion.current++;
    profileRequest.current++;
    profileReady.current = false;
    setUserToken(null);
    setUserProfile(null);
    setUser(null);
    localStorage.removeItem('isAuthenticated');
  }, []);

  const refreshUser = useCallback(async (options: { signal?: AbortSignal } = {}): Promise<UserProfile | null> => {
    if (options.signal?.aborted) throw new DOMException("Sign-in cancelled.", "AbortError");
    const token = getUserToken();
    if (!token) return null;
    const version = sessionVersion.current;
    const request = ++profileRequest.current;
    const res = await apiFetch("/api/auth/me", { cache: "no-store", signal: options.signal });
    const data = await res.json();
    if (options.signal?.aborted) throw new DOMException("Sign-in cancelled.", "AbortError");
    if (version !== sessionVersion.current || token !== getUserToken() || request !== profileRequest.current) return null;
    if (!res.ok) {
      if ([401, 403, 404].includes(res.status)) clearCustomerSession();
      throw new Error(data.error || "Unable to refresh your account. Please try again.");
    }
    const profile = serverUserProfile(data);
    setUser(profile);
    setUserProfile(profile);
    profileReady.current = true;
    localStorage.setItem('isAuthenticated', 'true');
    return profile;
  }, [clearCustomerSession]);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      try { await refreshUser(); }
      catch (err) { console.error("Auth initialization error:", err); }
      finally { if (active) setLoading(false); }
    };
    void initAuth();
    return () => { active = false; sessionVersion.current++; profileRequest.current++; };
  }, [refreshUser]);

  useEffect(() => {
    const refresh = () => {
      if (profileReady.current && document.visibilityState !== 'hidden') void refreshUser().catch(() => {});
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshUser]);

  const completeCustomerLogin = async (data: any, version: number, signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException("Sign-in cancelled.", "AbortError");
    if (version !== sessionVersion.current) throw new Error("This sign-in was replaced by another session.");
    if (!data.token) throw new Error("Login did not return a session token.");
    setUser(null);
    setUserProfile(null);
    localStorage.removeItem('isAuthenticated');
    setUserToken(data.token);
    try {
      const profile = await refreshUser({ signal });
      if (!profile) throw new Error("This sign-in was replaced by another session.");
    } catch (error) {
      if (version === sessionVersion.current && getUserToken() === data.token) clearCustomerSession();
      throw error;
    }
  };

  const login = async (
    email: string,
    password: string,
    options?: { signal?: AbortSignal }
  ) => {
    const version = ++sessionVersion.current;
    profileRequest.current++;
    profileReady.current = false;
    try {
      const res = await apiFetch("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        signal: options?.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (options?.signal?.aborted) throw new DOMException("Sign-in cancelled.", "AbortError");
      if (!res.ok) {
        const msg = data.error || "Login failed.";
        throw new Error(msg);
      }

      console.log("[Auth] login response", data);
      if (version !== sessionVersion.current) throw new Error("This sign-in was replaced by another session.");
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
        clearCustomerSession();

        return {
          ...data,
          role: "admin",
          user: adminProfile,
        };
      }

      // Ensure stale admin auth doesn't leak into user sessions.
      setAdminToken(null);
      localStorage.removeItem(ADMIN_STORAGE_KEY);

      await completeCustomerLogin(data, version, options?.signal);
      return data;
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // The mobile number was checked by Firebase; the server swaps its ID token for ours.
  const loginWithPhone = async (idToken: string, name?: string): Promise<PhoneLoginOutcome> => {
    const version = ++sessionVersion.current;
    profileRequest.current++;
    profileReady.current = false;
    const res = await apiFetch("/api/users/phone-login", {
      method: "POST",
      body: JSON.stringify(name ? { idToken, name } : { idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Login failed. Please try again.");
    }
    if (version !== sessionVersion.current) throw new Error("This sign-in was replaced by another session.");
    if (data.needsName) {
      return { needsName: true, isNew: false };
    }

    setAdminToken(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    await completeCustomerLogin(data, version);
    return { needsName: false, isNew: !!data.isNew };
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
    const version = ++sessionVersion.current;
    profileRequest.current++;
    profileReady.current = false;
    try {
      const res = await apiFetch("/api/users/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp, name, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      await completeCustomerLogin(data, version);

      return data;
    } catch (error: any) {
      console.error("Verification error:", error);
      throw error;
    }
  };

  const logout = async () => {
    clearCustomerSession();
    const version = sessionVersion.current;
    try {
      // Call backend to invalidate if needed
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout backend call failed", err);
    } finally {
      // Redirect to home
      if (version === sessionVersion.current) window.location.href = "/";
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const version = sessionVersion.current;
    const token = getUserToken();
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }

      if (version !== sessionVersion.current || token !== getUserToken()) return;
      const profile = await refreshUser();
      if (!profile) return;
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Update profile error:", error);
      toast.error(error.message || "Failed to update profile");
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        loginWithPhone,
        register,
        verifyOtp,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
