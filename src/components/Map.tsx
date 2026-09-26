import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { NearbyMapCanvas, type RadarPin } from "@/components/NearbyMapCanvas";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import {
  CardSkeletons,
  EvCard,
  FuelCard,
  PeekCard,
  PlaceRow,
  RadarMessage,
  StationDetail,
  TechnicianCard,
  TechnicianProfile,
  type RowView,
} from "@/components/radar/RadarParts";
import { placePinHtml, placePinSize, technicianPinHtml, technicianPinSize } from "@/components/radar/pins";
import {
  evRow,
  fuelRow,
  normalizeTechnicians,
  techRow,
  toEvView,
  toFuelView,
  toTechnicianView,
  type Technician,
} from "@/components/radar/radarModel";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiUrl } from "@/lib/api";
import { EV_SEARCH_RADIUS_METERS, EVStationsError, fetchEvStations, formatRadius, nextSearchAnchor } from "@/lib/evCharging";
import { FUEL_SEARCH_RADIUS_METERS, FuelStationsError, fetchFuelStations } from "@/lib/fuelStations";
import { fetchFuelPrices } from "@/lib/homeApi";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const WIDER_RADIUS_METERS = 10_000;

type Layer = "tech" | "ev" | "fuel";
type Snap = "peek" | "normal" | "full";
type Detail = { kind: "tech" | "ev"; id: string } | null;

const LAYERS: Array<{ id: Layer; label: string; icon: string; param: string | null }> = [
  { id: "tech", label: "Technicians", icon: "engineering", param: null },
  { id: "ev", label: "EV charging", icon: "bolt", param: "ev" },
  { id: "fuel", label: "Fuel", icon: "local_gas_station", param: "fuel" },
];

// Phone layout: the sheet sits under the header and legend and slides between three heights.
const SHEET_TOP = 132;
const NAV_CLEARANCE = 92;
const VISIBLE: Record<Exclude<Snap, "full">, number> = { peek: 104 + NAV_CLEARANCE, normal: 292 + NAV_CLEARANCE };
const HEADER_CLEARANCE = 150;

const layerFromParam = (value: string | null): Layer => (value === "ev" ? "ev" : value === "fuel" ? "fuel" : "tech");

async function fetchTechnicians(lat: number, lng: number, signal?: AbortSignal): Promise<Technician[]> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("resqnow_user_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Storage can be unavailable; nearby technicians don't need a login.
  }
  const response = await fetch(apiUrl(`/api/technicians/nearby?lat=${lat}&lng=${lng}`), { headers, signal });
  if (!response.ok) throw new Error(`Nearby technicians failed (${response.status})`);
  return normalizeTechnicians(await response.json(), [lat, lng], apiUrl);
}

