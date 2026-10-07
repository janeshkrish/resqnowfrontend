import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Vehicle } from "@/lib/garage";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import MyGarage from "./MyGarage";

let garage: Vehicle[];
let failStatus: boolean;
let failList: boolean;
let holdStatus: Promise<void> | null;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function fakeApi(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  // What the customer has asked for before: the Nexon was towed once this year.
  if (path === "/api/service-requests" && method === "GET") {
    return json([
      { id: 31, service_type: "towing", vehicle_type: "car", vehicle_model: "Tata Motors Nexon", status: "completed", payment_status: "completed", created_at: `${new Date().getFullYear()}-03-12T07:30:00Z` },
      { id: 32, service_type: "battery", vehicle_type: "car", vehicle_model: "Tata Motors Nexon", status: "cancelled", created_at: `${new Date().getFullYear()}-04-02T07:30:00Z` },
    ]);
  }
  if (path === "/api/vehicles" && method === "GET") return failList ? json({ error: "down" }, 500) : json(garage);
  if (path === "/api/vehicles" && method === "POST") {
    const body = JSON.parse(String(init.body));
    const id = 100 + garage.length;
    garage = [{ id, status: "ready", created_at: "2026-09-27T10:00:00Z", ...body }, ...garage];
    return json({ id }, 201);
  }
  const status = path.match(/^\/api\/vehicles\/(\d+)\/status$/);
  if (status && method === "PATCH") {
    if (holdStatus) await holdStatus;
    if (failStatus) return json({ error: "nope" }, 500);
    const next = JSON.parse(String(init.body)).status;
    garage = garage.map((v) => (v.id === Number(status[1]) ? { ...v, status: next } : v));
    return json({ ok: true });
  }
  const remove = path.match(/^\/api\/vehicles\/(\d+)$/);
  if (remove && method === "DELETE") {
    garage = garage.filter((v) => v.id !== Number(remove[1]));
    return json({ ok: true });
  }
  return json({ error: "unexpected" }, 404);
}

function RequestForm() {
  const location = useLocation();
  return <p>Request form {location.pathname}{location.search}</p>;
}

