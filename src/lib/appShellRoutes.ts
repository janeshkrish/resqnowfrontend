const TRACKING_ROUTE_PREFIXES = [
  "/request-service-tracking/",
  "/service-tracking/",
  "/payment/",
  "/service-summary/",
];

export const isLiveMapPath = (pathname: string) => pathname === "/map";

export const isServiceRequestFlowPath = (pathname: string) =>
  pathname.startsWith("/request-service/") && !pathname.startsWith("/request-service-tracking/");

export const isTrackingExperiencePath = (pathname: string) =>
  TRACKING_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export const shouldHideSupportSurfaces = (pathname: string) =>
  isLiveMapPath(pathname) || isServiceRequestFlowPath(pathname) || isTrackingExperiencePath(pathname);
