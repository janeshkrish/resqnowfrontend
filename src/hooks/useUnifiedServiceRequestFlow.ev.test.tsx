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

it("retains a towing submission across a lost response and reload, then opens its tracking page", async () => {
  window.history.replaceState({ usr: { reset: true } }, "");
  const navigate = vi.fn();
  const sent: string[] = [];
  apiFetch.mockImplementation(async (path: string, init: RequestInit) => {
    if (path !== "/api/service-requests") return new Response(JSON.stringify({ quote: { distance_km: 10 } }));
    sent.push(String(init.body));
    if (sent.length === 1) throw new TypeError("Response lost");
    return new Response(JSON.stringify({ id: "recovered-request" }));
  });
  const useBooking = () => useUnifiedServiceRequestFlow({
    serviceId: "towing", vehicleType: "car", storageKey: "recover-booking", navigate,
    resetRequested: Boolean(window.history.state?.usr?.reset),
    createInitialFormData: () => ({ name: "Asha", phone: "9999999999", vehicleType: "car", vehicleSubtype: "hatchback", vehicleModel: "Swift", location: "Pickup", locationLat: 11, locationLng: 77,
      dropLocation: "Drop", dropLat: 12, dropLng: 78, details: "", selectedTechnicianId: null }),
    validateStep1: () => true, buildVehicleModel: data => data.vehicleModel,
  });
  const first = renderHook(useBooking);
  await act(async () => { await Promise.all([first.result.current.submitRequest(), first.result.current.submitRequest()]); });
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0]).idempotencyKey).toBeTruthy();
  expect(navigate).not.toHaveBeenCalled();
  expect(window.history.state?.usr?.reset).toBeUndefined();
  first.unmount();
  const second = renderHook(useBooking);
  await act(async () => { await second.result.current.submitRequest(); });
  expect(sent[1]).toEqual(sent[0]);
  expect(navigate).toHaveBeenCalledWith("/request-service-tracking/recovered-request", expect.anything());
  expect(localStorage.getItem("recover-booking")).toBeNull();
});
