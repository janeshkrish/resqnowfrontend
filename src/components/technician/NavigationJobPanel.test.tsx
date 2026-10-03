import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavigationJobPanel } from "./NavigationJobPanel";

const job = {
  stopLabel: "Customer location",
  address: "Brookefields Mall parking, Krishnasamy Road, Coimbatore",
  landmark: "Basement 2, pillar C14",
  phone: "9876543210",
};

describe("the navigation screen's job panel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows where the technician is going, with the landmark", () => {
    render(<NavigationJobPanel {...job} arrive={{ label: "I've arrived", onClick: vi.fn() }} />);

    const destination = screen.getByTestId("navigation-destination");
    expect(destination).toHaveTextContent("Customer location");
    expect(destination).toHaveTextContent("Brookefields Mall parking, Krishnasamy Road, Coimbatore");
    expect(destination).toHaveTextContent("Basement 2, pillar C14");
  });

  it("calls the customer's own number and runs the job's arrived step", () => {
    const onArrive = vi.fn();
    render(<NavigationJobPanel {...job} arrive={{ label: "I've arrived", onClick: onArrive }} />);

    expect(screen.getByRole("link", { name: "Call customer" })).toHaveAttribute("href", "tel:9876543210");
    fireEvent.click(screen.getByRole("button", { name: /I've arrived/ }));
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("asks the technician to mark arrived only once they are close, with a short buzz", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const arrive = { label: "I've arrived", onClick: vi.fn() };
    const view = render(<NavigationJobPanel {...job} arrive={arrive} />);
    expect(screen.queryByTestId("navigation-arrival-prompt")).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();

    view.rerender(<NavigationJobPanel {...job} arrive={arrive} reachedText="You've reached the customer" />);
    expect(screen.getByTestId("navigation-arrival-prompt")).toHaveTextContent("You've reached the customer");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I've arrived/ })).toHaveClass("is-near");
    // Once, not on every position update.
    view.rerender(<NavigationJobPanel {...job} arrive={arrive} reachedText="You've reached the customer" />);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("offers no arrived step, and no prompt, when the job has none at this point", () => {
    render(<NavigationJobPanel {...job} arrive={null} reachedText="You've reached the customer" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("navigation-arrival-prompt")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call customer" })).toBeInTheDocument();
  });

  it("leaves out the call button when the customer gave no number", () => {
    render(<NavigationJobPanel {...job} phone={null} arrive={{ label: "Reached pickup", onClick: vi.fn() }} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reached pickup/ })).toBeInTheDocument();
  });

  describe("Google Maps for those who prefer it", () => {
    const href = "https://www.google.com/maps/dir/?api=1&destination=11.0092%2C76.9605&travelmode=driving&dir_action=navigate";

    it("opens Google Maps beside this screen, which stays open to come back to", () => {
      render(<NavigationJobPanel {...job} googleMaps={{ href }} arrive={{ label: "I've arrived", onClick: vi.fn() }} />);

      const link = screen.getByRole("link", { name: "Open in Google Maps" });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      // The call and the job's own step are still here.
      expect(screen.getByRole("link", { name: "Call customer" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /I've arrived/ })).toBeInTheDocument();
    });

    it("says so when the customer will stop seeing the technician move", () => {
      const note = "Live tracking pauses while Google Maps is open";
      const view = render(<NavigationJobPanel {...job} googleMaps={{ href, note }} />);
      expect(screen.getByText(note)).toBeInTheDocument();

      // The Android app with its tracking service keeps sending: nothing to warn about.
      view.rerender(<NavigationJobPanel {...job} googleMaps={{ href, note: null }} />);
      expect(screen.queryByText(note)).not.toBeInTheDocument();
    });

    it("is not shown when there is no link to give", () => {
      render(<NavigationJobPanel {...job} googleMaps={null} arrive={{ label: "I've arrived", onClick: vi.fn() }} />);
      expect(screen.queryByRole("link", { name: "Open in Google Maps" })).not.toBeInTheDocument();
    });

    it("stands alone when the customer gave no number", () => {
      render(<NavigationJobPanel {...job} phone={null} googleMaps={{ href }} />);
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Open in Google Maps" })).toBeInTheDocument();
    });
  });

  it("cannot be tapped twice while the status is being saved", () => {
    render(<NavigationJobPanel {...job} arrive={{ label: "I've arrived", onClick: vi.fn() }} busy />);
    expect(screen.getByRole("button", { name: /I've arrived/ })).toBeDisabled();
  });
});
