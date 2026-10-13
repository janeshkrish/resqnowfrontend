import { describe, expect, it } from "vitest";

import { SERVICES, serviceArt, serviceName, serviceOf } from "./services";

describe("serviceOf", () => {
  it("finds the service however the request spelled it", () => {
    expect(serviceOf("towing")?.id).toBe("towing");
    expect(serviceOf("Flat_Tyre")?.id).toBe("flat-tire");
    expect(serviceOf("jump start")?.id).toBe("battery");
    expect(serviceOf("fuel-delivery")?.id).toBe("fuel");
    expect(serviceOf("EV")?.id).toBe("ev-charging");
  });

  it("looks past the kind of vehicle the request form saves in front of the service", () => {
    expect(serviceOf("car-towing")?.id).toBe("towing");
    expect(serviceOf("bike-flat-tire")?.id).toBe("flat-tire");
    expect(serviceOf("commercial-lockout")?.id).toBe("lockout");
    expect(serviceOf("ev-ev-charging")?.id).toBe("ev-charging");
    expect(serviceOf("ev-battery")?.id).toBe("battery");
    // "ev-charging" is a service of its own, not "charging" for an EV.
    expect(serviceOf("ev-charging")?.id).toBe("ev-charging");
  });

  it("is nothing for a request that is not one of the listed services", () => {
    expect(serviceOf("emergency")).toBeNull();
    expect(serviceOf("car-emergency")).toBeNull();
    expect(serviceOf("other")).toBeNull();
    expect(serviceOf(null)).toBeNull();
  });
});

describe("serviceName", () => {
  it("uses the app's name for a known service", () => {
    expect(serviceName("flat-tire")).toBe("Flat tyre");
    expect(serviceName("ev-charging")).toBe("EV charge");
  });

  it("tidies up a type it does not know, and has a name when there is none", () => {
    expect(serviceName("brake_check")).toBe("Brake check");
    expect(serviceName("")).toBe("Roadside help");
    expect(serviceName("car-towing")).toBe("Towing");
    expect(serviceName("car-emergency")).toBe("Emergency");
    expect(serviceName("bike-other")).toBe("Roadside help");
  });
});

describe("serviceArt", () => {
  it("is the home page's picture for each listed service", () => {
    expect(SERVICES.map((service) => serviceArt(service.id))).toEqual([
      "/images/home/services/towing.webp",
      "/images/home/services/flat-tire.webp",
      "/images/home/services/battery.webp",
      "/images/home/services/mechanical.webp",
      "/images/home/services/fuel.webp",
      "/images/home/services/lockout.webp",
      "/images/home/services/winching.webp",
      "/images/home/services/ev-charging.webp",
    ]);
    expect(serviceArt("car-towing")).toBe("/images/home/services/towing.webp");
    expect(serviceArt("other")).toBeNull();
  });
});
