import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useUnifiedServiceRequestFlow } from "./useUnifiedServiceRequestFlow";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));
vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => ({ coordinates: null, address: null, loading: false, error: null, requestLocation: vi.fn() }) }));
vi.mock("@/lib/googlePlaces", () => ({ geocodeAddressWithGoogle: vi.fn(), reverseGeocodeWithGoogle: vi.fn() }));
vi.mock("@/lib/geo", () => ({ searchLocations: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  apiFetch.mockReset().mockImplementation(async () => new Response(JSON.stringify({ quote: { distance_km: 10, estimated_duration: 20 } }), { status: 200 }));
});

it("refreshes towing route readiness when only structured EV body details change and sends those details", async () => {
  const { result } = renderHook(() => useUnifiedServiceRequestFlow({
    serviceId: "towing", vehicleType: "ev", storageKey: "ev-body-estimate-test", navigate: vi.fn(),
    createInitialFormData: () => ({ name: "Asha", phone: "9999999999", vehicleType: "ev", vehicleSubtype: "electric-car", vehicleModel: "Prototype EV", vehicleBaseSubtype: "hatchback", location: "Pickup", locationLat: 11, locationLng: 77, dropLocation: "Drop", dropLat: 12, dropLng: 78, details: "", selectedTechnicianId: null }),
    validateStep1: () => true, buildVehicleModel: data => data.vehicleModel,
    buildEstimateExtras: data => ({ details: data.reorderDetails ? { answers: [], vehicle_base_subtype: data.vehicleBaseSubtype } : { vehicle_base_subtype: data.vehicleBaseSubtype, answers: [] } }),
  }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1), { timeout: 3000 });
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ vehicleType: "ev", details: { vehicle_base_subtype: "hatchback" } });
  await waitFor(() => expect(result.current.isEstimatingTowing).toBe(false));
  act(() => result.current.setFormData(previous => ({ ...previous, vehicleBaseSubtype: "sedan" })));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2), { timeout: 3000 });
  expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toMatchObject({ details: { vehicle_base_subtype: "sedan" } });
  await waitFor(() => expect(result.current.isEstimatingTowing).toBe(false));
  act(() => result.current.setFormData(previous => ({ ...previous, reorderDetails: true })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 750)); });
  expect(apiFetch).toHaveBeenCalledTimes(2);
});
