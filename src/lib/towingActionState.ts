import {
  Car,
  CheckCircle,
  CreditCard,
  MapPin,
  Navigation,
  type LucideIcon,
} from "lucide-react";

export interface TowingAction {
  status: string;
  label: string;
  icon: LucideIcon;
}

const isPaidPaymentStatus = (value: unknown) =>
  ["paid", "completed"].includes(String(value || "").trim().toLowerCase());

export function getTowingAction(
  status: string,
  paymentStatus: unknown
): TowingAction | null {
  if (status === "assigned" || status === "accepted") {
    return { status: "en_route_pickup", label: "START PICKUP", icon: Navigation };
  }
  if (status === "en_route_pickup") {
    return { status: "arrived_pickup", label: "REACHED PICKUP", icon: MapPin };
  }
  if (status === "arrived_pickup") {
    return { status: "vehicle_loaded", label: "VEHICLE LOADED", icon: Car };
  }
  if (status === "vehicle_loaded") {
    return { status: "enroute_drop", label: "START TOW", icon: Navigation };
  }
  if (status === "enroute_drop") {
    return { status: "arrived_drop", label: "REACHED DROP LOCATION", icon: MapPin };
  }
  if (status === "arrived_drop") {
    return { status: "service_completed", label: "COMPLETE SERVICE", icon: CheckCircle };
  }
  if (status === "service_completed") {
    return { status: "payment_pending", label: "COLLECT PAYMENT", icon: CreditCard };
  }
  if (status === "payment_pending" && isPaidPaymentStatus(paymentStatus)) {
    return { status: "closed", label: "CLOSE JOB", icon: CheckCircle };
  }
  return null;
}
