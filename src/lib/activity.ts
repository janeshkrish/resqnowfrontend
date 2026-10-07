// How the Activity page reads a request: which stage it is at, where tapping it goes, and what can be done with it.
import { firstName } from "@/lib/customerTracking";
import { requestId, type MyRequest } from "@/lib/myRequests";
import { serviceOf } from "@/lib/services";

export type ServiceState =
  | "pending" | "accepted" | "technician_assigned" | "on_the_way" | "arrived" | "in_progress" | "job_completed" | "cancelled";

/** The request's stage, whichever of its spellings the server sent. */
export function serviceState(request: MyRequest): string {
  const raw = String(request.serviceStatus || request.status || "").trim().toLowerCase();
  switch (raw) {
    case "assigned":
    case "technician_assigned":
      return "technician_assigned";
    case "accepted":
      return "accepted";
    case "on-the-way":
    case "on_the_way":
    case "en-route":
    case "en_route":
      return "on_the_way";
    case "arrived":
      return "arrived";
    case "in-progress":
    case "in_progress":
    case "service_started":
      return "in_progress";
    case "payment_pending":
    case "awaiting_payment":
    case "completed":
    case "job_completed":
    case "paid":
      return "job_completed";
    case "cancelled":
      return "cancelled";
    case "pending":
      return "pending";
    default:
      return raw || "pending";
  }
}

export function paymentState(request: MyRequest): string {
  const raw = String(request.paymentStatus || request.payment_status || "").trim().toLowerCase();
  if (raw === "completed" || raw === "paid") return "paid";
  if (raw === "pending" || raw === "payment_pending" || raw === "awaiting_payment") return "payment_pending";
  return raw || "payment_pending";
}

const isFinishedAndPaid = (request: MyRequest) => serviceState(request) === "job_completed" && paymentState(request) === "paid";

/** Over and done with: cancelled, or finished and paid. */
export const isEarlier = (request: MyRequest) => serviceState(request) === "cancelled" || isFinishedAndPaid(request);
export const isInProgress = (request: MyRequest) => !isEarlier(request);
export const wasCancelled = (request: MyRequest) => serviceState(request) === "cancelled";

/** Where tapping a request goes: live tracking, payment, or its summary. */
export function requestPath(request: MyRequest): string | null {
  const id = requestId(request).trim();
  if (!id) return null;
  const state = serviceState(request);
  if (state === "job_completed") return paymentState(request) === "paid" ? `/service-summary/${id}` : `/payment/${id}`;
  if (state === "cancelled") return `/service-summary/${id}`;
  return `/service-tracking/${id}`;
}

export type RequestStage = {
  /** What is happening, in a sentence. */
  say: string;
  /** Which of the four steps is the current one (0 to 3). */
  now: number;
  firstStep: "Finding" | "Found";
  action: "Track live" | "Pay now" | "View request";
};

/** The sentence, step and button for a request that is still in progress. */
export function stageOf(request: MyRequest): RequestStage {
  const name = firstName(request.technician?.name);
  switch (serviceState(request)) {
    case "pending":
      return { say: "Finding a technician", now: 0, firstStep: "Finding", action: "View request" };
    case "accepted":
    case "technician_assigned":
      return { say: `${name} accepted`, now: 0, firstStep: "Found", action: "Track live" };
    case "on_the_way":
      return { say: `${name} is on the way`, now: 1, firstStep: "Found", action: "Track live" };
    case "arrived":
      return { say: `${name} has arrived`, now: 2, firstStep: "Found", action: "Track live" };
    case "in_progress":
      return { say: "Work in progress", now: 2, firstStep: "Found", action: "Track live" };
    case "job_completed":
      return { say: "Work finished. Payment is due", now: 3, firstStep: "Found", action: "Pay now" };
    default:
      return { say: "In progress", now: 0, firstStep: "Found", action: "Track live" };
  }
}

/** A finished, paid request whose technician has not been rated yet. */
export const canRate = (request: MyRequest) => isFinishedAndPaid(request) && Boolean(request.technician?.id) && !request.has_review;

const FAMILIES: Record<string, string> = { car: "car", bike: "bike", commercial: "commercial", truck: "commercial", ev: "ev" };

/** The request form for the same service and kind of vehicle again; null when the service is not one of ours. */
export function askAgainPath(request: MyRequest): string | null {
  const service = serviceOf(request.service_type);
  if (!service) return null;
  const family = FAMILIES[String(request.vehicle_type ?? "").trim().toLowerCase()];
  return family ? `/request-service/${service.id}/${family}` : `/request-service/${service.id}`;
}

/** "Call" link for the technician's number; null when there is none. */
export function callHref(request: MyRequest): string | null {
  const digits = String(request.technician?.phone ?? "").replace(/[^\d+]/g, "");
  return digits.length >= 6 ? `tel:${digits}` : null;
}

/** "October 2026": the heading earlier requests are grouped under. */
export function monthOf(time: number): string {
  return time ? new Date(time).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Earlier";
}
