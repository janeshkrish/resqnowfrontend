import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

import MobileBottomNav from "./MobileBottomNav";

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <MobileBottomNav />
  </MemoryRouter>,
);

describe("MobileBottomNav", () => {
  it("labels every tab and marks the current one", () => {
    renderAt("/");
    const home = screen.getByRole("link", { name: /home/i });
    expect(home).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /map/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /activity/i })).toHaveAttribute("href", "/my-requests");
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute("href", "/login?from=profile");
  });

  it("puts Get help in the middle, within thumb reach", () => {
    renderAt("/");
    const links = screen.getAllByRole("link");
    expect(links[2]).toHaveAccessibleName(/get help/i);
    expect(links[2]).toHaveAttribute("href", "/services");
  });

  it("steps aside during a service request", () => {
    const { container } = renderAt("/request-service/towing");
    expect(container).toBeEmptyDOMElement();
  });
});
