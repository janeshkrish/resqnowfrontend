import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ConfirmationStep from "./ConfirmationStep";

it("does not show a selected technician's request-specific base charge before acceptance", () => {
  const { container } = render(<ConfirmationStep service={{ id: "towing", name: "Towing", estimatedPrice: "Starts from ₹599" } as any} formData={{ name: "Asha", phone: "9999999999", location: "Pickup", selectedTechnicianId: "7" } as any} estimatedBaseAmount={1040} onInputChange={vi.fn()} technicianName="Ravi" />);
  expect(container).not.toHaveTextContent("1040.00");
  expect(container).toHaveTextContent("Starts from ₹599");
  expect(container).toHaveTextContent("Price shown after a technician accepts");
});
