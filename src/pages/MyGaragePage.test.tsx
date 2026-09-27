import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async () => new Response(JSON.stringify([
    { id: 7, type: "car", make: "Tata", model: "Nexon", license_plate: "KA01AB1234", status: "ready" },
  ]), { status: 200 })),
}));

import MyGaragePage from "./MyGaragePage";

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/my-garage" element={<MyGaragePage />} />
      <Route path="/my-garage/add" element={<MyGaragePage />} />
    </Routes>
  </MemoryRouter>,
);

describe("My garage page", () => {
  it("shows the customer's saved vehicles", async () => {
    renderAt("/my-garage");
    expect(await screen.findByText("Nexon")).toBeInTheDocument();
    expect(screen.getByText("KA01AB1234")).toBeInTheDocument();
  });

  it("opens the add-vehicle steps from the home screen's Add vehicle link", () => {
    renderAt("/my-garage/add");
    expect(screen.getByText("4-Wheeler")).toBeInTheDocument();
    expect(screen.getByText("2-Wheeler")).toBeInTheDocument();
  });
});
