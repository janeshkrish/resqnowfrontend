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
    renderAt("/services");
    expect(screen.queryByTestId("home-glass-header")).not.toBeInTheDocument();
    expect(screen.getByAltText("ResQNow Logo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/request-service/emergency");
  });

  it("steps aside on vehicle selection, which has its own back button", () => {
    const { container } = renderAt("/request-service/towing");
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the logo header with a back button on the later request steps", () => {
    renderAt("/request-service/towing/car");
    expect(screen.getByAltText("ResQNow Logo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });
});
