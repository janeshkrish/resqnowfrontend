import { describe, expect, it } from "vitest";

import { summarizePlace } from "./placeSummary";

describe("summarizePlace", () => {
  it("uses the area as the title and a short street, area, city line", () => {
    expect(summarizePlace({
      display_name: "12, Avinashi Road, Peelamedu, Coimbatore North, Coimbatore, Tamil Nadu, 641004, India",
      address: {
        house_number: "12",
        road: "Avinashi Road",
        suburb: "Peelamedu",
        city_district: "Coimbatore North",
        city: "Coimbatore",
        state: "Tamil Nadu",
        postcode: "641004",
        country: "India",
      },
    })).toEqual({
      title: "Peelamedu",
      subtitle: "12, Avinashi Road, Peelamedu, Coimbatore 641004",
    });
  });

  it("falls back to the city when there is no area and never repeats a segment", () => {
    expect(summarizePlace({
      address: { road: "Race Course Road", city: "Coimbatore", postcode: "641018" },
    })).toEqual({ title: "Coimbatore", subtitle: "Race Course Road, Coimbatore 641018" });
  });

  it("uses the display name when the provider sent no address details", () => {
    expect(summarizePlace({ display_name: "Gandhipuram, Coimbatore, Tamil Nadu, 641012, India" }))
      .toEqual({ title: "Gandhipuram", subtitle: "Coimbatore, Tamil Nadu, 641012" });
  });

  it("returns null for an empty or invalid result", () => {
    expect(summarizePlace(null)).toBeNull();
    expect(summarizePlace({})).toBeNull();
  });
});
