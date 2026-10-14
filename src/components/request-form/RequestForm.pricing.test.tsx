import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import RequestForm from "./RequestForm";
import QuestionField from "./QuestionField";

const state = vi.hoisted(() => ({ step: 3 }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, updateProfile: vi.fn() }) }));
vi.mock("@/hooks/usePricingConfig", () => ({ usePricingConfig: () => ({ data: { service_base_prices: { towing: { car: 599 } } } }) }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === "home" ? { services: [{ service: "towing", startingPrice: 599 }] } : [] }),
}));
vi.mock("@/hooks/useUnifiedServiceRequestFlow", () => ({ useUnifiedServiceRequestFlow: () => ({
  currentStep: state.step, isSubmitting: false, setFormData: vi.fn(), canProceed: () => true,
  handleNext: vi.fn(), handleBack: vi.fn(), setCurrentStep: vi.fn(), submitRequest: vi.fn(),
  formData: { name: "Asha", phone: "9999999999", vehicleType: "car", vehicleSubtype: "sedan", vehicleModel: "Swift", location: "Pickup", dropLocation: "Workshop", locationLat: 11, locationLng: 77, answers: {}, vehicleSource: "garage" },
  towingEstimate: { quote: { distance_km: 12, final_estimated_price: 938.54 } }, isEstimatingTowing: false,
}) }));
vi.mock("@/components/service-request/LocationStep", () => ({ default: () => <div>Location picker</div> }));

beforeEach(() => { state.step = 3; vi.spyOn(window, "scrollTo").mockImplementation(() => {}); HTMLElement.prototype.scrollTo = vi.fn(); });

it("keeps generic starting prices in towing confirmation without showing a calculated fare", () => {
  const { container } = render(<MemoryRouter initialEntries={["/request-service/towing/car"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/request-service/:serviceId/:family" element={<RequestForm family="car" />} /></Routes></MemoryRouter>);
  expect(screen.getByText("Starts from")).toBeInTheDocument();
  expect(container).toHaveTextContent("₹599");
  expect(container).not.toHaveTextContent("₹939");
  expect(container).not.toHaveTextContent("Fare estimate");
  expect(container).toHaveTextContent("Price shown after a technician accepts");
});

it("does not show a calculated towing fare in the location dock", () => {
  state.step = 2;
  const { container } = render(<MemoryRouter initialEntries={["/request-service/towing/car"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/request-service/:serviceId/:family" element={<RequestForm family="car" />} /></Routes></MemoryRouter>);
  expect(container).not.toHaveTextContent("₹939");
  expect(container).toHaveTextContent("Price shown after a technician accepts");
});

it("keeps fuel unit and delivery starting rates without a request-specific fuel total", () => {
  const { container } = render(<QuestionField question={{ id: "cost", kind: "fuelcalc" } as any} context={{ family: "car" }} answers={{ fuel: "petrol", qty: "5" }} onPick={vi.fn()} onSwitch={vi.fn()} fuel={{ pricePerLitre: 100, area: "Coimbatore", serviceFee: 200 }} />);
  expect(container).not.toHaveTextContent("₹700");
  expect(container).not.toHaveTextContent("₹500");
  expect(container).toHaveTextContent("₹100");
  expect(container).toHaveTextContent("from ₹200");
  expect(container).toHaveTextContent("Price shown after a technician accepts");
});
