import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RadarPin } from "@/components/NearbyMapCanvas";

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
  responses: {} as Record<string, () => Promise<Response>>,
  calls: [] as string[],
}));

vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => harness.geo }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/components/NearbyMapCanvas", () => ({
  NearbyMapCanvas: (props: Record<string, unknown>) => {
    harness.mapProps = props;
    return null;
  },
}));
vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `https://api.test${path}`,
  apiFetch: vi.fn(async (path: string) => {
    harness.calls.push(path);
    const route = Object.keys(harness.responses).find((prefix) => path.startsWith(prefix));
    return route ? harness.responses[route]() : new Response("{}", { status: 404 });
  }),
}));

import RadarMap from "./Map";

const technicians = [
  {
    id: "t1", name: "Arun Kumar", service_type: "towing", specialties: ["towing", "flat_tyre"], vehicle_types: ["car", "bike"],
    distance: 1.4, rating: 4.9, jobs_completed: 212, latitude: 11.02, longitude: 76.95, profile_photo: "/uploads/arun.jpg",
  },
  { id: "t2", name: "Priya Motors", service_type: "battery", distance: 2.6, rating: 4.7, jobs_completed: 88, latitude: 11.01, longitude: 76.94 },
];

const fullStation = {
  id: "EVA001",
  mapplsPlaceId: "EVA001",
  name: "Tata Power EZ Charge",
  brand: "tatapower",
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
  name: "Green Plug Point",
  address: "Brookefields Mall, Avinashi Road, Peelamedu",
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

const pumps = [
  { id: "F1", name: "Indian Oil - Sri Balaji Fuels", brand: "indianoil", address: "Trichy Road, Coimbatore", latitude: 11.0101, longitude: 76.9601, distance: 800, isOpen: true, stationTypes: ["petrol"] },
  { id: "F2", name: "Nayara Energy CNG", brand: "nayara", address: "Ukkadam, Coimbatore", latitude: 11.0001, longitude: 76.9611, distance: 1900, stationTypes: ["cng"] },
];

const prices = {
  available: true,
  location: { area: "Coimbatore", state: "Tamil Nadu", scope: "city" },
  prices: [
    { fuel: "petrol", label: "Petrol", price: 101.94, unit: "L", change: 0.14, effectiveDate: "2026-09-27" },
    { fuel: "diesel", label: "Diesel", price: 93.52, unit: "L", change: -0.06, effectiveDate: "2026-09-27" },
    { fuel: "cng", label: "CNG", price: 86.5, unit: "kg", change: 0, effectiveDate: "2026-09-27" },
  ],
};

const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const stationsOk = (stations: unknown[]) => json({ source: "mappls", radiusMeters: 5000, stations, total: stations.length, located: stations.length });

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
  const view = render(wrap(<RadarMap />));
  return { ...view, rerenderRadar: () => view.rerender(wrap(<RadarMap />)) };
}

const pins = () => (harness.mapProps?.pins ?? []) as RadarPin[];
const sheet = (container: HTMLElement) => container.querySelector(".rqr-sheet") as HTMLElement;
const tapHandle = (container: HTMLElement) => {
  const handle = container.querySelector(".rqr-drag") as HTMLElement;
  fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: 500, pointerId: 1 });
};
const callsTo = (prefix: string) => harness.calls.filter((path) => path.startsWith(prefix));

