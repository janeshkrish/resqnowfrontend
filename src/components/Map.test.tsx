import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  geo: {
    coordinates: { lat: 11.0168, lng: 76.9558 } as { lat: number; lng: number } | null,
    place: { title: "Race Course", subtitle: "Coimbatore" } as { title: string; subtitle: string } | null,
    address: null,
    loading: false,
    error: null as string | null,
    errorCode: null,
    requestLocation: vi.fn(),
    reset: vi.fn(),
  },
  mapProps: null as Record<string, unknown> | null,
  evResponse: null as (() => Promise<Response>) | null,
  evCalls: [] as string[],
}));

vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => harness.geo }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/NearbyMapCanvas", () => ({
  NearbyMapCanvas: (props: Record<string, unknown>) => {
    harness.mapProps = props;
    return null;
  },
}));
vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `https://api.test${path}`,
  apiFetch: vi.fn(async (path: string) => {
    harness.evCalls.push(path);
    return harness.evResponse ? harness.evResponse() : new Response("{}", { status: 404 });
  }),
}));

import RadarMap from "./Map";

const technicians = [
  { id: "t1", name: "Squad Recovery Service", service_type: "Towing", distance: 1.4, rating: 4.9, latitude: 11.02, longitude: 76.95, aiRecommended: true },
  { id: "t2", name: "Rapid Battery Care", service_type: "Battery", distance: 2.6, rating: 4.7, latitude: 11.01, longitude: 76.94 },
];

const fullStation = {
  id: "EVA001",
  mapplsPlaceId: "EVA001",
  name: "Tata Power EZ Charge",
  address: "Race Course Road, Coimbatore",
  latitude: 11.0228,
  longitude: 76.9648,
  distance: 1200,
  isOpen: true,
  openingHours: ["06:00-22:00"],
  chargingTypes: ["AC", "DC"],
  connectorTypes: ["CCS2", "Type 2"],
  chargingPower: 60,
  chargingSlots: 4,
  phone: "9876500000",
  availability: { status: "unknown" },
};
const bareStation = {
  id: "EVA002",
  mapplsPlaceId: "EVA002",
  name: "Statiq Charging Hub",
  address: "Avinashi Road, Peelamedu",
  latitude: 11.004,
  longitude: 76.97,
  distance: 2300,
  availability: { status: "unknown" },
};
const unplacedStation = {
  id: "EVA004",
  name: "EV charging point",
  address: "Gandhipuram, Coimbatore",
  latitude: null,
  longitude: null,
  distance: 4100,
  availability: { status: "unknown" },
};

const evOk = (stations: unknown[]) => async () =>
  new Response(JSON.stringify({ source: "mappls", radiusMeters: 5000, stations, total: stations.length, located: stations.length }), { status: 200 });

let currentSearch = "";
function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRadar(path = "/map") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(wrap(<RadarMap mode="page" />));
  return { ...view, rerenderRadar: () => view.rerender(wrap(<RadarMap mode="page" />)) };
}

const openEvLayer = () => fireEvent.click(screen.getByRole("tab", { name: /ev charging/i }));

