import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async () => new Response(JSON.stringify([
    { id: 4, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: null, status: "ready" },
    { id: 7, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready" },
  ]), { status: 200 })),
}));

import VehicleInfoStep from "./VehicleInfoStep";
import type { ServiceRequestFormData } from "./types";

const renderAt = (path: string) => {
  const onInputChange = vi.fn();
  const onVehicleTypeSelect = vi.fn();
  const onVehicleSubtypeSelect = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <VehicleInfoStep
        formData={{ vehicleType: "car", vehicleModel: "" } as ServiceRequestFormData}
        onInputChange={onInputChange}
        onVehicleTypeSelect={onVehicleTypeSelect}
        onVehicleSubtypeSelect={onVehicleSubtypeSelect}
        hideCategorySelection
      />
    </MemoryRouter>,
  );
  const typed = () => onInputChange.mock.calls.map(([event]) => [event.target.name, event.target.value]);
  return { typed, onVehicleTypeSelect };
};

describe("VehicleInfoStep", () => {
  it("fills in the vehicle picked in My garage", async () => {
    const { typed, onVehicleTypeSelect } = renderAt("/request-service/emergency/car?vehicle=7");
    await waitFor(() => expect(typed()).toContainEqual(["vehicleModel", "Nexon"]));
    expect(typed()).toContainEqual(["vehicleBrand", "Tata Motors"]);
    expect(onVehicleTypeSelect).toHaveBeenCalledWith("car");
  });

  it("leaves the form alone without a vehicle in the link", async () => {
    const { typed } = renderAt("/request-service/emergency/car");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(typed()).toEqual([]);
  });
});