const renderGarage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/my-garage"]}>
        <Routes>
          <Route path="/my-garage" element={<MyGarage />} />
          <Route path="/request-service/emergency/:type" element={<RequestForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const callsTo = (path: string, method: string) =>
  apiFetch.mock.calls.filter(([url, init]) => url === path && (init?.method ?? "GET") === method);

/** Puts a vehicle on show from the row under the bay, then opens its sheet. */
async function openSheet(tab: string, model: string) {
  fireEvent.click(await screen.findByRole("tab", { name: tab }));
  fireEvent.click(await screen.findByRole("button", { name: `More for ${model}` }));
  return screen.findByRole("dialog", { name: model });
}

describe("My garage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => fakeApi(path, init));
    failStatus = false;
    failList = false;
    holdStatus = null;
    garage = [
      { id: 2, type: "bike", make: "Honda Motorcycles", model: "Activa 125", license_plate: "KA 05 HX 7781", status: "ready", created_at: "2026-08-01T10:00:00Z" },
      { id: 1, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready", created_at: "2026-09-01T10:00:00Z" },
      { id: 3, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: null, status: "maintenance", created_at: "2026-07-01T10:00:00Z" },
    ];
  });

  it("puts the newest vehicle on show with its facts, and the rest a tap away", async () => {
    renderGarage();

    const bay = await screen.findByRole("article", { name: "Tata Nexon, Ready" });
    expect(screen.getByRole("heading", { name: "My garage" })).toBeInTheDocument();
    expect(screen.getByText("3 vehicles · 2 cars, 1 bike")).toBeInTheDocument();
    expect(within(bay).getByRole("heading", { name: "Nexon" })).toBeInTheDocument();
    expect(within(bay).getByLabelText("Number plate KA 01 AB 1234")).toBeInTheDocument();
    expect(within(bay).getByText("Ready")).toBeInTheDocument();
    expect(within(bay).getByText("1 / 3")).toBeInTheDocument();

    // Every saved vehicle is shown with the app's own studio picture; no photo is looked up.
    expect(bay.querySelector(".rqg-bay-car.is-in img")).toHaveAttribute("src", "/images/vehicles/car.webp");
    expect(bay.querySelector(".rqg-bay-car.is-out")).toBeNull();
    expect(apiFetch.mock.calls.some(([url]) => String(url).startsWith("/api/public/vehicle-photo"))).toBe(false);

    // Its facts: when it was saved, and the help it has had (the cancelled request does not count).
    expect(within(bay).getByText("In garage").nextElementSibling).toHaveTextContent("Sep 2026");
    await waitFor(() => expect(within(bay).getByText("Last help").nextElementSibling).toHaveTextContent("Towing · 12 Mar"));
    expect(within(bay).getByText("1 time", { selector: ".sr-only" })).toBeInTheDocument();

    // The others wait in the row underneath.
    expect(screen.getByRole("tab", { name: "Tata Nexon, Ready" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Maruti Swift, In service" })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("tab", { name: "Honda Activa 125, Ready" }));

    const next = await screen.findByRole("article", { name: "Honda Activa 125, Ready" });
    expect(next.querySelector(".rqg-bay-car.is-in img")).toHaveAttribute("src", "/images/vehicles/bike.webp");
    // The one that was there is seen driving off.
    expect(next.querySelector(".rqg-bay-car.is-out img")).toHaveAttribute("src", "/images/vehicles/car.webp");
    expect(within(next).getByText("2 / 3")).toBeInTheDocument();
    expect(within(next).getByText("Last help").nextElementSibling).toHaveTextContent("None yet");
    expect(screen.getByRole("tab", { name: "Honda Activa 125, Ready" })).toHaveAttribute("aria-selected", "true");
  });

  it("changes the status straight away and saves it", async () => {
    let release = () => {};
    holdStatus = new Promise<void>((resolve) => { release = resolve; });
    renderGarage();
    const sheet = await openSheet("Maruti Swift, In service", "Swift");
    expect(within(sheet).getByRole("radio", { name: "In service" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(sheet).getByRole("radio", { name: "Not in use" }));

    // Shown before the server answers.
    await waitFor(() => expect(within(sheet).getByRole("radio", { name: "Not in use" })).toHaveAttribute("aria-checked", "true"));
    expect(callsTo("/api/vehicles/3/status", "PATCH")).toHaveLength(1);
    release();
    await waitFor(() => expect(screen.getByRole("tab", { name: "Maruti Swift, Not in use", hidden: true })).toBeInTheDocument());
    expect(JSON.parse(String(callsTo("/api/vehicles/3/status", "PATCH")[0][1].body))).toEqual({ status: "inactive" });
  });

  it("puts the status back when the save fails", async () => {
    failStatus = true;
    renderGarage();
    const sheet = await openSheet("Maruti Swift, In service", "Swift");
    fireEvent.click(within(sheet).getByRole("radio", { name: "Ready" }));

    expect(await screen.findByText("The status wasn’t changed. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByRole("radio", { name: "In service" })).toHaveAttribute("aria-checked", "true"));
  });

  it("asks before removing a vehicle", async () => {
    renderGarage();
    fireEvent.click(within(await openSheet("Maruti Swift, In service", "Swift")).getByRole("button", { name: /remove from garage/i }));

    const confirm = await screen.findByRole("alertdialog", { name: "Remove Maruti Swift?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(callsTo("/api/vehicles/3", "DELETE")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "More for Swift" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Swift" })).getByRole("button", { name: /remove from garage/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Maruti Swift removed")).toBeInTheDocument();
    expect(callsTo("/api/vehicles/3", "DELETE")).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("tab", { name: /Maruti Swift/ })).not.toBeInTheDocument());
    expect(screen.getByText("2 vehicles · 1 car, 1 bike")).toBeInTheDocument();
    // The newest vehicle is back on show.
    expect(screen.getByRole("article", { name: "Tata Nexon, Ready" })).toBeInTheDocument();
  });

  it("opens the request form with the vehicle filled in", async () => {
    renderGarage();
    const bay = await screen.findByRole("article", { name: "Tata Nexon, Ready" });
    fireEvent.click(within(bay).getByRole("button", { name: "Get help for this car" }));
    expect(await screen.findByText("Request form /request-service/emergency/car?vehicle=1")).toBeInTheDocument();
  });

  it("adds a vehicle in four steps and puts it on show", async () => {
    garage = [];
    renderGarage();

    expect(await screen.findByRole("heading", { name: "No vehicles yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add your first vehicle" }));

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Car:/ }));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search car brands" }), { target: { value: "tata" } });
    fireEvent.click(screen.getByRole("button", { name: "Tata Motors" }));

    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Nexon" }));

    const plate = screen.getByLabelText("Registration number");
    fireEvent.change(plate, { target: { value: "ka01ab1234" } });
    fireEvent.blur(plate);
    expect(plate).toHaveValue("KA 01 AB 1234");
    fireEvent.click(screen.getByRole("button", { name: "Save vehicle" }));

    expect(await screen.findByText("Tata Nexon saved to your garage")).toBeInTheDocument();
    expect(JSON.parse(String(callsTo("/api/vehicles", "POST")[0][1].body))).toEqual({
      type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234",
    });
    expect(await screen.findByRole("article", { name: "Tata Nexon, Ready" })).toBeInTheDocument();
  });

  it("offers a retry when the vehicles don't load", async () => {
    failList = true;
    renderGarage();
    expect(await screen.findByText("Your vehicles didn’t load")).toBeInTheDocument();

    failList = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Tata Nexon, Ready" })).toBeInTheDocument();
  });
});
