import React, { useEffect, useState, useRef } from "react";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TechnicianJobModal, JobRequest } from "@/components/technician/TechnicianJobModal";
import { toast } from "sonner";
import { Loader2, MapPin, DollarSign, Briefcase, Navigation, PhoneCall, User, Car, AlertCircle, TrendingUp, Star, CreditCard } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import TechnicianJobCompletion from "@/components/technician/TechnicianJobCompletion";
import io, { Socket } from "socket.io-client";
import TechnicianJobMap from "@/components/technician/TechnicianJobMap";
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE, getRequiredApiBaseUrl } from "@/lib/api";
import TechnicianBottomNav from "@/components/technician/TechnicianBottomNav"; // Import Bottom Nav
import { useTechnicianActiveJob } from "@/hooks/useTechnicianActiveJob";
import { formatTechnicianStatus, normalizeTechnicianStatus } from "@/utils/technicianStatus";
import { useTechnicianJob } from "@/contexts/TechnicianJobContext";
import { Capacitor } from "@capacitor/core";

// Restored imports for widgets
import TechnicianJobHistory from "@/components/technician/TechnicianJobHistory";
import TechnicianEarningsChart from "@/components/technician/TechnicianEarningsChart"; // Ensure this matches file name
import TechnicianReviews from "@/components/technician/TechnicianReviews"; // Ensure this matches file name
import TechnicianNotifications from "@/components/technician/TechnicianNotifications"; // Ensure this matches file name