const RadarMap = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { coordinates, place, loading: locating, requestLocation } = useGeolocation();

  const layer = layerFromParam(searchParams.get("layer"));
  const [snap, setSnap] = useState<Snap>("normal");
  const [detail, setDetail] = useState<Detail>(null);
  const [selected, setSelected] = useState<Record<Layer, string | null>>({ tech: null, ev: null, fuel: null });
  const [radius, setRadius] = useState<Record<"ev" | "fuel", number>>({ ev: EV_SEARCH_RADIUS_METERS, fuel: FUEL_SEARCH_RADIUS_METERS });
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null);
  const [containerHeight, setContainerHeight] = useState(844);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const sheetY = useMotionValue(0);
  const dragControls = useDragControls();
  const tapStart = useRef<{ y: number; t: number } | null>(null);
  const draggable = isMobile;

  useEffect(() => { requestLocation(); }, [requestLocation]);
  // Searches follow the customer, but only after a real move.
  useEffect(() => { setAnchor((current) => nextSearchAnchor(current, coordinates)); }, [coordinates]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setContainerHeight(Math.round(node.getBoundingClientRect().height) || 844);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  const techQuery = useQuery({
    queryKey: ["radar", "technicians", anchor?.lat, anchor?.lng],
    queryFn: ({ signal }) => fetchTechnicians(anchor!.lat, anchor!.lng, signal),
    enabled: anchor !== null,
    staleTime: 60_000,
    retry: 1,
  });
  const evQuery = useQuery({
    queryKey: ["radar", "ev-stations", anchor?.lat, anchor?.lng, radius.ev],
    queryFn: ({ signal }) => fetchEvStations(anchor!, radius.ev, signal),
    enabled: anchor !== null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const fuelQuery = useQuery({
    queryKey: ["radar", "fuel-stations", anchor?.lat, anchor?.lng, radius.fuel],
    queryFn: ({ signal }) => fetchFuelStations(anchor!, radius.fuel, signal),
    enabled: anchor !== null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const priceCoords = anchor ? { lat: Math.round(anchor.lat * 100) / 100, lng: Math.round(anchor.lng * 100) / 100 } : null;
  const pricesQuery = useQuery({
    queryKey: ["radar", "fuel-prices", priceCoords?.lat, priceCoords?.lng],
    queryFn: ({ signal }) => fetchFuelPrices(priceCoords!, signal),
    enabled: priceCoords !== null,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const technicians = useMemo(() => techQuery.data ?? [], [techQuery.data]);
  const techViews = useMemo(() => technicians.map(toTechnicianView), [technicians]);
  const evStations = useMemo(() => evQuery.data?.stations ?? [], [evQuery.data]);
  const evViews = useMemo(() => evStations.map(toEvView), [evStations]);
  const fuelStations = useMemo(() => fuelQuery.data?.stations ?? [], [fuelQuery.data]);
  const prices = pricesQuery.data?.available ? pricesQuery.data.prices : undefined;
  const fuelViews = useMemo(() => fuelStations.map((f) => toFuelView(f, prices)), [fuelStations, prices]);

  const selectedId = (list: Array<{ id: string }>, key: Layer) =>
    (list.some((item) => item.id === selected[key]) ? selected[key] : list[0]?.id) ?? null;
  const techId = selectedId(techViews, "tech");
  const evId = selectedId(evViews, "ev");
  const fuelId = selectedId(fuelViews, "fuel");

  // ---------- Sheet sizes ----------
  const sheetHeight = Math.max(0, containerHeight - SHEET_TOP);
  const offsets = useMemo(() => ({
    full: 0,
    normal: Math.max(0, sheetHeight - VISIBLE.normal),
    peek: Math.max(0, sheetHeight - VISIBLE.peek),
  }), [sheetHeight]);
  const effectiveSnap: Snap = !draggable ? "full" : detail ? "full" : snap;

  useEffect(() => {
    const target = draggable ? offsets[effectiveSnap] : 0;
    if (reduceMotion) { sheetY.set(target); return; }
    const controls = animate(sheetY, target, { type: "spring", stiffness: 380, damping: 38, mass: 0.9 });
    return () => controls.stop();
  }, [draggable, effectiveSnap, offsets, reduceMotion, sheetY]);

  const settle = useCallback((next: Snap) => {
    setSnap(next);
    if (next !== "full") setDetail(null);
  }, []);

  const onDragEnd = (_event: unknown, info: PanInfo) => {
    const projected = sheetY.get() + info.velocity.y * 0.18;
    const next = (["full", "normal", "peek"] as Snap[]).reduce((best, key) =>
      Math.abs(offsets[key] - projected) < Math.abs(offsets[best] - projected) ? key : best, "normal" as Snap);
    // Always settle, even onto the same size, so the sheet springs back into place.
    const target = offsets[next];
    animate(sheetY, target, { type: "spring", stiffness: 380, damping: 38 });
    settle(next);
  };

  const onHandlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    tapStart.current = { y: event.clientY, t: Date.now() };
    if (draggable) dragControls.start(event);
  };
  const cycle = () => settle(effectiveSnap === "peek" ? "normal" : effectiveSnap === "normal" ? "full" : "normal");
  const onHandlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = tapStart.current;
    tapStart.current = null;
    if (draggable && start && Math.abs(event.clientY - start.y) < 6 && Date.now() - start.t < 400) cycle();
  };
  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); cycle(); }
  };

  // ---------- Selection ----------
  const setLayer = (next: Layer) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      const param = LAYERS.find((entry) => entry.id === next)?.param;
      if (param) params.set("layer", param); else params.delete("layer");
      return params;
    }, { replace: true });
    setDetail(null);
    if (snap === "full") setSnap("normal");
  };

  const select = useCallback((key: Layer, id: string, fromMap: boolean) => {
    setSelected((current) => ({ ...current, [key]: id }));
    if (fromMap) {
      setSnap((current) => (current === "full" ? "normal" : current));
      requestAnimationFrame(() => cardRefs.current.get(`${key}:${id}`)?.scrollIntoView?.({ behavior: "smooth", inline: "start", block: "nearest" }));
    }
  }, []);

  const onCardSelect = (key: Layer, id: string, isSelected: boolean) => {
    if (isSelected && (key === "tech" || key === "ev")) { setDetail({ kind: key, id }); return; }
    select(key, id, false);
  };

  const onMapTap = useCallback(() => {
    if (draggable) { setDetail(null); setSnap("peek"); }
  }, [draggable]);

  // ---------- Map ----------
  const userPosition = coordinates ? ([coordinates.lat, coordinates.lng] as [number, number]) : null;
  const mapCenter: [number, number] = userPosition ?? DEFAULT_CENTER;

  const pins: RadarPin[] = useMemo(() => {
    if (layer === "tech") {
      return technicians.map((t) => {
        const view = techViews.find((v) => v.id === t.id)!;
        const on = t.id === techId;
        return {
          id: `tech-${t.id}`, lat: t.latitude, lng: t.longitude, anchor: "bottom" as const, zIndex: on ? 400 : 150,
          html: technicianPinHtml({ name: t.name, photo: view.photo, initials: view.initials, selected: on }),
          ...technicianPinSize(on),
          onClick: () => select("tech", t.id, true),
        };
      });
    }
    const list = layer === "ev" ? evStations : fuelStations;
    return list.flatMap((station) => {
      if (typeof station.latitude !== "number" || typeof station.longitude !== "number") return [];
      const view = layer === "ev" ? evViews.find((v) => v.id === station.id)! : fuelViews.find((v) => v.id === station.id)!;
      const on = station.id === (layer === "ev" ? evId : fuelId);
      const label = layer === "ev"
        ? ((view as ReturnType<typeof toEvView>).kw ? `${(view as ReturnType<typeof toEvView>).kw} kW` : "EV")
        : ((view as ReturnType<typeof toFuelView>).prices[0]?.value ?? "Fuel");
      return [{
        id: `${layer}-${station.id}`, lat: station.latitude, lng: station.longitude, zIndex: on ? 400 : 140,
        html: placePinHtml({ name: station.name, logo: view.logo, initials: view.initials, label, selected: on }),
        ...placePinSize(label, on),
        onClick: () => select(layer, station.id, true),
      }];
    });
  }, [layer, technicians, techViews, techId, evStations, evViews, evId, fuelStations, fuelViews, fuelId, select]);

  const focus: Array<[number, number]> = useMemo(() => {
    if (layer === "tech") {
      const t = technicians.find((x) => x.id === techId);
      return t ? [[t.latitude, t.longitude]] : [];
    }
    const list = layer === "ev" ? evStations : fuelStations;
    const s = list.find((x) => x.id === (layer === "ev" ? evId : fuelId));
    return s && typeof s.latitude === "number" && typeof s.longitude === "number" ? [[s.latitude, s.longitude]] : [];
  }, [layer, technicians, techId, evStations, evId, fuelStations, fuelId]);

  const visibleSheet = draggable ? (effectiveSnap === "full" ? sheetHeight : VISIBLE[effectiveSnap]) : 0;
  const bottomPadding = draggable ? Math.min(visibleSheet, containerHeight - 220) + 12 : 64;

  // ---------- Sheet content ----------
  const counts: Record<Layer, string> = {
    tech: techQuery.data ? String(techViews.length) : "–",
    ev: evQuery.data ? String(evViews.length) : "–",
    fuel: fuelQuery.data ? String(fuelViews.length) : "–",
  };
  const rows: RowView[] = layer === "tech" ? techViews.map(techRow) : layer === "ev" ? evViews.map(evRow) : fuelViews.map(fuelRow);
  const activeId = layer === "tech" ? techId : layer === "ev" ? evId : fuelId;
  const peekRow = rows.find((row) => row.id === activeId) ?? rows[0] ?? null;
  const query = layer === "tech" ? techQuery : layer === "ev" ? evQuery : fuelQuery;
  const loading = locating || (anchor !== null && query.isPending);
  const searchError = query.error instanceof EVStationsError || query.error instanceof FuelStationsError ? query.error.code : null;
  const titles: Record<Layer, [string, string]> = {
    tech: ["Technicians near you", `${techViews.length} online · updated just now`],
    ev: ["EV charging near you", `${evViews.length} stations within ${formatRadius(radius.ev)} · live availability not shared`],
    fuel: ["Fuel pumps near you", `${fuelViews.length} pumps within ${formatRadius(radius.fuel)} · city prices today`],
  };
  const detailTech = detail?.kind === "tech" ? techViews.find((t) => t.id === detail.id) : undefined;
  const detailEv = detail?.kind === "ev" ? evViews.find((e) => e.id === detail.id) : undefined;
  const notConfigured = searchError === "ev_search_unavailable" || searchError === "fuel_search_unavailable";

  const listBody = () => {
    if (!coordinates && !locating) {
      return (
        <RadarMessage
          icon="location_off"
          title="See help, charging and fuel near you"
          body="Turn on location and Live radar shows technicians, EV charging stations and fuel pumps around you."
          action={<button type="button" className="rq-h-btn rq-h-btn-block rq-press" onClick={requestLocation}><MaterialSymbol name="my_location" />Turn on location</button>}
        />
      );
    }
    if (loading) {
      return (
        <>
          <p className="rqr-searching"><span className="rq-h-live-dot" aria-hidden="true" />{layer === "tech" ? "Finding technicians near you…" : layer === "ev" ? `Finding charging stations within ${formatRadius(radius.ev)}…` : `Finding fuel pumps within ${formatRadius(radius.fuel)}…`}</p>
          <CardSkeletons />
        </>
      );
    }
    if (query.isError) {
      const what = layer === "tech" ? "technicians" : layer === "ev" ? "chargers" : "fuel pumps";
      return (
        <RadarMessage
          tone="error"
          icon="error"
          title={`Couldn’t load ${what}`}
          body={notConfigured ? "This search isn’t switched on yet. Other categories still work." : "Something went wrong on our side. The other categories still work."}
          action={<button type="button" className="rq-h-btn rq-h-btn-block rq-press" onClick={() => void query.refetch()}><MaterialSymbol name="refresh" />Try again</button>}
        />
      );
    }
    if (rows.length === 0) {
      if (layer === "tech") {
        return <RadarMessage icon="engineering" title="No technicians online nearby" body="Partners come online through the day. Check again in a few minutes." />;
      }
      const key = layer;
      const wider = radius[key] < WIDER_RADIUS_METERS;
      return (
        <RadarMessage
          icon={layer === "ev" ? "ev_station" : "local_gas_station"}
          title={`No ${layer === "ev" ? "chargers" : "fuel pumps"} within ${formatRadius(radius[key])}`}
          body={`Mappls has no ${layer === "ev" ? "charging stations" : "fuel pumps"} listed near you yet.`}
          action={wider ? <button type="button" className="rqr-btn-outline rq-press" onClick={() => setRadius((r) => ({ ...r, [key]: WIDER_RADIUS_METERS }))}>Search within {formatRadius(WIDER_RADIUS_METERS)}</button> : undefined}
        />
      );
    }
    return (
      <>
        <div className="rqr-carousel" role="list" aria-label={titles[layer][0]}>
          {layer === "tech" && techViews.map((t) => (
            <TechnicianCard key={t.id} ref={(node) => { if (node) cardRefs.current.set(`tech:${t.id}`, node); }} technician={t} selected={t.id === techId} onSelect={() => onCardSelect("tech", t.id, t.id === techId)} />
          ))}
          {layer === "ev" && evViews.map((e) => (
            <EvCard key={e.id} ref={(node) => { if (node) cardRefs.current.set(`ev:${e.id}`, node); }} station={e} selected={e.id === evId} onSelect={() => onCardSelect("ev", e.id, e.id === evId)} />
          ))}
          {layer === "fuel" && fuelViews.map((f) => (
            <FuelCard key={f.id} ref={(node) => { if (node) cardRefs.current.set(`fuel:${f.id}`, node); }} station={f} selected={f.id === fuelId} onSelect={() => onCardSelect("fuel", f.id, f.id === fuelId)} />
          ))}
        </div>
        <section className="rqr-all" aria-label="Everything nearby">
          <p className="rqr-all__title"><span>{layer === "tech" ? "All technicians" : layer === "ev" ? "All charging stations" : "All fuel pumps"}</span><span>Nearest first</span></p>
          {rows.map((row) => <PlaceRow key={row.id} row={row} onSelect={() => { select(layer, row.id, false); settle("normal"); }} />)}
        </section>
        {layer === "ev" ? <p className="rqr-foot">Station details from Mappls. Directions open in Google Maps.</p> : null}
        {layer === "fuel" ? <p className="rqr-foot">Prices are today’s city prices for {pricesQuery.data?.location?.area || "your area"}. Directions open in Google Maps.</p> : null}
      </>
    );
  };

  const placeTitle = coordinates ? place?.title || "Your location" : locating ? "Finding your location…" : "Location off";
  const placeSub = coordinates ? "Live radar · nearby now" : "Turn on location to see what’s near you";

  return (
    <div ref={containerRef} className="rqr">
      <div className="rqr-map">
        <NearbyMapCanvas
          center={mapCenter}
          userPosition={userPosition}
          pins={pins}
          focus={focus}
          topPadding={HEADER_CLEARANCE}
          bottomPadding={bottomPadding}
          rightPadding={isMobile ? 32 : 450}
          onMapTap={onMapTap}
          onUnavailable={() => setSnap("normal")}
          ariaLabel={`Map of ${LAYERS.find((entry) => entry.id === layer)?.label.toLowerCase()} near you`}
        />
      </div>

      <header className="rqr-hdr">
        <span className="rqr-hdr__pin" aria-hidden="true"><MaterialSymbol name={coordinates ? "near_me" : "location_off"} /></span>
        <button type="button" className="rqr-hdr__loc rq-press" onClick={requestLocation} aria-label={`Your location: ${placeTitle}. Tap to refresh.`}>
          <span className="rqr-hdr__place">{placeTitle}<MaterialSymbol name="keyboard_arrow_down" /></span>
          <span className="rqr-hdr__sub">{coordinates ? <span className="rq-h-live-dot" aria-hidden="true" /> : null}{placeSub}</span>
        </button>
        <span className="rqr-hdr__div" aria-hidden="true" />
        <img className="rqr-hdr__logo" src="/images/resqnow-wordmark.png" alt="ResQNow" />
      </header>

      <div className="rqr-legend" role="tablist" aria-label="Show on the map">
        {LAYERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={layer === entry.id}
            className={cn("rqr-lg rq-press", layer === entry.id && "is-on")}
            onClick={() => setLayer(entry.id)}
          >
            <MaterialSymbol name={entry.icon} className="rqr-lg__icon" />
            {entry.label}
            <span className="rqr-lg__n">{counts[entry.id]}</span>
          </button>
        ))}
      </div>

      {draggable && effectiveSnap !== "full" ? (
        <button
          type="button"
          className="rqr-locate rq-press"
          style={{ bottom: visibleSheet + 12 }}
          onClick={requestLocation}
          disabled={locating}
          aria-label="Use my current location"
        >
          <MaterialSymbol name="my_location" className={cn(locating && "rqr-spin")} />
        </button>
      ) : null}

      <motion.section
        className={cn("rqr-sheet", !draggable && "is-panel")}
        aria-label={LAYERS.find((entry) => entry.id === layer)?.label}
        style={draggable ? { y: sheetY, top: SHEET_TOP } : undefined}
        drag={draggable ? "y" : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: offsets.peek }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        data-snap={effectiveSnap}
      >
        <div className="rqr-drag" onPointerDown={onHandlePointerDown} onPointerUp={onHandlePointerUp}>
          {draggable ? (
            <button type="button" className="rqr-grab" aria-label="Resize the panel" onKeyDown={onHandleKey}><span /></button>
          ) : null}
          {effectiveSnap === "peek" && peekRow && coordinates ? (
            <PeekCard row={peekRow} />
          ) : !detail ? (
            <div className="rqr-head">
              <h2 className="rqr-title pj">{titles[layer][0]}</h2>
              <p className="rqr-sub"><span className="rq-h-live-dot" aria-hidden="true" />{coordinates && !loading && !query.isError ? titles[layer][1] : "Live radar"}</p>
            </div>
          ) : null}
        </div>
        <div className={cn("rqr-body", effectiveSnap === "peek" && coordinates && "is-tucked")} aria-hidden={effectiveSnap === "peek" && coordinates ? true : undefined}>
          {detailTech ? <TechnicianProfile technician={detailTech} onClose={() => settle("normal")} /> : null}
          {detailEv ? <StationDetail station={detailEv} onClose={() => settle("normal")} /> : null}
          {!detailTech && !detailEv ? listBody() : null}
        </div>
      </motion.section>
    </div>
  );
};

export default RadarMap;
