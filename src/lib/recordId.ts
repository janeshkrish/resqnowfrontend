/** Persistence IDs are UUIDs; positive integers remain readable during cutover. */
export type RecordId = string | number;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Keep route validation aligned with the backend's models/identifiers.js.
export function recordId(value: unknown): RecordId | null {
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value.toLowerCase();
  if ((typeof value === "number" || typeof value === "string") && /^[1-9]\d*$/.test(String(value))) {
    const legacy = Number(value);
    if (Number.isSafeInteger(legacy)) return legacy;
  }
  return null;
}
