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

  it("cannot be tapped twice while the status is being saved", () => {
    render(<NavigationJobPanel {...job} arrive={{ label: "I've arrived", onClick: vi.fn() }} busy />);
    expect(screen.getByRole("button", { name: /I've arrived/ })).toBeDisabled();
  });
});
