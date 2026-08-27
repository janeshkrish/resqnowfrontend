export type TrackingMapMode = "map" | "balanced" | "sheet";

export function trackingMapModeFromSheetSnap(
  snap: "expanded" | "half" | "collapsed",
): TrackingMapMode {
  if (snap === "expanded") return "sheet";
  if (snap === "collapsed") return "map";
  return "balanced";
}
