import { serviceArt, serviceName } from "@/lib/services";

import { ago as agoShort } from "@/pages/adminExtended/monitor/monitorFormat";

export { clock, dayAndTime, initials, minutesLabel, money, runningFor } from "@/pages/adminExtended/monitor/monitorFormat";

/** "12 s ago", "5 min ago", "20 h ago", then "3 days ago" past two days. */
export function ago(value: string | number | null | undefined, now = Date.now()) {
  if (value == null || value === "") return null;
  const t = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(t)) return null;
  const hours = (now - t) / 3_600_000;
  return hours >= 48 ? `${Math.floor(hours / 24)} days ago` : agoShort(t, now);
}

/** ₹1,23,456 — Indian grouping, no paise. */
export const rupees = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `₹${Math.round(value).toLocaleString("en-IN")}`;

/** ₹11.9 lakh for big totals. */
export function rupeesShort(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2).replace(/\.?0+$/, "")} crore`;
  if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(2).replace(/\.?0+$/, "")} lakh`;
  return rupees(value);
}

export const percent = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;

export const count = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("en-IN"));

/** "1 h 5 min", "42 min". */
export function duration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

/** 14 Oct, or "Today" / "Yesterday" for recent days, in India time. */
export function day(value: string | number | null | undefined, now = Date.now()) {
  if (value == null) return "—";
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return "—";
  const key = (t: number) => new Date(t + 330 * 60_000).toISOString().slice(0, 10);
  if (key(ms) === key(now)) return "Today";
  if (key(ms) === key(now - 86_400_000)) return "Yesterday";
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function dateLong(value: string | null | undefined) {
  if (!value) return "—";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
}

export const service = (type: string | null | undefined) => (type ? serviceName(type) : "—");
export const servicePicture = (type: string | null | undefined) => (type ? serviceArt(type) : null);

const VEHICLE_PICTURE: Record<string, string> = {
  bike: "/images/vehicles/bike.webp", scooter: "/images/vehicles/bike.webp", "two-wheeler": "/images/vehicles/bike.webp",
  car: "/images/vehicles/car.webp", suv: "/images/vehicles/car.webp",
  truck: "/images/vehicles/truck.webp", commercial: "/images/vehicles/truck.webp",
  ev: "/images/vehicles/ev.webp",
};
export function vehiclePicture(type: string | null | undefined) {
  const key = String(type || "").toLowerCase();
  const found = Object.keys(VEHICLE_PICTURE).find((name) => key.includes(name));
  return found ? VEHICLE_PICTURE[found] : "/images/vehicles/car.webp";
}
export const VEHICLE_LABEL: Record<string, string> = { bike: "Bike", car: "Car", commercial: "Truck", truck: "Truck", ev: "EV" };
export const vehicleLabel = (type: string | null | undefined) => VEHICLE_LABEL[String(type || "").toLowerCase()] || (type ? type[0].toUpperCase() + type.slice(1) : "—");

/** The plan names stored on a customer, as people say them. */
export const planName = (plan: string | null | undefined) => {
  if (!plan) return null;
  const key = plan.toLowerCase();
  if (key.includes("smart")) return "Smart Care";
  return plan.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const PAYMENT_METHOD: Record<string, string> = { cash: "Cash", razorpay: "Online", upi: "UPI", card: "Card", online: "Online" };
export const paymentMethod = (method: string | null | undefined) => (method ? PAYMENT_METHOD[method.toLowerCase()] || method : "—");

/** Plain words for the admin actions the backend records. */
export const ACTION_WORDS: Record<string, { label: string; icon: string }> = {
  manualAssignTechnician: { label: "Assigned a technician", icon: "assignment_ind" },
  forceAssign: { label: "Assigned directly", icon: "assignment_ind" },
  escalateRequest: { label: "Escalated a request", icon: "priority_high" },
  markHighPriority: { label: "Marked high priority", icon: "flag" },
  mark_high_priority: { label: "Marked high priority", icon: "flag" },
  manualCloseRequest: { label: "Closed a request", icon: "cancel" },
  overrideRequestPricing: { label: "Changed the fare", icon: "edit" },
  addInternalNote: { label: "Added a request note", icon: "edit_note" },
  reRouteSearchRadius: { label: "Widened the search", icon: "zoom_out_map" },
  toggleTechnicianVisibility: { label: "Showed or hid a technician", icon: "visibility_off" },
  sendTechnicianLoginReminder: { label: "Sent a log-in reminder", icon: "notifications" },
  adminNoteOnTechnician: { label: "Added a technician note", icon: "edit_note" },
  updateTechnicianProfile: { label: "Edited a technician", icon: "edit" },
  createComplaint: { label: "Logged a complaint", icon: "support_agent" },
  assignComplaint: { label: "Assigned a complaint", icon: "assignment_ind" },
  resolveComplaint: { label: "Resolved a complaint", icon: "task_alt" },
  addComplaintInternalNote: { label: "Added a complaint note", icon: "edit_note" },
  systemAnnouncement: { label: "Messaged everyone", icon: "campaign" },
  technicianBroadcast: { label: "Messaged technicians", icon: "campaign" },
  emergencyMessage: { label: "Sent an urgent message", icon: "campaign" },
  broadcastNotification: { label: "Sent a message", icon: "campaign" },
};
export const actionWords = (type: string) => ACTION_WORDS[type] || { label: type.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]/g, " "), icon: "history" };

/** Why dispatch could not offer a job to a technician, in plain words. */
export const DISPATCH_REASON: Record<string, string> = {
  not_approved: "Not approved yet", inactive: "Off duty", unavailable: "Not free", busy: "On another job", hidden_by_admin: "Hidden by an admin",
  missing_location: "No shop location", service_profile_missing: "No services set", service_mismatch: "Doesn't do this service",
  vehicle_profile_missing: "No vehicles set", vehicle_mismatch: "Doesn't do this vehicle", out_of_range: "Too far",
  invalid_job_location: "The request has no location", invalid_service_domain: "Unknown service", invalid_vehicle_type: "Unknown vehicle",
};
export const dispatchReason = (code: string) => DISPATCH_REASON[code] || code.replace(/_/g, " ");
