import { describe, expect, it } from "vitest";
import { readOfferNumber, toJobRequest } from "./technicianJobOffer";

describe("the offer card's job", () => {
  it("reads a socket offer", () => {
    const job = toJobRequest({
      requestId: "6101",
      isTowing: true,
      customerName: "Asha",
      serviceType: "car-towing",
      vehicleType: "car",
      location: { lat: 11.0168, lng: 76.9558, address: "21, Race Course Road, Coimbatore" },
      address: "21, Race Course Road, Coimbatore",
      dropLocation: { lat: 11.02, lng: 76.96, address: "Ganapathy workshop" },
      routeDistanceKm: 4.2,
      estimatedDuration: 14,
      technicianEstimatedEarning: 820,
      amount: 999,
      eta: "8 min",
      landmark: "Opposite the petrol bunk",
    });
    expect(job).toMatchObject({
      id: "6101",
      isTowing: true,
      customerName: "Asha",
      serviceType: "car-towing",
      location: { lat: 11.0168, lng: 76.9558, address: "21, Race Course Road, Coimbatore" },
      dropLocation: { lat: 11.02, lng: 76.96, address: "Ganapathy workshop" },
      distance: 4.2,
      routeDistanceKm: 4.2,
      estimatedDuration: 14,
      // The technician's earning, not the customer's price.
      amount: 820,
      eta: "8 min",
    });
    expect(job?.details?.landmark).toBe("Opposite the petrol bunk");
  });

  it("reads the technician-offer lookup, which names things differently", () => {
    const job = toJobRequest({
      id: 6102,
      service_type: "battery",
      vehicle_type: "bike",
      contact_name: "Ravi",
      location_lat: "11.1",
      location_lng: "76.9",
      locationDistance: "3.5 km",
      amount: "450",
    });
    expect(job).toMatchObject({
      id: "6102",
      serviceType: "battery",
      vehicleType: "bike",
      customerName: "Ravi",
      location: { lat: 11.1, lng: 76.9, address: "Location not available" },
      distance: 3.5,
      amount: 450,
      dropLocation: { lat: null, lng: null, address: null },
    });
  });

  it("keeps the way to the customer as dispatch measured it", () => {
    expect(readOfferNumber("2.4 km")).toBe(2.4);
    expect(readOfferNumber("~8 mins")).toBe(8);
    expect(readOfferNumber(3.1)).toBe(3.1);
    // No number sent: the card shows a dash rather than an estimate of its own.
    expect(readOfferNumber("Nearby")).toBeNull();
    expect(readOfferNumber("")).toBeNull();
    expect(readOfferNumber(undefined)).toBeNull();
    expect(readOfferNumber(0)).toBeNull();

    // For a tow the trip to the drop is routeDistanceKm; the way to the pickup stays separate.
    const tow = toJobRequest({ requestId: "6103", isTowing: true, distance: "2.4 km", eta: "11 mins", routeDistanceKm: 4.2, estimatedDuration: 14 });
    expect(tow).toMatchObject({ pickupDistanceKm: 2.4, etaMinutes: 11, routeDistanceKm: 4.2, estimatedDuration: 14 });
    expect(toJobRequest({ id: 6104, locationDistance: "Nearby" })).toMatchObject({ pickupDistanceKm: null, etaMinutes: null });
  });

  it("has no job without a request id", () => {
    expect(toJobRequest({ serviceType: "battery" })).toBeNull();
    expect(toJobRequest(null)).toBeNull();
  });
});
