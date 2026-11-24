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

it('clears both stale flat and nested place IDs when Photon replaces previously geocoded pickup and drop locations',async()=>{
  const {result}=renderHook(()=>useUnifiedServiceRequestFlow({serviceId:'towing',vehicleType:'car',storageKey:'photon-place-replacement',navigate:vi.fn(),validateStep1:()=>true,buildVehicleModel:d=>d.vehicleModel,
    createInitialFormData:()=>({name:'Asha',phone:'9999999999',vehicleType:'car',vehicleSubtype:'sedan',vehicleModel:'Swift',location:'Old GPS pickup',locationLat:11,locationLng:77,locationPlaceId:'old-google-pickup',locationPlace:{lat:11,lng:77,address:'Old GPS pickup',formatted_address:'Old GPS pickup',placeId:'old-google-pickup'},
      dropLocation:'Old drop',dropLat:12,dropLng:78,dropPlaceId:'old-google-drop',dropPlace:{lat:12,lng:78,address:'Old drop',formatted_address:'Old drop',placeId:'old-google-drop'},details:'',selectedTechnicianId:null})}));
  act(()=>{result.current.handleLocationSelect(11.02,77.02,'New Photon pickup',null);result.current.handleDropLocationSelect(11.04,77.04,'New Photon drop',null);});
  expect(result.current.formData).toMatchObject({locationPlaceId:null,locationPlace:{placeId:null},dropPlaceId:null,dropPlace:{placeId:null}});
  apiFetch.mockImplementation(async(path:string)=>new Response(JSON.stringify(path==='/api/service-requests'?{id:'synthetic-updated-location'}:{quote:{distance_km:8}})));
  await act(async()=>{await result.current.submitRequest();});
  const sent=apiFetch.mock.calls.find(([p])=>p==='/api/service-requests');
  expect(JSON.parse(sent![1].body)).toMatchObject({pickupPlaceId:null,locationPlaceId:null,dropPlaceId:null,location_lat:11.02,location_lng:77.02,dropLat:11.04,dropLng:77.04});
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
