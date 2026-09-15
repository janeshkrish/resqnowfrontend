import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  mapProps: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/useRealtimeServiceRequest", () => ({
  useRealtimeServiceRequest: () => ({
    request: {
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
    },
    technician: trackingHarness.technician,
    isLoading: false,
    isConnected: true,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
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
    trackingHarness.mapProps = null;
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
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

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
});
