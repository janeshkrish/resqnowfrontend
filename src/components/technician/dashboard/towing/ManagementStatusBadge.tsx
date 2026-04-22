import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ManagementStatusBadgeProps = {
  status: string;
  kind?: "vehicle" | "employee";
};

const VEHICLE_STATUS_STYLES: Record<string, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  busy: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-slate-200 bg-slate-100 text-slate-600",
};

const EMPLOYEE_STATUS_STYLES: Record<string, string> = {
  active: "border-sky-200 bg-sky-50 text-sky-700",
  offline: "border-slate-200 bg-slate-100 text-slate-600",
};

const formatStatusLabel = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function ManagementStatusBadge({
  status,
  kind = "vehicle",
}: ManagementStatusBadgeProps) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const palette = kind === "employee" ? EMPLOYEE_STATUS_STYLES : VEHICLE_STATUS_STYLES;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
        palette[normalizedStatus] || "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {formatStatusLabel(normalizedStatus || "unknown")}
    </Badge>
  );
}
