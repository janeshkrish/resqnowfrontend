import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as { name: string } | null }));
const geo = vi.hoisted(() => ({
  value: {
    place: null as { title: string; subtitle: string } | null,
    address: null as string | null,
    loading: true,
    error: null as string | null,
    errorCode: null as number | null,
    requestLocation: vi.fn(),
  },
}));
const native = vi.hoisted(() => ({ isNative: false, requestPermissions: vi.fn() }));
const toastInfo = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => geo.value }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.isNative } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { requestPermissions: native.requestPermissions } }));
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

import HomeGlassHeader from "./HomeGlassHeader";

const renderHeader = () => render(
  <MemoryRouter>
    <HomeGlassHeader />
  </MemoryRouter>,
);

const setGeo = (overrides: Partial<typeof geo.value>) => {
  geo.value = { ...geo.value, ...overrides };
};

describe("HomeGlassHeader", () => {
  beforeEach(() => {
    auth.user = null;
    native.isNative = false;
    native.requestPermissions.mockReset().mockResolvedValue({ location: "granted" });
    toastInfo.mockReset();
    geo.value = {
      place: null,
      address: null,
      loading: true,
      error: null,
      errorCode: null,
      requestLocation: vi.fn(),
    };
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("asks for the location once as soon as the home screen opens", () => {
    renderHeader();
    expect(geo.value.requestLocation).toHaveBeenCalledTimes(1);
  });

  it("greets a signed-in customer by first name and keeps the SOS button", () => {
    auth.user = { name: "Aswanth Kumar" };
    renderHeader();

    expect(screen.getByText("Aswanth")).toBeInTheDocument();
    expect(screen.getByText(/Hello,/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/request-service/emergency");
  });

  it("shows no greeting for a guest", () => {
    renderHeader();
    expect(screen.queryByText(/Hello,/)).not.toBeInTheDocument();
  });

  it("shows the finding state while the location loads", () => {
    renderHeader();
    expect(screen.getByText("Finding your location…")).toBeInTheDocument();
  });

  it("shows the area and short address once found", () => {
    setGeo({ loading: false, place: { title: "Peelamedu", subtitle: "Avinashi Road, Peelamedu, Coimbatore 641004" } });
    renderHeader();

    expect(screen.getByText("Peelamedu")).toBeInTheDocument();
    expect(screen.getByText("Avinashi Road, Peelamedu, Coimbatore 641004")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /current location: peelamedu/i })).toBeInTheDocument();
  });

  it("falls back to the full address when no area summary is available", () => {
    setGeo({ loading: false, address: "11.0200, 76.9900" });
    renderHeader();

    expect(screen.getByText("Current location")).toBeInTheDocument();
    expect(screen.getByText("11.0200, 76.9900")).toBeInTheDocument();
  });

  it("offers to turn location on when permission is denied, and explains how on the web", () => {
    setGeo({ loading: false, error: "denied", errorCode: 1 });
    renderHeader();
    expect(screen.getByText("Location is off")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /location is off/i }));

    expect(toastInfo).toHaveBeenCalledOnce();
    expect(geo.value.requestLocation).toHaveBeenCalledTimes(2);
  });

  it("asks Android for location permission again from the header", async () => {
    native.isNative = true;
    setGeo({ loading: false, error: "denied", errorCode: 1 });
    renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /location is off/i }));
    });

    expect(native.requestPermissions).toHaveBeenCalledOnce();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(geo.value.requestLocation).toHaveBeenCalledTimes(2);
  });

  it("offers a retry for other location failures", () => {
    setGeo({ loading: false, error: "timeout", errorCode: 3 });
    renderHeader();

    expect(screen.getByText("Couldn't find you")).toBeInTheDocument();
    expect(screen.getByText("Tap to try again")).toBeInTheDocument();
  });

  it("tucks the greeting away and tightens the capsule once the page scrolls", async () => {
    auth.user = { name: "Aswanth" };
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const { container } = renderHeader();
    expect(container.querySelector(".rq-glass-capsule")).not.toHaveClass("is-compact");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      frames.splice(0).forEach((callback) => callback(0));
    });

    expect(container.querySelector(".rq-glass-capsule")).toHaveClass("is-compact");
    expect(container.querySelector(".rq-greeting")).toHaveClass("is-hidden");
  });
});
