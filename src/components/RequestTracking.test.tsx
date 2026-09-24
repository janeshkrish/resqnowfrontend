import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import RequestTracking from "./RequestTracking";

const trackingHarness = vi.hoisted(() => ({
  technician: {} as Record<string, unknown>,
  request: {} as Record<string, unknown>,
  mapProps: null as Record<string, unknown> | null,
  refresh: vi.fn(),
}));

const viewportHarness = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/hooks/useRealtimeServiceRequest", () => ({
  useRealtimeServiceRequest: () => ({
    request: trackingHarness.request,
    technician: trackingHarness.technician,
    isLoading: false,
    isConnected: true,
    refresh: trackingHarness.refresh,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewportHarness.isMobile,
}));

vi.mock("@/hooks/usePricingConfig", () => ({
  usePricingConfig: () => ({ data: { currency: "INR" } }),
}));

vi.mock("@/components/user/LiveTrackingMap", () => ({
  default: (props: Record<string, unknown>) => {
    trackingHarness.mapProps = props;
    return null;
  },
}));

vi.mock("@/components/payments/PaymentSummaryDialog", () => ({
  PaymentSummaryDialog: () => null,
}));

vi.mock("./ui/avatar", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  AvatarImage: () => null,
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("RequestTracking live metrics", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    viewportHarness.isMobile = false;
    trackingHarness.mapProps = null;
    trackingHarness.refresh.mockReset();
    trackingHarness.request = {
      id: "request-1",
      isTowing: false,
      user_id: "user-1",
      status: "en-route",
      service_type: "puncture",
      address: "Customer location",
      location_lat: 0,
      location_lng: 0,
      created_at: "2026-09-15T00:00:00.000Z",
      payment_status: "pending",
      price: 500,
    };
    trackingHarness.technician = {
      id: "technician-1",
      name: "Test Technician",
      phone: "9999999999",
      rating: 4.8,
      completedJobs: 10,
      location_lat: 0,
      location_lng: 0.01,
      routeDistanceKm: 12.3,
      routeEtaMinutes: 17,
      routeEtaText: "17 min",
      routeEtaSource: "mappls",
      routeRequestId: "request-1",
      routeLocationLat: 0,
      routeLocationLng: 0.01,
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderTracking = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    await waitFor(() => expect(trackingHarness.mapProps).not.toBeNull());
  };

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("prefers fresh server route distance and ETA over Haversine estimates", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackingHarness.mapProps).not.toBeNull();
    expect(trackingHarness.mapProps).toMatchObject({
      eta: "17 min",
        distanceLabel: "12.3 km away",
        showRoutePath: true,
        routeDestination: { lat: 0, lng: 0 },
        trackingSessionId: "request-1",
      });
  });

  it("passes canonical motion and freshness fields through to the live map", async () => {
    trackingHarness.technician = {
      ...trackingHarness.technician,
      speed: 8,
      heading: 91,
      accuracy: 7,
      locationUpdatedAt: 1_789_729_200_000,
      sequenceId: 88,
    };

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({
      technicianSpeed: 8,
      technicianHeading: 91,
      technicianAccuracy: 7,
      technicianRecordedAt: 1_789_729_200_000,
      technicianSequenceId: 88,
      trackingFreshness: "LIVE",
    });
  });

  it("retains the Haversine and flat-speed fallback before route metrics arrive", async () => {
    trackingHarness.technician = {
      id: "technician-1",
      name: "Test Technician",
      phone: "9999999999",
      rating: 4.8,
      completedJobs: 10,
      location_lat: 0,
      location_lng: 0.01,
    };

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackingHarness.mapProps).not.toBeNull();
    expect(trackingHarness.mapProps).toMatchObject({
      eta: "3 min",
      distanceLabel: "1.1 km away",
    });
  });

  it("ignores route metrics from a different request", async () => {
    trackingHarness.technician.routeRequestId = "request-0";

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackingHarness.mapProps).toMatchObject({
      eta: "3 min",
      distanceLabel: "1.1 km away",
    });
  });

  it("uses the fallback until route metrics match the latest technician coordinate", async () => {
    trackingHarness.technician = {
      ...trackingHarness.technician,
      routeLocationLat: 0,
      routeLocationLng: 0.02,
    };

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackingHarness.mapProps).toMatchObject({
      eta: "3 min",
      distanceLabel: "1.1 km away",
    });
  });

  it("switches a towing live route to the drop after the vehicle is loaded", async () => {
    trackingHarness.request = {
      ...trackingHarness.request,
      isTowing: true,
      service_type: "towing",
      status: "vehicle_loaded",
      drop_latitude: 0.02,
      drop_longitude: 0.03,
    };

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/requests/request-1"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(trackingHarness.mapProps).toMatchObject({
      showRoutePath: true,
      routeDestination: { lat: 0.02, lng: 0.03 },
    });
  });

  it("keeps mobile tracking to one redesigned dock when returning from map focus", async () => {
    viewportHarness.isMobile = true;
    await renderTracking();

    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("17 min");
    expect(trackingHarness.mapProps).toMatchObject({
      mapMode: "balanced",
      showStatusOverlay: false,
    });
    expect(screen.queryByRole("button", { name: "Show map focus" })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
    });
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View service details" }));
    });
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "balanced" });
    expect(screen.queryByText("Journey progress")).not.toBeInTheDocument();
    expect(screen.getAllByText("Test Technician")).toHaveLength(1);
  });

  it("wires the mobile dock and floating SOS control to the existing request actions", async () => {
    viewportHarness.isMobile = true;
    await renderTracking();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh live tracking" }));
    });
    expect(trackingHarness.refresh).toHaveBeenCalledOnce();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open emergency support" }));
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("Emergency & support");
    expect(screen.getByRole("link", { name: "Open emergency assistance" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "Contact ResQNow support" })).toHaveAttribute("href", "/contact");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open SOS support" }));
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("Emergency & support");
  });

  it("keeps payment reachable in map focus without forcing the details sheet", async () => {
    viewportHarness.isMobile = true;
    trackingHarness.request = {
      ...trackingHarness.request,
      status: "payment_pending",
      payment_status: "pending",
    };
    await renderTracking();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
    });
    expect(screen.getByRole("button", { name: /Pay INR .* online/ })).toBeInTheDocument();
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });
  });

  it("keeps the desktop tracking hierarchy when the mobile viewport flag is false", async () => {
    await renderTracking();

    expect(screen.queryByTestId("mobile-tracking-summary")).not.toBeInTheDocument();
    expect(trackingHarness.mapProps).toMatchObject({ showRoutePath: true });
  });
});
