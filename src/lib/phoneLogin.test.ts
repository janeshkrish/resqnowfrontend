import { describe, expect, it } from "vitest";

import {
  cleanName,
  codeDigits,
  formatCountdown,
  formatIndianMobile,
  isIndianMobile,
  isWrongCode,
  nextMobileDigits,
  parseIndianMobile,
  phoneLoginMessage,
  toE164,
} from "./phoneLogin";

describe("parseIndianMobile", () => {
  it("keeps the ten digits of what was typed", () => {
    expect(parseIndianMobile("98765 43210")).toBe("9876543210");
    expect(parseIndianMobile("98765-432")).toBe("98765432");
  });

  it("drops +91, 91 and a leading 0 from a pasted number", () => {
    expect(parseIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(parseIndianMobile("919876543210")).toBe("9876543210");
    expect(parseIndianMobile("09876543210")).toBe("9876543210");
  });

  it("does not take 91 off a number that is still being typed", () => {
    expect(parseIndianMobile("91")).toBe("91");
    expect(parseIndianMobile("9198765432")).toBe("9198765432");
  });

  it("never gives more than ten digits", () => {
    expect(parseIndianMobile("98765432109999")).toBe("9876543210");
  });
});

describe("isIndianMobile", () => {
  it("wants ten digits starting with 6 to 9", () => {
    expect(isIndianMobile("9876543210")).toBe(true);
    expect(isIndianMobile("6000000000")).toBe(true);
    expect(isIndianMobile("5876543210")).toBe(false);
    expect(isIndianMobile("987654321")).toBe(false);
  });
});

describe("formatIndianMobile and toE164", () => {
  it("splits the number as people say it", () => {
    expect(formatIndianMobile("9876543210")).toBe("98765 43210");
    expect(formatIndianMobile("98765")).toBe("98765");
    expect(formatIndianMobile("987654")).toBe("98765 4");
    expect(formatIndianMobile("")).toBe("");
  });

  it("adds +91 for Firebase", () => {
    expect(toE164("9876543210")).toBe("+919876543210");
  });
});

describe("nextMobileDigits", () => {
  it("follows typing", () => {
    expect(nextMobileDigits("98765", "98765 4")).toBe("987654");
    expect(nextMobileDigits("987654", "98765 ")).toBe("98765");
  });

  it("deleting the space removes the digit before it", () => {
    expect(nextMobileDigits("987654", "987654")).toBe("98765");
  });
});

describe("codeDigits", () => {
  it("keeps up to six digits", () => {
    expect(codeDigits("48 29 13 77")).toBe("482913");
    expect(codeDigits("4a8")).toBe("48");
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds", () => {
    expect(formatCountdown(30)).toBe("0:30");
    expect(formatCountdown(4)).toBe("0:04");
    expect(formatCountdown(75)).toBe("1:15");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});

describe("cleanName", () => {
  it("trims and joins spaces", () => {
    expect(cleanName("  Asha   Raman ")).toBe("Asha Raman");
  });
});

describe("phoneLoginMessage", () => {
  const error = (code: string) => Object.assign(new Error(code), { code });

  it("says a wrong code plainly and marks it as wrong", () => {
    expect(phoneLoginMessage(error("auth/invalid-verification-code"), "confirm")).toBe(
      "That code is not right. Check the SMS and try again."
    );
    expect(isWrongCode(error("auth/invalid-verification-code"))).toBe(true);
    expect(isWrongCode(error("auth/code-expired"))).toBe(false);
  });

  it("covers too many tries, an expired code and no internet", () => {
    expect(phoneLoginMessage(error("auth/too-many-requests"), "send")).toMatch(/Too many tries/);
    expect(phoneLoginMessage(error("auth/code-expired"), "confirm")).toMatch(/expired/);
    expect(phoneLoginMessage(error("auth/network-request-failed"), "send")).toMatch(/No internet/);
  });

  it("points to Google or email when phone login is not set up", () => {
    // configuration-not-found: Firebase Authentication was never started for the project.
    for (const code of ["phone-login/not-configured", "auth/operation-not-allowed", "auth/billing-not-enabled", "auth/configuration-not-found"]) {
      expect(phoneLoginMessage(error(code), "send")).toBe(
        "Mobile number login is not available right now. Please use Google or email."
      );
    }
  });

  it("falls back to a plain sentence for anything else", () => {
    expect(phoneLoginMessage(new Error("boom"), "send")).toBe("We could not send the code. Please try again.");
    expect(phoneLoginMessage(undefined, "confirm")).toBe("We could not check the code. Please try again.");
  });
});
