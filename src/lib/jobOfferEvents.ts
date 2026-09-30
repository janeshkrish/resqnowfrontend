/**
 * Job offers that reach the open app as a push notification. The socket is the main path;
 * this covers a dropped socket, and the Android app, where a push that lands while the app
 * is on screen is passed to the web layer instead of ringing the full-screen alarm
 * (MyFirebaseMessagingService). Whoever shows the offer card — the dashboard, or
 * JobNotificationModal on the other technician pages — claims the offer, so useFCM knows
 * it was shown.
 */
export const JOB_OFFER_PUSH_EVENT = "resqnow:job-offer-push";
export const JOB_OFFER_CLOSED_EVENT = "resqnow:job-offer-closed";

type Payload = Record<string, unknown>;
type OfferEventDetail = { offer: Payload; claimed: boolean };

export type JobPushKind = "offer" | "closed" | "assigned" | "other";

/** What a push is, from the data resqnowbackend/services/notificationService.js sends. */
export function classifyJobPush(data: Payload | null | undefined): JobPushKind {
  const type = String(data?.type || "").trim().toUpperCase();
  const event = String(data?.event || "").trim().toLowerCase();
  if (type === "JOB_REVOKED" || event === "job:revoked") return "closed";
  if (event === "job:assigned") return "assigned";
  if (type === "EMERGENCY_JOB" || event === "job_offer") return "offer";
  return "other";
}

export function offerRequestId(offer: Payload | null | undefined) {
  const id = String(offer?.requestId ?? offer?.jobId ?? offer?.id ?? "").trim();
  return id && id !== "undefined" ? id : "";
}

/** Hands a pushed offer to the card on screen. False when no card claimed it. */
export function announcePushedJobOffer(offer: Payload) {
  if (typeof window === "undefined") return false;
  const detail: OfferEventDetail = { offer, claimed: false };
  window.dispatchEvent(new CustomEvent<OfferEventDetail>(JOB_OFFER_PUSH_EVENT, { detail }));
  return detail.claimed;
}

/** The handler returns true when it shows the offer (or knows it should not be shown). */
export function onPushedJobOffer(handler: (offer: Payload) => boolean) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<OfferEventDetail>).detail;
    if (detail?.offer && handler(detail.offer)) detail.claimed = true;
  };
  window.addEventListener(JOB_OFFER_PUSH_EVENT, listener);
  return () => window.removeEventListener(JOB_OFFER_PUSH_EVENT, listener);
}

export function announceClosedJobOffer(requestId: string) {
  if (typeof window === "undefined" || !requestId) return;
  window.dispatchEvent(new CustomEvent<string>(JOB_OFFER_CLOSED_EVENT, { detail: requestId }));
}

export function onClosedJobOffer(handler: (requestId: string) => void) {
  const listener = (event: Event) => {
    const requestId = String((event as CustomEvent<string>).detail || "").trim();
    if (requestId) handler(requestId);
  };
  window.addEventListener(JOB_OFFER_CLOSED_EVENT, listener);
  return () => window.removeEventListener(JOB_OFFER_CLOSED_EVENT, listener);
}
