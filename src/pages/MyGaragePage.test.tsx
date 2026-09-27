import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => new Response(JSON.stringify(
    path.startsWith("/api/public/vehicle-photo")
      ? { photo: null }
      : [{ id: 7, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready" }],
  ), { status: 200 })),
}));

import MyGaragePage from "./MyGaragePage";

const renderAt = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/my-garage" element={<MyGaragePage />} />
        <Route path="/my-garage/add" element={<MyGaragePage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

describe("My garage page", () => {
  it("shows the customer's saved vehicles", async () => {
    renderAt("/my-garage");
    expect(await screen.findByRole("heading", { name: "Nexon" })).toBeInTheDocument();
    expect(screen.getByLabelText("Number plate KA 01 AB 1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });

  it("opens the add-vehicle steps from the home screen's Add vehicle link", async () => {
    renderAt("/my-garage/add");
    expect(screen.getByRole("heading", { name: "What do you drive?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Car:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bike:/ })).toBeInTheDocument();

    // Leaving the steps lands on the garage itself.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Your vehicles" })).toBeInTheDocument();
  });
});
