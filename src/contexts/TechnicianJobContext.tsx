import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ACCEPTED_JOB_STORAGE_KEY = "resqnow_tech_last_accepted_job_id";

type TechnicianJobContextType = {
  acceptedJobId: string | null;
  setAcceptedJobId: (jobId: string | null) => void;
  clearAcceptedJobId: () => void;
};

const TechnicianJobContext = createContext<TechnicianJobContextType>({
  acceptedJobId: null,
  setAcceptedJobId: () => {},
  clearAcceptedJobId: () => {},
});

const readAcceptedJobId = (): string | null => {
  if (typeof window === "undefined") return null;
  const value = String(sessionStorage.getItem(ACCEPTED_JOB_STORAGE_KEY) || "").trim();
  return value || null;
};

export const TechnicianJobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const value = useMemo(
    () => ({
      acceptedJobId,
      setAcceptedJobId,
      clearAcceptedJobId,
    }),
    [acceptedJobId, setAcceptedJobId, clearAcceptedJobId]
  );

  return <TechnicianJobContext.Provider value={value}>{children}</TechnicianJobContext.Provider>;
};

export const useTechnicianJob = () => useContext(TechnicianJobContext);

