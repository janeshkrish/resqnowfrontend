export type LiveTrackingDiagnosticPrefix =
  | '[RT-TECH-GPS]'
  | '[RT-TECH-SOCKET]'
  | '[RT-CUSTOMER-SOCKET]'
  | '[RT-CUSTOMER-RECEIVE]'
  | '[RT-CUSTOMER-STATE]'
  | '[RT-PLAYBACK]'
  | '[RT-MAPPLS-MARKER]';

function isEnabled() {
  return String(import.meta.env.VITE_LIVE_TRACKING_DIAGNOSTICS || '')
    .trim()
    .toLowerCase() === 'true';
}

// Diagnostics are deliberately opt-in so they can be enabled in staging
// without changing customer-visible tracking behavior in other environments.
export function logLiveTrackingDiagnostic(
  prefix: LiveTrackingDiagnosticPrefix,
  event: string,
  details: Record<string, unknown> = {},
) {
  if (!isEnabled()) return;
  console.info(prefix, { event, ...details });
}
