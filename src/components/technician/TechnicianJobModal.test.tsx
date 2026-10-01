import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readJobDetails } from "@/lib/technicianJobDetails";
import { toJobRequest } from "@/lib/technicianJobOffer";
import { TechnicianJobModal, type JobRequest } from "./TechnicianJobModal";

// A socket offer as resqnowbackend/services/dispatchQueueService.js sends it.
const offer = {
  requestId: "6101",
  customerName: "Asha",
  serviceType: "flat-tyre",
  vehicleType: "car",
  location: { lat: 11.0168, lng: 76.9558, address: "21, Race Course Road, Coimbatore" },
  address: "21, Race Course Road, Coimbatore",
  distance: "2.4 km",
  eta: "8 mins",
  technicianEstimatedEarning: 350,
  vehicleLine: "Honda City · Sedan",
  problem: ["Tubeless", "Front left"],
  landmark: "Opposite the petrol bunk",
  customerNote: "Jack is in the boot",
};

const job = (extra: Record<string, unknown> = {}) => toJobRequest({ ...offer, ...extra }) as JobRequest;

function show(request: JobRequest, props: Partial<React.ComponentProps<typeof TechnicianJobModal>> = {}) {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  const onDismissUnavailable = vi.fn();
  render(
    <TechnicianJobModal job={request} isOpen onAccept={onAccept} onReject={onReject} onDismissUnavailable={onDismissUnavailable} {...props} />,
  );
  return { onAccept, onReject, onDismissUnavailable, card: screen.getByRole("dialog") };
}

afterEach(() => vi.useRealTimers());

describe("the new-request card", () => {
  it("shows the earnings, distance, time, address, landmark and vehicle from the offer", () => {
    const { card } = show(job());
    expect(within(card).getByRole("heading", { name: "flat tyre" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Honda City · Sedan");
    expect(within(card).getByText("You earn").nextSibling).toHaveTextContent("₹350");
    expect(within(card).getByText("Distance").nextSibling).toHaveTextContent("2.4 km");
    expect(within(card).getByText("Reach in").nextSibling).toHaveTextContent("8 min");
    const location = within(card).getByTestId("job-location");
    expect(location).toHaveTextContent("Customer location");
    expect(location).toHaveTextContent("21, Race Course Road, Coimbatore");
    expect(location).toHaveTextContent("Opposite the petrol bunk");
    expect(within(card).getByRole("list", { name: "Customer says" })).toHaveTextContent("TubelessFront left");
    expect(card).toHaveTextContent("“Jack is in the boot”");
  });

  it("shows a dash, never a guess, when dispatch sent no time or distance", () => {
    const { card } = show(job({ eta: "", distance: "Nearby", locationDistance: "Nearby" }));
    expect(within(card).getByText("Reach in").nextSibling).toHaveTextContent("—");
    expect(within(card).getByText("Distance").nextSibling).toHaveTextContent("—");
  });

  it("keeps the way to the pickup apart from the tow to the drop point", () => {
    const { card } = show(job({
      isTowing: true, serviceType: "car-towing", towTruckType: "flatbed", towTruckLabel: "Flatbed",
      dropLocation: { lat: 11.02, lng: 76.96, address: "Ganapathy workshop, Sathy Road" },
      routeDistanceKm: 4.2, estimatedDuration: 14,
    }));
    expect(card).toHaveTextContent("New request · Flatbed needed");
    expect(within(card).getByText("Distance").nextSibling).toHaveTextContent("2.4 km");
    const location = within(card).getByTestId("job-location");
    expect(location).toHaveTextContent("Pickup location");
    expect(location).toHaveTextContent("Drop · 4.2 km · 14 min");
    expect(location).toHaveTextContent("Ganapathy workshop, Sathy Road");
  });

  it("flags an urgent request", () => {
    const urgent = job({ answers: [{ id: "inside", value: "yes", label: "Someone inside" }], problem: ["Someone inside"] });
    expect(readJobDetails({ ...offer, answers: [{ id: "inside", value: "yes", label: "Someone inside" }] })?.urgent).toBe(true);
    const { card } = show(urgent);
    expect(within(card).getByRole("alert")).toHaveTextContent("Urgent · Someone is stuck inside the vehicle");
  });

  it("accepts from the slide and rejects from the button", () => {
    const { onAccept, onReject, card } = show(job());
    fireEvent.keyDown(within(card).getByRole("button", { name: "Slide to accept" }), { key: "Enter" });
    expect(onAccept).toHaveBeenCalledWith("6101");
    fireEvent.click(within(card).getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith("6101");
  });

  it("counts down 30 seconds and then lets the request go", () => {
    vi.useFakeTimers();
    const { onReject, card } = show(job());
    expect(within(card).getByRole("timer")).toHaveTextContent("30 sec");
    act(() => { vi.advanceTimersByTime(8000); });
    expect(within(card).getByRole("timer")).toHaveTextContent("22 sec");
    act(() => { vi.advanceTimersByTime(22000); });
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith("6101");
  });

  it("says the offer is closed once another technician has taken it", () => {
    const { onDismissUnavailable, onAccept, card } = show(job(), { isUnavailable: true, unavailableMessage: "This job has already been taken by another technician." });
    expect(card).toHaveTextContent("Offer closed");
    expect(card).toHaveTextContent("This job has already been taken by another technician.");
    expect(within(card).queryByRole("button", { name: "Slide to accept" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Dismiss" }));
    expect(onDismissUnavailable).toHaveBeenCalledWith("6101");
    expect(onAccept).not.toHaveBeenCalled();
  });
});
