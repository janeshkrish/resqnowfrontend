import type { Technician } from "@/types/technician";

const TOWING_ALIASES = new Set([
  "towing",
  "tow",
  "towing-assistance",
  "towing-services",
]);

const normalizeRoleToken = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function getTechnicianOperationalRole(
  technician: (Technician & { service_type?: string | null }) | null | undefined
) {
  const candidates = [
    technician?.role,
    technician?.service_type,
    ...(Array.isArray(technician?.specialties) ? technician.specialties : []),
  ];
  let fallbackRole = "technician";

  for (const candidate of candidates) {
    const normalized = normalizeRoleToken(candidate);
    if (!normalized) continue;
    if (TOWING_ALIASES.has(normalized)) return "towing";
    if (fallbackRole === "technician") {
      fallbackRole = normalized;
    }
  }

  return fallbackRole;
}

export function isTowingTechnician(
  technician: (Technician & { service_type?: string | null }) | null | undefined
) {
  return getTechnicianOperationalRole(technician) === "towing";
}
