import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ responses: new Map<string, unknown>(), calls: [] as string[] }));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    api.calls.push(path);
    const key = [...api.responses.keys()].find((prefix) => path.startsWith(prefix));
    if (!key) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(api.responses.get(key)), { status: 200 });
  }),
}));

import HomeServices from "./HomeServices";
import FuelPricesCard from "./FuelPricesCard";
import { setHomeCoordinates } from "@/lib/homeLocation";

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("home services", () => {
  beforeEach(() => {
    api.responses.clear();
    api.calls.length = 0;
  });

  it("shows the lowest technician price under each service that has one", async () => {
    api.responses.set("/api/public/service-prices", {
      vehicle: "car",
      currency: "INR",
      services: [
        { service: "towing", startingPrice: 1120, technicians: 3 },
        { service: "fuel", startingPrice: null, technicians: 0 },
      ],
    });
    render(wrap(<HomeServices />));

    const towing = await screen.findByRole("link", { name: /towing, starts from ₹1,120/i });
    expect(towing).toHaveAttribute("href", "/request-service/towing");
    expect(screen.getByRole("link", { name: /^fuel$/i })).toHaveAttribute("href", "/request-service/fuel");
    expect(screen.getByText("Lowest prices from our technicians · Car")).toBeInTheDocument();
    expect(api.calls).toContain("/api/public/service-prices?vehicle=car");
  });

  it("still lists every service when prices cannot load", async () => {
    render(wrap(<HomeServices />));
    await waitFor(() => expect(api.calls.length).toBe(1));
    expect(screen.getAllByRole("link", { name: /towing|flat tyre|battery|mechanic|fuel|lockout|winching|ev charge/i })).toHaveLength(8);
    expect(screen.queryByText(/starts from/i)).not.toBeInTheDocument();
  });
});

describe("fuel prices card", () => {
  beforeEach(() => {
    api.responses.clear();
    api.calls.length = 0;
    setHomeCoordinates(null);
  });

  it("waits for the customer's location before asking for prices", () => {
    const { container } = render(wrap(<FuelPricesCard />));
    expect(container).toBeEmptyDOMElement();
    expect(api.calls).toHaveLength(0);
  });

  it("shows today's prices for the customer's area with the change since yesterday", async () => {
    api.responses.set("/api/public/fuel-prices", {
      available: true,
      location: { area: "Coimbatore", state: "Tamil Nadu", scope: "area" },
      asOf: "2026-09-26",
      stale: false,
      prices: [
        { fuel: "petrol", label: "Petrol", price: 100.9, unit: "litre", change: 0.14, effectiveDate: "2026-09-26" },
        { fuel: "diesel", label: "Diesel", price: 92.48, unit: "litre", change: -0.06, effectiveDate: "2026-09-26" },
      ],
    });
    setHomeCoordinates({ lat: 11.0168, lng: 76.9558 });
    render(wrap(<FuelPricesCard />));

    expect(await screen.findByText("₹100.90")).toBeInTheDocument();
    expect(screen.getByText("₹92.48")).toBeInTheDocument();
    expect(screen.getByLabelText(/up ₹0.14 since yesterday/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/down ₹0.06 since yesterday/i)).toBeInTheDocument();
    expect(screen.getByText(/Coimbatore, Tamil Nadu · Today/)).toBeInTheDocument();
    expect(api.calls[0]).toBe("/api/public/fuel-prices?lat=11.0200&lng=76.9600");
  });

  it("stays hidden when there are no prices for the area", async () => {
    api.responses.set("/api/public/fuel-prices", { available: false, reason: "no_prices" });
    setHomeCoordinates({ lat: 12.97, lng: 77.59 });
    const { container } = render(wrap(<FuelPricesCard />));
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(container).toBeEmptyDOMElement();
  });
});
