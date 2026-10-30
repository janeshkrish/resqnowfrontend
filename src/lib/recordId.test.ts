import { describe, expect, it } from "vitest";
import { recordId } from "./recordId";

describe("record IDs at route boundaries", () => {
  it("preserves the production migrated technician UUID", () => {
    expect(recordId("0896f096-49af-598c-9c58-336d51b12a81")).toBe("0896f096-49af-598c-9c58-336d51b12a81");
    expect(recordId("0896F096-49AF-598C-9C58-336D51B12A81")).toBe("0896f096-49af-598c-9c58-336d51b12a81");
  });

  it("keeps legacy positive integer links readable", () => {
    expect(recordId("42")).toBe(42);
    expect(recordId(42)).toBe(42);
  });

  it.each([undefined, null, "", "0", "-1", "1.5", "1e2", "0x2a", "NaN", "Infinity", "9007199254740992", "not-a-technician", "0896f096-49af-598c-0c58-336d51b12a81", {}, true])("rejects an invalid ID: %s", (value) => {
    expect(recordId(value)).toBeNull();
  });
});