describe("Live radar", () => {
  beforeEach(() => {
    harness.geo.coordinates = { lat: 11.0168, lng: 76.9558 };
    harness.geo.place = { title: "Race Course", subtitle: "Coimbatore" };
    harness.geo.loading = false;
    harness.geo.error = null;
    harness.geo.requestLocation.mockReset();
    harness.mapProps = null;
    harness.evCalls.length = 0;
    harness.evResponse = evOk([fullStation, bareStation, unplacedStation]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(technicians), { status: 200 })));
  });

  it("opens on technicians near the customer's area, without searching EV stations", async () => {
    renderRadar();

    expect(screen.getByText("Race Course")).toBeInTheDocument();
    const pick = await screen.findByRole("article", { name: "Squad Recovery Service" });
    expect(within(pick).getByText("Best match")).toBeInTheDocument();
    expect(within(pick).getByRole("button", { name: /request service/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rapid battery care/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /technicians/i })).toHaveAttribute("aria-selected", "true");
    expect(harness.mapProps).toMatchObject({ layer: "technicians" });
    expect(harness.evCalls).toHaveLength(0);
  });

  it("shows nearby EV stations from the backend Mappls search with only the details Mappls returned", async () => {
    renderRadar();
    openEvLayer();

    const card = await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    expect(harness.evCalls).toEqual(["/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=5000"]);
    expect(currentSearch).toBe("?layer=ev");
    expect(within(card).getByText("1.2 km away")).toBeInTheDocument();
    expect(within(card).getByText("Open")).toBeInTheDocument();
    expect(within(card).getByText("CCS2 · Type 2")).toBeInTheDocument();
    expect(within(card).getByText("AC · DC")).toBeInTheDocument();
    expect(within(card).getByText("Up to 60 kW")).toBeInTheDocument();
    expect(within(card).getByText("4 charging points")).toBeInTheDocument();
    expect(within(card).getByText("Availability: Unknown")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /call tata power/i })).toHaveAttribute("href", "tel:9876500000");
    expect(harness.mapProps).toMatchObject({ layer: "ev", selectedEvId: "EVA001" });
    expect((harness.mapProps?.evStations as unknown[]).length).toBe(3);
  });

  it("navigates to the selected station's Mappls coordinates in Google Maps", async () => {
    renderRadar("/map?layer=ev");
    const card = await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    const navigate = within(card).getByRole("link", { name: /navigate to tata power ez charge/i });
    expect(navigate).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648");
    expect(navigate).toHaveAttribute("target", "_blank");
  });

  it("does not show empty labels for a station with no charger details", async () => {
    renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });

    fireEvent.click(screen.getByRole("button", { name: /statiq charging hub/i }));
    const card = screen.getByRole("article", { name: "Statiq Charging Hub" });
    expect(within(card).getByText("Operating hours unavailable")).toBeInTheDocument();
    expect(within(card).getByText("Connector information unavailable")).toBeInTheDocument();
    expect(within(card).queryByText(/connectors/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/kw/i)).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /navigate/i })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=11.004%2C76.97",
    );
  });

  it("selects a station from its map marker", async () => {
    renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    act(() => (harness.mapProps?.onSelectEv as (station: unknown) => void)(bareStation));
    // On phones the sheet folds to its summary row so the map stays in view.
    const peek = screen.getByRole("button", { name: /statiq charging hub/i });
    expect(peek).toHaveTextContent("2.3 km away");
    expect(harness.mapProps).toMatchObject({ selectedEvId: "EVA002" });
    fireEvent.click(peek);
    expect(screen.getByRole("article", { name: "Statiq Charging Hub" })).toBeInTheDocument();
  });

  it("sends a station Mappls could not place to Google Maps by name and address", async () => {
    harness.evResponse = evOk([unplacedStation]);
    renderRadar("/map?layer=ev");
    const card = await screen.findByRole("article", { name: "EV charging point" });
    expect(within(card).getByRole("link", { name: /navigate/i })).toHaveAttribute(
      "href",
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("EV charging point, Gandhipuram, Coimbatore")}`,
    );
    expect(within(card).getByText(/no map pin for this station/i)).toBeInTheDocument();
  });

  it("shows loading, empty and error states for EV without breaking technicians", async () => {
    let release!: () => void;
    harness.evResponse = () => new Promise((resolve) => { release = () => resolve(new Response(JSON.stringify({ source: "mappls", radiusMeters: 5000, stations: [], total: 0, located: 0 }), { status: 200 })); });
    renderRadar("/map?layer=ev");
    expect(await screen.findByText("Finding nearby EV charging stations…")).toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByText("No EV charging stations found nearby.")).toBeInTheDocument();
  });

  it("reports an EV search failure and keeps the technician radar working", async () => {
    harness.evResponse = async () => new Response(JSON.stringify({ code: "ev_search_failed" }), { status: 502 });
    renderRadar("/map?layer=ev");
    expect(await screen.findByText("EV charging stations are temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /technicians/i }));
    expect(await screen.findByRole("article", { name: "Squad Recovery Service" })).toBeInTheDocument();
    expect(currentSearch).toBe("");
  });

  it("does not search again for small GPS changes, only after a real move", async () => {
    const view = renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    expect(harness.evCalls).toHaveLength(1);

    harness.geo.coordinates = { lat: 11.0177, lng: 76.9558 }; // ~100 m
    view.rerenderRadar();
    await waitFor(() => expect(harness.evCalls).toHaveLength(1));

    harness.geo.coordinates = { lat: 11.0258, lng: 76.9558 }; // ~1 km
    view.rerenderRadar();
    await waitFor(() => expect(harness.evCalls).toHaveLength(2));
    expect(harness.evCalls[1]).toBe("/api/public/ev-stations?lat=11.0258&lng=76.9558&radius=5000");
  });

  it("asks for location when it is off, from either category", () => {
    harness.geo.coordinates = null;
    harness.geo.place = null;
    harness.geo.error = "Location permission denied. Please enable location access in browser settings.";
    renderRadar("/map?layer=ev");

    expect(screen.getByText("Location is off")).toBeInTheDocument();
    expect(screen.getByText("Turn on location to find chargers near you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(harness.geo.requestLocation).toHaveBeenCalled();
    expect(harness.evCalls).toHaveLength(0);
  });
});
