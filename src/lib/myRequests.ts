// The signed-in customer's own requests (GET /api/service-requests), and what state each one is in.
import { apiFetch } from "@/lib/api";

export type MyRequest = {
  id?: string | number;
  _id?: string;
  service_type?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  address?: string | null;
  status?: string | null;
  serviceStatus?: string | null;
  payment_status?: string | null;
  paymentStatus?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  has_review?: boolean;
  technician?: { id?: string | number; name?: string | null; phone?: string | null; rating?: number | null } | null;
};

export const MY_REQUESTS_KEY = ["my-requests"] as const;

export async function fetchMyRequests(signal?: AbortSignal): Promise<MyRequest[]> {
  const response = await apiFetch("/api/service-requests", { signal });
  if (!response.ok) throw new Error(`Requests failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export const requestId = (request: MyRequest) => String(request.id ?? request._id ?? "");

export const requestStatus = (request: MyRequest) =>
  String(request.serviceStatus || request.status || "pending").trim().toLowerCase();

export const isCancelled = (request: MyRequest) => ["cancelled", "canceled", "rejected"].includes(requestStatus(request));

export const isPaid = (request: MyRequest) => {
  const payment = String(request.payment_status || request.paymentStatus || "").trim().toLowerCase();
  return payment === "completed" || payment === "paid" || requestStatus(request) === "paid";
};

/** The work is finished (paid or not). */
export const isWorkDone = (request: MyRequest) => ["completed", "paid"].includes(requestStatus(request));

/** Over and done with: cancelled, or finished and paid. Everything else is still in progress. */
export const isPast = (request: MyRequest) => isCancelled(request) || (isWorkDone(request) && isPaid(request));

export const requestTime = (request: MyRequest) => {
  const time = Date.parse(String(request.created_at ?? request.createdAt ?? ""));
  return Number.isFinite(time) ? time : 0;
};

export const newestFirst = (requests: MyRequest[]) => [...requests].sort((a, b) => requestTime(b) - requestTime(a));

// Three letters for every month, whatever the phone’s language settings would write ("Sep", never "Sept").
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Oct", with the year once it is not this year: "1 Oct 2025". */
export function requestDay(request: MyRequest, now = new Date()): string {
  const time = requestTime(request);
  if (!time) return "";
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`}`;
}

/** "9:33 pm". */
export function requestClock(request: MyRequest): string {
  const time = requestTime(request);
  return time ? new Date(time).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase() : "";
}
