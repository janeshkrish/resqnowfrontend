import DynamicPricingStep from "./technician/DynamicPricingStep";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ mobile: true, token: "token" as string | null }));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => env.mobile }));
vi.mock("@/lib/api", () => ({
  getUserToken: () => env.token,
  apiUrl: (url: string) => url,
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => signupPricingProps })),
}));
vi.mock("./technician/LocationDetector", () => ({
  default: ({ onLocationDetected }: { onLocationDetected: (location: Record<string, string | number>) => void }) =>
    <button type="button" onClick={() => onLocationDetected({ latitude: 11.025, longitude: 77.005, accuracy: 10, address: '14 Avinashi Road, Coimbatore', locality: 'Peelamedu', city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' })}>Choose workshop location</button>,
}));

import VehicleServiceSelector from "./VehicleServiceSelector";
import TechnicianSignupWizard from "./technician/TechnicianSignupWizard";

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
    expect(screen.getByText("Then 3 quick steps")).toBeInTheDocument();

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


const signupPricingProps = {
  services: [{ id: 1, service_name: 'Flat Tire Repair', service_slug: 'flat_tire_repair' }],
  categories: [{ id: 1, category_name: 'Bike' }, { id: 2, category_name: 'Car' }],
  subcategories: [],
  pricingFields: [{ id: 1, service_id: 1, field_key: 'visit_charge', field_label: 'Visit charge', required: true }],
  selectedServiceNames: ['Flat Tire Repair'],
  selectedServiceIds: ['flat-tire'],
  selectedVehicleTypes: ['bike'],
  value: [],
  onChange: vi.fn(),
};

describe('signup pricing', () => {
  it('shows only selected vehicles and asks for the subtype before prices', () => {
    render(<DynamicPricingStep {...signupPricingProps} />);
    expect(screen.queryByText('Car')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Visit charge/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Bike$/ }));
    for (const name of ['Economy', 'Sports', 'Bullet', 'Scooter']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Economy' }).querySelector('svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Economy' }));
    expect(signupPricingProps.onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ service_id: 1, vehicle_category_id: 1,
        pricing_json: expect.objectContaining({ vehicle_subtype: 'commuter-bike', vehicle_subtype_label: 'Economy' }) }),
    ]));
  });

  it('restores saved subtype prices after leaving and revisiting pricing', () => {
    const value = [{ service_id: 1, vehicle_category_id: 1, pricing_json: {
      vehicle_subtype: 'sports-bike', vehicle_subtype_label: 'Sports', visit_charge: 0,
    } }];
    render(<DynamicPricingStep {...signupPricingProps} value={value} />);
    fireEvent.click(screen.getByRole('button', { name: /^Bike$/ }));
    expect(screen.getByLabelText(/Visit charge/)).toHaveValue(0);
  });

  it('offers bike and detailed car classes under EV without the generic Car choice', () => {
    render(<DynamicPricingStep {...signupPricingProps} categories={[{ id: 4, category_name: 'EV' }]} selectedVehicleTypes={['ev']} />);
    fireEvent.click(screen.getByRole('button', { name: 'EV' }));
    for (const name of ['Economy', 'Sports', 'Bullet', 'Scooter', 'Bike', 'Bus', 'Sedan', 'SUV', 'MPV', 'Hatchback']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Car' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sports' }));
    expect(signupPricingProps.onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ vehicle_category_id: 4, pricing_json: expect.objectContaining({ vehicle_type: 'ev', vehicle_subtype: 'sports-bike' }) }),
    ]));
    fireEvent.click(screen.getByRole('button', { name: 'Sedan' }));
    expect(signupPricingProps.onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ vehicle_category_id: 4, pricing_json: expect.objectContaining({ vehicle_type: 'ev', vehicle_subtype: 'sedan' }) }),
    ]));
  });
});

describe('technician application preview', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('reviews all six sections before Finish and validates edits before returning to preview', async () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    render(<MemoryRouter><TechnicianSignupWizard /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Your Name/), { target: { value: 'Arun Kumar' } });
    fireEvent.change(screen.getByLabelText(/Shop Name/), { target: { value: 'Arun Auto Care' } });
    fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose workshop location' }));
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    next();
    await screen.findByRole('heading', { name: 'What do you work on?' });
    fireEvent.click(screen.getByRole('button', { name: 'Car' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flat tyre' }));
    next();
    fireEvent.change(await screen.findByLabelText(/Aadhaar Number/), { target: { value: '123412341234' } });
    next();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'I am available 24 × 7' }));
    next();
    await screen.findByRole('heading', { name: 'Your expertise. Your rates.' });
    fireEvent.click(screen.getByRole('button', { name: 'Car' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sedan' }));
    fireEvent.change(screen.getByLabelText(/Visit charge/), { target: { value: '299' } });
    next();
    fireEvent.change(await screen.findByLabelText('UPI ID'), { target: { value: 'arun@upi' } });
    next();
    await screen.findByRole('heading', { name: 'Review your application.' });
    expect(within(screen.getByRole('navigation', { name: 'Registration progress' })).getAllByRole('button')).toHaveLength(8);
    for (const section of ['Personal details', 'Services', 'Verification', 'Operations', 'Pricing', 'Banking']) expect(screen.getByRole('button', { name: `Edit ${section}` })).toBeInTheDocument();
    expect(screen.getByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('arun@upi')).toBeInTheDocument();
    expect(screen.getByText('₹299')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Services' }));
    await screen.findByRole('heading', { name: 'What do you work on?' });
    fireEvent.click(screen.getByRole('button', { name: 'Bike' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & return to preview' }));
    await screen.findByRole('heading', { name: 'Review your application.' });
    next();
    await screen.findByText(/Choose a bike subtype/);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Pricing' }));
    await screen.findByRole('heading', { name: 'Your expertise. Your rates.' });
    fireEvent.click(screen.getByRole('button', { name: 'Bike' }));
    fireEvent.click(screen.getByRole('button', { name: 'Economy' }));
    fireEvent.change(screen.getByLabelText(/Visit charge/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & return to preview' }));
    await screen.findByRole('heading', { name: 'Review your application.' });
    expect(screen.getByText('₹0')).toBeInTheDocument();
    next();
    await screen.findByRole('heading', { name: "You're almost on the road." });
    expect(screen.getByRole('button', { name: 'Submit Application' })).toBeDisabled();
    scrollSpy.mockRestore();
  });
});
