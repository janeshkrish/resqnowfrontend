import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PlaceSummary } from "@/lib/placeSummary";
import { cn } from "@/lib/utils";

/** Space the floating header covers; the home page pads its content by this much. */
export const HOME_HEADER_HEIGHT = 100;
const COMPACT_SCROLL_Y = 16;
const PERMISSION_DENIED = 1;

// Kept for this app session so returning to home shows the last place at once
// while a fresh fix is taken, instead of flashing the loading state again.
let lastKnownPlace: PlaceSummary | null = null;

function MaterialSymbol({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("rq-symbol", className)}>
      {name}
    </span>
  );
}

export default function HomeGlassHeader() {
  const { user } = useAuth();
  const { place, address, loading, error, errorCode, requestLocation } = useGeolocation();
  const [cachedPlace] = useState<PlaceSummary | null>(() => lastKnownPlace);
  const [compact, setCompact] = useState(false);

  const firstName = String(user?.name || "").trim().split(/\s+/)[0] || "";
  const detectedPlace: PlaceSummary | null = place
    ?? (address ? { title: "Current location", subtitle: address } : null);
  const shownPlace = detectedPlace ?? (error ? null : cachedPlace);
  const status: "found" | "error" | "locating" = shownPlace ? "found" : error ? "error" : "locating";
  const permissionDenied = errorCode === PERMISSION_DENIED;

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (detectedPlace) lastKnownPlace = detectedPlace;
    // detectedPlace is rebuilt every render; place/address are its real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, address]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCompact(window.scrollY > COMPACT_SCROLL_Y);
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleLocationPress = useCallback(async () => {
    if (status === "error" && permissionDenied) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.requestPermissions().catch(() => undefined);
      } else {
        toast.info("Turn on location for ResQNow", {
          description: "Allow location access in your browser settings, then tap again.",
        });
      }
    }
    requestLocation();
  }, [permissionDenied, requestLocation, status]);

  const locationLabel = status === "found" && shownPlace
    ? `Current location: ${shownPlace.title}, ${shownPlace.subtitle}. Tap to refresh.`
    : status === "error"
      ? permissionDenied
        ? "Location is off. Tap to turn on location."
        : "Couldn't find your location. Tap to try again."
      : "Finding your location";

  return (
    <div
      className="rq-home-header pointer-events-none sticky top-0 z-50 px-3 pt-2.5"
      style={{ height: HOME_HEADER_HEIGHT, marginBottom: -HOME_HEADER_HEIGHT }}
    >
      <header className={cn("rq-glass-capsule pointer-events-auto", compact && "is-compact")}>
        <span aria-hidden="true" className="rq-glass-sheen" />
        <button
          type="button"
          className="rq-press rq-location"
          onClick={handleLocationPress}
          aria-label={locationLabel}
        >
          {firstName ? (
            <span className={cn("rq-greeting", compact && "is-hidden")}>
              Hello, <strong>{firstName}</strong>
            </span>
          ) : null}

          {status === "locating" ? (
            <>
              <span className="rq-place-row">
                <MaterialSymbol name="my_location" className="rq-breathe" />
                <span className="rq-place-title">Finding your location…</span>
              </span>
              <span className="rq-place-skeleton">
                <span className="rq-shimmer" />
              </span>
            </>
          ) : null}

          {status === "error" ? (
            <>
              <span className="rq-place-row">
                <MaterialSymbol name="location_off" />
                <span className="rq-place-title">
                  {permissionDenied ? "Location is off" : "Couldn't find you"}
                </span>
              </span>
              <span className="rq-place-action">
                {permissionDenied ? "Tap to turn on location" : "Tap to try again"}
                <MaterialSymbol name="chevron_right" className="rq-symbol-sm" />
              </span>
            </>
          ) : null}

          {status === "found" && shownPlace ? (
            <>
              <span key={`title:${shownPlace.title}`} className="rq-place-row rq-reveal">
                <MaterialSymbol name="near_me" />
                <span className="rq-place-title">{shownPlace.title}</span>
                <MaterialSymbol name="keyboard_arrow_down" className="rq-symbol-muted" />
              </span>
              {shownPlace.subtitle ? (
                <span key={`subtitle:${shownPlace.subtitle}`} className="rq-place-subtitle rq-reveal rq-reveal-delay">
                  {shownPlace.subtitle}
                </span>
              ) : null}
            </>
          ) : null}
        </button>

        <span className="rq-sos-wrap">
          <span aria-hidden="true" className="rq-sos-glow" />
          <Link to="/request-service/emergency" className="rq-press rq-sos" aria-label="SOS, request emergency help">
            <MaterialSymbol name="call" />
            SOS
          </Link>
        </span>
      </header>
      <span className="sr-only" aria-live="polite">
        {status === "found" && shownPlace ? `Location found: ${shownPlace.title}` : loading ? "Finding your location" : ""}
      </span>
    </div>
  );
}
