import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequestForm from "./RequestForm";
import { searchCatalog } from "@/lib/vehicleChoice";

const state = vi.hoisted(() => ({ step: 1, data: {} as any, currentData: null as any, options: null as any, submit: vi.fn(), next: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, updateProfile: vi.fn() }) }));
vi.mock("@/hooks/usePricingConfig", () => ({ usePricingConfig: () => ({ data: {} }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }), useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === "home" ? { services: [] } : [] }) }));
// The flow owns geolocation, network submission and draft storage. Keep those external
// effects simulated while exercising the real form, question rendering and payload builder.
vi.mock("@/hooks/useUnifiedServiceRequestFlow", () => ({ useUnifiedServiceRequestFlow: (options: any) => {
  const [formData, setFormData] = useState(state.data);
  state.currentData = formData;
  state.options = options;
  return { currentStep: state.step, formData, setFormData, isSubmitting: false, canProceed: () => true,
    handleNext: state.next, handleBack: vi.fn(), setCurrentStep: vi.fn(), submitRequest: state.submit };
} }));

function show(service: string, family: "ev" | "car" | "bike" = "ev") {
  return render(<MemoryRouter initialEntries={[`/request-service/${service}/${family}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/request-service/:serviceId/:family" element={<RequestForm family={family} />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  state.step = 1;
  state.data = { name: "Asha", phone: "9999999999", vehicleType: "ev", vehicleSubtype: "electric-scooter", vehicleModel: "450X", vehicleBrand: "Ather", location: "Pickup", locationLat: 11, locationLng: 77, answers: {}, vehicleSource: "garage" };
  state.options = null;
  state.submit.mockReset(); state.next.mockReset();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLElement.prototype.scrollTo = vi.fn();
});

describe("EV request UI", () => {
  it("offers chassis and EV-system inspection without engine or radiator advice", () => {
    state.data.answers = { help: "inspect", drive: "no", issue: ["heat"] };
    const { container } = show("mechanical");
    expect(screen.getByRole("radio", { name: /wheels, suspension or brakes/i })).toBeInTheDocument();
    expect(screen.getByText(/motor, controller or electrical faults/i)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/engine|radiator/i);
    fireEvent.click(screen.getByRole("radio", { name: /wheels, suspension or brakes/i }));
    expect(screen.getByRole("button", { name: /^Continue/ })).toHaveAttribute("aria-disabled", "false");
  });

  it("distinguishes low-voltage assistance from main-drive battery inspection", () => {
    state.data.answers = { symptom: "slow", need: "jump" };
    const { container } = show("battery");
    expect(screen.getByRole("radio", { name: /low-voltage.*auxiliary/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /main-drive.*traction/i })).toBeInTheDocument();
    expect(container).toHaveTextContent(/model-specific/i);
    expect(container).not.toHaveTextContent(/engine/i);
    expect(screen.queryByRole("radio", { name: "Jump-start" })).toBeNull();
  });

  it("preserves ordinary battery starting questions", () => {
    state.data = { ...state.data, vehicleType: "car", vehicleSubtype: "sedan", vehicleBrand: "Maruti Suzuki", vehicleModel: "Swift" };
    const { container } = show("battery", "car");
    expect(screen.getByRole("radio", { name: "Jump-start" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Engine tries, then stops");
    expect(screen.queryByRole("radio", { name: /main-drive.*traction/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Use EV services" })).toHaveAttribute("href", "/request-service/battery/ev");
  });

  it("directs electric vehicles from fuel delivery to EV charging", () => {
    state.data = { ...state.data, vehicleType: "car", vehicleSubtype: "sedan", vehicleBrand: "Maruti Suzuki", vehicleModel: "Swift" };
    show("fuel", "car");
    expect(screen.getByRole("link", { name: "Use EV services" })).toHaveAttribute("href", "/request-service/ev-charging/ev");
  });

  it.each([1, 3])("blocks an old ordinary-route EV catalogue draft at step %s", step => {
    const model = searchCatalog("ev", "tiago ev").find(entry => entry.model === "Tiago EV")!;
    state.step = step;
    state.data = { ...state.data, vehicleType: "car", vehicleSource: "catalog", catalogModelId: model.id, vehicleSubtype: "hatchback", vehicleBrand: model.brand, vehicleModel: "Tata Motors Tiago EV", answers: { symptom: "slow", need: "jump" } };
    show("battery", "car");
    expect(state.options.validateStep1(state.data)).toBe(false);
    expect(() => state.options.buildRequestExtras(state.data)).toThrow(/EV services/i);
    expect(screen.getByRole("link", { name: "Use EV services" })).toHaveAttribute("href", "/request-service/battery/ev");
    expect(screen.queryByRole("radio", { name: "Jump-start" })).toBeNull();
    if (step === 3) fireEvent.keyDown(screen.getByRole("button", { name: "Slide to find technician" }), { key: "Enter" });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["garage", "Ather Energy", "Ather Energy 450X"],
    ["manual", "", "450X"],
  ])("blocks an old %s known EV even without a catalogue id", (source, brand, name) => {
    state.step = 3;
    state.data = { ...state.data, vehicleType: "bike", vehicleSource: source, catalogModelId: null, vehicleSubtype: "scooter", vehicleBrand: brand, vehicleModel: name, answers: { symptom: "dead", need: "jump" } };
    show("battery", "bike");
    fireEvent.keyDown(screen.getByRole("button", { name: "Slide to find technician" }), { key: "Enter" });
    expect(state.submit).not.toHaveBeenCalled();
    expect(() => state.options.buildRequestExtras(state.data)).toThrow(/EV services/i);
  });

  it("blocks unknown connectors and offers towing to a charger", () => {
    state.data.answers = { left: "0", port: "dk", plan: "charge" };
    show("ev-charging");
    const continueButton = screen.getByRole("button", { name: /^Choose a known charging socket/ });
    expect(continueButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Go to towing" })).toBeInTheDocument();
    fireEvent.click(continueButton);
    expect(state.next).not.toHaveBeenCalled();
  });

  it("requires a vehicle brand for a proprietary connector", () => {
    state.data.vehicleBrand = "";
    state.data.answers = { left: "0", port: "brand", plan: "charge" };
    show("ev-charging");
    expect(screen.getByRole("button", { name: /Choose.*brand/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("accepts a manually entered EV brand for a proprietary plug and includes it in the request", () => {
    state.data = { ...state.data, vehicleSource: "manual", manualName: "Prototype EV", vehicleModel: "Prototype EV", vehicleBrand: "", answers: { left: "0", port: "brand", plan: "charge" } };
    show("ev-charging");
    expect(screen.getByRole("button", { name: /Choose.*brand/i })).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "EV brand" }), { target: { value: "Ather Energy" } });
    const next = screen.getByRole("button", { name: /^Continue/ });
    expect(next).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(next);
    expect(state.next).toHaveBeenCalledOnce();
    expect(state.options.buildRequestExtras(state.currentData)).toMatchObject({ vehicle_brand: "Ather Energy", vehicle_subtype: "electric-scooter", details: { answers: expect.arrayContaining([expect.objectContaining({ id: "port", value: "brand" })]) } });
  });

  it.each(["", "dk", "unknown"])("prevents a restored confirmation draft with port %s from being submitted", (port) => {
    state.step = 3; state.data.answers = { left: "0", port, plan: "charge" };
    show("ev-charging");
    fireEvent.keyDown(screen.getByRole("button", { name: "Slide to find technician" }), { key: "Enter" });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("prevents a restored proprietary-connector draft without a brand from being submitted", () => {
    state.step = 3; state.data.vehicleBrand = ""; state.data.answers = { left: "0", port: "brand", plan: "charge" };
    show("ev-charging");
    fireEvent.keyDown(screen.getByRole("button", { name: "Slide to find technician" }), { key: "Enter" });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("submits a known proprietary connector with the selected brand", () => {
    state.step = 3; state.data.answers = { left: "0", port: "brand", plan: "charge" };
    show("ev-charging");
    fireEvent.keyDown(screen.getByRole("button", { name: "Slide to find technician" }), { key: "Enter" });
    expect(state.submit).toHaveBeenCalledOnce();
    expect(state.options.buildRequestExtras(state.data)).toMatchObject({ vehicle_brand: "Ather", vehicle_subtype: "electric-scooter", details: { answers: [
      expect.objectContaining({ id: "left", value: "0" }), expect.objectContaining({ id: "port", value: "brand" }), expect.objectContaining({ id: "plan", value: "charge" }),
    ] } });
  });

  it("recovers a known catalogue body for a legacy EV draft and includes it in request and estimate details", () => {
    const model = searchCatalog("ev", "tiago ev").find(entry => entry.model === "Tiago EV")!;
    state.data = { ...state.data, vehicleSource: "catalog", vehicleSubtype: "electric-car", catalogModelId: model.id, catalogBrandId: model.brandId, vehicleBrand: model.brand, vehicleModel: "Tata Motors Tiago EV" };
    show("towing");
    expect(state.options.buildRequestExtras(state.data)).toMatchObject({ vehicle_subtype: "electric-car", details: { vehicle_base_subtype: "hatchback" } });
    expect(state.options.buildEstimateExtras(state.data)).toMatchObject({ vehicleSubtype: "electric-car", details: { vehicle_base_subtype: "hatchback" } });
  });

  it("preserves a manually selected EV body in payloads and towing drafts", () => {
    state.data = { ...state.data, vehicleSource: "manual", vehicleSubtype: "electric-car", vehicleBaseSubtype: "sedan", vehicleModel: "Prototype EV", manualName: "Prototype EV", answers: { left: "0", port: "dk", plan: "charge" } };
    show("ev-charging");
    expect(state.options.buildRequestExtras(state.data)).toMatchObject({ vehicle_subtype: "electric-car", details: { vehicle_base_subtype: "sedan" } });
    fireEvent.click(screen.getByRole("button", { name: "Go to towing" }));
    const draft = JSON.parse(localStorage.getItem("resqnow_service_request_towing_ev") || "null");
    expect(draft.formData).toMatchObject({ vehicleSubtype: "electric-car", vehicleBaseSubtype: "sedan", answers: {} });
  });
});
