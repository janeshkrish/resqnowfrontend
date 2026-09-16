import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileTrackingSummaryDock from "./MobileTrackingSummaryDock";

const summary = {
  eyebrow: "Technician arriving in",
  value: "8 min",
  detail: "2.4 km away",
  journeyLabel: "On the way",
};

describe("MobileTrackingSummaryDock", () => {
  it("shows the live essentials and preserves technician contact links", () => {
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={true}
        isMapFocus={false}
        onShowMap={vi.fn()}
        onShowDetails={vi.fn()}
        technician={{
          name: "Arun Kumar",
          phone: "9999999999",
          ratingLabel: "4.8",
          completedJobs: 12,
        }}
      />,
    );

    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("8 min");
    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("2.4 km away");
    expect(screen.getByRole("link", { name: "Message technician" })).toHaveAttribute("href", "sms:9999999999");
    expect(screen.getByRole("link", { name: "Call technician" })).toHaveAttribute("href", "tel:9999999999");
  });

  it("offers explicit customer-controlled map and details focus actions", () => {
    const onShowMap = vi.fn();
    const onShowDetails = vi.fn();
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={false}
        isMapFocus={false}
        onShowMap={onShowMap}
        onShowDetails={onShowDetails}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
    fireEvent.click(screen.getByRole("button", { name: "View service details" }));
    expect(onShowMap).toHaveBeenCalledOnce();
    expect(onShowDetails).toHaveBeenCalledOnce();
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it("keeps an online payment CTA reachable in map focus", () => {
    const onPayOnline = vi.fn();
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={true}
        isMapFocus={true}
        onShowMap={vi.fn()}
        onShowDetails={vi.fn()}
        paymentAction={{ amountLabel: "INR 500.00", onPayOnline }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pay INR 500.00 online" }));
    expect(onPayOnline).toHaveBeenCalledOnce();
  });
});
