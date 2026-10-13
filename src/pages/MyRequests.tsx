import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import TechnicianRatingDialog from "@/components/rating/TechnicianRatingDialog";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  askAgainPath,
  callHref,
  canRate,
  isEarlier,
  isInProgress,
  monthOf,
  requestPath,
  serviceState,
  stageOf,
  wasCancelled,
} from "@/lib/activity";
import { apiFetch } from "@/lib/api";
import { firstName } from "@/lib/customerTracking";
import { newestFirst, requestClock, requestDay, requestId, requestTime, type MyRequest } from "@/lib/myRequests";
import { serviceArt, serviceName } from "@/lib/services";
import { cn } from "@/lib/utils";

const KNOWN_STATES = ["pending", "accepted", "technician_assigned", "on_the_way", "arrived", "in_progress", "job_completed", "cancelled"];
const STEPS = ["On the way", "At vehicle", "Done"];

type Shown = "all" | "done" | "cancelled";

/** The service's picture on its soft tile; a plain spanner when the request is for something we have no picture of. */
function Art({ request, small = false }: { request: MyRequest; small?: boolean }) {
  const art = serviceArt(request.service_type);
  return (
    <span className={cn("rq-av-art", small && "is-sm")} aria-hidden="true">
      {art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name="build" />}
    </span>
  );
}

/**
 * Activity (/my-requests): what is happening now, the technicians still to rate, and the latest earlier
 * requests, on one screen. "See all" opens every earlier request.
 */
const MyRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [shown, setShown] = useState<Shown>("all");
  const [rating, setRating] = useState<{ request: MyRequest; stars: number } | null>(null);
  const { permission, isSupported, requestPermission } = usePushNotifications();

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      try {
        const res = await apiFetch("/api/service-requests");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setRequests((Array.isArray(data) ? data : []).map((req: MyRequest) => ({ ...req, has_review: !!req.has_review })));
        setIsConnected(true);
      } catch (error) {
        console.error("Error fetching requests:", error);
        toast.error("Failed to load your requests");
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
    // Poll every 2 seconds to keep request progress updates near real-time.
    const intervalId = setInterval(fetchRequests, 2000);
    return () => clearInterval(intervalId);
  }, [user]);

  const open = (request: MyRequest) => {
    if (!requestId(request).trim()) {
      toast.error("Unable to open this service right now.");
      return;
    }
    if (!KNOWN_STATES.includes(serviceState(request))) toast.info("Status updated. Opening live tracking.");
    const path = requestPath(request);
    if (!path) {
      toast.error("Invalid service state. Please refresh and try again.");
      return;
    }
    navigate(path);
  };

  // Back from "See all": to where the customer came from, or to Activity when this was the first page opened.
  const backFromAll = () => (location.key !== "default" ? navigate(-1) : navigate("/my-requests", { replace: true }));

  const active = newestFirst(requests.filter(isInProgress));
  const earlier = newestFirst(requests.filter(isEarlier));
  const toRate = earlier.filter(canRate).slice(0, 3);
  const showAlerts = isSupported && permission === "default" && !alertsDismissed;
  const viewingAll = searchParams.get("view") === "all" && earlier.length > 0;

  const detailOf = (request: MyRequest) => [serviceName(request.service_type), request.vehicle_model, requestDay(request)].filter(Boolean).join(" · ");

  const row = (request: MyRequest, first: boolean, last: boolean) => {
    const cancelled = wasCancelled(request);
    const again = cancelled || canRate(request) ? null : askAgainPath(request);
    const name = serviceName(request.service_type);
    return (
      <div key={requestId(request)} className={cn("rq-av-row", first && "is-first", last && "is-last", cancelled && "is-void")}>
        <button type="button" className="rq-av-row-main" onClick={() => open(request)} aria-label={`${detailOf(request)}${cancelled ? ", cancelled" : ""}`}>
          <Art request={request} small />
          <span className="rq-av-row-text"><b>{name}</b><span>{[requestDay(request), request.vehicle_model].filter(Boolean).join(" · ")}</span></span>
        </button>
        {canRate(request) ? (
          <button type="button" className="rq-av-pill rq-press" aria-label={`Rate ${firstName(request.technician?.name)} for ${detailOf(request)}`} onClick={() => setRating({ request, stars: 0 })}>
            <MaterialSymbol name="star" />Rate
          </button>
        ) : again ? (
          <Link to={again} className="rq-av-pill rq-press" aria-label={`Ask for ${name} again`}><MaterialSymbol name="replay" />Ask again</Link>
        ) : cancelled ? <span className="rq-av-row-end">Cancelled</span> : null}
      </div>
    );
  };

  let body;
  if (isLoading) {
    body = (
      <div className="rq-av-loading" role="status" aria-label="Loading your requests">
        <span className="rq-shimmer" style={{ height: 32, width: "45%" }} />
        <span className="rq-shimmer" style={{ height: 176, borderRadius: 24 }} />
        <span className="rq-shimmer" style={{ height: 190, borderRadius: 20 }} />
      </div>
    );
  } else if (viewingAll) {
    const picked = earlier.filter((request) => shown === "all" || (shown === "cancelled" ? wasCancelled(request) : !wasCancelled(request)));
    const cancelledCount = earlier.filter(wasCancelled).length;
    const chips: { id: Shown; name: string; count: number }[] = [
      { id: "all", name: "All", count: earlier.length },
      { id: "done", name: "Completed", count: earlier.length - cancelledCount },
      { id: "cancelled", name: "Cancelled", count: cancelledCount },
    ];
    body = (
      <>
        <button type="button" className="rq-icon-btn rq-press" aria-label="Back to Activity" onClick={backFromAll}><MaterialSymbol name="arrow_back" /></button>
        <h1 className="rq-pg-h1 rq-av-all-title">All requests</h1>
        <div className="rq-av-chips" role="radiogroup" aria-label="Show">
          {chips.map((chip) => (
            <button key={chip.id} type="button" role="radio" aria-checked={shown === chip.id} className={cn("rq-av-chip rq-press", shown === chip.id && "is-on")} onClick={() => setShown(chip.id)}>
              {chip.name}<i>{chip.count}</i>
            </button>
          ))}
        </div>
        {picked.map((request, index) => {
          const month = monthOf(requestTime(request));
          const first = index === 0 || monthOf(requestTime(picked[index - 1])) !== month;
          const last = index === picked.length - 1 || monthOf(requestTime(picked[index + 1])) !== month;
          return (
            <div key={requestId(request)}>
              {first ? <h2 className="rq-av-month">{month}</h2> : null}
              {row(request, first, last)}
            </div>
          );
        })}
        <p className="rq-av-end">{picked.length ? (shown === "all" ? "That’s every request you’ve made." : "That’s all of them.") : "Nothing here."}</p>
      </>
    );
  } else if (!requests.length) {
    body = (
      <>
        <h1 className="rq-pg-h1">No requests <em>yet</em></h1>
        <p className="rq-pg-sub">When you ask for help, you can follow it here, from finding a technician to paying.</p>
        <div className="rq-av-new" aria-hidden="true"><img src="/images/vehicles/car.webp" alt="" draggable={false} /></div>
        <Link to="/services" className="rq-btn rq-btn-block rq-press"><MaterialSymbol name="car_repair" />Get help</Link>
      </>
    );
  } else {
    // Enough of the latest to fill the screen without scrolling.
    const latest = earlier.slice(0, active.length > 1 || showAlerts ? 2 : active.length ? 3 : 4);
    body = (
      <>
        <div className="rq-av-title">
          <h1 className="rq-pg-h1">Activity</h1>
          {active.length ? (
            <span className={cn("rq-av-live", !isConnected && "is-off")}><i aria-hidden="true" />{isConnected ? "Live" : "Reconnecting…"}</span>
          ) : null}
        </div>
        <p className="rq-pg-sub">
          {active.length ? `${active.length} in progress · ${earlier.length} earlier` : `${earlier.length} ${earlier.length === 1 ? "request" : "requests"} so far`}
        </p>

        {showAlerts ? (
          <p className="rq-av-alert">
            <MaterialSymbol name="notifications" />
            <span>Get an alert when help arrives</span>
            <button type="button" className="rq-text-btn" onClick={() => void requestPermission().then(() => setAlertsDismissed(true))}>Turn on</button>
            <button type="button" className="rq-av-x" aria-label="Not now" onClick={() => setAlertsDismissed(true)}><MaterialSymbol name="close" /></button>
          </p>
        ) : null}

        {active.length ? (
          <div className="rq-av-jobs">
            {active.map((request) => {
              const stage = stageOf(request);
              const call = callHref(request);
              const name = serviceName(request.service_type);
              return (
                <article key={requestId(request)} className="rq-av-job" aria-label={`${name}: ${stage.say}`}>
                  <button type="button" className="rq-av-job-top" onClick={() => open(request)}>
                    <Art request={request} />
                    <span className="rq-av-job-text">
                      <b className="rq-av-job-say">{stage.say}</b>
                      <span className="rq-av-job-what">{[name, request.vehicle_model, requestClock(request)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                  <ol className="rq-av-steps" aria-label={`Step ${stage.now + 1} of 4`}>
                    {[stage.firstStep, ...STEPS].map((label, index) => (
                      <li key={label} className={index < stage.now ? "is-done" : index === stage.now ? "is-now" : undefined}><i /><span>{label}</span></li>
                    ))}
                  </ol>
                  <div className="rq-av-job-actions">
                    <button type="button" className="rq-btn rq-av-grow rq-press" onClick={() => open(request)}>{stage.action}<MaterialSymbol name="arrow_forward" /></button>
                    {call ? (
                      <a href={call} className="rq-btn rq-btn-soft rq-press" aria-label={`Call ${firstName(request.technician?.name)}`}><MaterialSymbol name="call" />Call</a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rq-av-idle"><MaterialSymbol name="check_circle" /><span>Nothing in progress right now.</span><Link to="/services" className="rq-text-btn">Get help<MaterialSymbol name="chevron_right" /></Link></p>
        )}

        {toRate.length && active.length < 2 ? (
          <>
            <div className="rq-av-head"><h2 className="rq-pg-h2">{toRate.length === 1 ? "Rate your technician" : "Rate your technicians"}</h2></div>
            <div className="rq-av-rail">
              {toRate.map((request) => (
                <div key={requestId(request)} className={cn("rq-av-rate", toRate.length === 1 && "is-only")}>
                  <div className="rq-av-rate-top">
                    <Art request={request} small />
                    <span className="rq-av-rate-text"><b>How was {firstName(request.technician?.name)}?</b><span>{[serviceName(request.service_type), requestDay(request)].filter(Boolean).join(" · ")}</span></span>
                  </div>
                  <div className="rq-av-rate-stars" role="group" aria-label={`Rate ${firstName(request.technician?.name)}`}>
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button key={stars} type="button" className="rq-av-rate-star" aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`} onClick={() => setRating({ request, stars })}>
                        <MaterialSymbol name="star" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {earlier.length ? (
          <>
            <div className="rq-av-head">
              <h2 className="rq-pg-h2">Earlier</h2>
              {earlier.length > latest.length ? (
                <button type="button" className="rq-text-btn" onClick={() => { setShown("all"); setSearchParams({ view: "all" }); }}>See all {earlier.length}<MaterialSymbol name="chevron_right" /></button>
              ) : null}
            </div>
            <div>{latest.map((request, index) => row(request, index === 0, index === latest.length - 1))}</div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="rq-pg rq-av">
      <div className="rq-pg-in">{body}</div>
      {rating?.request.technician ? (
        <TechnicianRatingDialog
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen) setRating(null); }}
          requestId={requestId(rating.request)}
          technicianId={String(rating.request.technician.id ?? "")}
          technicianName={firstName(rating.request.technician.name)}
          initialRating={rating.stars}
          detail={detailOf(rating.request)}
          onSuccess={() => {
            const rated = requestId(rating.request);
            setRequests((list) => list.map((request) => (requestId(request) === rated ? { ...request, has_review: true } : request)));
          }}
        />
      ) : null}
    </div>
  );
};

export default MyRequests;
