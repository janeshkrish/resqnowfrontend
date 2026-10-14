import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import TowingEstimateCard from "./TowingEstimateCard";

it("shows route information without a request-specific fare before acceptance", () => {
  const { container } = render(<TowingEstimateCard estimate={{ quote: { distance_km: 12, final_estimated_price: 938.54, pricing_breakdown: { tow_truck_type: "flatbed", platform_fee: 85 } } }} />);
  expect(container).not.toHaveTextContent("₹");
  expect(screen.getByText(/price.*after.*accepts/i)).toBeInTheDocument();
  expect(container).toHaveTextContent("12.0 km");
  expect(container).toHaveTextContent("Flatbed truck");
});
