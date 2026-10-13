import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import CancelledJobCard from "@/components/technician/CancelledJobCard";
import { setTechLanguage } from "@/lib/technicianLanguage";

import TechHome, { type TechHomeProps } from "./TechHome";

// The alerts note looks at the phone's own settings and has its own tests; it is left out here.
vi.mock("@/components/technician/JobAlertsBanner", () => ({ default: () => null }));

afterEach(() => {
  // The page comes down first, so going back to English redraws nothing.
  cleanup();
  setTechLanguage("en");
});

const props: TechHomeProps = {
  name: "Arun Kumar",
  photoUrl: null,
  isOnline: true,
  unread: 0,
  todayEarnings: 494,
  jobsDoneToday: 2,
  points: 202,
  withdrawable: 3120,
  jobsDone: 38,
  rating: 4.67,
  pendingDues: 0,
  towing: false,
  fleetCount: 0,
  teamCount: 0,
  onToggleAvailability: vi.fn(),
  onOpenMessages: vi.fn(),
  onPayDues: vi.fn(),
  onOpenFleet: vi.fn(),
  onOpenTeam: vi.fn(),
};

const show = (over: Partial<TechHomeProps> = {}) =>
  render(
    <MemoryRouter>
      <TechHome {...props} {...over} />
    </MemoryRouter>,
  );

describe("the technician's home", () => {
  it("says the technician is on duty and offers to go off", () => {
    const onToggleAvailability = vi.fn();
    show({ onToggleAvailability });
    const duty = screen.getByTestId("technician-duty");
    expect(duty).toHaveAttribute("data-state", "on");
    expect(within(duty).getByRole("status")).toHaveTextContent("ON DUTY");
    fireEvent.click(within(duty).getByRole("button", { name: "Go off duty" }));
    expect(onToggleAvailability).toHaveBeenCalledWith(false);
  });

  it("says the technician is off duty and offers one button to start", () => {
    const onToggleAvailability = vi.fn();
    show({ isOnline: false, onToggleAvailability });
    const duty = screen.getByTestId("technician-duty");
    expect(duty).toHaveAttribute("data-state", "off");
    expect(within(duty).getByRole("status")).toHaveTextContent("OFF DUTY");
    expect(within(duty).queryByText(/Waiting for a job/)).toBeNull();
    fireEvent.click(within(duty).getByRole("button", { name: "Go ON duty" }));
    expect(onToggleAvailability).toHaveBeenCalledWith(true);
  });

  it("shows today's money, how many jobs made it, and the points", () => {
    show();
    const today = screen.getByTestId("technician-today");
    expect(today).toHaveAttribute("href", "/technician/earnings");
    expect(today).toHaveTextContent("₹494");
    expect(today).toHaveTextContent("2 jobs done today");
    expect(today).toHaveTextContent("202 points");
  });

  it("words the day's jobs for none and for one", () => {
    const { unmount } = show({ jobsDoneToday: 0 });
    expect(screen.getByTestId("technician-today")).toHaveTextContent("No jobs done yet today");
    unmount();
    show({ jobsDoneToday: 1 });
    expect(screen.getByTestId("technician-today")).toHaveTextContent("1 job done today");
  });

  it("leads to money, jobs, rating and a call for help", () => {
    show();
    expect(screen.getByRole("link", { name: /My money/ })).toHaveTextContent("₹3,120 ready");
    expect(screen.getByRole("link", { name: /My jobs/ })).toHaveAttribute("href", "/technician/history");
    expect(screen.getByRole("link", { name: /My rating/ })).toHaveTextContent("4.7 out of 5");
    expect(screen.getByRole("link", { name: /Help/ })).toHaveAttribute("href", "tel:+919566510080");
  });

  it("says so when nobody has rated the technician yet", () => {
    show({ rating: null });
    expect(screen.getByRole("link", { name: /My rating/ })).toHaveTextContent("No ratings yet");
  });

  it("counts new messages on the bell and opens them", () => {
    const onOpenMessages = vi.fn();
    show({ unread: 12, onOpenMessages });
    const bell = screen.getByRole("button", { name: "Messages, 12 new" });
    expect(bell).toHaveTextContent("9+");
    fireEvent.click(bell);
    expect(onOpenMessages).toHaveBeenCalledTimes(1);
  });

  it("asks for the fee only when one is owed", () => {
    const onPayDues = vi.fn();
    const { unmount } = show();
    expect(screen.queryByTestId("technician-dues")).toBeNull();
    unmount();
    show({ pendingDues: 120.5, onPayDues });
    expect(screen.getByTestId("technician-dues")).toHaveTextContent("You need to pay ₹120.50");
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹120.50 now" }));
    expect(onPayDues).toHaveBeenCalledTimes(1);
  });

  it("gives a towing operator their vehicles and team, and nobody else", () => {
    const onOpenFleet = vi.fn();
    const onOpenTeam = vi.fn();
    const { unmount } = show();
    expect(screen.queryByRole("button", { name: /My vehicles/ })).toBeNull();
    unmount();
    show({ towing: true, fleetCount: 3, teamCount: 4, onOpenFleet, onOpenTeam });
    fireEvent.click(screen.getByRole("button", { name: /My vehicles/ }));
    fireEvent.click(screen.getByRole("button", { name: /My team/ }));
    expect(screen.getByRole("button", { name: /My vehicles/ })).toHaveTextContent("3 tow trucks");
    expect(screen.getByRole("button", { name: /My team/ })).toHaveTextContent("4 people");
    expect(onOpenFleet).toHaveBeenCalledTimes(1);
    expect(onOpenTeam).toHaveBeenCalledTimes(1);
  });

  it("changes its words with the language, and keeps the amounts", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: /தமிழ்/ }));
    expect(screen.getByTestId("technician-duty")).toHaveTextContent("வேலைக்குத் தயார்");
    expect(screen.getByTestId("technician-today")).toHaveTextContent("₹494");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a job the customer cancelled", () => {
  const job = { id: "5502", contactName: "Asha", serviceType: "car-flat-tire", address: "Race Course Road", cancellationReason: "Found help nearby" };

  it("comes first on home, says who cancelled what and why, and leads to the jobs page", () => {
    const onViewDetails = vi.fn();
    show({ notice: <CancelledJobCard job={job} onViewDetails={onViewDetails} /> });
    const note = screen.getByTestId("cancelled-job");
    expect(note).toHaveTextContent("Job cancelled");
    expect(note).toHaveTextContent("Asha cancelled the Flat tyre job. You do not need to go.");
    expect(note).toHaveTextContent("Why: Found help nearby");
    expect(note).toHaveTextContent("#5502 · Race Course Road");
    // Before the duty card, so it is the first thing read.
    expect(note.compareDocumentPosition(screen.getByTestId("technician-duty")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(note).getByRole("button", { name: "See my jobs" }));
    expect(onViewDetails).toHaveBeenCalledWith(job);
  });

  it("speaks of the customer when the name is not known", () => {
    render(<CancelledJobCard job={{ id: "1", serviceType: "" }} />);
    expect(screen.getByTestId("cancelled-job")).toHaveTextContent("The customer cancelled the Roadside help job.");
  });
});
