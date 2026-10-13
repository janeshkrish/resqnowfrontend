import { afterEach, describe, expect, it } from "vitest";

import {
  TECH_LANGUAGE_KEY,
  readTechLanguage,
  setTechLanguage,
  techDate,
  techDayLabel,
  techRupees,
  techServiceName,
  techText,
  techWeekday,
} from "./technicianLanguage";
import { TECH_LANGUAGES, TECH_TEXT, type TechLang, type TechTextKey } from "./technicianText";

afterEach(() => {
  setTechLanguage("en");
  localStorage.clear();
});

const holes = (line: string) => (line.match(/\{\w+\}/g) || []).sort();

describe("the technician app's words", () => {
  const keys = Object.keys(TECH_TEXT.en) as TechTextKey[];
  const others = TECH_LANGUAGES.map((language) => language.code).filter((code) => code !== "en");

  it("offers English, Tamil and Hindi, each named in its own script", () => {
    expect(TECH_LANGUAGES.map((language) => [language.code, language.name])).toEqual([
      ["en", "English"],
      ["ta", "தமிழ்"],
      ["hi", "हिंदी"],
    ]);
  });

  it.each(others)("%s says every line English has, and nothing is left empty", (code) => {
    const words = TECH_TEXT[code as TechLang];
    expect(Object.keys(words).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(words[key].trim(), key).not.toBe("");
  });

  it.each(others)("%s keeps the same values to fill in as English, line by line", (code) => {
    const words = TECH_TEXT[code as TechLang];
    for (const key of keys) expect(holes(words[key]), key).toEqual(holes(TECH_TEXT.en[key]));
  });

  it("fills the values into a line, in any language", () => {
    expect(techText("en", "home.todayJobs", { n: 2 })).toBe("2 jobs done today");
    expect(techText("en", "home.dueTitle", { amount: "₹120" })).toBe("You need to pay ₹120");
    expect(techText("ta", "home.points", { n: 202 })).toBe("202 புள்ளிகள்");
    expect(techText("hi", "rating.onTimeLine", { a: 4, b: 5 })).toBe("5 में से 4 काम समय पर");
  });

  it("leaves a value it was not given as it is written, so a mistake shows", () => {
    expect(techText("en", "home.points")).toBe("{n} points");
  });
});

describe("the chosen language", () => {
  it("is English until the technician picks another, and the choice is kept on the phone", () => {
    expect(readTechLanguage()).toBe("en");
    setTechLanguage("ta");
    expect(localStorage.getItem(TECH_LANGUAGE_KEY)).toBe("ta");
    expect(readTechLanguage()).toBe("ta");
  });

  it("falls back to English when what is saved is not a language the app has", () => {
    localStorage.setItem(TECH_LANGUAGE_KEY, "fr");
    expect(readTechLanguage()).toBe("en");
  });
});

describe("money", () => {
  it("is written the Indian way, with paise only when there are some", () => {
    expect(techRupees(3120)).toBe("₹3,120");
    expect(techRupees(123456)).toBe("₹1,23,456");
    expect(techRupees(179.5)).toBe("₹179.50");
    expect(techRupees("1000")).toBe("₹1,000");
  });

  it("is never rounded up or down to a whole rupee", () => {
    expect(techRupees(3120.49)).toBe("₹3,120.49");
    expect(techRupees(0.5)).toBe("₹0.50");
  });

  it("shows nothing owed for a missing amount", () => {
    expect(techRupees(undefined)).toBe("₹0");
    expect(techRupees("")).toBe("₹0");
  });
});

describe("service names", () => {
  it("keeps the app's own names in English, however the request spells the service", () => {
    expect(techServiceName("en", "car-flat-tire")).toBe("Flat tyre");
    expect(techServiceName("en", "bike-battery")).toBe("Battery");
    expect(techServiceName("en", "")).toBe("Roadside help");
  });

  it("names each service in Tamil and Hindi, and has a plain name for anything else", () => {
    expect(techServiceName("ta", "car-towing")).toBe("டோயிங்");
    expect(techServiceName("hi", "car-flat-tyre")).toBe("पंक्चर");
    expect(techServiceName("hi", "something-new")).toBe("सड़क पर मदद");
  });
});

describe("days and dates", () => {
  const now = new Date(2026, 9, 13, 15, 0);

  it("calls today and yesterday by name and gives other days their date", () => {
    expect(techDayLabel("en", new Date(2026, 9, 13, 9, 30), now)).toBe("Today");
    expect(techDayLabel("en", new Date(2026, 9, 12, 23, 59), now)).toBe("Yesterday");
    expect(techDayLabel("en", new Date(2026, 9, 5, 9, 48), now)).toMatch(/Monday.*5 Oct/);
    expect(techDayLabel("ta", new Date(2026, 9, 13, 9, 30), now)).toBe("இன்று");
    expect(techDayLabel("hi", new Date(2026, 9, 12, 9, 30), now)).toBe("कल");
  });

  it("names the days of the week under the bars, with today called Today", () => {
    expect(techWeekday("en", new Date(2026, 9, 12), now)).toBe("Mon");
    expect(techWeekday("en", new Date(2026, 9, 13), now)).toBe("Today");
  });

  it("gives nothing for a date that is missing or broken", () => {
    expect(techDate("en", null)).toBe("");
    expect(techDayLabel("en", "not a date", now)).toBe("");
    expect(techDate("en", new Date(2026, 9, 7))).toBe("7 Oct");
  });
});