describe("Live radar", () => {
  beforeEach(() => {
    harness.geo.coordinates = { lat: 11.0168, lng: 76.9558 };
    harness.geo.place = { title: "Race Course", subtitle: "Coimbatore" };
    harness.geo.loading = false;
    harness.geo.error = null;
    harness.geo.requestLocation.mockReset();
    harness.mapProps = null;
    harness.calls.length = 0;
    harness.responses = {
      "/api/public/ev-stations": stationsOk([fullStation, bareStation, unplacedStation]),
      "/api/public/fuel-stations": stationsOk(pumps),
      "/api/public/fuel-prices": json(prices),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(technicians), { status: 200 })));
  });

  it("opens on technicians with the ResQNow logo in the header and no way to request from the radar", async () => {
    renderRadar();

    expect(screen.getByText("Race Course")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ResQNow" })).toHaveAttribute("src", "/images/resqnow-wordmark.png");
    expect(screen.queryByRole("link", { name: /sos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /technicians/i })).toHaveAttribute("aria-selected", "true");

    const card = await screen.findByRole("article", { name: "Arun Kumar" });
    expect(card.querySelector(".rqr-card__sub")).toHaveTextContent("Towing");
    expect(within(card).getByText("4.9")).toBeInTheDocument();
    expect(within(card).getByText("212")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Priya Motors" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request|book/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /technicians/i })).toHaveTextContent("2");
    expect(pins().map((pin) => pin.id)).toEqual(["tech-t1", "tech-t2"]);
  });

  it("uses a technician's uploaded photo and initials for those without one", async () => {
    const { container } = renderRadar();
    const card = await screen.findByRole("article", { name: "Arun Kumar" });

    expect(card.querySelector(".rqr-logo img")).toHaveAttribute("src", "https://api.test/uploads/arun.jpg");
    expect(screen.getByRole("article", { name: "Priya Motors" }).querySelector(".rqr-logo")).toHaveTextContent("PM");
    expect(pins()[0].html).toContain('src="https://api.test/uploads/arun.jpg"');
    expect(pins()[1].html).toContain(">PM<");
    expect(container.querySelector(".rqr-pin")).toBeNull();
  });

  it("opens a view-only technician profile from the selected card", async () => {
    renderRadar();
    const card = await screen.findByRole("article", { name: "Arun Kumar" });
    fireEvent.click(within(card).getByRole("button", { name: /open arun kumar's profile/i }));

    const profile = screen.getByRole("region", { name: "Arun Kumar profile" });
    expect(within(profile).getByText("Online now")).toBeInTheDocument();
    expect(within(profile).getByText("Flat Tyre")).toBeInTheDocument();
    expect(within(profile).getByText("Bike")).toBeInTheDocument();
    expect(within(profile).getByText(/to get help, tap get help/i)).toBeInTheDocument();
    expect(within(profile).queryByRole("button", { name: /request|book/i })).not.toBeInTheDocument();

    fireEvent.click(within(profile).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("article", { name: "Arun Kumar" })).toBeInTheDocument();
  });

  it("selects a technician from their map pin", async () => {
    renderRadar();
    await screen.findByRole("article", { name: "Arun Kumar" });

    act(() => pins()[1].onClick?.());
    expect(screen.getByRole("article", { name: "Priya Motors" })).toHaveClass("is-sel");
    expect(screen.getByRole("article", { name: "Arun Kumar" })).not.toHaveClass("is-sel");
    expect(harness.mapProps?.focus).toEqual([[11.01, 76.94]]);
  });

  it("shrinks the sheet when the map is tapped and brings it back when the card is tapped", async () => {
    const { container } = renderRadar();
    await screen.findByRole("article", { name: "Arun Kumar" });
    expect(sheet(container)).toHaveAttribute("data-snap", "normal");

    act(() => (harness.mapProps?.onMapTap as () => void)());
    expect(sheet(container)).toHaveAttribute("data-snap", "peek");
    expect(container.querySelector(".rqr-peek")).toHaveTextContent("Arun Kumar");

    tapHandle(container);
    expect(sheet(container)).toHaveAttribute("data-snap", "normal");

    fireEvent.keyDown(screen.getByRole("button", { name: /resize the panel/i }), { key: "Enter" });
    expect(sheet(container)).toHaveAttribute("data-snap", "full");
  });

  it("shows EV stations with brand logos, power, connectors and Google Maps directions", async () => {
    renderRadar();
    fireEvent.click(screen.getByRole("tab", { name: /ev charging/i }));
    expect(currentSearch).toBe("?layer=ev");

    const card = await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    expect(callsTo("/api/public/ev-stations")).toEqual(["/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=5000"]);
    expect(card.querySelector(".rqr-logo img")).toHaveAttribute("src", "/images/brands/tatapower.png");
    expect(within(card).getByText("Open · 06:00-22:00")).toBeInTheDocument();
    expect(within(card).getByText("60")).toBeInTheDocument();
    expect(within(card).getByText("CCS2")).toBeInTheDocument();
    const directions = within(card).getByRole("link", { name: /directions to tata power ez charge/i });
    expect(directions).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648");
    expect(directions).toHaveAttribute("target", "_blank");
    // The station Mappls couldn't place has no pin but is still listed.
    expect(pins().map((pin) => pin.id)).toEqual(["ev-EVA001", "ev-EVA002"]);
    expect(screen.getByRole("article", { name: "EV charging point" })).toBeInTheDocument();
  });

  it("opens station details without claiming a charger is free", async () => {
    renderRadar("/map?layer=ev");
    const card = await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    fireEvent.click(within(card).getByRole("button", { name: /open details for tata power ez charge/i }));

    const detail = screen.getByRole("region", { name: "Tata Power EZ Charge details" });
    expect(within(detail).getByText("Availability unknown")).toBeInTheDocument();
    expect(within(detail).getByText("60 kW")).toBeInTheDocument();
    expect(within(detail).getByText("4")).toBeInTheDocument();
    expect(within(detail).getByText("Type 2")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: /call tata power/i })).toHaveAttribute("href", "tel:9876500000");
    expect(within(detail).getByRole("link", { name: /directions to tata power ez charge in google maps/i })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648",
    );
  });

  it("opens any card's details on the first tap, and a list row's too", async () => {
    renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });

    const second = screen.getByRole("article", { name: "Green Plug Point" });
    expect(second).not.toHaveClass("is-sel");
    expect(second).toHaveTextContent("Brookefields Mall");
    fireEvent.click(within(second).getByRole("button", { name: /open details for green plug point/i }));
    expect(screen.getByRole("region", { name: "Green Plug Point details" })).toBeInTheDocument();
    expect(harness.mapProps?.focus).toEqual([[11.004, 76.97]]);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const rows = screen.getAllByRole("button", { name: /EV charging point/ });
    fireEvent.click(rows[rows.length - 1]);
    expect(screen.getByRole("region", { name: "EV charging point details" })).toBeInTheDocument();
  });

  it("does not invent charger details a station doesn't list", async () => {
    renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    act(() => pins()[1].onClick?.());
    const card = screen.getByRole("article", { name: "Green Plug Point" });
    expect(within(card).getByText("Charger details not listed")).toBeInTheDocument();
    expect(within(card).getByText("Hours not listed")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /open details/i }));
    const detail = screen.getByRole("region", { name: "Green Plug Point details" });
    expect(within(detail).getByText("Connector information unavailable for this station.")).toBeInTheDocument();
    expect(within(detail).queryByText(/kW/)).not.toBeInTheDocument();
    expect(within(detail).queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
  });

  it("sends a station Mappls could not place to Google Maps by name and address", async () => {
    harness.responses["/api/public/ev-stations"] = stationsOk([unplacedStation]);
    renderRadar("/map?layer=ev");
    const card = await screen.findByRole("article", { name: "EV charging point" });
    expect(within(card).getByRole("link", { name: /directions/i })).toHaveAttribute(
      "href",
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("EV charging point, Gandhipuram, Coimbatore")}`,
    );
    expect(pins()).toHaveLength(0);
  });

  it("shows fuel pumps with their brand logo and today's city prices for what they sell", async () => {
    renderRadar("/map?layer=fuel");

    const petrol = await screen.findByRole("article", { name: "Indian Oil - Sri Balaji Fuels" });
    expect(petrol.querySelector(".rqr-logo img")).toHaveAttribute("src", "/images/brands/indianoil.png");
    expect(within(petrol).getByText("₹101.94")).toBeInTheDocument();
    expect(within(petrol).getByText("₹93.52")).toBeInTheDocument();
    expect(within(petrol).queryByText("CNG")).not.toBeInTheDocument();

    const cng = screen.getByRole("article", { name: "Nayara Energy CNG" });
    expect(within(cng).getByText("CNG")).toBeInTheDocument();
    expect(within(cng).getByText("₹86.50")).toBeInTheDocument();
    expect(pins()[0].html).toContain("/images/brands/indianoil.png");
    expect(screen.getByText(/today’s city prices for coimbatore/i)).toBeInTheDocument();

    fireEvent.click(within(cng).getByRole("button", { name: /open details for nayara energy cng/i }));
    const detail = screen.getByRole("region", { name: "Nayara Energy CNG details" });
    expect(within(detail).getByText("Today’s prices")).toBeInTheDocument();
    expect(within(detail).getByText("₹86.50")).toBeInTheDocument();
    expect(within(detail).getByText("Ukkadam, Coimbatore")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: /directions to nayara energy cng in google maps/i }))
      .toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=11.0001%2C76.9611");
  });

  it("pins stations placed from OpenStreetMap, credits it, and still routes by address", async () => {
    harness.responses["/api/public/fuel-stations"] = json({
      source: "mappls", radiusMeters: 5000, total: 2, located: 1, positionsAttribution: "© OpenStreetMap contributors",
      stations: [
        { ...pumps[0], latitude: 11.0101, longitude: 76.9601, positionSource: "osm" },
        { ...pumps[1], latitude: null, longitude: null },
      ],
    });
    renderRadar("/map?layer=fuel");

    const card = await screen.findByRole("article", { name: "Indian Oil - Sri Balaji Fuels" });
    expect(pins().map((pin) => pin.id)).toEqual(["fuel-F1"]);
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(within(card).getByRole("link", { name: /directions/i })).toHaveAttribute(
      "href",
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Indian Oil - Sri Balaji Fuels, Trichy Road, Coimbatore")}`,
    );
    fireEvent.click(within(card).getByRole("button", { name: /open details/i }));
    expect(screen.getByText(/map pin placed using openstreetmap/i)).toBeInTheDocument();
  });

  it("offers a wider search when nothing is listed nearby", async () => {
    harness.responses["/api/public/ev-stations"] = stationsOk([]);
    renderRadar("/map?layer=ev");

    expect(await screen.findByText("No chargers within 5 km")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search within 10 km" }));
    await waitFor(() => expect(callsTo("/api/public/ev-stations")).toContain("/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=10000"));
  });

  it("reports a failed search and keeps the other categories working", async () => {
    harness.responses["/api/public/ev-stations"] = json({ code: "ev_search_failed" }, 502);
    renderRadar("/map?layer=ev");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load chargers");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /technicians/i }));
    expect(await screen.findByRole("article", { name: "Arun Kumar" })).toBeInTheDocument();
    expect(currentSearch).toBe("");
  });

  it("does not search again for small GPS changes, only after a real move", async () => {
    const view = renderRadar("/map?layer=ev");
    await screen.findByRole("article", { name: "Tata Power EZ Charge" });
    expect(callsTo("/api/public/ev-stations")).toHaveLength(1);

    harness.geo.coordinates = { lat: 11.0177, lng: 76.9558 }; // ~100 m
    view.rerenderRadar();
    await waitFor(() => expect(callsTo("/api/public/ev-stations")).toHaveLength(1));

    harness.geo.coordinates = { lat: 11.0258, lng: 76.9558 }; // ~1 km
    view.rerenderRadar();
    await waitFor(() => expect(callsTo("/api/public/ev-stations")).toHaveLength(2));
    expect(callsTo("/api/public/ev-stations")[1]).toBe("/api/public/ev-stations?lat=11.0258&lng=76.9558&radius=5000");
  });

  it("asks for location when it is off and searches nothing", () => {
    harness.geo.coordinates = null;
    harness.geo.place = null;
    harness.geo.error = "Location permission denied.";
    renderRadar("/map?layer=ev");

    expect(screen.getByText("Location off")).toBeInTheDocument();
    expect(screen.getByText("See help, charging and fuel near you")).toBeInTheDocument();
    harness.geo.requestLocation.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /turn on location/i }));
    expect(harness.geo.requestLocation).toHaveBeenCalledTimes(1);
    act(() => (harness.mapProps?.onMapTap as () => void)());
    expect(screen.getByRole("region", { name: "EV charging" })).toHaveAttribute("data-snap", "normal");
    expect(screen.queryByRole("heading", { name: "EV charging near you" })).not.toBeInTheDocument();
    expect(harness.calls).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
