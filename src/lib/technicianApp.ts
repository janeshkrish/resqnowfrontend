import { useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";

/** The number technicians call for help; the same one the customer app shows. */
export const TECH_SUPPORT_PHONE = "+919566510080";

/** Up to two letters standing in for a person without a photo. */
export const techInitials = (name: unknown) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "T";

/** The kinds of tow truck an operator can add, as the server stores them. */
export const TOW_VEHICLE_TYPES = ["flatbed", "wheel-lift", "integrated", "heavy-duty", "recovery", "other"] as const;

const titleCase = (value: unknown) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

/** A tow truck's kind in the technician's language; kinds saved before the list existed keep their own name. */
export function useVehicleTypeName() {
  const { t } = useTechText();
  return (type: unknown) => {
    const key = String(type || "").trim().toLowerCase();
    return (TOW_VEHICLE_TYPES as readonly string[]).includes(key) ? t(`fleet.type.${key}` as TechTextKey) : titleCase(type);
  };
}
