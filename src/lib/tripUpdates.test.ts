import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripLiveUpdateInput } from "./tripLiveUpdate";

const capacitor = vi.hoisted(() => ({
  native: true,
  platform: "android",
  plugin: { update: vi.fn((_update: unknown) => Promise.resolve()), end: vi.fn(), getStatus: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => capacitor.native, getPlatform: () => capacitor.platform },
  registerPlugin: () => capacitor.plugin,
}));

import { useTripLiveUpdate } from "./tripUpdates";

const trip = (overrides: Partial<TripLiveUpdateInput>): TripLiveUpdateInput => ({
  requestId: "5318",
  phase: "way",
  isTowing: false,
  technicianName: "Arun",
  technicianPhone: "",
  serviceType: "lockout",
  liveEta: null,
  distanceLabel: "2.4 km away",
  amountLabel: null,
  ...overrides,
});

describe("keeping the Live Update in step with the tracking card", () => {
  beforeEach(() => {
    capacitor.native = true;
    capacitor.platform = "android";
    capacitor.plugin.update.mockClear();
  });

  it("sends each new stage once, and not again for the same words", () => {
    const { rerender } = renderHook((input: TripLiveUpdateInput | null) => useTripLiveUpdate(input), { initialProps: trip({ phase: "accepted" }) });
    rerender(trip({ phase: "accepted" }));
    rerender(trip({ phase: "way" }));
    rerender(trip({ phase: "way" }));
    rerender(trip({ phase: "arrived" }));
    const phases = capacitor.plugin.update.mock.calls.map(([update]) => (update as { phase: string }).phase);
    expect(phases).toEqual(["accepted", "way", "arrived"]);
  });

  it("does nothing on the website or on an iPhone", () => {
    capacitor.native = false;
    renderHook(() => useTripLiveUpdate(trip({})));
    capacitor.native = true;
    capacitor.platform = "ios";
    renderHook(() => useTripLiveUpdate(trip({})));
    expect(capacitor.plugin.update).not.toHaveBeenCalled();
  });

  it("waits for the request to load", () => {
    renderHook(() => useTripLiveUpdate(null));
    expect(capacitor.plugin.update).not.toHaveBeenCalled();
  });

  it("does not bring back the notification of a request that was over before the page opened", () => {
    renderHook(() => useTripLiveUpdate(trip({ phase: "rate" })));
    expect(capacitor.plugin.update).not.toHaveBeenCalled();
  });

  it("thanks the customer when payment lands while they watch", () => {
    const { rerender } = renderHook((input: TripLiveUpdateInput) => useTripLiveUpdate(input), { initialProps: trip({ phase: "pay", amountLabel: "₹110.00" }) });
    rerender(trip({ phase: "rate", amountLabel: "₹110.00" }));
    const titles = capacitor.plugin.update.mock.calls.map(([update]) => (update as { title: string }).title);
    expect(titles).toEqual(["Work done · ₹110 to pay", "Paid · thank you"]);
  });

  it("keeps working when the app has no plugin", async () => {
    capacitor.plugin.update.mockImplementationOnce(() => Promise.reject(new Error("not implemented")));
    expect(() => renderHook(() => useTripLiveUpdate(trip({})))).not.toThrow();
  });
});