const TechnicianDashboard = () => {
  const { technician, isOnline, setIsOnline, isLoading } = useTechnicianAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jobs: 0, earnings: 0, today: 0 });
  const [incomingJob, setIncomingJob] = useState<JobRequest | null>(null);
  const [incomingJobUnavailable, setIncomingJobUnavailable] = useState(false);

  // Modals & Completion
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [lastEarned, setLastEarned] = useState(0);
  const [isJobActionLoading, setIsJobActionLoading] = useState(false);

  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [earningsHistory, setEarningsHistory] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [financials, setFinancials] = useState({ total_earnings: 0, pending_dues: 0 });
  const isNativePlatform = Capacitor.isNativePlatform();
  const { activeJob, setActiveJob, refreshActiveJob } = useTechnicianActiveJob(technician?.id, 15000);
  const { acceptedJobId, setAcceptedJobId, clearAcceptedJobId } = useTechnicianJob();
  const JOB_TAKEN_MESSAGE = "This job has already been taken by another technician.";

  const socketRef = useRef<Socket | null>(null);
  const trackingInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const confirmationAudioContextRef = useRef<AudioContext | null>(null);
  const isOnlineRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);
  const activeJobStatusRef = useRef<string>("");
  const acceptedJobIdRef = useRef<string | null>(acceptedJobId);
  const incomingJobRef = useRef<JobRequest | null>(incomingJob);
  const handledRouteJobRef = useRef<string | null>(null);

  const stopAlertSound = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    try {
      delete (window as any).currentSiren;
    } catch {
      // no-op
    }
  };

  const playAlertSound = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((error) => {
      console.error("Siren play failed", error);
    });
    (window as any).currentSiren = audioRef.current;
  };

  const playAcceptConfirmationSound = () => {
    try {
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const context: AudioContext =
        confirmationAudioContextRef.current ||
        new AudioContextClass();
      confirmationAudioContextRef.current = context;
      if (context.state === "suspended") {
        void context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(720, now);
      oscillator.frequency.exponentialRampToValueAtTime(1240, now + 0.18);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.26);
    } catch (error) {
      console.error("Confirmation sound failed", error);
    }
  };

  const normalizeIncomingAssignedJob = (payload: any) => {
    const raw = payload?.request || payload || {};
    const amountRaw = raw.amount ?? raw.service_charge ?? raw.serviceCharge ?? incomingJob?.amount ?? activeJob?.amount ?? null;
    const amount = amountRaw != null && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null;
    const lat = raw.location?.lat ?? raw.location_lat ?? raw.locationLat ?? incomingJob?.location?.lat ?? null;
    const lng = raw.location?.lng ?? raw.location_lng ?? raw.locationLng ?? incomingJob?.location?.lng ?? null;
    const address = raw.location?.address ?? raw.address ?? incomingJob?.location?.address ?? activeJob?.address ?? "";

    return {
      ...raw,
      id: String(raw.id ?? raw.requestId ?? incomingJob?.id ?? activeJob?.id ?? ""),
      status: normalizeTechnicianStatus(raw.status ?? raw.current_status ?? raw.job_status),
      service_type: raw.service_type ?? raw.serviceType ?? incomingJob?.serviceType ?? activeJob?.service_type,
      vehicle_type: raw.vehicle_type ?? raw.vehicleType ?? incomingJob?.vehicleType ?? activeJob?.vehicle_type,
      contact_name: raw.contact_name ?? raw.customerName ?? incomingJob?.customerName ?? activeJob?.contact_name,
      amount,
      distance: raw.distance ?? incomingJob?.distance ?? activeJob?.distance ?? null,
      eta: raw.eta ?? incomingJob?.eta ?? activeJob?.eta ?? null,
      location: { lat, lng, address },
      location_lat: lat,
      location_lng: lng,
      address,
    };
  };

  useEffect(() => {
    // Initialize audio ref once
    audioRef.current = new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;

    return () => {
      if (audioRef.current) {
        stopAlertSound();
        audioRef.current = null;
      }
      if (confirmationAudioContextRef.current) {
        confirmationAudioContextRef.current.close().catch(() => { });
        confirmationAudioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    activeJobIdRef.current = activeJob?.id ? String(activeJob.id) : null;
    activeJobStatusRef.current = activeJob?.status ? normalizeTechnicianStatus(activeJob.status) : "";
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    acceptedJobIdRef.current = acceptedJobId || null;
  }, [acceptedJobId]);

  useEffect(() => {
    incomingJobRef.current = incomingJob;
  }, [incomingJob]);

  useEffect(() => {
    const status = normalizeTechnicianStatus(activeJob?.status);
    const activeJobId = String(activeJob?.id || "").trim();
    if (activeJobId && status !== "completed" && status !== "cancelled" && status !== "rejected") {
      setAcceptedJobId(activeJobId);
      return;
    }
    if (!activeJobId || ["completed", "cancelled", "rejected"].includes(status)) {
      clearAcceptedJobId();
    }
  }, [activeJob?.id, activeJob?.status, setAcceptedJobId, clearAcceptedJobId]);

  useEffect(() => {
    if (activeJob) {
      startLocationTracking();
      return;
    }
    if (!isOnline) {
      stopLocationTracking();
    }
  }, [activeJob, isOnline]);

  // Initialize Socket and Status
  useEffect(() => {
    if (!technician) return;

    // Fetch initial status, active job and stats
    const fetchData = async () => {
      try {
        const [meRes, statsRes, historyRes, earningsRes, reviewsRes, notificationsRes, financialsRes] = await Promise.all([
          apiFetch("/api/technicians/me", { technician: true }),
          apiFetch("/api/technicians/dashboard-stats", { technician: true }),
          apiFetch("/api/technicians/requests", { technician: true }),
          apiFetch("/api/technicians/earnings-history", { technician: true }),
          apiFetch("/api/technicians/me/reviews", { technician: true }),
          apiFetch("/api/technicians/me/notifications", { technician: true }),
          apiFetch("/api/technicians/me/financials", { technician: true })
        ]);

        let meData = null;
        if (meRes.ok) {
          meData = await meRes.json();
          setIsOnline(!!meData.is_active);
          if (meData.latitude && meData.longitude) {
            setCurrentLocation({ lat: meData.latitude, lng: meData.longitude });
          }
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            jobs: statsData.completedJobs || 0,
            earnings: statsData.totalEarnings || 0,
            today: statsData.todayEarnings || 0
          });
        }

        if (historyRes.ok) {
          const data = await historyRes.json();
          setJobHistory(Array.isArray(data) ? data : []);
        }

        if (earningsRes.ok) {
          const data = await earningsRes.json();
          setEarningsHistory(Array.isArray(data) ? data : []);
        }

        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setReviews(Array.isArray(data) ? data : []);
        }

        if (notificationsRes.ok) {
          const data = await notificationsRes.json();
          setNotifications(Array.isArray(data) ? data : []);
        }

        if (financialsRes && financialsRes.ok) {
          const data = await financialsRes.json();
          setFinancials(data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };

    fetchData();
    const refreshInterval = setInterval(fetchData, 15000);
    return () => clearInterval(refreshInterval);
  }, [technician]); // Close fetch effect

  // Socket Effect
  useEffect(() => { // Start socket effect
    if (!technician?.id || FRONTEND_ONLY_MODE) return;
    const socketUrl = getRequiredApiBaseUrl();

    // Connect Socket
    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token: localStorage.getItem("resqnow_technician_token") || undefined }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      if (technician?.id) {
        // Correct event name to join room
        socket.emit("join_technician_room", technician.id);
      }
    });



    const handleAssignedJob = (jobData: any) => {
      console.log("Job assigned directly!", jobData);
      stopAlertSound();
      setIncomingJob(null); // Clear offer if any
      setIncomingJobUnavailable(false);
      const normalized = normalizeIncomingAssignedJob(jobData);
      setActiveJob(normalized);
      setShowJobModal(false);
    };

    socket.on("job:assigned", handleAssignedJob);
    socket.on("job_assigned", handleAssignedJob);



    // New: Listen for Broadcast Offers
    const handleJobOffer = async (offerData: any) => {
      console.log("New Job Offer Received!", offerData);
      const rawRequestId = offerData?.requestId ?? offerData?.id;
      const requestId = rawRequestId != null ? String(rawRequestId).trim() : "";
      if (!requestId || requestId === "undefined") {
        console.warn("Skipping malformed job_offer payload: missing requestId", offerData);
        return;
      }

      // Native Android uses system-level full-screen alerts from FCM.
      // Skipping in-app socket modal here avoids duplicate cards/alerts.
      if (isNativePlatform) {
        return;
      }

      if (acceptedJobIdRef.current && acceptedJobIdRef.current === requestId) {
        return;
      }

      const currentActiveStatus = activeJobStatusRef.current;
      const currentActiveJobId = activeJobIdRef.current;
      if (
        currentActiveJobId &&
        !["pending", "completed", "cancelled", "rejected"].includes(currentActiveStatus)
      ) {
        return;
      }

      try {
        const latestActiveJob = await refreshActiveJob();
        const latestStatus = normalizeTechnicianStatus(latestActiveJob?.status);
        if (
          latestActiveJob?.id &&
          !["pending", "completed", "cancelled", "rejected"].includes(latestStatus)
        ) {
          return;
        }
      } catch {
        // Ignore refresh failures and continue showing incoming offer.
      }

      // Map offer payload to JobRequest interface expected by Modal
      const offerLocation = offerData?.location || {};
      const jobRequest: JobRequest = {
        id: requestId,
        customerName: String(offerData?.customerName || "Customer"),
        serviceType: String(offerData?.serviceType || offerData?.service_type || "Service"),
        vehicleType: String(offerData?.vehicleType || offerData?.vehicle_type || "car"),
        location: {
          lat: Number(offerLocation?.lat ?? offerData?.location_lat ?? 0),
          lng: Number(offerLocation?.lng ?? offerData?.location_lng ?? 0),
          address: String(offerData?.address || offerLocation?.address || "Location not available")
        },
        distance: parseFloat(String(offerData?.distance ?? 0)) || 0,
        amount: offerData?.amount != null && !Number.isNaN(Number(offerData?.amount)) ? Number(offerData.amount) : 0
      };
      (jobRequest as any).eta = offerData.eta ?? null;
      setIncomingJob(jobRequest);
      setIncomingJobUnavailable(false);
      setShowJobModal(true);

      playAlertSound();
    };

    socket.on("job_offer", handleJobOffer);
    socket.on("JOB_ALERT", handleJobOffer);

    // New: Listen for Revocations (Job Taken)
    const handleRevoked = (data: any) => {
      console.log("Job Offer Revoked/Taken", data);
      const revokedRequestId = String(data?.requestId || data?.jobId || data?.id || "").trim();
      if (!revokedRequestId) return;
      const currentOffer = incomingJobRef.current;
      if (!currentOffer || String(currentOffer.id) !== revokedRequestId) return;
      stopAlertSound();
      setIncomingJobUnavailable(true);
      setShowJobModal(true);
      toast.warning(JOB_TAKEN_MESSAGE);
    };

    socket.on("job:revoked", handleRevoked);
    socket.on("JOB_TAKEN", handleRevoked);

    // ... (rest of listeners)

    // ...

    // handleAcceptJob moved to outer scope

    socket.on('dashboard:stats_update', (data: any) => {
      console.log('Received real-time stats update:', data);
      setStats(prev => ({
        ...prev,
        earnings: data.totalEarnings,
        jobs: data.completedJobs,
        today: data.todayEarnings
      }));

      // Also update financials optimistically
      setFinancials(prev => ({
        ...prev,
        total_earnings: data.totalEarnings
      }));

      if (data?.newJobAmount != null && !Number.isNaN(Number(data.newJobAmount))) {
        toast.success("New earnings recorded!", {
          description: `Rs ${parseFloat(data.newJobAmount).toFixed(2)} added to your wallet.`
        });
      }
    });

    socket.on('technician:financials_update', (data: any) => {
      if (!data) return;
      setFinancials((prev) => ({
        ...prev,
        total_earnings: Number(data.total_earnings ?? prev.total_earnings ?? 0),
        pending_dues: Number(data.pending_dues ?? prev.pending_dues ?? 0)
      }));
    });

    // Listen for new reviews
    socket.on('technician:new_review', (review: any) => {
      setReviews(prev => [review, ...prev]);
      toast("New Review Received!", {
        description: `${review.rating} Stars`
      });
    });

    // Listen for real-time job list updates
    socket.on('job:list_update', async (data: any) => {
      console.log('Real-time job list update received:', data);
      const requestId = String(data?.requestId || data?.id || "").trim();
      const action = String(data?.action || "").trim().toLowerCase();

      if (
        requestId &&
        activeJobIdRef.current &&
        requestId === activeJobIdRef.current &&
        ["updated", "revoked", "removed", "completed"].includes(action)
      ) {
        refreshActiveJob();
      }

      // Fetch updated job list
      try {
        const [jobListRes, notificationsRes] = await Promise.all([
          apiFetch("/api/technicians/requests", { technician: true }),
          apiFetch("/api/technicians/me/notifications", { technician: true }),
        ]);

        if (jobListRes.ok) {
          const updatedJobs = await jobListRes.json();
          if (Array.isArray(updatedJobs)) {
            setJobHistory(prev => {
              const prevSig = JSON.stringify((prev || []).map((j: any) => `${j.id}:${j.status}:${j.updated_at || j.created_at}`));
              const nextSig = JSON.stringify((updatedJobs || []).map((j: any) => `${j.id}:${j.status}:${j.updated_at || j.created_at}`));
              if (prevSig !== nextSig) {
                const prevIds = new Set((prev || []).map((j: any) => String(j.id)));
                const newJobs = updatedJobs.filter((j: any) => !prevIds.has(String(j.id)));
                if (newJobs.length > 0) {
                  toast.info(`${newJobs.length} new request(s) available!`);
                }
                return updatedJobs;
              }
              return prev;
            });
          }
        }

        if (notificationsRes.ok) {
          const notificationRows = await notificationsRes.json();
          setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
        }
      } catch (err) {
        console.warn('Failed to fetch updated job list:', err);
      }
    });

    socket.on('job:status_update', async (data: any) => {
      const requestId = String(data?.requestId || data?.id || "");
      if (!requestId) return;
      const normalizedStatus = normalizeTechnicianStatus(data?.status);

      if (activeJobIdRef.current && requestId === activeJobIdRef.current && data?.status) {
        setActiveJob((prev: any) => prev ? { ...prev, status: normalizedStatus } : prev);
      }

      if (
        incomingJobRef.current &&
        String(incomingJobRef.current.id || "").trim() === requestId &&
        normalizedStatus !== "pending"
      ) {
        stopAlertSound();
        setIncomingJob(null);
        setIncomingJobUnavailable(false);
        setShowJobModal(false);
      }

      if (['paid', 'completed', 'cancelled', 'rejected'].includes(normalizedStatus)) {
        if (acceptedJobIdRef.current && acceptedJobIdRef.current === requestId) {
          clearAcceptedJobId();
        }
      }

      if (['payment_pending', 'paid', 'completed', 'cancelled', 'rejected'].includes(normalizedStatus)) {
        try {
          const [activeJobRes, statsRes, historyRes, financialsRes, notificationsRes] = await Promise.all([
            apiFetch("/api/technicians/me/active-job", { technician: true }),
            apiFetch("/api/technicians/dashboard-stats", { technician: true }),
            apiFetch("/api/technicians/requests", { technician: true }),
            apiFetch("/api/technicians/me/financials", { technician: true }),
            apiFetch("/api/technicians/me/notifications", { technician: true }),
          ]);

          if (activeJobRes.ok) {
            const latestActiveJob = await activeJobRes.json();
            setActiveJob(latestActiveJob || null);
            refreshActiveJob();
          }
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats({
              jobs: statsData.completedJobs || 0,
              earnings: statsData.totalEarnings || 0,
              today: statsData.todayEarnings || 0,
            });
          }
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setJobHistory(Array.isArray(historyData) ? historyData : []);
          }
          if (financialsRes.ok) {
            const finData = await financialsRes.json();
            setFinancials(finData);
          }
          if (notificationsRes.ok) {
            const notificationsData = await notificationsRes.json();
            setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
          }
        } catch (err) {
          console.warn("Failed to sync dashboard after status update:", err);
        }
      }
    });

    // Polling fallback: Check for new jobs every 10 seconds if socket is not reliable
    const pollInterval = setInterval(async () => {
      if (isOnlineRef.current || !!activeJobIdRef.current) {
        try {
          const jobListRes = await apiFetch("/api/technicians/requests", { technician: true });
          if (jobListRes.ok) {
            const updatedJobs = await jobListRes.json();
            if (Array.isArray(updatedJobs)) {
              setJobHistory(prev => {
                const prevSig = JSON.stringify((prev || []).map((j: any) => `${j.id}:${j.status}:${j.updated_at || j.created_at}`));
                const nextSig = JSON.stringify((updatedJobs || []).map((j: any) => `${j.id}:${j.status}:${j.updated_at || j.created_at}`));
                if (prevSig !== nextSig) {
                  return updatedJobs;
                }
                return prev;
              });
            }
          }
        } catch (err) {
          console.warn('Polling failed:', err);
        }
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      socket.off("job:assigned", handleAssignedJob);
      socket.off("job_assigned", handleAssignedJob);
      socket.off("job_offer", handleJobOffer);
      socket.off("JOB_ALERT", handleJobOffer);
      socket.off("job:revoked", handleRevoked);
      socket.off("JOB_TAKEN", handleRevoked);
      socket.off("job:status_update");
      socket.off("job:list_update");
      socket.off("dashboard:stats_update");
      socket.off("technician:financials_update");
      socket.off("technician:new_review");
      stopAlertSound();
      socket.disconnect();
      stopLocationTracking();
      clearInterval(pollInterval);
    };
  }, [technician?.id, refreshActiveJob, clearAcceptedJobId]); // Close socket effect



  const toggleAvailability = async (checked: boolean) => {
    try {
      const res = await fetch(apiUrl("/api/technicians/me/status"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("resqnow_technician_token")}`
        },
        body: JSON.stringify({ active: checked })
      });

      if (res.ok) {
        setIsOnline(checked);
        if (checked) {
          socketRef.current?.emit("technician:online", technician?.id);
          toast.success("You are now Online");
          // Start tracking location
          startLocationTracking();
        } else {
          socketRef.current?.emit("technician:offline", technician?.id);
          toast.success("You are now Offline");
          stopLocationTracking();
        }
      } else {
        toast.error("Failed to update status");
      }
    } catch (e) {
      toast.error("Error updating status");
    }
  };

  const updateJobStatus = async (
    status: string,
    jobId: string,
    options?: { useAcceptEndpoint?: boolean }
  ) => {
    try {
      const normalizedJobId = String(jobId || "").trim();
      if (!normalizedJobId || normalizedJobId === "undefined") {
        throw new Error("Invalid job id");
      }

      const useAcceptEndpoint =
        status === "accepted" && options?.useAcceptEndpoint !== false;
      const endpoint = useAcceptEndpoint
        ? apiUrl("/api/jobs/accept")
        : apiUrl(`/api/service-requests/${normalizedJobId}/technician-status`);

      const method = useAcceptEndpoint ? 'POST' : 'PATCH';
      const body = useAcceptEndpoint ? { jobId: normalizedJobId } : { status };

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("resqnow_technician_token")}`
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (!res.ok) {
        let errData: any = {};
        try {
          errData = await res.json();
        } catch {
          errData = {};
        }
        const error = new Error(errData.error || errData.message || "Failed");
        (error as any).status = res.status;
        (error as any).code = errData.code || null;
        throw error;
      }
      const data = await res.json();
      return data;
    } catch (e: any) {
      const statusCode = Number(e?.status || 0);
      // 409 on accept is handled by the caller so we can keep modal state visible and disabled.
      if (!(statusCode === 409 && status === "accepted")) {
        toast.error(`Failed: ${e.message || "Unknown error"}`);
      }
      throw e;
    }
  };

  useEffect(() => {
    if (!technician?.id) return;

    const params = new URLSearchParams(location.search);
    const routeState = (location.state || {}) as {
      acceptedJobId?: string;
      jobId?: string;
      alertAction?: string;
    };

    const routeJobId = String(
      routeState.acceptedJobId || routeState.jobId || params.get("jobId") || ""
    ).trim();
    const routeAction = String(
      routeState.alertAction ||
      params.get("alertAction") ||
      params.get("alert_action") ||
      ""
    ).trim().toLowerCase();

    const normalizedJobId = routeJobId || String(acceptedJobId || "").trim();
    if (!normalizedJobId || normalizedJobId === "undefined") return;

    const handledKey = `${routeAction}:${normalizedJobId}`;
    if (handledRouteJobRef.current === handledKey) return;
    handledRouteJobRef.current = handledKey;

    const hydrateIncomingJobFromDeepLink = async () => {
      const offerRes = await apiFetch(
        `/api/service-requests/${encodeURIComponent(normalizedJobId)}/technician-offer`,
        { technician: true }
      );
      const offerData = await offerRes.json().catch(() => ({} as any));

      const offerRequest = offerData?.request || {};
      const location = offerRequest?.location || {};
      const lat = Number(location?.lat ?? offerRequest?.location_lat ?? 0);
      const lng = Number(location?.lng ?? offerRequest?.location_lng ?? 0);
      const parsedDistance = Number.parseFloat(
        String(offerRequest?.distance ?? offerRequest?.locationDistance ?? 0)
      );
      const parsedAmount = Number(offerRequest?.amount ?? 0);

      const fallbackJob: JobRequest = {
        id: normalizedJobId,
        customerName: String(offerRequest?.customerName || "Customer"),
        serviceType: String(offerRequest?.serviceType || offerRequest?.service_type || "Service"),
        vehicleType: String(offerRequest?.vehicleType || offerRequest?.vehicle_type || "car"),
        location: {
          lat: Number.isFinite(lat) ? lat : 0,
          lng: Number.isFinite(lng) ? lng : 0,
          address: String(location?.address || offerRequest?.address || "Location not available"),
        },
        distance: Number.isFinite(parsedDistance) ? parsedDistance : 0,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      };
      (fallbackJob as any).eta = offerRequest?.eta ?? null;

      if (!offerRes.ok || !offerData?.available) {
        const unavailableText = String(offerData?.message || JOB_TAKEN_MESSAGE);
        setIncomingJob(fallbackJob);
        setIncomingJobUnavailable(true);
        setShowJobModal(true);
        toast.warning(unavailableText);
        return;
      }

      setIncomingJob(fallbackJob);
      setIncomingJobUnavailable(false);
      setShowJobModal(true);
      playAlertSound();
    };

    const syncRouteState = async () => {
      const currentJobId = String(activeJob?.id || "").trim();
      const currentStatus = normalizeTechnicianStatus(activeJob?.status);
      const isSameJob = currentJobId === normalizedJobId;
      const isAlreadyAccepted =
        isSameJob &&
        ["accepted", "en-route", "arrived", "in-progress", "payment_pending", "paid", "completed"].includes(currentStatus);

      if (routeAction === "accept" && !isAlreadyAccepted) {
        try {
          stopAlertSound();
          await updateJobStatus("accepted", normalizedJobId, { useAcceptEndpoint: true });
          playAcceptConfirmationSound();
          toast.success("Job Accepted!");
        } catch (error: any) {
          const statusCode = Number(error?.status || 0);
          if (statusCode === 409) {
            setIncomingJobUnavailable(true);
            setShowJobModal(true);
            toast.error(JOB_TAKEN_MESSAGE);
            return;
          }
          throw error;
        }
      }

      if (routeAction === "reject") {
        let canReject = false;
        try {
          const offerRes = await apiFetch(
            `/api/service-requests/${encodeURIComponent(normalizedJobId)}/technician-offer`,
            { technician: true }
          );
          const offerBody = await offerRes.json().catch(() => ({} as any));
          const offerStatus = String(offerBody?.request?.offer_status || "").trim().toLowerCase();
          canReject = offerRes.ok && offerBody?.available === true && offerStatus === "pending";
        } catch {
          canReject = false;
        }

        try {
          stopAlertSound();
          if (canReject) {
            await updateJobStatus("rejected", normalizedJobId);
            toast.info("Job Rejected");
          } else {
            toast.info("Job offer is already closed.");
          }
        } catch (error: any) {
          const statusCode = Number(error?.status || 0);
          if (statusCode !== 404 && statusCode !== 409) {
            throw error;
          }
        }
        setIncomingJob(null);
        setIncomingJobUnavailable(false);
        setShowJobModal(false);
      }

      if (routeAction === "accept" || isAlreadyAccepted) {
        setAcceptedJobId(normalizedJobId);
      }

      if (!routeAction && !isAlreadyAccepted) {
        await hydrateIncomingJobFromDeepLink();
      }

      const refreshedActiveJob = await refreshActiveJob();

      if (routeAction === "accept") {
        setIncomingJob(null);
        setIncomingJobUnavailable(false);
        setShowJobModal(false);
        navigate("/technician/active-job", {
          replace: true,
          state: {
            jobId: normalizedJobId,
            job:
              refreshedActiveJob &&
              String(refreshedActiveJob?.id || "").trim() === normalizedJobId
                ? refreshedActiveJob
                : { id: normalizedJobId, status: "accepted" },
            alertAction: "accept",
            alertSource: "system",
          },
        });
        return;
      }

      if (location.search || location.state) {
        navigate("/technician/dashboard", { replace: true });
      }
    };

    syncRouteState().catch((error) => {
      console.error("Failed to sync dashboard route job state", error);
      toast.error("Unable to restore accepted job automatically.");
    });
  }, [
    technician?.id,
    location.search,
    location.state,
    acceptedJobId,
    activeJob?.id,
    activeJob?.status,
    navigate,
    refreshActiveJob,
    setAcceptedJobId,
    updateJobStatus,
  ]);

  const handleAcceptJob = async (jobId: string) => {
    if (isJobActionLoading) return;
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId || normalizedJobId === "undefined") {
      toast.error("Invalid job request id");
      return;
    }

    try {
      setIsJobActionLoading(true);
      stopAlertSound();
      await updateJobStatus("accepted", normalizedJobId, { useAcceptEndpoint: true });
      playAcceptConfirmationSound();
      toast.success("Job Accepted!");
      setIncomingJob(null);
      setIncomingJobUnavailable(false);
      setShowJobModal(false);
      setAcceptedJobId(normalizedJobId);

      // Fix: Update activeJob state reliably even if incomingJob is null
      setActiveJob((prev: any) => {
        if (prev && String(prev.id) === normalizedJobId) {
          return { ...prev, status: 'accepted' };
        }
        if (!incomingJob) return prev;
        return {
          id: incomingJob.id,
          status: 'accepted',
          service_type: incomingJob.serviceType,
          vehicle_type: incomingJob.vehicleType,
          contact_name: incomingJob.customerName,
          amount: incomingJob.amount != null && !Number.isNaN(Number(incomingJob.amount)) ? Number(incomingJob.amount) : null,
          distance: incomingJob.distance ?? null,
          location: incomingJob.location,
          address: incomingJob.location?.address || "",
        };
      });

      const refreshedActiveJob = await refreshActiveJob();
      startLocationTracking();
      navigate("/technician/active-job", {
        state: {
          jobId: normalizedJobId,
          job:
            refreshedActiveJob &&
            String(refreshedActiveJob?.id || "").trim() === normalizedJobId
              ? refreshedActiveJob
              : { id: normalizedJobId, status: "accepted" },
          alertAction: "accept",
          alertSource: "system",
        },
      });
    } catch (e: any) {
      const statusCode = Number(e?.status || 0);
      if (statusCode === 409) {
        setIncomingJobUnavailable(true);
        setShowJobModal(true);
        toast.error(JOB_TAKEN_MESSAGE);
        return;
      }
      console.error(e);
    } finally {
      setIsJobActionLoading(false);
    }
  };

  const handleRejectJob = async (jobId: string) => {
    if (isJobActionLoading) return;
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId || normalizedJobId === "undefined") {
      toast.error("Invalid job request id");
      return;
    }

    if (
      incomingJobUnavailable &&
      incomingJob &&
      String(incomingJob.id) === normalizedJobId
    ) {
      stopAlertSound();
      setIncomingJob(null);
      setIncomingJobUnavailable(false);
      setShowJobModal(false);
      return;
    }

    const currentActiveJobId = String(activeJob?.id || "").trim();
    const currentActiveStatus = normalizeTechnicianStatus(activeJob?.status);
    if (
      currentActiveJobId &&
      currentActiveJobId === normalizedJobId &&
      !["pending", "assigned"].includes(currentActiveStatus)
    ) {
      stopAlertSound();
      setIncomingJob(null);
      setIncomingJobUnavailable(false);
      setShowJobModal(false);
      toast.info("This job can no longer be rejected.");
      return;
    }

    try {
      setIsJobActionLoading(true);
      stopAlertSound();
      await updateJobStatus("rejected", normalizedJobId);
      setIncomingJob(null);
      setIncomingJobUnavailable(false);
      setShowJobModal(false);
      if (acceptedJobId && acceptedJobId === normalizedJobId) {
        clearAcceptedJobId();
      }
      toast.info("Job Rejected");
    } catch (e) {
      console.error(e);
    } finally {
      setIsJobActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!activeJob) return;
    try {
      const data = await updateJobStatus(newStatus, activeJob.id);
      const resolvedStatus = normalizeTechnicianStatus(data?.status ?? newStatus);
      if (resolvedStatus === 'completed' || resolvedStatus === 'paid') {
        const earned = Number(data?.request?.amount ?? activeJob?.amount ?? 0);
        setLastEarned(Number.isNaN(earned) ? 0 : earned);
        setShowCompletionModal(true);
        toast.success("Job Completed! Great work.");
        clearAcceptedJobId();
        setActiveJob(null);
        setStats(prev => ({ ...prev, jobs: prev.jobs + 1 }));
        stopLocationTracking();
        if (isOnline) startLocationTracking();
      } else {
        setActiveJob(prev => (prev ? { ...prev, status: resolvedStatus } : prev));
        toast.success(`Status updated to: ${resolvedStatus}`);
      }
    } catch (e) { }
  };


  // Location Tracking Simulation

  const handlePayDues = async () => {
    try {
      const orderRes = await apiFetch("/api/technicians/me/pay-dues/order", {
        method: "POST",
        technician: true
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        if (orderRes.status === 400 && err.error === "No pending dues") {
          toast.success("All dues are already cleared!");
          setFinancials(prev => ({ ...prev, pending_dues: 0 }));
          return;
        }
        throw new Error(err.error || "Failed to create order");
      }

      const orderData = await orderRes.json();

      if (!(window as any).Razorpay) {
        toast.error("Payment gateway not loaded", { description: "Please check your internet connection." });
        return;
      }

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) {
        toast.error("Payment Configuration Error", { description: "Razorpay Key ID is missing." });
        console.error("VITE_RAZORPAY_KEY_ID is missing");
        return;
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ResQNow Platform Fee",
        description: "Settlement of pending dues",
        order_id: orderData.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch("/api/technicians/me/pay-dues/verify", {
              method: "POST",
              cache: "no-store",
              technician: true,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json().catch(() => null);
              toast.success("Dues paid successfully!");
              if (verifyData?.financials) {
                setFinancials(verifyData.financials);
              } else {
                const financialsRes = await apiFetch("/api/technicians/me/financials", { technician: true });
                if (financialsRes.ok) {
                  const freshFinancials = await financialsRes.json();
                  setFinancials(freshFinancials);
                } else {
                  setFinancials(prev => ({ ...prev, pending_dues: 0 }));
                }
              }
            } else {
              const errData = await verifyRes.json().catch(() => ({}));
              toast.error("Verification failed", { description: errData.error || "Please contact support." });
            }
          } catch (e) {
            console.error(e);
            toast.error("Payment verification error");
          }
        },
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => {
            toast.info("Payment Cancelled");
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error("Payment Failed", { description: response.error.description });
      });
      rzp.open();

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Payment initialization failed");
    }
  };

  const startLocationTracking = () => {
    if (navigator.geolocation && !trackingInterval.current) {
      trackingInterval.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ lat: latitude, lng: longitude });
            socketRef.current?.emit("technician:location_update", {
              technicianId: technician?.id,
              lat: latitude,
              lng: longitude
            });
            apiFetch('/api/technicians/me/location', {
              method: 'PATCH',
              technician: true,
              body: JSON.stringify({ latitude, longitude })
            }).catch(console.error);
          },
          (err) => console.error(err),
          { enableHighAccuracy: true }
        );
      }, 5000); // Every 5s
    }
  };

  const stopLocationTracking = () => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
  };

  // Compute best available amount for a job using job fields and technician pricing
  const computeJobAmount = (job: any, tech: any) => {
    if (!job) return null;
    // Prefer explicit amount fields
    const a = job.amount ?? job.service_charge ?? job.serviceCharge;
    if (a && Number(a) > 0) return Number(a);

    // Try technician pricing structures
    // Try technician pricing structures
    const pricing = (tech?.pricing ?? tech?.pricing_config) || tech?.pricing || null; // Simplified logic, assuming redundancies were unintentional
    const serviceCosts = (tech?.service_costs ?? tech?.service_costs) || tech?.serviceCosts || null;

    const svcKey = (job.service_type || job.serviceType || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    let computed = null;

    try {
      if (pricing && typeof pricing === 'object') {
        const flat = pricing[job.service_type] ?? pricing[svcKey];
        if (typeof flat === 'number') computed = flat;
        else if (flat && typeof flat === 'object' && job.vehicle_type) {
          const vehicleKey = job.vehicle_type.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
          const nested = flat[job.vehicle_type] ?? flat[vehicleKey] ?? flat[vehicleKey + '_vehicle'];
          if (nested && (nested.baseCharge || nested.base_charge || nested.price || nested.amount)) {
            computed = nested.baseCharge ?? nested.base_charge ?? nested.price ?? nested.amount;
          } else if (typeof flat.baseCharge === 'number') {
            computed = flat.baseCharge;
          }
        }
      }

      if (computed == null && serviceCosts) {
        if (Array.isArray(serviceCosts)) {
          for (const sc of serviceCosts) {
            const key = (sc.service_key || sc.service || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            if (key && (key === svcKey || key.includes(svcKey))) {
              if (job.vehicle_type && sc.vehicle_prices) {
                const vp = sc.vehicle_prices[job.vehicle_type] ?? sc.vehicle_prices[job.vehicle_type?.toLowerCase?.().replace(/\s+/g, '_')];
                if (vp && (vp.baseCharge || vp.price || vp.amount)) {
                  computed = vp.baseCharge ?? vp.price ?? vp.amount;
                  break;
                }
              }
              if (sc.price || sc.baseCharge || sc.amount) {
                computed = sc.price ?? sc.baseCharge ?? sc.amount;
                break;
              }
            }
          }
        } else if (typeof serviceCosts === 'object') {
          const scEntry = serviceCosts[job.service_type] ?? serviceCosts[svcKey];
          if (scEntry) {
            if (job.vehicle_type && scEntry[job.vehicle_type]) {
              computed = scEntry[job.vehicle_type].baseCharge ?? scEntry[job.vehicle_type].price ?? scEntry[job.vehicle_type].amount;
            } else {
              computed = scEntry.price ?? scEntry.baseCharge ?? scEntry.amount;
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to compute job amount', e);
    }

    return computed != null ? Number(computed) : null;
  };

  const openNavigation = () => {
    // Safely read coordinates — activeJob or its location may be null.
    const lat = activeJob?.location?.lat ?? activeJob?.location_lat ?? null;
    const lng = activeJob?.location?.lng ?? activeJob?.location_lng ?? null;
    const address = activeJob?.location?.address || activeJob?.address || "";

    if ((lat !== null && lng !== null) && (Number(lat) !== 0 || Number(lng) !== 0)) {
      // Use precise coordinates if available
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      // Fallback to address string
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    } else {
      toast.error('No location details available for navigation.');
    }
  };

  // Calculate Distance and ETA
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const jobLat = Number(activeJob?.location?.lat ?? activeJob?.location_lat);
  const jobLng = Number(activeJob?.location?.lng ?? activeJob?.location_lng);

  const jobDistance = currentLocation && Number.isFinite(jobLat) && Number.isFinite(jobLng) && (jobLat !== 0 || jobLng !== 0)
    ? calculateDistance(currentLocation.lat, currentLocation.lng, jobLat, jobLng)
    : (activeJob?.distance != null ? Number(activeJob.distance) : null);

  // Assume avg speed 30km/h for city driving
  // Assume avg speed 30km/h for city driving
  const etaMinutes = jobDistance !== null ? Math.ceil((jobDistance / 30) * 60) : null;
  const activeAmountDisplay = activeJob && (activeJob.amount ?? activeJob.service_charge ?? activeJob.serviceCharge) != null
    ? (Number.isNaN(Number(activeJob.amount ?? activeJob.service_charge ?? activeJob.serviceCharge))
      ? null
      : Number(activeJob.amount ?? activeJob.service_charge ?? activeJob.serviceCharge))
    : null;
  const activeJobDialablePhone = String(
    activeJob?.contact_phone ?? activeJob?.phoneNumber ?? activeJob?.user?.phone ?? ""
  )
    .trim()
    .replace(/[^\d+]/g, "");

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!technician) return <Navigate to="/technician/login" replace />;
  if (technician?.verification_status !== "verified") {
    return <Navigate to="/technician/verification" replace />;
  }

  const handleCancelJob = async () => {
    if (!activeJob) return;
    if (!confirm("Are you sure you want to cancel this job? This logic will be recorded.")) return;
    try {
      await updateJobStatus("cancelled", activeJob.id);
      toast.info("Job Cancelled");
      clearAcceptedJobId();
      setActiveJob(null);
      stopLocationTracking();
      if (isOnline) startLocationTracking();
    } catch (e) {
      console.error(e);
    }
  };

  // Derived state for "Busy"
  const isBusy = activeJob && activeJob.status !== 'completed' && activeJob.status !== 'cancelled' && activeJob.status !== 'rejected';

  // Enhanced Toggle Handler
  const handleToggleAvailability = (checked: boolean) => {
    if (isBusy && !checked) {
      toast.error("Cannot go offline while on an active job.", {
        description: "Please complete your current job first."
      });
      return;
    }
    toggleAvailability(checked);
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-24 md:pb-8 selection:bg-primary/20 relative">
      <div className="container max-w-md mx-auto px-4 pt-6 pb-24 space-y-5">

        {/* 1. MAP SECTION (NOW AT THE TOP) */}
        {!activeJob && (
          <div className="bg-card dark:bg-slate-900 rounded-[2rem] shadow-sm border border-border overflow-hidden relative">
            {/* Map Placeholder when no active job */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-[400]">
              <div className="bg-card dark:bg-slate-900/90 backdrop-blur pb-1 pt-1.5 px-4 rounded-2xl shadow-sm border border-border">
                <h3 className="font-black text-foreground text-sm tracking-tight uppercase">Live Map</h3>
              </div>
              {isOnline ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50/90 backdrop-blur rounded-full border border-green-100 shadow-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card dark:bg-slate-900/90 backdrop-blur rounded-full border border-border shadow-sm">
                  <span className="w-2 h-2 bg-slate-300 rounded-full" />
                  <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">Paused</span>
                </div>
              )}
            </div>
            <div className="h-[300px] w-full relative">
              <TechnicianJobMap
                techLocation={currentLocation}
                jobLocation={null}
              />
              {!isOnline && (
                <div className="absolute inset-0 bg-card dark:bg-slate-900/60 backdrop-blur-[2px] z-[400] flex items-center justify-center">
                  <div className="bg-card dark:bg-slate-900 shadow-xl px-6 py-3 rounded-full border border-border font-bold text-sm text-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400" /> Map Paused
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!activeJob && (
          <div className="flex justify-center">
            <div className="w-[220px] bg-card dark:bg-slate-900 border border-border rounded-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Status</span>
                <span className={`text-sm font-black ${isOnline ? "text-green-700" : "text-slate-500"}`}>
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <Switch
                checked={isOnline}
                onCheckedChange={handleToggleAvailability}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>
        )}

        {/* 2. QUICK MENU GRID SECTION */}
        {!activeJob && (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/technician/earnings" className="bg-card dark:bg-slate-900 p-4 rounded-[1.5rem] border border-border shadow-sm flex flex-col justify-between active:scale-95 transition-transform group">
              <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-3 group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-0.5">Today</p>
                <p className="text-xl font-black text-foreground leading-none">₹{stats.today}</p>
              </div>
            </Link>

            <Link to="/technician/history" className="bg-card dark:bg-slate-900 p-4 rounded-[1.5rem] border border-border shadow-sm flex flex-col justify-between active:scale-95 transition-transform group">
              <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-0.5">Total Jobs</p>
                <p className="text-xl font-black text-foreground leading-none">{stats.jobs}</p>
              </div>
            </Link>

            <Link to="/technician/reviews" className="bg-card dark:bg-slate-900 p-4 rounded-[1.5rem] border border-border shadow-sm flex flex-col justify-between active:scale-95 transition-transform group">
              <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-3 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 fill-amber-500" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-0.5">Rating</p>
                <p className="text-xl font-black text-foreground leading-none">
                  {Array.isArray(reviews) && reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : "5.0"}
                </p>
              </div>
            </Link>

            {financials.pending_dues > 0 ? (
              <div onClick={handlePayDues} className="bg-red-50 p-4 rounded-[1.5rem] border border-red-100 shadow-sm flex flex-col justify-between active:scale-95 transition-transform cursor-pointer group">
                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-red-400 text-[10px] uppercase font-bold tracking-widest mb-0.5">Pending Dues</p>
                  <p className="text-xl font-black text-red-700 leading-none">₹{financials.pending_dues}</p>
                  <span className="text-[9px] font-bold text-red-600 mt-1 block">Pay Now</span>
                </div>
              </div>
            ) : (
              <div className="bg-card dark:bg-slate-900 p-4 rounded-[1.5rem] border border-border shadow-sm flex flex-col justify-between opacity-70">
                <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center text-slate-400 mb-3">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-0.5">Dues</p>
                  <p className="text-xl font-black text-slate-300 leading-none">₹0</p>
                  <span className="text-[9px] font-bold text-green-500 mt-1 block">All clear</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. BUSINESS ANALYTICS GRAPH (NEW POSITION) */}
        {!activeJob && Array.isArray(earningsHistory) && earningsHistory.length > 0 && (
          <div className="mb-4">
            <TechnicianEarningsChart data={earningsHistory} />
          </div>
        )}

        {/* ACTIVE JOB HERO CARD */}
        {activeJob ? (
          <div className="bg-card dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-border relative mb-4">

            {/* Live Map Header */}
            <div className="h-[220px] w-full relative bg-muted/50">
              <TechnicianJobMap
                techLocation={currentLocation}
                jobLocation={activeJob?.location && activeJob.location.lat != null && activeJob.location.lng != null ? { lat: Number(activeJob.location.lat), lng: Number(activeJob.location.lng) } : null}
                showRoute={true}
              />

              {/* Floating Status Badge */}
              <div className="absolute top-4 left-4 z-[400]">
                <div className="bg-card dark:bg-slate-900/95 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-border flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-black tracking-widest text-foreground uppercase">
                    {formatTechnicianStatus(activeJob.status)}
                  </span>
                </div>
              </div>

              <div className="absolute top-4 right-4 z-[400] bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg flex flex-col items-center">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Pmt</span>
                <span className="text-sm font-black text-white leading-none tracking-tight">
                  ₹{activeAmountDisplay != null ? activeAmountDisplay.toFixed(0) : "---"}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-foreground mb-1 leading-tight tracking-tight">
                  {activeJob.service_type?.replace(/-/g, " ")}
                </h2>
                <div className="flex items-start gap-2 text-muted-foreground/80 mt-2">
                  <div className="mt-0.5 bg-muted/50 p-1 rounded-full text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm font-medium leading-snug line-clamp-2">
                    {activeJob.address}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-muted rounded-2xl p-3 border border-border flex items-center gap-3">
                  <div className="w-10 h-10 bg-card dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                    <Navigation className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Dist</p>
                    <p className="text-sm font-black text-foreground leading-none">{jobDistance !== null ? jobDistance.toFixed(1) : "--"} <span className="text-[10px] text-muted-foreground/80 font-semibold">km</span></p>
                  </div>
                </div>
                <div className="bg-muted rounded-2xl p-3 border border-border flex items-center gap-3">
                  <div className="w-10 h-10 bg-card dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xs font-black text-indigo-600">ETA</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Time</p>
                    <p className="text-sm font-black text-foreground leading-none">{etaMinutes !== null ? etaMinutes : "--"} <span className="text-[10px] text-muted-foreground/80 font-semibold">min</span></p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6 border-t border-border pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center text-muted-foreground/80 border border-border">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Client</p>
                    <p className="font-bold text-foreground text-sm truncate">{activeJob.contact_name || "Guest"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center text-muted-foreground/80 border border-border">
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Vehicle</p>
                    <p className="font-bold text-foreground text-sm truncate">{activeJob.vehicle_model || activeJob.vehicle_type}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons with Bottom Sheet flow feel */}
              <div className="space-y-3">
                {activeJob.status !== 'pending' && activeJob.status !== 'paid' && (
                  <div className="flex gap-2">
                    {activeJobDialablePhone && (
                      <Button variant="outline" className="flex-1 h-12 rounded-xl bg-card dark:bg-slate-900 border-border text-muted-foreground shadow-sm active:scale-95" asChild>
                        <a href={`tel:${activeJobDialablePhone}`}><PhoneCall className="w-4 h-4 mr-2" /> <span className="font-bold">Call</span></a>
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1 h-12 rounded-xl bg-card dark:bg-slate-900 border-border text-muted-foreground shadow-sm active:scale-95" onClick={openNavigation}>
                      <Navigation className="w-4 h-4 mr-2" /> <span className="font-bold">Nav</span>
                    </Button>
                  </div>
                )}

                {activeJob.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      disabled={isJobActionLoading}
                      onClick={() => handleRejectJob(activeJob.id)}
                      variant="outline"
                      className="h-14 px-4 rounded-2xl border-red-200 text-red-600 bg-red-50 hover:bg-red-100 active:scale-95"
                    >
                      X
                    </Button>
                    <Button
                      disabled={isJobActionLoading}
                      onClick={() => handleAcceptJob(activeJob.id)}
                      className="flex-1 h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/20 active:scale-95 text-lg font-black tracking-wide"
                    >
                      {isJobActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ACCEPT JOB"}
                    </Button>
                  </div>
                )}

                {(activeJob.status === 'accepted' || activeJob.status === 'assigned') && (
                  <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 active:scale-95 text-lg font-black tracking-wide" onClick={() => handleStatusChange('en-route')}>
                    START JOURNEY
                  </Button>
                )}

                {activeJob.status === 'en-route' && (
                  <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 active:scale-95 text-lg font-black tracking-wide" onClick={() => handleStatusChange('in-progress')}>
                    ARRIVED
                  </Button>
                )}

                {activeJob.status === 'in-progress' && (
                  <Button className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/20 active:scale-95 text-lg font-black tracking-wide" onClick={() => handleStatusChange('completed')}>
                    COMPLETE WORK
                  </Button>
                )}

                {activeJob.status === 'payment_pending' && (
                  <div className="w-full h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                    <span className="font-bold text-orange-700">Waiting for payment...</span>
                  </div>
                )}

                {activeJob.status === 'paid' && (
                  <Button className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-95 text-lg font-black tracking-wide flex items-center justify-center gap-2" onClick={() => handleStatusChange('completed')}>
                    <DollarSign className="w-5 h-5" /> FINISH JOB
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <TechnicianJobModal
          isOpen={showJobModal && !!incomingJob}
          job={incomingJob}
          isProcessing={isJobActionLoading}
          isUnavailable={incomingJobUnavailable}
          unavailableMessage={JOB_TAKEN_MESSAGE}
          onAccept={handleAcceptJob}
          onReject={handleRejectJob}
          onDismissUnavailable={(jobId) => {
            if (!incomingJob || String(incomingJob.id) !== String(jobId)) return;
            setIncomingJob(null);
            setIncomingJobUnavailable(false);
            setShowJobModal(false);
          }}
        />
      </div>

      <TechnicianBottomNav />
      {/* Completion Modal */}
      {showCompletionModal && (
        <TechnicianJobCompletion
          amount={lastEarned}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </div>
  );
};

export default TechnicianDashboard;
