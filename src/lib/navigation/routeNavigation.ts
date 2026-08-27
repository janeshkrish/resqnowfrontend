import type { GeoPoint } from "@/lib/geo";

export type ManeuverKind =
  | "continue"
  | "slight-left"
  | "slight-right"
  | "turn-left"
  | "turn-right"
  | "sharp-left"
  | "sharp-right"
  | "arrive";

export type NavigationInput = {
  current: GeoPoint;
  destination?: GeoPoint;
  route: Array<[number, number]>;
  routeDurationMinutes?: number;
};

export type NavigationProgress = {
  instruction: string;
  maneuver: { kind: ManeuverKind; bearing: number };
  distanceToManeuverMeters: number;
  remainingDistanceMeters: number;
  remainingEtaMinutes: number;
  remainingPolyline: Array<[number, number]>;
  offRoute: boolean;
};

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function bearingDegrees(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function normalizedDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function pointFromTuple(point: [number, number]): GeoPoint {
  return { lat: point[0], lng: point[1] };
}

function collapseRoute(route: Array<[number, number]>) {
  return route.filter((point, index, points) => {
    if (index === 0) return true;
    return distanceMeters(pointFromTuple(points[index - 1]), pointFromTuple(point)) >= 3;
  });
}

function routeLength(route: Array<[number, number]>) {
  return route.slice(1).reduce(
    (sum, point, index) =>
      sum + distanceMeters(pointFromTuple(route[index]), pointFromTuple(point)),
    0,
  );
}

function nearestSegment(current: GeoPoint, route: Array<[number, number]>) {
  const referenceLat = toRadians(current.lat);
  const scaleX = Math.cos(referenceLat) * EARTH_RADIUS_METERS;
  const scaleY = EARTH_RADIUS_METERS;
  const currentX = toRadians(current.lng) * scaleX;
  const currentY = toRadians(current.lat) * scaleY;
  let best = {
    segmentIndex: 0,
    point: pointFromTuple(route[0]),
    distance: Number.POSITIVE_INFINITY,
  };

  route.slice(1).forEach((endTuple, index) => {
    const start = pointFromTuple(route[index]);
    const end = pointFromTuple(endTuple);
    const startX = toRadians(start.lng) * scaleX;
    const startY = toRadians(start.lat) * scaleY;
    const endX = toRadians(end.lng) * scaleX;
    const endY = toRadians(end.lat) * scaleY;
    const dx = endX - startX;
    const dy = endY - startY;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator
      ? Math.max(
          0,
          Math.min(
            1,
            ((currentX - startX) * dx + (currentY - startY) * dy) /
              denominator,
          ),
        )
      : 0;
    const snappedX = startX + fraction * dx;
    const snappedY = startY + fraction * dy;
    const candidate = {
      lat: toDegrees(snappedY / scaleY),
      lng: toDegrees(snappedX / scaleX),
    };
    const distance = distanceMeters(current, candidate);
    if (distance < best.distance) {
      best = { segmentIndex: index, point: candidate, distance };
    }
  });

  return best;
}

function classifyManeuver(delta: number): ManeuverKind {
  const magnitude = Math.abs(delta);
  if (magnitude < 20) return "continue";
  const direction = delta > 0 ? "right" : "left";
  if (magnitude < 45) return `slight-${direction}` as ManeuverKind;
  if (magnitude < 120) return `turn-${direction}` as ManeuverKind;
  return `sharp-${direction}` as ManeuverKind;
}

function instructionFor(kind: ManeuverKind) {
  const instructions: Record<ManeuverKind, string> = {
    continue: "Continue straight",
    "slight-left": "Bear slightly left",
    "slight-right": "Bear slightly right",
    "turn-left": "Turn left",
    "turn-right": "Turn right",
    "sharp-left": "Make a sharp left",
    "sharp-right": "Make a sharp right",
    arrive: "You have arrived",
  };
  return instructions[kind];
}

function etaMinutes(
  remainingMeters: number,
  totalMeters: number,
  routeDurationMinutes?: number,
) {
  const estimate =
    routeDurationMinutes && totalMeters > 0
      ? routeDurationMinutes * (remainingMeters / totalMeters)
      : remainingMeters / 500;
  return Math.max(1, Math.ceil(estimate));
}

export function getNavigationProgress({
  current,
  destination,
  route: rawRoute,
  routeDurationMinutes,
}: NavigationInput): NavigationProgress {
  const route = collapseRoute(rawRoute);

  if (route.length < 2) {
    const endpoint = destination ?? current;
    const remainingDistanceMeters = distanceMeters(current, endpoint);
    return {
      instruction: "Continue toward the destination",
      maneuver: {
        kind: remainingDistanceMeters < 20 ? "arrive" : "continue",
        bearing: bearingDegrees(current, endpoint),
      },
      distanceToManeuverMeters: remainingDistanceMeters,
      remainingDistanceMeters,
      remainingEtaMinutes: etaMinutes(
        remainingDistanceMeters,
        remainingDistanceMeters,
        routeDurationMinutes,
      ),
      remainingPolyline: [
        [current.lat, current.lng],
        [endpoint.lat, endpoint.lng],
      ],
      offRoute: false,
    };
  }

  const nearest = nearestSegment(current, route);
  const remainingPolyline: Array<[number, number]> = [
    [nearest.point.lat, nearest.point.lng],
    ...route.slice(nearest.segmentIndex + 1),
  ];
  const remainingDistanceMeters = routeLength(remainingPolyline);
  const totalMeters = routeLength(route);

  let maneuverKind: ManeuverKind = "arrive";
  let maneuverBearing = bearingDegrees(
    nearest.point,
    pointFromTuple(remainingPolyline[remainingPolyline.length - 1]),
  );
  let distanceToManeuverMeters = remainingDistanceMeters;
  let distanceAlongRoute = distanceMeters(
    nearest.point,
    pointFromTuple(route[nearest.segmentIndex + 1]),
  );

  for (let vertex = nearest.segmentIndex + 1; vertex < route.length - 1; vertex += 1) {
    const incoming = bearingDegrees(
      vertex === nearest.segmentIndex + 1
        ? nearest.point
        : pointFromTuple(route[vertex - 1]),
      pointFromTuple(route[vertex]),
    );
    const outgoing = bearingDegrees(
      pointFromTuple(route[vertex]),
      pointFromTuple(route[vertex + 1]),
    );
    const candidate = classifyManeuver(normalizedDelta(incoming, outgoing));
    if (candidate !== "continue") {
      maneuverKind = candidate;
      maneuverBearing = outgoing;
      distanceToManeuverMeters = distanceAlongRoute;
      break;
    }
    distanceAlongRoute += distanceMeters(
      pointFromTuple(route[vertex]),
      pointFromTuple(route[vertex + 1]),
    );
  }

  if (remainingDistanceMeters < 20) {
    maneuverKind = "arrive";
    distanceToManeuverMeters = remainingDistanceMeters;
  }

  return {
    instruction: instructionFor(maneuverKind),
    maneuver: { kind: maneuverKind, bearing: maneuverBearing },
    distanceToManeuverMeters,
    remainingDistanceMeters,
    remainingEtaMinutes: etaMinutes(
      remainingDistanceMeters,
      totalMeters,
      routeDurationMinutes,
    ),
    remainingPolyline,
    offRoute: nearest.distance > 80,
  };
}
