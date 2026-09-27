import { describe, expect, it } from "vitest";
import { formatPlate, helpPath, initialsOf, normalizeStatus, shortMake } from "./garage";

describe("garage helpers", () => {
  it("writes Indian number plates the way they are printed", () => {
    expect(formatPlate("ka01ab1234")).toBe("KA 01 AB 1234");
    expect(formatPlate("KA-1-AB-12")).toBe("KA 01 AB 12");
    expect(formatPlate("dl 3c 5678")).toBe("DL 03 C 5678");
    expect(formatPlate("  22 bh 1234 aa ")).toBe("22 BH 1234 AA");
    expect(formatPlate("")).toBe("");
  });

  it("uses the short brand name people say", () => {
    expect(shortMake("Tata Motors")).toBe("Tata");
    expect(shortMake("Maruti Suzuki")).toBe("Maruti");
    expect(shortMake("Toyota")).toBe("Toyota");
  });

  it("falls back to initials for brands without a logo", () => {
    expect(initialsOf("TVS Motor")).toBe("TVS");
    expect(initialsOf("Mercedes-Benz")).toBe("MB");
    expect(initialsOf("Volvo")).toBe("VO");
    expect(initialsOf("")).toBe("?");
  });

  it("treats unknown statuses as ready", () => {
    expect(normalizeStatus("maintenance")).toBe("maintenance");
    expect(normalizeStatus("inactive")).toBe("inactive");
    expect(normalizeStatus("parked")).toBe("ready");
    expect(normalizeStatus(undefined)).toBe("ready");
  });

  it("sends Get help to the emergency request for that vehicle", () => {
    expect(helpPath({ id: 7, type: "car" })).toBe("/request-service/emergency/car?vehicle=7");
    expect(helpPath({ id: 9, type: "bike" })).toBe("/request-service/emergency/bike?vehicle=9");
  });
});
