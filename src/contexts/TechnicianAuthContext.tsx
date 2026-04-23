
import React, { createContext, useContext } from "react";
import { TechnicianAuthContextType } from "@/types/technician";
import { useTechnicianAuth as useTechnicianAuthHook } from "@/hooks/useTechnicianAuth";

const TechnicianAuthContext = createContext<TechnicianAuthContextType>({
  technician: null,
  isAuthenticated: false,
  token: null,
  isLoading: true,
  login: async () => ({}),
  register: async () => ({}),
  approveTechnician: async () => false,
  rejectTechnician: async () => false,
  refreshTechnician: async () => null,
  isOnline: false,
  setIsOnline: () => { },
  logout: async () => { },
});

export const TechnicianAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authState = useTechnicianAuthHook();

  return (
    <TechnicianAuthContext.Provider value={authState}>
      {children}
    </TechnicianAuthContext.Provider>
  );
};

export const useTechnicianAuth = () => useContext(TechnicianAuthContext);
