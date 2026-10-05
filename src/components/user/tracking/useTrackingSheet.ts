import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { animate, useDragControls, useMotionValue, useTransform, type PanInfo } from "framer-motion";

/** The card's three sizes: details open, the card as it opens, and the strip that leaves the map free. */
export type TrackingSheetSnap = "expanded" | "half" | "collapsed";

const HANDLE_HEIGHT = 30;
// Used until the card and strip have been measured on screen.
const DEFAULT_CARD_HEIGHT = 300;
const DEFAULT_STRIP_HEIGHT = 92;
const DEFAULT_TOP_INSET = 72;
const GAP_BELOW_TOP_BAR = 14;

/** The height of an element, kept up to date as its content changes. */
function useMeasuredHeight(fallback: number) {
  const [height, setHeight] = useState(fallback);
  const node = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    node.current = element;
    if (!element) return;
    const read = () => {
      const next = Math.round(element.offsetHeight);
      if (next > 0) setHeight(next);
    };
    read();
    if (typeof ResizeObserver !== "undefined") {
      observer.current = new ResizeObserver(read);
      observer.current.observe(element);
    }
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return { height, ref, node };
}

type Options = {
  /** False on wide screens, where the card sits beside the map and does not move. */
  enabled: boolean;
  viewportHeight: number;
  /** False on the screens that need an answer (rating, closed, cancelled): one size only. */
  canResize: boolean;
  reduceMotion: boolean;
};

/**
 * Moves the tracking card between its sizes. The card follows the finger while it is
 * dragged and settles on the nearest size; each size is placed from the card's own
 * measured height, so it always ends exactly on the bottom edge of the screen.
 */
