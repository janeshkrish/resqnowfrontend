import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { getServiceCatalogItem } from "@/config/serviceCatalog";
import { apiFetch } from "@/lib/api";
import { REQUEST_STEPS as STEPS, STAGE_COPY, pickActiveRequest, type RequestSummary } from "@/lib/activeRequest";
import { cn } from "@/lib/utils";
import MaterialSymbol from "./MaterialSymbol";

const ROUTE = "M 34 128 L 34 92 Q 34 76 50 76 L 176 76 Q 192 76 192 60 L 192 44 Q 192 30 206 30 L 300 30";

function serviceName(serviceType?: string | null) {
  const id = String(serviceType || "").replace(/^(car|bike|ev|commercial)-/i, "");
  return getServiceCatalogItem(id).name.replace(/ Services$/, "");
}

async function fetchMyRequests(signal?: AbortSignal): Promise<RequestSummary[]> {
  const response = await apiFetch("/api/service-requests", { signal });
  if (!response.ok) throw new Error(`Requests failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
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
  const { title, step } = STAGE_COPY[request.stage];
  const moving = request.stage === "on_the_way";
  const details = [serviceName(request.service_type), request.vehicle_model].filter(Boolean).join(" · ");
  const technician = request.technician;

  return (
    <section className="rq-h-card rq-h-track" aria-live="polite" aria-label="Your active request">
      <div className={cn("rq-h-map", moving && "is-moving")} aria-hidden="true">
        {/* Fixed-size canvas so the moving marker's path lines up with the drawn route. */}
        <div className="rq-h-map-canvas">
          <svg width="350" height="148" viewBox="0 0 350 148">
            <rect x="-6" y="-6" width="160" height="66" rx="10" className="rq-h-map-block" />
            <rect x="60" y="92" width="120" height="70" rx="10" className="rq-h-map-block" />
            <rect x="210" y="46" width="150" height="120" rx="10" className="rq-h-map-block" />
            <rect x="226" y="-10" width="140" height="24" rx="8" className="rq-h-map-park" />
            <path d="M -10 76 L 360 76 M 34 -10 L 34 160 M 192 -10 L 192 160 M 150 30 L 360 30" className="rq-h-map-road" />
            <path d={ROUTE} className="rq-h-map-route" />
            <path d={ROUTE} className="rq-h-map-flow" />
            <circle cx="34" cy="128" r="5" className="rq-h-map-start" />
          </svg>
          <span className="rq-h-map-pulse" />
          <span className="rq-h-map-pin">
            <MaterialSymbol name="location_on" />
          </span>
          <span className="rq-h-map-mover" style={{ offsetPath: `path('${ROUTE}')` }}>
            <span className="rq-h-map-truck">
              <MaterialSymbol name="auto_towing" />
            </span>
          </span>
        </div>
        <span className="rq-h-map-chip">
          <span className="rq-h-live-dot" />
          Live
        </span>
      </div>

      <div className="rq-h-track-body">
        <div>
          <h2 className="rq-h-track-title">{title}</h2>
          {details ? <p className="rq-h-track-sub">{details}</p> : null}
        </div>

        <div className="rq-h-steps-wrap">
          <span aria-hidden="true" className="rq-h-step-line">
            <i style={{ width: `${(Math.min(step, STEPS.length - 1) / (STEPS.length - 1)) * 100}%` }} />
          </span>
          <ol className="rq-h-steps">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={cn("rq-h-step", index < step && "is-done", index === step && "is-now")}
                aria-current={index === step ? "step" : undefined}
              >
                <span className="rq-h-step-dot">{index < step ? <MaterialSymbol name="check" className="rq-symbol-xs" /> : null}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>

        {technician?.name ? (
          <div className="rq-h-tech">
            <span aria-hidden="true" className="rq-h-avatar">
              {technician.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="rq-h-tech-copy">
              <span className="rq-h-tech-name">{technician.name}</span>
              {technician.rating ? (
                <span className="rq-h-tech-meta">
                  <MaterialSymbol name="star" className="rq-symbol-xs rq-h-star" />
                  {Number(technician.rating).toFixed(1)}
                </span>
              ) : null}
            </span>
            {technician.phone ? (
              <a href={`tel:${technician.phone}`} className="rq-h-icon-btn rq-press" aria-label={`Call ${technician.name}`}>
                <MaterialSymbol name="call" />
              </a>
            ) : null}
          </div>
        ) : null}

        {requestId ? (
          <Link to={`/service-tracking/${requestId}`} className="rq-h-btn rq-h-btn-block rq-press">
            <MaterialSymbol name="near_me" />
            Open live tracking
          </Link>
        ) : null}
      </div>
    </section>
  );
}
