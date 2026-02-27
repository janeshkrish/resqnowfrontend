import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTechnicianAuth } from '../contexts/TechnicianAuthContext';
import { useFCM } from '../hooks/useFCM';

export const FCMWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const { isAuthenticated: isTechAuthenticated } = useTechnicianAuth();

    // Initialize FCM if either user or technician is logged in
    useFCM(isAuthenticated || isTechAuthenticated);

    return <>{children}</>;
};
