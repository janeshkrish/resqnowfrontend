import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("./home/HomeGlassHeader", () => ({
  default: () => <div data-testid="home-glass-header" />,
}));

import MobileAppHeader from "./MobileAppHeader";

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <MobileAppHeader />
  </MemoryRouter>,
);

describe("MobileAppHeader", () => {
  it("uses the glass header on the home screen", () => {
    renderAt("/");
    expect(screen.getByTestId("home-glass-header")).toBeInTheDocument();
    expect(screen.queryByAltText("ResQNow Logo")).not.toBeInTheDocument();
  });

  it("keeps the existing logo header with SOS on every other screen", () => {
    renderAt("/subscription");
    expect(screen.queryByTestId("home-glass-header")).not.toBeInTheDocument();
    expect(screen.getByAltText("ResQNow Logo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/request-service/emergency");
    expect(screen.getByRole("banner")).not.toHaveClass("rq-tab-topbar");
  });

  it.each(["/services", "/my-requests", "/settings"])(
    "on %s the bar is only for when the bottom bar is switched off, so the styles can hide it",
    (path) => {
      renderAt(path);
      // Still there as the way home; index.css hides .rq-tab-topbar while the bottom bar is on the page.
      expect(screen.getByRole("banner")).toHaveClass("rq-tab-topbar");
      expect(screen.getByAltText("ResQNow Logo").closest("a")).toHaveAttribute("href", "/");
    },
  );

  it("steps aside on vehicle selection, which has its own back button", () => {
    const { container } = renderAt("/request-service/towing");
    expect(container).toBeEmptyDOMElement();
  });

  it("steps aside on the live radar, which has its own floating location bar", () => {
    const { container } = renderAt("/map");
    expect(container).toBeEmptyDOMElement();
  });

  it("steps aside in My garage, which has its own back button", () => {
    expect(renderAt("/my-garage").container).toBeEmptyDOMElement();
  });

  it("steps aside on the request form, which has its own back button, title and steps", () => {
    renderAt("/request-service/towing/car");
    expect(screen.queryByAltText("ResQNow Logo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /go back/i })).not.toBeInTheDocument();
  });
});
