const TRACKING_ROUTE_PREFIXES = [
  "/request-service-tracking/",
  "/service-tracking/",
  "/payment/",
  "/service-summary/",
];

export const isLiveMapPath = (pathname: string) => pathname === "/map";

export const isServiceRequestFlowPath = (pathname: string) =>
  pathname.startsWith("/request-service/") && !pathname.startsWith("/request-service-tracking/");

/** The first step of a service request, where the customer picks a vehicle type. */
export const isVehicleSelectionPath = (pathname: string) =>
  /^\/request-service\/[^/]+\/?$/.test(pathname);

export const isTrackingExperiencePath = (pathname: string) =>
  TRACKING_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export const shouldHideSupportSurfaces = (pathname: string) =>
  isLiveMapPath(pathname) || isServiceRequestFlowPath(pathname) || isTrackingExperiencePath(pathname);
