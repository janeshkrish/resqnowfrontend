import { describe, expect, it } from "vitest";

import { trackingMapModeFromSheetSnap } from "./trackingMapMode";

describe("tracking map mode", () => {
  it("maps the mobile sheet snap state to map camera padding", () => {
    expect(trackingMapModeFromSheetSnap("expanded")).toBe("sheet");
    expect(trackingMapModeFromSheetSnap("half")).toBe("balanced");
    expect(trackingMapModeFromSheetSnap("collapsed")).toBe("map");
  });
});
