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
  const enhancedProps = {
    summary,
    isConnected: true,
    isMapFocus: false,
    onShowMap: vi.fn(),
    onShowDetails: vi.fn(),
    timeline: [
      { label: "Accepted", caption: "8:01 AM", complete: true, active: false },
      { label: "On the way", caption: "8 min", complete: false, active: true },
      { label: "Arrived", caption: "Est. 8:09", complete: false, active: false },
    ],
    serviceSummary: {
      title: "Lockout assistance",
      detail: "Hyundai Creta",
      amountLabel: "INR 768.90",
      guaranteeLabel: "Upfront guaranteed",
    },
    technician: {
      name: "Arun Kumar",
      phone: "9999999999",
      ratingLabel: "4.8",
      completedJobs: 12,
    },
    onRefresh: vi.fn(),
    onEmergency: vi.fn(),
    onShare: vi.fn(),
    canCancel: true,
    onRequestCancellation: vi.fn(),
  };

  it("renders the live timeline, verified partner, and request price without mock values", () => {
    render(<MobileTrackingSummaryDock {...enhancedProps} />);

    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("8 min");
    expect(screen.getByTestId("mobile-tracking-timeline")).toHaveTextContent("Accepted");
    expect(screen.getByTestId("mobile-tracking-timeline")).toHaveTextContent("On the way");
    expect(screen.getByTestId("mobile-tracking-timeline")).toHaveTextContent("Arrived");
    expect(screen.getByText("Verified ResQNow partner")).toBeInTheDocument();
    expect(screen.getByText("INR 768.90")).toBeInTheDocument();
  });

  it("exposes the approved live-tracking actions without replacing technician contact links", () => {
    render(<MobileTrackingSummaryDock {...enhancedProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh live tracking" }));
    fireEvent.click(screen.getByRole("button", { name: "Open emergency support" }));
    fireEvent.click(screen.getByRole("button", { name: "Share tracking link" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));

    expect(enhancedProps.onRefresh).toHaveBeenCalledOnce();
    expect(enhancedProps.onEmergency).toHaveBeenCalledOnce();
    expect(enhancedProps.onShare).toHaveBeenCalledOnce();
    expect(enhancedProps.onRequestCancellation).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Message technician" })).toHaveAttribute("href", "sms:9999999999");
    expect(screen.getByRole("link", { name: "Call technician" })).toHaveAttribute("href", "tel:9999999999");
  });

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

  it("does not call a stale live location current", () => {
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={true}
        trackingFreshness="DELAYED"
        isMapFocus={false}
        onShowMap={vi.fn()}
        onShowDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("Delayed")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
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
