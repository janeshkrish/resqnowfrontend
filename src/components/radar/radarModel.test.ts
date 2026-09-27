import { describe, expect, it } from "vitest";

import { brandOf, initialsOf } from "@/lib/brands";
import { placePinHtml, placePinSize, technicianPinHtml } from "./pins";
import { etaMinutes, formatKm, normalizeTechnicians, toEvView, toFuelView, toTechnicianView } from "./radarModel";

const resolve = (path: string) => `https://api.test${path}`;

describe("radar model", () => {
  it("keeps technicians with a real position, nearest first, with a usable photo URL", () => {
    const list = normalizeTechnicians([
      { id: "far", name: "Far Away", latitude: 11.1, longitude: 77.1, distance: 9.2 },
      { id: "none", name: "No Position", latitude: 0, longitude: 0 },
      { id: "near", name: "Near By", lat: 11.01, lng: 76.95, distance: "1.2", profile_photo: "/uploads/near.jpg", jobs_completed: 40 },
      { id: "cdn", name: "Cdn Photo", latitude: 11.02, longitude: 76.96, distance: 3, profile_photo: "https://cdn.test/p.jpg" },
    ], [11, 76.9], resolve);

    expect(list.map((t) => t.id)).toEqual(["near", "cdn", "far"]);
    expect(list[0]).toMatchObject({ photo: "https://api.test/uploads/near.jpg", jobs: 40, distance: 1.2 });
    expect(list[1].photo).toBe("https://cdn.test/p.jpg");
    expect(list[2].photo).toBeNull();
    expect(normalizeTechnicians({ not: "a list" }, [11, 77], resolve)).toEqual([]);
  });

  it("describes a technician without making up a rating", () => {
    const [t] = normalizeTechnicians([{ id: "a", name: "Arun Kumar", service_type: "battery", specialties: ["battery", "jump_start"], vehicle_types: { car: true, bike: false }, latitude: 11, longitude: 77, distance: 2 }], [11, 77], resolve);
    const view = toTechnicianView(t);
    expect(view).toMatchObject({ rating: "New", initials: "AK", km: "2.0 km", etaMinutes: 8, services: ["Battery", "Jump Start"] });
    expect(view.vehicles).toEqual([{ label: "Car", icon: "directions_car" }]);
    expect(etaMinutes(10)).toBe(26);
    expect(formatKm(0.42)).toBe("420 m");
    expect(formatKm(undefined)).toBe("—");
  });

  it("only shows prices for the fuels a pump sells", () => {
    const prices = [
      { fuel: "petrol" as const, label: "Petrol", price: 101.94, unit: "L", change: 0.14, effectiveDate: "" },
      { fuel: "diesel" as const, label: "Diesel", price: 93.52, unit: "L", change: null, effectiveDate: "" },
      { fuel: "cng" as const, label: "CNG", price: 86.5, unit: "kg", change: 0, effectiveDate: "" },
    ];
    const base = { id: "p", name: "Shell Station", latitude: 11, longitude: 77, distance: 1500 };
    expect(toFuelView({ ...base, brand: "shell" }, prices).prices.map((p) => p.label)).toEqual(["Petrol", "Diesel"]);
    expect(toFuelView({ ...base, stationTypes: ["cng"] }, prices).prices).toEqual([{ label: "CNG", value: "₹86.50", change: 0 }]);
    expect(toFuelView({ ...base, brand: "shell" }, undefined)).toMatchObject({ prices: [], logo: "/images/brands/shell.png", km: "1.5 km" });
  });

  it("shortens Mappls' long charger names and shows where the charger is", () => {
    const view = toEvView({ id: "e", name: "Tata Power Electric Vehicle Charging Station", brand: "tatapower", latitude: null, longitude: null, address: "JW Marriott Hotel UB City, Vittal Mallya Road, Bengaluru" });
    expect(view).toMatchObject({ name: "Tata Power EV Charging Station", area: "JW Marriott Hotel UB City", sub: "Tata Power EZ Charge · JW Marriott Hotel UB City", initials: "TP" });
  });

  it("marks an EV station's hours as unknown rather than open", () => {
    const view = toEvView({ id: "e", name: "Plug Point", latitude: null, longitude: null, address: "MG Road, Bengaluru" });
    expect(view.status).toEqual({ text: "Hours not listed", tone: "none" });
    expect(view.kw).toBeNull();
    expect(view.directionsUrl).toBe(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Plug Point, MG Road, Bengaluru")}`);
  });

  it("knows only the brands it has logos for", () => {
    expect(brandOf("bpcl")).toEqual({ name: "Bharat Petroleum", logo: "/images/brands/bpcl.png" });
    expect(brandOf("toString")).toBeNull();
    expect(brandOf(undefined)).toBeNull();
    expect(initialsOf("  ")).toBe("RN");
    expect(initialsOf("Zeon")).toBe("ZE");
  });

  it("escapes names and addresses in map pins", () => {
    const tech = technicianPinHtml({ name: '<img src=x onerror="alert(1)">', photo: 'x" onerror="alert(1)', initials: "<b>", selected: false });
    expect(tech).not.toContain("<img src=x");
    expect(tech).not.toContain('x" onerror');
    expect(tech).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

    const place = placePinHtml({ name: "A & B", initials: "AB", label: "<script>", selected: true });
    expect(place).toContain("A &amp; B");
    expect(place).toContain("&lt;script&gt;");
    expect(place).toContain("is-sel");
  });

  it("shows only the logo on a pin when there is no power or price", () => {
    const pin = placePinHtml({ name: "Charger", initials: "CH", label: "", selected: false });
    expect(pin).toContain("rqr-ppin--icon");
    expect(pin).not.toContain("<span>");
    expect(placePinSize("", false)).toEqual({ width: 32, height: 32 });
    expect(placePinSize("60 kW", false).width).toBeGreaterThan(32);
  });
});
