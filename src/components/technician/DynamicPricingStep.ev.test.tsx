import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DynamicPricingStep, { type PricingRow, type PricingTemplate } from "./DynamicPricingStep";
import { buildLegacySignupPricingConfig, getSignupPricingError } from "@/utils/technicianSignupPricing";

const template: PricingTemplate = {
  services: [{ id: 8, service_name: "EV charging", service_slug: "ev-charging" }],
  categories: [{ id: 4, category_name: "EV" }], subcategories: [],
  pricingFields: [{ id: 81, service_id: 8, field_key: "charging_support_fee", field_label: "Charging support fee", required: true }],
};
const chargingRow = (subtype: string, extra: Record<string, string | number> = {}): PricingRow => ({
  service_id: 8, vehicle_category_id: 4, pricing_json: {
    service_domain: "ev-charging", vehicle_type: "ev", vehicle_subtype: subtype,
    vehicle_subtype_label: subtype, charging_support_fee: 400, cost_per_km: 20, ...extra,
  },
});

function PricingEditor() {
  const [value, onChange] = useState<PricingRow[]>([]);
  return <><DynamicPricingStep {...template} selectedServiceIds={["ev-charging"]} selectedVehicleTypes={["ev"]} value={value} onChange={onChange} /><output data-testid="rows">{JSON.stringify(value)}</output></>;
}
const editedRows = (): PricingRow[] => JSON.parse(screen.getByTestId("rows").textContent || "[]");

describe("charging capability registration", () => {
  it("stores connector and proprietary-brand CSV per subtype while preserving prices", () => {
    render(<PricingEditor />);
    fireEvent.click(screen.getByRole("button", { name: "EV", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Scooter", exact: true }));
    fireEvent.change(screen.getByLabelText("Charging support fee *"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Home plug" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Brand’s own plug" }));
    fireEvent.change(screen.getByLabelText("Supported EV brands *"), { target: { value: "Ather, Ola" } });
    expect(editedRows()[0].pricing_json).toMatchObject({ vehicle_subtype: "scooter", charging_support_fee: 500, supported_connectors: "home,brand", supported_ev_brands: "Ather, Ola" });

    fireEvent.click(screen.getByRole("button", { name: "Sedan", exact: true }));
    expect(screen.queryByLabelText("Supported EV brands *")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Home plug" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "CCS2" }));
    expect(editedRows()[1].pricing_json).toMatchObject({ vehicle_subtype: "sedan", supported_connectors: "ccs2" });
    fireEvent.click(screen.getByRole("button", { name: "Scooter", exact: true }));
    expect(screen.getByRole("checkbox", { name: "Home plug" })).toBeChecked();
    expect(screen.getByLabelText("Supported EV brands *")).toHaveValue("Ather, Ola");
    expect(screen.getByLabelText("Charging support fee *")).toHaveValue(500);
  });

  it("requires supported connectors on every charging subtype", () => {
    expect(getSignupPricingError([chargingRow("scooter")], template, ["ev-charging"], ["ev"])).toEqual(expect.stringMatching(/connector/i));
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "unknown" })], template, ["ev-charging"], ["ev"])).toEqual(expect.stringMatching(/connector/i));
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "home" }), chargingRow("sedan")], template, ["ev-charging"], ["ev"])).toEqual(expect.stringMatching(/connector.*sedan|sedan.*connector/i));
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "home" })], template, ["ev-charging"], ["ev"])).toBeNull();
  });

  it("requires proprietary brand coverage only when a brand connector is selected", () => {
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "home,brand" })], template, ["ev-charging"], ["ev"])).toEqual(expect.stringMatching(/brand/i));
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "brand", supported_ev_brands: " , " })], template, ["ev-charging"], ["ev"])).toEqual(expect.stringMatching(/brand/i));
    expect(getSignupPricingError([chargingRow("scooter", { supported_connectors: "brand", supported_ev_brands: "Ather, Ola" })], template, ["ev-charging"], ["ev"])).toBeNull();
  });

  it("summarizes connector coverage without merging different subtype capabilities", () => {
    const result = buildLegacySignupPricingConfig([
      chargingRow("scooter", { supported_connectors: "home,brand", supported_ev_brands: "ather,ola", inspection_note: "Model-specific adapters" }),
      chargingRow("sedan", { supported_connectors: "ccs2,type2", charging_support_fee: 700 }),
    ]);
    expect(result[0]).toMatchObject({
      metadata: { supported_connectors: "home,brand,ccs2,type2", supported_ev_brands: "ather,ola" },
      vehicle_pricing: { ev: { subcategories: {
        scooter: { supported_connectors: "home,brand", supported_ev_brands: "ather,ola", service_charge: 400, extra_km_charge: 20, inspection_note: "Model-specific adapters" },
        "electric-scooter": { supported_connectors: "home,brand" },
        sedan: { supported_connectors: "ccs2,type2", service_charge: 700 },
      } } },
    });
  });
});
