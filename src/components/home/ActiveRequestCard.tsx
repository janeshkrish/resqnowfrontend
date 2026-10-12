import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeServiceRequest } from "@/hooks/useRealtimeServiceRequest";
import { apiFetch } from "@/lib/api";
import { activeStage, pickActiveRequest, type ActiveStage, type RequestSummary } from "@/lib/activeRequest";
import { firstName, freshnessText, vehicleArt } from "@/lib/customerTracking";
import { approachDistance, homeTrackingHeadline, phaseForStage, tripProgress } from "@/lib/homeTrip";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { usableLiveEta } from "@/lib/liveEta";
import { cn } from "@/lib/utils";
import ActiveRequestTrip from "./ActiveRequestTrip";
import MaterialSymbol from "./MaterialSymbol";

// The real map is fetched only when there is a request to show on it.
const ActiveRequestMap = lazyWithReload(() => import("./ActiveRequestMap"));

/** The route on the drawn stand-in map, from the technician's corner to the customer's spot. */
const DRAWN_ROUTE = "M 40 80 L 40 56 Q 40 46 50 46 L 178 46 Q 190 46 190 36 L 190 32 Q 190 22 200 22 L 300 22";

const mapPoint = (lat: unknown, lng: unknown) => {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null;
};

async function fetchMyRequests(signal?: AbortSignal): Promise<RequestSummary[]> {
  const response = await apiFetch("/api/service-requests", { signal });
  if (!response.ok) throw new Error(`Requests failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/** Seconds since the work started, counted while it is going on. */
function useWorkSeconds(startedAt: string | null | undefined, counting: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.parse(String(startedAt ?? ""));
    if (!counting || !Number.isFinite(started)) {
      setSeconds(0);
      return;
    }
    const read = () => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [counting, startedAt]);
  return seconds;
}

/** The map stand-in, drawn: shown while the real map loads and whenever it cannot be shown. */
function DrawnMap({ searching, hasTechnician, progress, glyph }: { searching: boolean; hasTechnician: boolean; progress: number; glyph: string }) {
  return (
    <div className="rq-h-map-canvas">
      <svg width="350" height="92" viewBox="0 0 350 92">
        <rect x="-6" y="-6" width="34" height="100" rx="8" className="rq-h-map-block" />
        <rect x="54" y="-6" width="122" height="40" rx="8" className="rq-h-map-block" />
        <rect x="54" y="60" width="122" height="40" rx="8" className="rq-h-map-block" />
        <rect x="206" y="36" width="150" height="64" rx="8" className="rq-h-map-block" />
        <rect x="206" y="-10" width="150" height="18" rx="6" className="rq-h-map-park" />
        <path d="M -10 46 L 360 46 M 40 -10 L 40 110 M 190 -10 L 190 110 M 190 22 L 360 22" className="rq-h-map-road" />
        {hasTechnician ? (
          <>
            <path d={DRAWN_ROUTE} className="rq-h-map-route-case" />
            <path d={DRAWN_ROUTE} className="rq-h-map-route" />
          </>
        ) : null}
      </svg>
      {searching ? (
        <>
          <span className="rq-h-map-radar" />
          <span className="rq-h-map-radar is-late" />
        </>
      ) : null}
      <span className="rq-h-map-pulse" />
      <span className="rq-h-map-me" />
      {hasTechnician ? (
        <span className="rq-h-map-mover" style={{ offsetPath: `path('${DRAWN_ROUTE}')`, offsetDistance: `${6 + progress * 94}%` }}>
          <span className="rq-h-map-pin">
            <MaterialSymbol name={glyph} />
          </span>
        </span>
      ) : null}
    </div>
  );
}

function ActiveRequestTracker({ summary, requestId }: { summary: RequestSummary & { stage: ActiveStage }; requestId: string }) {
  const queryClient = useQueryClient();
  // A new status reaches the live connection first; the card's own list is refreshed to match.
  const realtimeOptions = useMemo(
    () => ({
      onStatusChange: () => {
        void queryClient.invalidateQueries({ queryKey: ["home", "my-requests"] });
      },
    }),
    [queryClient],
  );
  const { request: live, technician: liveTechnician, isConnected, trackingFreshness } = useRealtimeServiceRequest(
    requestId || undefined,
    realtimeOptions,
  );
  const [mapFailed, setMapFailed] = useState(false);
  const handleMapUnavailable = useCallback(() => setMapFailed(true), []);

  // The live request is ahead of the list; the list fills in until it has loaded.
  const stage = (live ? activeStage(live) : null) ?? summary.stage;
  const phase = phaseForStage(stage);
  const technician = liveTechnician ?? summary.technician ?? null;
  const technicianName = technician?.name?.trim() || null;
  const first = firstName(technicianName);
  const customer = useMemo(
    () => mapPoint(live?.location_lat ?? summary.location_lat, live?.location_lng ?? summary.location_lng),
    [live?.location_lat, live?.location_lng, summary.location_lat, summary.location_lng],
  );
  const technicianAt = useMemo(
    () => mapPoint(liveTechnician?.location_lat, liveTechnician?.location_lng),
    [liveTechnician?.location_lat, liveTechnician?.location_lng],
  );
  const liveEta = useMemo(
    () => usableLiveEta(liveTechnician?.liveEta, { requestId, destination: customer }),
    [customer, liveTechnician?.liveEta, requestId],
  );
  const freshness = trackingFreshness ?? (isConnected ? "LIVE" : "RECONNECTING");
  const workSeconds = useWorkSeconds(live?.started_at, phase === "working");

  const headline = homeTrackingHeadline({
    phase,
    technicianName,
    createdAt: live?.created_at ?? summary.created_at,
    startedAt: live?.started_at,
    elapsedSeconds: workSeconds,
    liveEta,
    distance: phase === "accepted" || phase === "way" ? approachDistance(liveEta, technicianAt, customer) : null,
  });
  const progress = tripProgress(phase, liveEta);
  const towing = Boolean(live?.isTowing) || /tow/i.test(String(live?.service_type ?? summary.service_type ?? ""));
  const vehicle = towing ? "tow" : "bike";
  const hasTechnician = phase !== "search";
  const showRealMap = Boolean(requestId) && Boolean(customer) && !mapFailed;
  const trackingPath = `/service-tracking/${requestId}`;
  const drawnMap = (
    <DrawnMap
      searching={phase === "search"}
      hasTechnician={hasTechnician}
      progress={progress}
      glyph={towing ? "auto_towing" : "two_wheeler"}
    />
  );

  return (
    <section className="rq-h-card rq-h-track" aria-label="Your active request" data-phase={phase}>
      <div className="rq-h-map" data-testid="home-request-map" data-map={showRealMap ? "live" : "drawn"} aria-hidden="true">
        {showRealMap && customer ? (
          <div className="rq-h-map-live">
            {/* The drawing stands in while the real map's code is fetched. */}
            <Suspense fallback={drawnMap}>
              <ActiveRequestMap
                requestId={requestId}
                customer={customer}
                technicianAt={technicianAt}
                motion={liveTechnician}
                freshness={freshness}
                status={live?.status}
                towing={towing}
                onUnavailable={handleMapUnavailable}
              />
            </Suspense>
          </div>
        ) : (
          drawnMap
        )}
        {showRealMap ? (
          // On the real map the chip says what the technician's position is doing, and only
          // while there is a technician to follow.
          technicianAt ? (
            <span
              className={cn(
                "rq-h-map-chip",
                freshness === "DELAYED" || freshness === "RECONNECTING" ? "is-warn" : freshness !== "LIVE" && "is-off",
              )}
              data-testid="home-request-map-chip"
            >
              <span className="rq-h-live-dot" />
              {freshnessText(freshness)}
            </span>
          ) : null
        ) : hasTechnician ? (
          <span className="rq-h-map-chip">
            <span className="rq-h-live-dot" />
            Live
          </span>
        ) : null}
        {/* The map only shows. A touch on it does not move it; it opens live tracking. */}
        {showRealMap ? <Link to={trackingPath} className="rq-h-map-open" tabIndex={-1} /> : null}
      </div>

      <div className="rq-ht-body">
        <div className="rq-ht-top">
          <div className="rq-ht-text">
            <p className="rq-ht-say" data-testid="home-request-say" aria-live="polite">
              {headline.say}
            </p>
            <div className="rq-ht-bigrow">
              <p className={cn("rq-ht-big", headline.bigIsText && "is-text")} data-testid="home-request-big">
                {headline.big}
              </p>
              {headline.side ? (
                <span className="rq-ht-side" data-testid="home-request-side">
                  {headline.side}
                </span>
              ) : null}
            </div>
          </div>
          {hasTechnician && technician?.phone ? (
            <a href={`tel:${technician.phone}`} className="rq-ht-call rq-press" aria-label={`Call ${first}`}>
              <MaterialSymbol name="call" />
            </a>
          ) : null}
        </div>

        <div className="rq-ht-foot">
          <ActiveRequestTrip
            phase={phase}
            progress={progress}
            vehicle={vehicle}
            art={vehicleArt(live?.vehicle_type ?? summary.vehicle_type)}
          />
          {requestId ? (
            <Link to={trackingPath} className="rq-ht-track rq-press">
              Track live
              <MaterialSymbol name="chevron_right" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Shown at the top of home while the customer has a request in progress. */
export default function ActiveRequestCard() {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: ["home", "my-requests"],
    queryFn: ({ signal }) => fetchMyRequests(signal),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const request = isAuthenticated && data ? pickActiveRequest(data) : null;
  if (!request) return null;

  const requestId = String(request.id ?? request._id ?? "");
  // Keyed by the request, so nothing from one request is carried over to the next.
  return <ActiveRequestTracker key={requestId} summary={request} requestId={requestId} />;
}
