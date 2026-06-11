import { apiFetch, readJsonSafely } from "@/lib/api";

export type VerificationState = "pending" | "verified" | "rejected";

export type AdminTechnicianProfile = {
  technicianId: number;
  businessInfo: Record<string, any>;
  verification: {
    approvalStatus: VerificationState;
    aadhaar: { number: string; status: VerificationState };
    pan: { number: string; status: VerificationState };
    drivingLicense: { number: string; status: VerificationState };
    gst: { number: string; status: VerificationState };
    businessRegistration: { number: string; status: VerificationState };
  };
  services: string[];
  fleet: {
    selectedTypes: string[];
    vehicleCategories: Record<string, boolean>;
    vehicles: Array<{
      id: number;
      vehicleType: string;
      vehicleNumber: string;
      capacity: string | null;
      status: string;
      metadata: Record<string, any>;
    }>;
  };
  pricing: {
    rows: Array<Record<string, any>>;
    rawPricing: Record<string, any>;
    rawServiceCosts: any;
  };
  documents: Record<string, any>;
  statistics: {
    totalJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    rating: number;
    reviewCount: number;
    revenueEarned: number;
  };
  paymentDetails: Record<string, any>;
  appReadiness: Record<string, any>;
  availability: Record<string, any>;
  registration: Record<string, any>;
};

export type AdminRequestDetails = {
  request: {
    id: number;
    createdTime: string;
    updatedTime: string;
    status: string;
    priority: string;
    serviceType: string;
    description: string;
    paymentStatus: string;
    cancellationReason: string | null;
  };
  customer: Record<string, any>;
  vehicle: Record<string, any>;
  location: {
    pickupAddress: string;
    destinationAddress: string | null;
    pickup: { lat: number | null; lng: number | null };
    destination: { lat: number | null; lng: number | null };
    distanceKm: number | null;
    estimatedDurationMinutes: number | null;
    routeMetadata: Record<string, any>;
  };
  fare: {
    currency: string;
    customerFare: number;
    technicianEarnings: number;
    platformMargin: number;
    surgeMultiplier: number;
    tax: number;
    total: number;
    paymentDetails: Record<string, any>;
    breakdown: Record<string, any>;
  };
  technician: AdminTechnicianProfile | null;
  timeline: Array<{
    id: string | number;
    eventType: string;
    title: string;
    status: string | null;
    description: string | null;
    actorType: string | null;
    actorId: string | null;
    metadata: Record<string, any>;
    createdAt: string;
  }>;
  attachments: Array<{
    id: number;
    fileName: string | null;
    url: string;
    mimeType: string | null;
    type: string;
    createdAt: string | null;
  }>;
};

export type AssignmentCandidate = {
  technicianId: number;
  name: string;
  phone: string;
  profileImage: string;
  shopName: string;
  location: string;
  distanceKm: number | null;
  rating: number;
  jobsCompleted: number;
  availability: string;
  status: string;
  approvalStatus: VerificationState;
  services: string[];
  fleet: Array<{
    vehicleType: string;
    vehicleNumber: string;
    capacity: string | null;
    status: string;
  }>;
  matchesService: boolean;
};

async function adminGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { method: "GET", admin: true });
  const body = await readJsonSafely<any>(response);
  if (!response.ok) throw new Error(body?.error || body?.message || "Request failed.");
  return body as T;
}

export const getAdminTechnicianProfile = (technicianId: string | number) =>
  adminGet<AdminTechnicianProfile>(`/api/admin/technicians/${technicianId}`);

export const getAdminRequestDetails = (requestId: string | number) =>
  adminGet<AdminRequestDetails>(`/api/admin/requests/${requestId}`);

export const getAdminRequestAssignmentCandidates = (
  requestId: string | number,
  search = ""
) => {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", "100");
  return adminGet<{ requestId: number; serviceType: string; data: AssignmentCandidate[] }>(
    `/api/admin/requests/${requestId}/candidates?${params.toString()}`
  );
};
