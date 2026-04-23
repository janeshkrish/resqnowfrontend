import React, { useEffect, useState, useRef } from "react";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { Button } from "@/components/ui/button";
import { TechnicianJobModal, JobRequest } from "@/components/technician/TechnicianJobModal";
import { toast } from "sonner";
import { Loader2, MapPin, DollarSign, Navigation, PhoneCall, User, Car, Briefcase, CreditCard, Star } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import TechnicianJobCompletion from "@/components/technician/TechnicianJobCompletion";
import io, { Socket } from "socket.io-client";
import TechnicianJobMap from "@/components/technician/TechnicianJobMap";
import TechnicianEarningsChart from "@/components/technician/TechnicianEarningsChart";
import CancelledJobCard, { CancelledJobDetails } from "@/components/technician/CancelledJobCard";
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE, getRequiredApiBaseUrl, readJsonSafely } from "@/lib/api";
import TechnicianBottomNav from "@/components/technician/TechnicianBottomNav"; // Import Bottom Nav
import TechnicianDashboardOverview from "@/components/technician/dashboard/TechnicianDashboardOverview";
import { useTechnicianActiveJob } from "@/hooks/useTechnicianActiveJob";
import { useTechnicianTowingManagement } from "@/hooks/useTechnicianTowingManagement";
import {
  formatTechnicianStatus,
  isTechnicianCompletionStatus,
  normalizeTechnicianStatus,
} from "@/utils/technicianStatus";
import {
  buildEarningsBreakdown,
  buildOrderOverviewCounts,
  buildOrderPerformanceSummary,
  calculateRewardPoints,
  countEnabledVehicleTypes,
} from "@/utils/technicianDashboard";
import { isTowingTechnician as isTowingTechnicianRole } from "@/utils/technicianRole";
import { useTechnicianJob } from "@/contexts/TechnicianJobContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import FleetManagementModule from "@/components/technician/dashboard/towing/FleetManagementModule";
import TeamManagementModule from "@/components/technician/dashboard/towing/TeamManagementModule";
import type { FleetVehicle, FleetVehicleInput, TeamEmployee, TeamEmployeeInput } from "@/types/towingManagement";

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
  const [cancelledJob, setCancelledJob] = useState<CancelledJobDetails | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [financials, setFinancials] = useState({ total_earnings: 0, pending_dues: 0 });
  const [walletSummary, setWalletSummary] = useState<any | null>(null);
  const [dashboardTechnician, setDashboardTechnician] = useState<any | null>(null);
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<TeamEmployee | null>(null);
  const isNativePlatform = Capacitor.isNativePlatform();
  const technicianSnapshot = dashboardTechnician || technician;
  const isTowingOperator = isTowingTechnicianRole(technicianSnapshot);
  const towingManagement = useTechnicianTowingManagement(isTowingOperator);
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
  const activeJobAmountRef = useRef<number>(0);
  const activeJobSnapshotRef = useRef<any | null>(null);
  const acceptedJobIdRef = useRef<string | null>(acceptedJobId);
  const incomingJobRef = useRef<JobRequest | null>(incomingJob);
  const handledRouteJobRef = useRef<string | null>(null);
  const locationPermissionRef = useRef<"granted" | "denied" | null>(null);
  const isMountedRef = useRef(true);
  const celebratedCompletionJobRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (isNativePlatform) return;
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
      cancelled_at: raw.cancelled_at ?? raw.cancelledAt ?? activeJob?.cancelled_at ?? null,
      location: { lat, lng, address },
      location_lat: lat,
      location_lng: lng,
      address,
    };
  };

  const isCancelledStatus = (status: unknown) => {
    const raw = String(status || "").trim().toLowerCase();
    return raw === "cancelled_by_user" || normalizeTechnicianStatus(raw) === "cancelled";
  };

  const buildCancelledJobDetails = (source: any, payload?: any): CancelledJobDetails | null => {
    const requestId = String(payload?.requestId ?? payload?.id ?? source?.requestId ?? source?.id ?? "").trim();
    if (!requestId) return null;

    const contactName = String(
      payload?.contact_name ??
        payload?.customerName ??
        payload?.customer_name ??
        payload?.user?.name ??
        source?.contact_name ??
        source?.customerName ??
        source?.customer_name ??
        source?.user?.name ??
        ""
    ).trim();
    const address = String(
      payload?.location?.address ??
        payload?.address ??
        source?.location?.address ??
        source?.address ??
        ""
    ).trim();
    const serviceType = String(
      payload?.service_type ??
        payload?.serviceType ??
        source?.service_type ??
        source?.serviceType ??
        ""
    ).trim();
    const cancellationReason = String(
      payload?.cancellation_reason ??
        payload?.reason ??
        source?.cancellation_reason ??
        source?.reason ??
        ""
    ).trim();
    const cancelledAt = String(
      payload?.cancelled_at ??
        payload?.cancelledAt ??
        payload?.updated_at ??
        source?.cancelled_at ??
        source?.cancelledAt ??
        source?.updated_at ??
        ""
    ).trim();

    return {
      id: requestId,
      contactName: contactName || null,
      address: address || null,
      serviceType: serviceType || null,
      cancellationReason: cancellationReason || null,
      cancelledAt: cancelledAt || null,
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
    activeJobAmountRef.current = Number(activeJob?.amount || 0);
    if (activeJob) {
      activeJobSnapshotRef.current = activeJob;
    }
  }, [activeJob?.id, activeJob?.status, activeJob?.amount]);

  useEffect(() => {
    if (activeJob?.id && !isCancelledStatus(activeJob?.status)) {
      setCancelledJob(null);
    }
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    const nextIsCancelled = Boolean(cancelledJob) || isCancelledStatus(activeJob?.status);
    setIsCancelled(nextIsCancelled);
  }, [activeJob?.status, cancelledJob]);

  useEffect(() => {
    acceptedJobIdRef.current = acceptedJobId || null;
  }, [acceptedJobId]);

  useEffect(() => {
    incomingJobRef.current = incomingJob;
  }, [incomingJob]);

  const triggerCompletionCelebration = (jobId: string, amount: number, message = "Job Completed! Great work.") => {
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId || celebratedCompletionJobRef.current === normalizedJobId) {
      return;
    }

    celebratedCompletionJobRef.current = normalizedJobId;
    const earned = Number(amount);
    setLastEarned(Number.isFinite(earned) && earned > 0 ? earned : 0);
    setShowCompletionModal(true);
    toast.success(message);
  };

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
        const [meRes, statsRes, historyRes, earningsRes, reviewsRes, notificationsRes, financialsRes, walletRes] = await Promise.all([
          apiFetch("/api/technicians/me", { technician: true }),
          apiFetch("/api/technicians/dashboard-stats", { technician: true }),
          apiFetch("/api/technicians/requests", { technician: true }),
          apiFetch("/api/technicians/earnings-history", { technician: true }),
          apiFetch("/api/technicians/me/reviews", { technician: true }),
          apiFetch("/api/technicians/me/notifications", { technician: true }),
          apiFetch("/api/technicians/me/financials", { technician: true }),
          apiFetch("/api/technicians/me/wallet", { technician: true })
        ]);

        let meData = null;
        if (meRes.ok) {
          meData = await meRes.json();
          setDashboardTechnician(meData);
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

        if (walletRes && walletRes.ok) {
          const data = await walletRes.json();
          setWalletSummary(data);
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
      setCancelledJob(null);
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
      setCancelledJob(null);
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
      setWalletSummary((prev: any) =>
        prev
          ? {
              ...prev,
              total_earnings: Number(data.totalEarnings ?? prev.total_earnings ?? 0),
            }
          : prev
      );

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
      void apiFetch("/api/technicians/me/wallet", { technician: true })
        .then((response) => (response.ok ? response.json() : null))
        .then((wallet) => {
          if (wallet) {
            setWalletSummary(wallet);
          }
        })
        .catch(() => {
          // Ignore transient wallet refresh failures.
        });
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
      const matchesTrackedJob =
        (activeJobIdRef.current && requestId === activeJobIdRef.current) ||
        (acceptedJobIdRef.current && acceptedJobIdRef.current === requestId);

      if (matchesTrackedJob && isTechnicianCompletionStatus(normalizedStatus)) {
        const earnedAmount = Number(data?.amount ?? activeJobAmountRef.current ?? 0);
        triggerCompletionCelebration(requestId, earnedAmount, "Customer payment received. Job completed.");
        stopLocationTracking();
        if (isOnlineRef.current) {
          startLocationTracking();
        }
      }

      if (matchesTrackedJob && isCancelledStatus(data?.status)) {
        const cancelledDetails = buildCancelledJobDetails(activeJobSnapshotRef.current, data);
        if (cancelledDetails) {
          setCancelledJob(cancelledDetails);
        }
        stopLocationTracking();
        if (isOnlineRef.current) {
          startLocationTracking();
        }
      }

      if (activeJobIdRef.current && requestId === activeJobIdRef.current && data?.status) {
        setActiveJob((prev: any) =>
          prev
            ? {
                ...prev,
                status: normalizedStatus,
                cancellation_reason:
                  data?.cancellation_reason ?? data?.reason ?? prev.cancellation_reason ?? null,
              }
            : prev
        );
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
          const [activeJobRes, statsRes, historyRes, financialsRes, notificationsRes, walletRes] = await Promise.all([
            apiFetch("/api/technicians/me/active-job", { technician: true }),
            apiFetch("/api/technicians/dashboard-stats", { technician: true }),
            apiFetch("/api/technicians/requests", { technician: true }),
            apiFetch("/api/technicians/me/financials", { technician: true }),
            apiFetch("/api/technicians/me/notifications", { technician: true }),
            apiFetch("/api/technicians/me/wallet", { technician: true }),
          ]);

          if (activeJobRes.ok) {
            const latestActiveJob = await readJsonSafely<any>(activeJobRes);
            setActiveJob(
              latestActiveJob ? normalizeIncomingAssignedJob({ request: latestActiveJob }) : null
            );
          } else {
            setActiveJob(null);
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
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            setWalletSummary(walletData);
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

  useEffect(() => {
    const trackedJobId = String(activeJob?.id || acceptedJobId || "").trim();
    if (!trackedJobId || cancelledJob || activeJob) return;
    const historyMatch = Array.isArray(jobHistory)
      ? jobHistory.find((job: any) => String(job?.id || job?.requestId || "").trim() === trackedJobId)
      : null;
    if (!historyMatch || !isCancelledStatus(historyMatch?.status)) return;
    const cancelledDetails = buildCancelledJobDetails(activeJobSnapshotRef.current ?? historyMatch, historyMatch);
    if (cancelledDetails) {
      setCancelledJob(cancelledDetails);
    }
  }, [jobHistory, activeJob, acceptedJobId, cancelledJob]);



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
        ? "/api/jobs/accept"
        : `/api/service-requests/${encodeURIComponent(normalizedJobId)}/technician-status`;

      const method = useAcceptEndpoint ? 'POST' : 'PATCH';
      const body = useAcceptEndpoint ? { jobId: normalizedJobId } : { status };

      const res = await apiFetch(endpoint, {
        method,
        technician: true,
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await readJsonSafely<any>(res);
      if (!res.ok) {
        const error = new Error(data?.error || data?.message || "Failed");
        (error as any).status = res.status;
        (error as any).code = data?.code || null;
        throw error;
      }
      return (
        data || {
          success: true,
          request: {
            id: normalizedJobId,
            status,
          },
          job: {
            id: normalizedJobId,
            status,
          },
        }
      );
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
    let cancelled = false;

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
      const offerData = (await readJsonSafely<any>(offerRes)) || {};
      if (cancelled || !isMountedRef.current) return;

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
      const shouldStop = () => cancelled || !isMountedRef.current;
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
          if (shouldStop()) return;
          playAcceptConfirmationSound();
          toast.success("Job Accepted!");
        } catch (error: any) {
          if (shouldStop()) return;
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
          const offerBody = (await readJsonSafely<any>(offerRes)) || {};
          const offerStatus = String(offerBody?.request?.offer_status || "").trim().toLowerCase();
          canReject = offerRes.ok && offerBody?.available === true && offerStatus === "pending";
        } catch {
          canReject = false;
        }
        if (shouldStop()) return;

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
        if (shouldStop()) return;
        setIncomingJob(null);
        setIncomingJobUnavailable(false);
        setShowJobModal(false);
      }

      if (routeAction === "accept" || isAlreadyAccepted) {
        if (shouldStop()) return;
        setAcceptedJobId(normalizedJobId);
      }

      if (!routeAction && !isAlreadyAccepted) {
        await hydrateIncomingJobFromDeepLink();
        if (shouldStop()) return;
      }

      const refreshedActiveJob = await refreshActiveJob();
      if (shouldStop()) return;

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
      if (cancelled || !isMountedRef.current) return;
      console.error("Failed to sync dashboard route job state", error);
      toast.error("Unable to restore accepted job automatically.");
    });
    return () => {
      cancelled = true;
    };
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
      if (!isMountedRef.current) return;
      playAcceptConfirmationSound();
      toast.success("Job Accepted!");
      const sourceIncomingJob = incomingJobRef.current;
      setIncomingJob(null);
      setIncomingJobUnavailable(false);
      setShowJobModal(false);
      setAcceptedJobId(normalizedJobId);
      setCancelledJob(null);

      // Fix: Update activeJob state reliably even if incomingJob is null
      setActiveJob((prev: any) => {
        if (prev && String(prev.id) === normalizedJobId) {
          return { ...prev, status: 'accepted' };
        }
        if (!sourceIncomingJob) return prev;
        return {
          id: sourceIncomingJob.id,
          status: 'accepted',
          service_type: sourceIncomingJob.serviceType,
          vehicle_type: sourceIncomingJob.vehicleType,
          contact_name: sourceIncomingJob.customerName,
          amount: sourceIncomingJob.amount != null && !Number.isNaN(Number(sourceIncomingJob.amount)) ? Number(sourceIncomingJob.amount) : null,
          distance: sourceIncomingJob.distance ?? null,
          location: sourceIncomingJob.location,
          address: sourceIncomingJob.location?.address || "",
        };
      });

      const refreshedActiveJob = await refreshActiveJob();
      if (!isMountedRef.current) return;
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
        if (!isMountedRef.current) return;
        setIncomingJobUnavailable(true);
        setShowJobModal(true);
        toast.error(JOB_TAKEN_MESSAGE);
        return;
      }
      console.error(e);
    } finally {
      if (isMountedRef.current) {
        setIsJobActionLoading(false);
      }
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
      if (isTechnicianCompletionStatus(resolvedStatus)) {
        const earned = Number(data?.request?.amount ?? activeJob?.amount ?? 0);
        triggerCompletionCelebration(String(activeJob.id || ""), earned);
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
    if (trackingInterval.current) return;

    const applyLocationUpdate = (latitude: number, longitude: number) => {
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
    };

    const ensureNativePermission = async () => {
      if (!isNativePlatform) return true;
      if (locationPermissionRef.current === "granted") return true;
      try {
        const current = await Geolocation.checkPermissions();
        const status = String(
          (current as any).location || (current as any).coarseLocation || (current as any).fineLocation || ""
        ).toLowerCase();
        if (status === "granted") {
          locationPermissionRef.current = "granted";
          return true;
        }
        const requested = await Geolocation.requestPermissions();
        const nextStatus = String(
          (requested as any).location || (requested as any).coarseLocation || (requested as any).fineLocation || ""
        ).toLowerCase();
        locationPermissionRef.current = nextStatus === "granted" ? "granted" : "denied";
        return locationPermissionRef.current === "granted";
      } catch (error) {
        console.warn("Location permission check failed", error);
        locationPermissionRef.current = "denied";
        return false;
      }
    };

    const fetchNativeLocation = async () => {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        const { latitude, longitude } = position.coords;
        applyLocationUpdate(latitude, longitude);
      } catch (err) {
        console.warn("Native geolocation error", err);
      }
    };

    const fetchWebLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          applyLocationUpdate(latitude, longitude);
        },
        (err) => console.warn("Web geolocation error", err),
        { enableHighAccuracy: true }
      );
    };

    const start = async () => {
      if (isNativePlatform) {
        const granted = await ensureNativePermission();
        if (!granted) {
          toast.error("Location permission is required to accept jobs.");
          return;
        }
      }

      trackingInterval.current = setInterval(() => {
        if (isNativePlatform) {
          void fetchNativeLocation();
        } else {
          fetchWebLocation();
        }
      }, 5000);

      if (isNativePlatform) {
        void fetchNativeLocation();
      } else {
        fetchWebLocation();
      }
    };

    void start();
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
  const activeJobStatus = normalizeTechnicianStatus(activeJob?.status);
  const visibleCancelledJob =
    activeJob && isCancelledStatus(activeJob?.status)
      ? buildCancelledJobDetails(activeJob, activeJob)
      : cancelledJob;
  const showCancelledJobCard = Boolean(isCancelled && visibleCancelledJob);
  const showActiveJobCard = Boolean(activeJob) && !showCancelledJobCard;
  const showIdleDashboard = !showActiveJobCard && !showCancelledJobCard;

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
  const isBusy = Boolean(showActiveJobCard && !["completed", "cancelled", "rejected"].includes(activeJobStatus));

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

  const scrollToSection = (sectionId: string) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFleetDialogOpenChange = (open: boolean) => {
    setFleetDialogOpen(open);
    if (!open) {
      setSelectedVehicle(null);
    }
  };

  const handleEmployeeDialogOpenChange = (open: boolean) => {
    setEmployeeDialogOpen(open);
    if (!open) {
      setSelectedEmployee(null);
    }
  };

  const openCreateVehicleDialog = () => {
    setSelectedVehicle(null);
    setFleetDialogOpen(true);
  };

  const openCreateEmployeeDialog = () => {
    setSelectedEmployee(null);
    setEmployeeDialogOpen(true);
  };

  const handleCreateVehicle = async (payload: FleetVehicleInput) => {
    try {
      await towingManagement.createVehicle(payload);
      toast.success("Vehicle added to fleet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add vehicle.");
      throw error;
    }
  };

  const handleUpdateVehicle = async (id: string, payload: FleetVehicleInput) => {
    try {
      await towingManagement.updateVehicle(id, payload);
      toast.success("Fleet vehicle updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update vehicle.");
      throw error;
    }
  };

  const handleDeleteVehicle = async (vehicle: FleetVehicle) => {
    if (!window.confirm(`Delete ${vehicle.vehicle_number} from your fleet?`)) return;

    try {
      await towingManagement.deleteVehicle(vehicle.id);
      toast.success("Vehicle removed from fleet.");
      if (selectedVehicle?.id === vehicle.id) {
        handleFleetDialogOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete vehicle.");
    }
  };

  const handleCreateEmployee = async (payload: TeamEmployeeInput) => {
    try {
      await towingManagement.createEmployee(payload);
      toast.success("Employee added to team.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add employee.");
      throw error;
    }
  };

  const handleUpdateEmployee = async (id: string, payload: TeamEmployeeInput) => {
    try {
      await towingManagement.updateEmployee(id, payload);
      toast.success("Team member updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update employee.");
      throw error;
    }
  };

  const handleDeleteEmployee = async (employee: TeamEmployee) => {
    if (!window.confirm(`Delete ${employee.name} from your team?`)) return;

    try {
      await towingManagement.deleteEmployee(employee.id);
      toast.success("Employee removed from team.");
      if (selectedEmployee?.id === employee.id) {
        handleEmployeeDialogOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete employee.");
    }
  };

  const totalEarningsValue = Number(walletSummary?.total_earnings ?? financials.total_earnings ?? stats.earnings ?? 0);
  const orderOverview = buildOrderOverviewCounts(jobHistory);
  const orderPerformance = buildOrderPerformanceSummary(jobHistory);
  const earningsBreakdown = buildEarningsBreakdown(walletSummary);
  const pointsBalance = calculateRewardPoints({
    totalEarnings: totalEarningsValue,
    completedJobs: Number(stats.jobs || 0),
  });
  const unreadNotifications = notifications.filter((notification: any) => !notification?.is_read).length;
  const defaultFleetCount = countEnabledVehicleTypes(technicianSnapshot?.vehicle_types);
  const defaultTeamCount = Number(
    (technicianSnapshot as any)?.service_providers_count ??
    (technicianSnapshot as any)?.team_members_count ??
    (technicianSnapshot as any)?.sub_providers_count ??
    (technicianSnapshot?.id ? 1 : 0)
  );
  const fleetCount = isTowingOperator ? towingManagement.vehicles.length : defaultFleetCount;
  const teamCount = isTowingOperator ? towingManagement.employees.length : defaultTeamCount;
  const technicianDisplayName = String(
    (technicianSnapshot as any)?.proprietor_name || technicianSnapshot?.name || "Technician"
  ).trim() || "Technician";
  const technicianIdentifier = String(
    (technicianSnapshot as any)?.technician_id || (technicianSnapshot as any)?.sp_id || technicianSnapshot?.id || ""
  );
  const profilePhotoPath = String((technicianSnapshot as any)?.documents?.profile_photo || "").trim();
  const profileImageUrl = profilePhotoPath
    ? (/^https?:\/\//i.test(profilePhotoPath) ? profilePhotoPath : apiUrl(profilePhotoPath))
    : null;

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-24 md:pb-8 selection:bg-primary/20 relative">
      <div className="mx-auto max-w-7xl space-y-5 px-4 pb-24 pt-4 md:px-6 md:pt-6">
        {showIdleDashboard ? (
          <TechnicianDashboardOverview
            showTowingManagement={isTowingOperator}
            technicianName={technicianDisplayName}
            technicianId={technicianIdentifier}
            profileImageUrl={profileImageUrl}
            isOnline={isOnline}
            pointsBalance={pointsBalance}
            unreadNotifications={unreadNotifications}
            notifications={notifications}
            fleetCount={fleetCount}
            teamCount={teamCount}
            orderOverview={orderOverview}
            orderPerformance={orderPerformance}
            earnings={{
              total: totalEarningsValue,
              withdrawable: earningsBreakdown.withdrawable,
              pending: earningsBreakdown.pending,
              paid: earningsBreakdown.paid,
              disputed: earningsBreakdown.disputed,
            }}
            onToggleAvailability={handleToggleAvailability}
            onOpenNotifications={() => scrollToSection("dashboard-notifications")}
            onViewProfile={() => navigate("/technician/profile?tab=profile")}
            onOpenAppearanceSettings={() => navigate("/technician/profile?tab=appearance")}
            onOpenNotificationSettings={() => navigate("/technician/profile?tab=notifications")}
            onOpenSecuritySettings={() => navigate("/technician/profile?tab=security")}
            onManageFleet={() => scrollToSection("dashboard-fleet")}
            onAddVehicle={() => {
              scrollToSection("dashboard-fleet");
              openCreateVehicleDialog();
            }}
            onViewHistory={() => navigate("/technician/history")}
            onOpenFinancialReport={() => navigate("/technician/earnings")}
            onManageTeam={() => scrollToSection("dashboard-team")}
            onAddServiceProvider={() => {
              scrollToSection("dashboard-team");
              openCreateEmployeeDialog();
            }}
          />
        ) : null}

        {showIdleDashboard && isTowingOperator ? (
          <>
            <FleetManagementModule
              vehicles={towingManagement.vehicles}
              isLoading={towingManagement.isVehiclesLoading}
              isMutating={towingManagement.isMutating}
              error={towingManagement.vehicleError}
              dialogOpen={fleetDialogOpen}
              selectedVehicle={selectedVehicle}
              onDialogOpenChange={handleFleetDialogOpenChange}
              onOpenCreate={openCreateVehicleDialog}
              onEditVehicle={(vehicle) => {
                setSelectedVehicle(vehicle);
                setFleetDialogOpen(true);
              }}
              onDeleteVehicle={handleDeleteVehicle}
              onRefresh={towingManagement.refreshVehicles}
              onCreateVehicle={handleCreateVehicle}
              onUpdateVehicle={handleUpdateVehicle}
            />

            <TeamManagementModule
              employees={towingManagement.employees}
              vehicles={towingManagement.vehicles}
              isLoading={towingManagement.isEmployeesLoading}
              isMutating={towingManagement.isMutating}
              error={towingManagement.employeeError}
              dialogOpen={employeeDialogOpen}
              selectedEmployee={selectedEmployee}
              onDialogOpenChange={handleEmployeeDialogOpenChange}
              onOpenCreate={openCreateEmployeeDialog}
              onEditEmployee={(employee) => {
                setSelectedEmployee(employee);
                setEmployeeDialogOpen(true);
              }}
              onDeleteEmployee={handleDeleteEmployee}
              onRefresh={towingManagement.refreshEmployees}
              onCreateEmployee={handleCreateEmployee}
              onUpdateEmployee={handleUpdateEmployee}
            />
          </>
        ) : null}




        {/* 2. QUICK MENU GRID SECTION */}
        {false && showIdleDashboard && (
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
        {false && showIdleDashboard && Array.isArray(earningsHistory) && earningsHistory.length > 0 && (
          <div className="mb-4">
            <TechnicianEarningsChart data={earningsHistory} />
          </div>
        )}

        {/* ACTIVE JOB HERO CARD */}
        {showActiveJobCard ? (
          <div className="relative mx-auto mb-4 max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl shadow-slate-200/50 dark:bg-slate-900">

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
        ) : showCancelledJobCard && visibleCancelledJob ? (
          <CancelledJobCard
            job={visibleCancelledJob}
            className="mx-auto mb-4 max-w-3xl"
            onViewDetails={() => {
              setCancelledJob(null);
              navigate("/technician/history");
            }}
          />
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
