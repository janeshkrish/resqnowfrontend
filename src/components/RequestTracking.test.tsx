import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  trackingFreshness: undefined as string | undefined,
  isLoading: false,
}));

const viewportHarness = vi.hoisted(() => ({ isMobile: false }));

const nearbyHarness = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  result: undefined as Array<{ id: string; lat: number; lng: number }> | undefined,
}));

const roadEta = (overrides: Record<string, unknown> = {}) => ({
  requestId: "request-1",
  etaSeconds: 17 * 60,
  distanceMeters: 12_300,
  trafficAware: true,
  provider: "mappls",
  calculatedAt: Date.now(),
  receivedAt: Date.now(),
  destinationLat: 0,
  destinationLng: 0,
  ...overrides,
});

vi.mock("@/hooks/useRealtimeServiceRequest", () => ({
  useRealtimeServiceRequest: () => ({
    request: trackingHarness.request,
    technician: trackingHarness.technician,
    isLoading: trackingHarness.isLoading,
    isConnected: true,
    trackingFreshness: trackingHarness.trackingFreshness,
    refresh: trackingHarness.refresh,
  }),
}));

vi.mock("@/hooks/useNearbySearchTechnicians", () => ({
  useNearbySearchTechnicians: (options: Record<string, unknown>) => {
    nearbyHarness.options = options;
    return options.enabled ? nearbyHarness.result : undefined;
  },
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
    nearbyHarness.options = null;
    nearbyHarness.result = undefined;
    trackingHarness.isLoading = false;
    sessionStorage.clear();
    trackingHarness.mapProps = null;
    trackingHarness.refresh.mockReset();
    trackingHarness.trackingFreshness = undefined;
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
      liveEta: roadEta(),
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

  describe("while a technician is being found", () => {
    const search = (overrides: Record<string, unknown> = {}) => {
      trackingHarness.technician = null as unknown as Record<string, unknown>;
      trackingHarness.request = {
        ...trackingHarness.request,
        status: "pending",
        service_type: "car-towing",
        vehicle_type: "car",
        location_lat: 11.0168,
        location_lng: 76.9558,
        ...overrides,
      };
    };
    const renderFrom = async (entry: string | { pathname: string; state: unknown }) => {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/requests/:requestId" element={<RequestTracking />} />
            </Routes>
          </MemoryRouter>,
        );
      });
      await waitFor(() => expect(trackingHarness.mapProps).not.toBeNull());
    };

    it("shows the search card for the service, with where help is going and Cancel", async () => {
      viewportHarness.isMobile = true;
      search();
      await renderTracking();

      const card = screen.getByTestId("tracking-card");
      expect(card).toHaveAttribute("data-phase", "search");
      expect(screen.getByTestId("tracking-big")).toHaveTextContent("Finding a tow truck nearby");
      const lines = within(screen.getByTestId("tracking-finding-lines")).getAllByText(/./);
      expect(lines.map((line) => line.textContent)).toEqual(["Contacting tow operators near you", "Waiting for one of them to accept"]);
      expect(screen.getByTestId("tracking-trip")).toHaveTextContent("Customer location");
      // The service is named on its own: the row beneath already says what kind of vehicle it is.
      expect(within(screen.getByTestId("tracking-request")).getByText("Towing")).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Cancel request" })).toBeInTheDocument();
    });

    it("leaves where help is going to the details beside the card on a wide screen", async () => {
      search();
      await renderTracking();

      expect(screen.getByTestId("tracking-big")).toHaveTextContent("Finding a tow truck nearby");
      expect(screen.queryByTestId("tracking-trip")).toBeNull();
      expect(screen.getByTestId("tracking-details")).toHaveTextContent("Customer location");
    });

    it("asks who is nearby for this service and vehicle, and gives them to the map", async () => {
      search();
      nearbyHarness.result = [{ id: "21", lat: 11.02, lng: 76.96 }];
      await renderTracking();

      expect(nearbyHarness.options).toMatchObject({
        enabled: true,
        location: { lat: 11.0168, lng: 76.9558 },
        serviceType: "car-towing",
        vehicleType: "car",
      });
      expect(trackingHarness.mapProps).toMatchObject({ status: "pending", nearbyTechnicians: nearbyHarness.result, nearbyGlyph: "auto_towing" });
    });

    it("stops once a technician has accepted", async () => {
      nearbyHarness.result = [{ id: "21", lat: 11.02, lng: 76.96 }];
      await renderTracking();

      expect(nearbyHarness.options).toMatchObject({ enabled: false });
      expect(trackingHarness.mapProps?.nearbyTechnicians).toBeUndefined();
      expect(screen.getByTestId("tracking-card")).toHaveAttribute("data-phase", "way");
      expect(screen.queryByTestId("tracking-finding-lines")).toBeNull();
    });

    it("plays the request-sent moment once, and only when the page was opened by sending a request", async () => {
      search();
      await renderFrom({ pathname: "/requests/request-1", state: { requestSent: true } });
      const sent = screen.getByTestId("request-sent");
      expect(sent).toHaveTextContent("Request sent");
      expect(sent).toHaveTextContent("Finding a tow truck near you");
      expect(within(screen.getByTestId("request-sent-card")).getByText("Towing")).toBeInTheDocument();

      // The same page again (a reload keeps the note that the request was sent): it does not play twice.
      act(() => root.unmount());
      root = createRoot(container);
      trackingHarness.mapProps = null;
      await renderFrom({ pathname: "/requests/request-1", state: { requestSent: true } });
      expect(screen.queryByTestId("request-sent")).toBeNull();
    });

    it("keeps playing, not starting again, when the request finishes loading under it", async () => {
      search();
      trackingHarness.isLoading = true;
      const tree = () => (
        <MemoryRouter initialEntries={[{ pathname: "/requests/request-1", state: { requestSent: true } }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/requests/:requestId" element={<RequestTracking />} />
          </Routes>
        </MemoryRouter>
      );
      await act(async () => root.render(tree()));
      const whileLoading = screen.getByTestId("request-sent");
      expect(screen.queryByTestId("tracking-card")).toBeNull();

      trackingHarness.isLoading = false;
      await act(async () => root.render(tree()));
      expect(screen.getByTestId("tracking-card")).toBeInTheDocument();
      // The very same element: had it been put up afresh, its animation would have begun again.
      expect(screen.getByTestId("request-sent")).toBe(whileLoading);
    });

    it("does not play it when the page is simply opened", async () => {
      search();
      await renderTracking();
      expect(screen.queryByTestId("request-sent")).toBeNull();
    });
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

  it("shows only an approximate distance, not guessed minutes, before a road ETA arrives", async () => {
    trackingHarness.technician = {
      id: "technician-1",
      name: "Test Technician",
      phone: "9999999999",
      rating: 4.8,
      completedJobs: 10,
      location_lat: 0,
      location_lng: 0.01,
    };

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({
      eta: "On the way",
      distanceLabel: "≈ 1.1 km away",
    });
  });

  it("ignores an ETA from a different request", async () => {
    trackingHarness.technician.liveEta = roadEta({ requestId: "request-0" });

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({
      eta: "On the way",
      distanceLabel: "≈ 1.1 km away",
    });
  });

  it("keeps the road ETA while the technician moves between ETA refreshes", async () => {
    // The ETA was calculated at an earlier coordinate; newer GPS must not
    // swap it for a straight-line guess.
    trackingHarness.technician = {
      ...trackingHarness.technician,
      location_lat: 0.004,
      location_lng: 0.02,
    };

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({
      eta: "17 min",
      distanceLabel: "12.3 km away",
    });
  });

  it("drops an ETA that has gone unrefreshed for too long", async () => {
    trackingHarness.technician.liveEta = roadEta({ receivedAt: Date.now() - 3 * 60_000 - 1_000 });

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({ eta: "On the way" });
  });

  it("ignores an ETA calculated for another destination", async () => {
    trackingHarness.request = {
      ...trackingHarness.request,
      isTowing: true,
      service_type: "towing",
      status: "vehicle_loaded",
      drop_latitude: 0.2,
      drop_longitude: 0.3,
    };

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({ distanceLabel: expect.stringMatching(/^≈ /) });
  });

  it.each([
    [true, "live traffic"],
    [false, "road estimate"],
  ])("says what the minutes are based on (trafficAware=%s)", async (trafficAware, basis) => {
    viewportHarness.isMobile = true;
    trackingHarness.technician.liveEta = roadEta({ trafficAware, provider: trafficAware ? "mappls" : "osrm" });

    await renderTracking();

    const card = screen.getByTestId("tracking-card");
    expect(within(card).getByTestId("tracking-big")).toHaveTextContent("17 min");
    expect(card).toHaveTextContent(/Arrives by \d{1,2}:\d{2} (am|pm)/);
    expect(card).toHaveTextContent(`12.3 km away · ${basis}`);
  });

  it("formats long ETAs in hours", async () => {
    trackingHarness.technician.liveEta = roadEta({ etaSeconds: 95 * 60 });

    await renderTracking();

    expect(trackingHarness.mapProps).toMatchObject({ eta: "1 hr 35 min" });
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

  it("tells the map how much room the card leaves it as the card changes size", async () => {
    viewportHarness.isMobile = true;
    await renderTracking();

    const sheet = screen.getByTestId("tracking-sheet");
    expect(sheet).toHaveAttribute("data-size", "half");
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "balanced", showStatusOverlay: false });
    expect(screen.getAllByText("Test Technician")).toHaveLength(1);

    // Touching the map gives it the screen: the card becomes the strip.
    await act(async () => {
      (trackingHarness.mapProps?.onInteract as () => void)();
    });
    expect(sheet).toHaveAttribute("data-size", "collapsed");
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show the full card" }));
    });
    expect(sheet).toHaveAttribute("data-size", "half");
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "balanced" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    });
    expect(sheet).toHaveAttribute("data-size", "expanded");
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "sheet" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    });
    expect(sheet).toHaveAttribute("data-size", "half");
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "balanced" });
  });

  it("opens this request's safety and help from SOS", async () => {
    viewportHarness.isMobile = true;
    await renderTracking();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open safety and help" }));
    });
    const help = screen.getByRole("dialog", { name: "Safety and help" });
    expect(within(help).getByRole("link", { name: "Open emergency assistance" })).toHaveAttribute("href", "/emergency");
    expect(within(help).getByRole("link", { name: "Contact ResQNow support" })).toHaveAttribute("href", "/contact");
    expect(within(help).getByRole("button", { name: "Share live tracking" })).toBeInTheDocument();
  });

  it("offers Refresh only when the technician's position has stopped arriving", async () => {
    viewportHarness.isMobile = true;
    await renderTracking();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();

    trackingHarness.trackingFreshness = "DELAYED";
    await renderTracking();
    expect(screen.getByRole("status")).toHaveTextContent("Location is delayed. Showing where Test was last seen.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });
    expect(trackingHarness.refresh).toHaveBeenCalledOnce();
  });

  it("keeps payment one tap away when the card is the strip", async () => {
    viewportHarness.isMobile = true;
    trackingHarness.request = {
      ...trackingHarness.request,
      status: "payment_pending",
      payment_status: "pending",
    };
    await renderTracking();

    expect(screen.getByRole("button", { name: /^Pay ₹[\d,.]+ online$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay cash to Test" })).toBeInTheDocument();
    await act(async () => {
      (trackingHarness.mapProps?.onInteract as () => void)();
    });
    expect(screen.getByTestId("tracking-sheet")).toHaveAttribute("data-size", "collapsed");
    expect(screen.getByRole("button", { name: "Pay" })).toBeInTheDocument();
    expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });
  });

  it("keeps one size for the rating, which needs an answer", async () => {
    viewportHarness.isMobile = true;
    trackingHarness.request = { ...trackingHarness.request, status: "paid", payment_status: "completed" };
    await renderTracking();

    expect(screen.getByTestId("tracking-big")).toHaveTextContent("How was Test?");
    await act(async () => {
      (trackingHarness.mapProps?.onInteract as () => void)();
    });
    expect(screen.getByTestId("tracking-sheet")).toHaveAttribute("data-size", "half");
    expect(screen.queryByRole("button", { name: "Open details" })).not.toBeInTheDocument();
  });

  it("puts the card beside the map with its details open on a wide screen", async () => {
    await renderTracking();

    expect(screen.getByTestId("tracking-sheet")).toHaveAttribute("data-size", "open");
    expect(screen.getByTestId("tracking-details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show request details" })).not.toBeInTheDocument();
    expect(trackingHarness.mapProps).toMatchObject({ showRoutePath: true });
  });

  describe("cancelling", () => {
    const cancelButtons = () => screen.queryAllByRole("button", { name: "Cancel request" });

    it.each(["pending", "assigned", "accepted", "technician_assigned"])("is offered while the request is %s", async (status) => {
      trackingHarness.request = { ...trackingHarness.request, status };
      if (status === "pending") trackingHarness.technician = null as unknown as Record<string, unknown>;
      await renderTracking();

      expect(cancelButtons()).toHaveLength(1);
      expect(screen.queryByTestId("tracking-cancel-closed")).not.toBeInTheDocument();
    });

    it.each([
      "en-route", "on_the_way", "en_route_pickup", "arrived", "arrived_pickup", "in-progress", "service_started",
      "vehicle_loaded", "enroute_drop", "arrived_drop",
    ])("is closed, with the reason, once the request is %s", async (status) => {
      trackingHarness.request = { ...trackingHarness.request, status };
      await renderTracking();

      expect(cancelButtons()).toHaveLength(0);
      expect(screen.getByTestId("tracking-cancel-closed")).toHaveTextContent("Cancelling closed when your technician set off.");
    });

    it.each(["payment_pending", "completed", "cancelled"])("is not offered once the request is %s", async (status) => {
      trackingHarness.request = { ...trackingHarness.request, status };
      await renderTracking();

      expect(cancelButtons()).toHaveLength(0);
      expect(screen.queryByTestId("tracking-cancel-closed")).not.toBeInTheDocument();
    });
  });
});
