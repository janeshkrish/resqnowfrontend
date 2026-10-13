import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useJobAcceptance } from '@/hooks/useJobAcceptance';
import { getTechnicianActiveJobPath } from '@/lib/technicianActiveJobRoute';
import type { AcceptanceResult } from '@/lib/technicianJobAcceptance';

const ACCEPTED_JOB_STORAGE_KEY = "resqnow_tech_last_accepted_job_id";

type TechnicianJobContextType = {
  acceptedJobId: string | null;
  setAcceptedJobId: (jobId: string | null) => void;
  clearAcceptedJobId: () => void;
  acceptJob: (jobId: string) => Promise<AcceptanceResult>;
  pendingAcceptanceId: string | null;
  acceptanceMessage: string | null;
  checkAcceptance: () => Promise<AcceptanceResult | null>;
  canRetryAcceptance: boolean;
  retryAcceptance: () => Promise<AcceptanceResult>;
};

const TechnicianJobContext = createContext<TechnicianJobContextType>({
  acceptedJobId: null,
  setAcceptedJobId: () => {},
  clearAcceptedJobId: () => {},
  acceptJob: async () => { throw new Error('Technician job provider is missing'); },
  pendingAcceptanceId: null,
  acceptanceMessage: null,
  checkAcceptance: async () => null,
  canRetryAcceptance: false,
  retryAcceptance: async () => { throw new Error('Technician job provider is missing'); },
});

const readAcceptedJobId = (): string | null => {
  if (typeof window === "undefined") return null;
  const value = String(sessionStorage.getItem(ACCEPTED_JOB_STORAGE_KEY) || "").trim();
  return value || null;
};

export const TechnicianJobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [acceptedJobId, setAcceptedJobIdState] = useState<string | null>(() => readAcceptedJobId());

  const setAcceptedJobId = useCallback((jobId: string | null) => {
    const normalized = String(jobId || "").trim();
    const nextValue = normalized || null;
    setAcceptedJobIdState(nextValue);

    if (typeof window === "undefined") return;
    if (nextValue) {
      sessionStorage.setItem(ACCEPTED_JOB_STORAGE_KEY, nextValue);
    } else {
      sessionStorage.removeItem(ACCEPTED_JOB_STORAGE_KEY);
    }
  }, []);

  const clearAcceptedJobId = useCallback(() => {
    setAcceptedJobId(null);
  }, [setAcceptedJobId]);

  const { acceptJob, pendingAcceptanceId, acceptanceMessage, checkAcceptance, canRetryAcceptance, retryAcceptance } = useJobAcceptance((job, recovered) => {
    const jobId = String(job.id);
    setAcceptedJobId(jobId);
    if (recovered && pathname.startsWith('/technician/')) {
      navigate(getTechnicianActiveJobPath(jobId), { replace: true, state: { jobId, job } });
    }
  });

  const value = useMemo(
    () => ({
      acceptedJobId,
      setAcceptedJobId,
      clearAcceptedJobId,
      acceptJob,
      pendingAcceptanceId,
      acceptanceMessage,
      checkAcceptance,
      canRetryAcceptance,
      retryAcceptance,
    }),
    [acceptedJobId, setAcceptedJobId, clearAcceptedJobId, acceptJob, pendingAcceptanceId, acceptanceMessage, checkAcceptance, canRetryAcceptance, retryAcceptance]
  );

  return <TechnicianJobContext.Provider value={value}>{children}</TechnicianJobContext.Provider>;
};

export const useTechnicianJob = () => useContext(TechnicianJobContext);

