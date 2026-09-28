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

/** The request form after the vehicle type (/request-service/towing/car): full screen with its own top bar. */
export const isServiceRequestFormPath = (pathname: string) =>
  /^\/request-service\/[^/]+\/(car|bike|commercial|ev)\/?$/.test(pathname);

/** My garage is a full page with its own back button (/my-garage and /my-garage/add). */
export const isGaragePath = (pathname: string) => /^\/my-garage(\/|$)/.test(pathname);

export const isTrackingExperiencePath = (pathname: string) =>
  TRACKING_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export const shouldHideSupportSurfaces = (pathname: string) =>
  isLiveMapPath(pathname) ||
  isServiceRequestFlowPath(pathname) ||
  isTrackingExperiencePath(pathname) ||
  isGaragePath(pathname);
