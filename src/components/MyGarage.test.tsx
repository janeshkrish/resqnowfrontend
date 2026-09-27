import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Vehicle } from "@/lib/garage";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import MyGarage from "./MyGarage";

const NEXON_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/n/nexon.jpg/960px-nexon.jpg";

let garage: Vehicle[];
let failStatus: boolean;
let failList: boolean;
let holdStatus: Promise<void> | null;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function fakeApi(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  if (path.startsWith("/api/public/vehicle-photo")) {
    const model = new URLSearchParams(path.split("?")[1]).get("model");
    return json({
      photo: model === "Nexon"
        ? { url: NEXON_PHOTO, width: 960, height: 640, article: "Tata Nexon", credit: { author: "Jane Doe", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Nexon.jpg" } }
        : null,
    });
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

  it("shows the newest vehicle large with its photo and the rest as rows", async () => {
    const { container } = renderGarage();

    const hero = await screen.findByRole("article", { name: "Tata Nexon" });
    expect(screen.getByRole("heading", { name: "Your vehicles" })).toBeInTheDocument();
    expect(screen.getByText(/3 vehicles/)).toBeInTheDocument();
    expect(within(hero).getByLabelText("Number plate KA 01 AB 1234")).toBeInTheDocument();
    expect(within(hero).getByText("Ready")).toBeInTheDocument();
    expect(await within(hero).findByRole("img", { name: "Tata Nexon" })).toHaveAttribute("src", NEXON_PHOTO);

    expect(screen.getByRole("button", { name: "Honda Activa 125, Ready" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maruti Swift, In service" })).toBeInTheDocument();

    // No photo for the Activa: the studio bike picture stands in.
    await waitFor(() => expect(container.querySelector('img[src="/images/vehicles/bike.webp"]')).not.toBeNull());
  });

  it("changes the status straight away and saves it", async () => {
    let release = () => {};
    holdStatus = new Promise<void>((resolve) => { release = resolve; });
    renderGarage();
    fireEvent.click(await screen.findByRole("button", { name: "Maruti Swift, In service" }));

    const sheet = await screen.findByRole("dialog", { name: "Swift" });
    expect(within(sheet).getByRole("radio", { name: "In service" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(sheet).getByRole("radio", { name: "Not in use" }));

    // Shown before the server answers.
    await waitFor(() => expect(within(sheet).getByRole("radio", { name: "Not in use" })).toHaveAttribute("aria-checked", "true"));
    expect(callsTo("/api/vehicles/3/status", "PATCH")).toHaveLength(1);
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Maruti Swift, Not in use", hidden: true })).toBeInTheDocument());
    expect(JSON.parse(String(callsTo("/api/vehicles/3/status", "PATCH")[0][1].body))).toEqual({ status: "inactive" });
  });

  it("puts the status back when the save fails", async () => {
    failStatus = true;
    renderGarage();
    fireEvent.click(await screen.findByRole("button", { name: "Maruti Swift, In service" }));
    const sheet = await screen.findByRole("dialog", { name: "Swift" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "Ready" }));

    expect(await screen.findByText("The status wasn’t changed. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByRole("radio", { name: "In service" })).toHaveAttribute("aria-checked", "true"));
  });

  it("asks before removing a vehicle", async () => {
    renderGarage();
    fireEvent.click(await screen.findByRole("button", { name: "Maruti Swift, In service" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Swift" })).getByRole("button", { name: /remove from garage/i }));

    const confirm = await screen.findByRole("alertdialog", { name: "Remove Maruti Swift?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(callsTo("/api/vehicles/3", "DELETE")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Maruti Swift, In service" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Swift" })).getByRole("button", { name: /remove from garage/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Maruti Swift removed")).toBeInTheDocument();
    expect(callsTo("/api/vehicles/3", "DELETE")).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Maruti Swift/ })).not.toBeInTheDocument());
    expect(screen.getByText(/2 vehicles/)).toBeInTheDocument();
  });

  it("opens the request form with the vehicle filled in", async () => {
    renderGarage();
    const hero = await screen.findByRole("article", { name: "Tata Nexon" });
    fireEvent.click(within(hero).getByRole("button", { name: "Get help for this car" }));
    expect(await screen.findByText("Request form /request-service/emergency/car?vehicle=1")).toBeInTheDocument();
  });

  it("adds a vehicle in four steps and puts it on top", async () => {
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
    expect(await screen.findByRole("article", { name: "Tata Nexon" })).toBeInTheDocument();
  });

  it("offers a retry when the vehicles don't load", async () => {
    failList = true;
    renderGarage();
    expect(await screen.findByText("Your vehicles didn’t load")).toBeInTheDocument();

    failList = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Tata Nexon" })).toBeInTheDocument();
  });
});
