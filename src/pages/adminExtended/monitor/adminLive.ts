import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import { mergeLiveEta, parseLiveEta, type LiveEta } from "@/lib/liveEta";

// One socket for the admin monitor screens. It joins the admins room on the server, so it
// hears every request change, and it can follow any one request's live-tracking feed.

let shared: Socket | null = null;
let holders = 0;

function acquireSocket(): Socket {
  if (!shared) {
    shared = io(getRequiredApiBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });
  }
  holders += 1;
  return shared;
}

function releaseSocket() {
  holders = Math.max(0, holders - 1);
  if (holders === 0 && shared) {
    shared.disconnect();
    shared = null;
  }
}

/** Every admin event that can change what a request screen shows. */
export const ADMIN_LIVE_EVENTS = [
  "admin:request_event",
  "admin:request_status_updated",
  "admin:request_pricing_updated",
  "admin:payment_update",
  "admin:dispatch_override",
  "admin:technician_update",
  "admin:command_center_alert",
  "admin:command_center_alert_resolved",
  "admin:command_center_cycle",
  "admin:vehicle_loaded",
  "admin:tow_started",
  "admin:arrived_drop",
  "admin:service_completed",
  "admin:payment_pending",
  "admin:job_closed",
];

/** Whether the shared admin socket is connected right now. */
export function useAdminSocketConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = acquireSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    setConnected(socket.connected);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
      releaseSocket();
    };
  }, []);
  return connected;
}

/**
 * Calls `onEvent` for admin events, at most once per `waitMs`: a burst of updates becomes
 * one refresh.
 */
export function useAdminEvents(onEvent: (event: string, data: unknown) => void, waitMs = 600, events: readonly string[] = ADMIN_LIVE_EVENTS) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  useEffect(() => {
    const socket = acquireSocket();
    let timer: number | null = null;
    let last: { event: string; data: unknown } | null = null;
    const listeners = events.map((event) => {
      const listener = (data: unknown) => {
        last = { event, data };
        if (timer != null) return;
        timer = window.setTimeout(() => {
          timer = null;
          if (last) handlerRef.current(last.event, last.data);
        }, waitMs);
      };
      socket.on(event, listener);
      return [event, listener] as const;
    });
    return () => {
      if (timer != null) window.clearTimeout(timer);
      listeners.forEach(([event, listener]) => socket.off(event, listener));
      releaseSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is a module constant at every call site
  }, [waitMs, events.join(",")]);
}

export type LivePoint = { lat: number; lng: number; at: number; speedKmh: number | null; heading: number | null; sequenceId: number | null };
export type RequestLive = { point: LivePoint | null; eta: LiveEta | null; subscribed: boolean; statusChangedAt: number | null };

const finite = (value: unknown) => {
  const n = Number(value);
  return value != null && value !== "" && Number.isFinite(n) ? n : null;
};

/**
 * One request's live feed — the technician's position and ETA, from the same feed the
 * customer's tracking screen uses — plus a tick whenever its status changes.
 */
export function useRequestLive(requestId: number | null, technicianId: number | null): RequestLive {
  const [state, setState] = useState<RequestLive>({ point: null, eta: null, subscribed: false, statusChangedAt: null });
  useEffect(() => {
    setState({ point: null, eta: null, subscribed: false, statusChangedAt: null });
    if (!requestId) return;
    const socket = acquireSocket();
    const id = String(requestId);
    const onLocation = (data: Record<string, unknown> | null) => {
      if (!data || String(data.requestId ?? data.jobId ?? "") !== id) return;
      if (technicianId != null && data.technicianId != null && String(data.technicianId) !== String(technicianId)) return;
      const lat = finite(data.lat);
      const lng = finite(data.lng);
      const at = Date.parse(String(data.recordedAt ?? data.locationUpdatedAt ?? data.receivedAt ?? "")) || Date.now();
      const sequenceId = finite(data.sequenceId);
      const speed = finite(data.speed);
      const incomingEta = parseLiveEta(data, id);
      setState((prev) => {
        const older = prev.point && (at < prev.point.at || (at === prev.point.at && sequenceId != null && prev.point.sequenceId != null && sequenceId < prev.point.sequenceId));
        const point = lat != null && lng != null && !older
          ? { lat, lng, at, speedKmh: speed == null ? null : Math.round(speed * 3.6), heading: finite(data.heading), sequenceId }
          : prev.point;
        return { ...prev, point, eta: mergeLiveEta(prev.eta, incomingEta) };
      });
    };
    const onStatus = (data: Record<string, unknown> | null) => {
      if (!data || String(data.requestId ?? data.jobId ?? "") !== id) return;
      setState((prev) => ({ ...prev, statusChangedAt: Date.now() }));
    };
    const subscribe = () => {
      socket.emit("tracking:subscribe:v1", { requestId }, (ack: { ok?: boolean; location?: Record<string, unknown> | null } | undefined) => {
        setState((prev) => ({ ...prev, subscribed: Boolean(ack?.ok) }));
        if (ack?.ok && ack.location) onLocation(ack.location);
      });
    };
    socket.on("tracking:location:v1", onLocation);
    socket.on("technician:location_update", onLocation);
    socket.on("job:status_update", onStatus);
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    return () => {
      socket.off("tracking:location:v1", onLocation);
      socket.off("technician:location_update", onLocation);
      socket.off("job:status_update", onStatus);
      socket.off("connect", subscribe);
      releaseSocket();
    };
  }, [requestId, technicianId]);
  return state;
}

/** Re-renders every `ms`, for "seen 8 s ago" and running timers. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

const WATCH_KEY = "resqnow_admin_watch_list";
export const WATCH_LIMIT = 4;

/** The pinned requests, kept on this computer for this admin. */
export function readWatchList(): number[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(WATCH_KEY) || "[]");
    return Array.isArray(list) ? list.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, WATCH_LIMIT) : [];
  } catch {
    return [];
  }
}

export function useWatchList() {
  const [list, setList] = useState<number[]>(() => readWatchList());
  const save = (next: number[]) => {
    setList(next);
    try {
      window.localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {
      // Storage refused: the list still works until the page closes.
    }
  };
  const toggle = (id: number) => {
    if (list.includes(id)) {
      save(list.filter((x) => x !== id));
      return { pinned: false, full: false };
    }
    if (list.length >= WATCH_LIMIT) return { pinned: false, full: true };
    save([...list, id]);
    return { pinned: true, full: false };
  };
  return { list, toggle, remove: (id: number) => save(list.filter((x) => x !== id)) };
}
