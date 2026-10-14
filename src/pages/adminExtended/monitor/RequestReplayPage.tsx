import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import { serviceOf } from "@/lib/services";
import { getRequestReplay } from "../api/adminMonitorApi";
import { clock, money, service } from "./monitorFormat";

export default function RequestReplayPage() {
  const params = useParams();
  const requestId = Number(params.requestId);
  const replay = useQuery({ queryKey: ["admin", "monitor", "replay", requestId], queryFn: () => getRequestReplay(requestId), enabled: Number.isInteger(requestId) && requestId > 0 });
  const data = replay.data;
  const trail = useMemo(() => data?.trail ?? [], [data]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || trail.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => {
        if (i >= trail.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, Math.max(60, Math.round(12_000 / trail.length)));
    return () => window.clearInterval(timer);
  }, [playing, trail.length]);

  const point = trail[index] ?? null;
  const summary = data?.summary;
  const towing = serviceOf(data?.serviceType)?.id === "towing";
  const polyline = useMemo(() => trail.map((p) => [p.lat, p.lng] as [number, number]), [trail]);
  const startAt = trail[0]?.at ? Date.parse(trail[0].at) : null;
  const endAt = trail.length ? Date.parse(trail[trail.length - 1].at || "") : null;
  const progressAt = point?.at ? Date.parse(point.at) : null;
  const fraction = startAt != null && endAt != null && progressAt != null && endAt > startAt ? (progressAt - startAt) / (endAt - startAt) : 0;
  const marks = (data?.timeline ?? [])
    .filter((t) => startAt != null && endAt != null && endAt > startAt && Date.parse(t.at) >= startAt && Date.parse(t.at) <= endAt)
    .map((t) => ({ left: (Date.parse(t.at) - startAt!) / (endAt! - startAt!), warn: t.kind === "alert", title: t.title }));

  return (
    <section className="am" data-testid="request-replay">
      <header className="am-replay-head">
        <Link to="/admin/extended/requests" className="am-btn"><MaterialSymbol name="arrow_back" />Requests</Link>
        <div>
          <h1>#{requestId}{data ? ` · ${service(data.serviceType)} · replay` : ""}</h1>
          <p>{data ? [data.customer.name, data.technician?.name, data.address].filter(Boolean).join(" · ") : replay.isLoading ? "Loading…" : ""}</p>
        </div>
      </header>
      {replay.isError ? <p className="am-error" role="alert">{(replay.error as Error).message}</p> : null}
      {data ? (
        <>
          <div className="am-sum">
            <div className="am-kpi"><span>Promised arrival</span><b>{clock(summary?.promisedAt)}</b></div>
            <div className="am-kpi"><span>Arrived</span><b>{clock(summary?.arrivedAt)}{summary?.lateMinutes != null ? <small>{summary.lateMinutes > 0 ? `+${summary.lateMinutes} min` : "on time"}</small> : null}</b></div>
            <div className="am-kpi"><span>Distance driven</span><b>{summary?.distanceKm != null ? summary.distanceKm : "—"}{summary?.distanceKm != null ? <small>km</small> : null}</b></div>
            <div className="am-kpi"><span>Work took</span><b>{summary?.workMinutes != null ? summary.workMinutes : "—"}{summary?.workMinutes != null ? <small>min</small> : null}</b></div>
            <div className="am-kpi"><span>Rating · fare</span><b>{summary?.rating != null ? `${summary.rating}★` : "—"}<small>{money(data.fare)}</small></b></div>
          </div>
          <div className="am-replay">
            <div className="am-rmap">
              {trail.length > 1 ? (
                <LiveTrackingMap
                  variant="card"
                  className="am-map-canvas"
                  techLocation={point ? { lat: point.lat, lng: point.lng } : null}
                  userLocation={data.location.lat != null && data.location.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null}
                  dropLocation={data.drop?.lat != null && data.drop.lng != null ? { lat: data.drop.lat, lng: data.drop.lng } : null}
                  routePolyline={polyline}
                  showRoutePath
                  showStatusOverlay={false}
                  technicianVehicle={towing ? "tow" : "bike"}
                  userLabel={data.customer.name}
                  trackingSessionId={`replay-${requestId}`}
                />
              ) : (
                <p className="am-empty">No GPS trail was recorded for this job.</p>
              )}
              {trail.length > 1 ? (
                <div className="am-scrub">
                  <button type="button" className="am-play" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (index >= trail.length - 1) setIndex(0); setPlaying(!playing); }}>
                    <MaterialSymbol name={playing ? "pause" : "play_arrow"} />
                  </button>
                  <time>{clock(trail[0]?.at)}</time>
                  <div className="am-track">
                    <i aria-hidden="true" />
                    <b style={{ width: `${fraction * 100}%` }} aria-hidden="true" />
                    {marks.map((m, i) => <s key={i} className={m.warn ? "is-warn" : ""} style={{ left: `${m.left * 100}%` }} title={m.title} />)}
                    <input type="range" min={0} max={trail.length - 1} value={index} onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }} aria-label="Replay position" />
                  </div>
                  <time>{clock(trail[trail.length - 1]?.at)}</time>
                  <span className="am-replay-at">{clock(point?.at)}{point?.speedKmh != null ? ` · ${point.speedKmh} km/h` : ""}</span>
                </div>
              ) : null}
            </div>
            <div className="am-side">
              <p className="am-h">What happened</p>
              <ol className="am-tl">
                {[...data.timeline].reverse().map((item, i) => (
                  <li key={`${item.kind}-${i}`} className={item.kind === "alert" ? "is-warn" : progressAt != null && Date.parse(item.at) <= progressAt ? "is-done" : "is-muted"}>
                    <time>{clock(item.at)}</time>
                    <i aria-hidden="true" />
                    <div><b>{item.title}</b><span>{item.description || ""}</span></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
