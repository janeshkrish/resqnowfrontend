import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import { serviceOf } from "@/lib/services";
import { getRequestMonitor } from "../api/adminMonitorApi";
import { useAdminEvents, useNow, useRequestLive, useWatchList, WATCH_LIMIT } from "./adminLive";
import { ago, attentionOf, chipOf, clock, liveLine, minutesLabel, service } from "./monitorFormat";
import RequestMonitorPanel from "./RequestMonitorPanel";

const SOUND_KEY = "resqnow_admin_watch_sound";

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
    // No audio on this device.
  }
}

function WatchCard({ requestId, now, onOpen, onRemove }: { requestId: number; now: number; onOpen: () => void; onRemove: () => void }) {
  const detail = useQuery({ queryKey: ["admin", "monitor", "request", requestId], queryFn: () => getRequestMonitor(requestId), refetchInterval: 30_000 });
  const data = detail.data;
  const live = useRequestLive(requestId, data?.technician?.id ?? null);
  if (detail.isError) {
    return (
      <div className="am-card">
        <div className="am-card-body">
          <div><b>#{requestId}</b><span className="am-live-txt">{(detail.error as Error).message}</span></div>
          <button type="button" className="am-btn" onClick={onRemove}>Unpin</button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="am-card"><p className="am-empty">Loading #{requestId}…</p></div>;
  const point = live.point ?? (data.live?.lat != null && data.live.lng != null ? { lat: data.live.lat, lng: data.live.lng, at: Date.parse(data.live.lastSeenAt || "") || now } : null);
  const merged = { ...data, live: data.live ? { ...data.live, etaSeconds: live.eta?.etaSeconds ?? data.live.etaSeconds, lastSeenAt: point ? new Date(point.at).toISOString() : data.live.lastSeenAt, gpsStale: point ? now - point.at > 120_000 : data.live.gpsStale } : null };
  const attention = attentionOf(merged, now);
  const chip = chipOf(merged, now);
  const line = liveLine(merged, now);
  const etaSeconds = merged.live?.etaSeconds ?? null;
  const towing = serviceOf(data.serviceType)?.id === "towing";
  const destination = data.phase === "towing" && data.drop?.lat != null && data.drop.lng != null ? { lat: data.drop.lat, lng: data.drop.lng } : data.location.lat != null && data.location.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null;
  return (
    <div className={`am-card${attention ? " is-risk" : ""}`} data-testid={`watch-card-${requestId}`}>
      <div className="am-card-map">
        {destination ? (
          <LiveTrackingMap
            variant="mini"
            className="am-map-canvas"
            techLocation={point ? { lat: point.lat, lng: point.lng } : null}
            userLocation={data.location.lat != null && data.location.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null}
            routeDestination={point ? destination : null}
            showRoutePath={Boolean(point)}
            showStatusOverlay={false}
            eta={etaSeconds != null ? minutesLabel(etaSeconds) ?? undefined : undefined}
            status={data.status}
            technicianVehicle={towing ? "tow" : "bike"}
            userLabel={data.customer.name}
            trackingSessionId={requestId}
          />
        ) : null}
      </div>
      <div className="am-card-body">
        <div>
          <b>#{requestId} · {service(data.serviceType)}</b>
          <span className="am-live-txt">{data.technician ? `${data.technician.name} → ${data.customer.name}` : `Finding a technician for ${data.customer.name}`}</span>
          <span className={chip.cls}>
            <MaterialSymbol name={chip.icon} />
            {chip.label}
          </span>
        </div>
        <div className="am-card-big">
          <b className={attention ? "is-warn" : ""}>{etaSeconds != null ? minutesLabel(etaSeconds) : line.main.split(" · ")[0]}</b>
          <span>{etaSeconds != null ? `arrives ${clock(now + etaSeconds * 1000)}` : point ? `seen ${ago(point.at, now)}` : line.sub}</span>
        </div>
        <div className="am-card-acts">
          <button type="button" className="am-btn" onClick={onOpen}>Open</button>
          <button type="button" className="am-btn is-icon" aria-label={`Unpin #${requestId}`} onClick={onRemove}>
            <MaterialSymbol name="close" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WatchListPage() {
  const now = useNow(1000);
  const queryClient = useQueryClient();
  const watch = useWatchList();
  const [openId, setOpenId] = useState<number | null>(null);
  const [sound, setSound] = useState(() => {
    try {
      return window.localStorage.getItem(SOUND_KEY) === "on";
    } catch {
      return false;
    }
  });
  const listRef = useRef(watch.list);
  listRef.current = watch.list;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useAdminEvents((event, data) => {
    const id = Number((data as { requestId?: unknown } | null)?.requestId);
    if (id && listRef.current.includes(id)) {
      void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "request", id] });
      if (soundRef.current && event === "admin:command_center_alert") beep();
    }
  });

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // Not remembered on this computer.
    }
    if (next) beep();
  };

  return (
    <div className="am" data-testid="watch-list">
      <div className="am-bar">
        <p className="am-lead">{watch.list.length} of {WATCH_LIMIT} pinned. Pin jobs from <Link to="/admin/live">Live requests</Link>.</p>
        <button type="button" className={`am-btn${sound ? " is-pinned" : ""}`} aria-pressed={sound} onClick={toggleSound}>
          <MaterialSymbol name={sound ? "volume_up" : "volume_off"} />
          {sound ? "Sound on for new alerts" : "Sound off"}
        </button>
      </div>
      {watch.list.length === 0 ? (
        <div className="am-empty-card">
          <MaterialSymbol name="push_pin" />
          <b>No jobs pinned</b>
          <span>Use the pin on any live request to watch it here, up to {WATCH_LIMIT} at a time.</span>
        </div>
      ) : (
        <div className="am-grid">
          {watch.list.map((id) => (
            <WatchCard key={id} requestId={id} now={now} onOpen={() => setOpenId(id)} onRemove={() => watch.remove(id)} />
          ))}
        </div>
      )}
      {openId != null ? <RequestMonitorPanel requestId={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