export function useTrackingSheet({ enabled, viewportHeight, canResize, reduceMotion }: Options) {
  const sheetY = useMotionValue(0);
  const dragControls = useDragControls();
  const [wanted, setWanted] = useState<TrackingSheetSnap>("half");
  const snap: TrackingSheetSnap = canResize ? wanted : "half";

  const card = useMeasuredHeight(DEFAULT_CARD_HEIGHT);
  const strip = useMeasuredHeight(DEFAULT_STRIP_HEIGHT);
  const detailsNode = useRef<HTMLDivElement | null>(null);
  const scrollNode = useRef<HTMLDivElement | null>(null);
  const topBarNode = useRef<HTMLDivElement | null>(null);
  const [topInset, setTopInset] = useState(DEFAULT_TOP_INSET);

  // The open card stops just under the Back and SOS buttons, wherever the status bar puts them.
  useLayoutEffect(() => {
    if (!enabled || !topBarNode.current) return;
    const bottom = Math.round(topBarNode.current.getBoundingClientRect().bottom);
    if (bottom > 0) setTopInset(bottom + GAP_BELOW_TOP_BAR);
  }, [enabled, viewportHeight]);

  const expandedY = Math.max(0, Math.min(topInset, viewportHeight - 240));
  const sheetHeight = Math.max(0, viewportHeight - expandedY);
  const cardVisible = Math.min(sheetHeight, HANDLE_HEIGHT + card.height);
  const halfY = viewportHeight - cardVisible;
  const stripVisible = Math.min(cardVisible, HANDLE_HEIGHT + strip.height);
  const collapsedY = canResize ? viewportHeight - stripVisible : halfY;
  const topY = canResize ? expandedY : halfY;
  const targetY = snap === "expanded" ? topY : snap === "collapsed" ? collapsedY : halfY;

  const dragging = useRef(false);
  const justDragged = useRef(false);
  const entered = useRef(false);

  useEffect(() => {
    if (!enabled || viewportHeight <= 0 || dragging.current) return;
    if (!entered.current) {
      // The card rises from below the screen the first time it is shown.
      entered.current = true;
      sheetY.set(viewportHeight);
    }
    if (reduceMotion) {
      sheetY.set(targetY);
      return;
    }
    const controls = animate(sheetY, targetY, { type: "spring", stiffness: 380, damping: 34 });
    return () => controls.stop();
  }, [enabled, reduceMotion, sheetY, targetY, viewportHeight]);

  // Only the part of the sheet that is showing can be reached by keyboard or screen reader.
  useEffect(() => {
    card.node.current?.toggleAttribute("inert", snap === "collapsed");
    strip.node.current?.toggleAttribute("inert", snap !== "collapsed");
    detailsNode.current?.toggleAttribute("inert", snap !== "expanded");
  });

  useEffect(() => {
    if (snap !== "expanded" && scrollNode.current) scrollNode.current.scrollTop = 0;
  }, [snap]);

  const stops = useRef({ halfY, collapsedY });
  stops.current = { halfY, collapsedY };
  // 0 while the card is at its own size, 1 when it has become the strip.
  const stripMix = useTransform(sheetY, (y) => {
    const span = stops.current.collapsedY - stops.current.halfY;
    return span > 0 ? Math.max(0, Math.min(1, (y - stops.current.halfY) / span)) : 0;
  });
  // The card's text fades out first, then the strip fades in, so the two never overlap.
  const cardOpacity = useTransform(stripMix, (mix) => Math.max(0, 1 - mix * 1.8));
  const stripOpacity = useTransform(stripMix, (mix) => Math.max(0, (mix - 0.45) * 1.82));
  // The map ends a little under the sheet's rounded corners.
  const mapHeight = useTransform(sheetY, (y) => Math.max(160, y + 32));

  const snapTo = useCallback((next: TrackingSheetSnap) => setWanted(next), []);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (enabled && canResize) dragControls.start(event);
    },
    [canResize, dragControls, enabled],
  );

  const onDragStart = useCallback(() => {
    dragging.current = true;
  }, []);

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      dragging.current = false;
      // The tap that ends a drag must not also count as a tap on the handle.
      justDragged.current = true;
      window.setTimeout(() => {
        justDragged.current = false;
      }, 60);

      // Where the card would come to rest if it kept its speed for a moment.
      const resting = sheetY.get() + info.velocity.y * 0.2;
      const candidates: Array<[TrackingSheetSnap, number]> = [
        ["half", halfY],
        ["expanded", topY],
        ["collapsed", collapsedY],
      ];
      const [next, y] = candidates.reduce((best, stop) =>
        Math.abs(resting - stop[1]) < Math.abs(resting - best[1]) ? stop : best,
      );
      setWanted(next);
      if (reduceMotion) sheetY.set(y);
      else animate(sheetY, y, { type: "spring", stiffness: 380, damping: 34 });
    },
    [collapsedY, halfY, reduceMotion, sheetY, topY],
  );

  /** A tap on the handle steps up one size; from the top it steps back down. */
  const stepFromHandle = useCallback(() => {
    if (justDragged.current) return;
    setWanted((current) => (current === "half" ? "expanded" : "half"));
  }, []);

  const toggleDetails = useCallback(() => {
    if (justDragged.current) return;
    setWanted((current) => (current === "expanded" ? "half" : "expanded"));
  }, []);

  const showCard = useCallback(() => {
    if (justDragged.current) return;
    setWanted("half");
  }, []);

  return {
    snap,
    sheetY,
    mapHeight,
    cardOpacity,
    stripOpacity,
    sheetHeight,
    /** The whole sheet scrolls once details are open, or when the card alone is taller than the screen. */
    scrollable: snap === "expanded" || halfY <= expandedY,
    dragControls,
    dragConstraints: { top: topY, bottom: collapsedY },
    onDragStart,
    onDragEnd,
    startDrag,
    snapTo,
    stepFromHandle,
    toggleDetails,
    showCard,
    cardRef: card.ref,
    stripRef: strip.ref,
    detailsRef: detailsNode,
    scrollRef: scrollNode,
    topBarRef: topBarNode,
  };
}
