import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ mobile: true, token: "token" as string | null }));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => env.mobile }));
vi.mock("@/lib/api", () => ({ getUserToken: () => env.token }));

import VehicleServiceSelector from "./VehicleServiceSelector";

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/request-service/:serviceId" element={<VehicleServiceSelector />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  </MemoryRouter>,
);

const card = (name: RegExp) => screen.getByRole("button", { name });

describe("VehicleServiceSelector", () => {
  beforeEach(() => {
    env.mobile = true;
    env.token = "token";
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the service and the four vehicle types with their studio images", () => {
    renderAt("/request-service/towing");

    expect(screen.getByText("Towing Services")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /which vehicle\s*needs help\?/i })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    const expected: Array<[RegExp, string]> = [
      [/^car:/i, "/images/vehicles/car.webp"],
      [/^bike:/i, "/images/vehicles/bike.webp"],
      [/^commercial vehicle:/i, "/images/vehicles/truck.webp"],
      [/^electric vehicle:/i, "/images/vehicles/ev.webp"],
    ];
    for (const [name, src] of expected) {
      const button = card(name);
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button.querySelector("img")).toHaveAttribute("src", src);
    }
  });

  it("on mobile, marks the tapped card selected and then opens that vehicle's form", () => {
    vi.useFakeTimers();
    renderAt("/request-service/towing");

    fireEvent.click(card(/^car:/i));

    expect(card(/^car:/i)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/request-service/towing/car");
  });

  it("sends signed-out customers to login and remembers where they were going", () => {
    vi.useFakeTimers();
    env.token = null;
    renderAt("/request-service/battery");

    fireEvent.click(card(/^bike:/i));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/login");
    expect(sessionStorage.getItem("returnUrl")).toBe("/request-service/battery/bike");
  });

  it("keeps a technician picked from the map", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/request-service/towing?techId=tech-9");
    renderAt("/request-service/towing");

    fireEvent.click(card(/^commercial vehicle:/i));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/request-service/towing/commercial?techId=tech-9");
  });

  it("on desktop, waits for Continue instead of moving on by itself", () => {
    vi.useFakeTimers();
    env.mobile = false;
    renderAt("/request-service/towing");

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(card(/^electric vehicle:/i));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(continueButton).toBeEnabled();
    expect(continueButton).toHaveTextContent("Continue with EV");

    fireEvent.click(continueButton);
    expect(screen.getByTestId("location")).toHaveTextContent("/request-service/towing/ev");
  });

  it("goes home from the back button when there is no page to go back to", () => {
    renderAt("/request-service/towing");

    fireEvent.click(screen.getByRole("button", { name: /go back/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });
});
