import { describe, expect, it } from "vitest";

import { SERVICE_SPECS, serviceSpecFor } from "@/config/requestQuestions";
import {
  answerChips,
  buildRequestDetails,
  firstMissingAnswer,
  isQuestionShown,
  isUrgent,
  optionsFor,
  toggleAnswer,
  type Answers,
} from "./requestForm";

const flat = SERVICE_SPECS["flat-tire"];
const question = (spec: typeof flat, id: string) => spec.questions.find((entry) => entry.id === id)!;

describe("request questions", () => {
  it("maps service ids from the app to their questions", () => {
    expect(serviceSpecFor("emergency").key).toBe("sos");
    expect(serviceSpecFor("flat-tire").title).toBe("Puncture");
    expect(serviceSpecFor("something-new").key).toBe("other");
  });

  it("asks two-wheelers about their two tyres and skips the stepney", () => {
    const bike = { family: "bike" as const, classId: "scooter" };
    expect(optionsFor(question(flat, "tyre"), bike).map((option) => option.v)).toEqual(["rear", "front"]);
    expect(isQuestionShown(question(flat, "spare"), {}, bike)).toBe(false);
    const eScooter = { family: "ev" as const, classId: "electric-scooter" };
    expect(isQuestionShown(question(flat, "spare"), {}, eScooter)).toBe(false);
    const car = { family: "car" as const, classId: "sedan" };
    expect(optionsFor(question(flat, "tyre"), car)).toHaveLength(4);
    expect(isQuestionShown(question(flat, "spare"), {}, car)).toBe(true);
  });

  it("gives commercial vehicles their own fuel amounts and towing notes", () => {
    const truck = { family: "commercial" as const, classId: "heavy-truck" };
    expect(optionsFor(question(SERVICE_SPECS.fuel, "qty"), truck).map((option) => option.v)).toEqual(["5", "10", "20"]);
    expect(optionsFor(question(SERVICE_SPECS.towing, "roll"), truck)[0].sub).toBe("We’ll send a heavy tow truck");
  });

  it("says which answer is still needed, safety first", () => {
    const car = { family: "car" as const, classId: "hatchback" };
    expect(firstMissingAnswer(flat, {}, car)).toBe("the tyre type");
    expect(firstMissingAnswer(flat, { tyretype: "tube" }, car)).toBe("the flat tyre");
    expect(firstMissingAnswer(SERVICE_SPECS.lockout, {}, car, { firstOnly: true })).toBe("is anyone inside");
    expect(firstMissingAnswer(SERVICE_SPECS.lockout, { inside: "no" }, car, { firstOnly: true })).toBeNull();
    // Optional questions never block.
    expect(firstMissingAnswer(SERVICE_SPECS.battery, { symptom: "click", need: "jump" }, car)).toBeNull();
    // CNG hides the litres, so they aren't asked for.
    expect(firstMissingAnswer(SERVICE_SPECS.fuel, { fuel: "cng" }, car)).toBeNull();
  });

  it("toggles multi-choice answers and replaces single ones", () => {
    let answers: Answers = {};
    answers = toggleAnswer(answers, question(flat, "tyre"), "fl");
    answers = toggleAnswer(answers, question(flat, "tyre"), "rr");
    answers = toggleAnswer(answers, question(flat, "tyre"), "fl");
    expect(answers.tyre).toEqual(["rr"]);
    answers = toggleAnswer(answers, question(flat, "tyretype"), "tube");
    answers = toggleAnswer(answers, question(flat, "tyretype"), "tubeless");
    expect(answers.tyretype).toBe("tubeless");
  });
});

describe("what is sent", () => {
  const car = { family: "car" as const, classId: "compact-suv" };

  it("sends each shown answer with its question and a readable label", () => {
    const answers: Answers = { tyretype: "dk", tyre: ["fl", "rr"], spare: "spare", damage: "flat" };
    expect(answerChips(flat, answers, car)).toEqual(["Tyre type not sure", "Front left tyre", "Back right tyre", "Fit stepney", "Only flat"]);
    const details = buildRequestDetails({
      spec: flat, answers, context: car, landmark: " Gate 2 ", plate: "KA 01 AB 1234", note: "Near the temple",
      attachments: [{ type: "photo", url: "/api/upload/files/1-tyre.jpg", name: "tyre.jpg" }],
    });
    expect(details).toEqual({
      answers: [
        { id: "tyretype", question: "Tyre type", value: "dk", label: "Tyre type not sure" },
        { id: "tyre", question: "Which tyre is flat?", value: ["fl", "rr"], label: "Front left tyre, Back right tyre" },
        { id: "spare", question: "Do you have a stepney (spare tyre)?", value: "spare", label: "Fit stepney" },
        { id: "damage", question: "How does the tyre look?", value: "flat", label: "Only flat" },
      ],
      landmark: "Gate 2",
      plate: "KA 01 AB 1234",
      note: "Near the temple",
      urgent: false,
      attachments: [{ type: "photo", url: "/api/upload/files/1-tyre.jpg" }],
    });
  });

  it("leaves out answers to questions that no longer show", () => {
    const bike = { family: "bike" as const, classId: "scooter" };
    const details = buildRequestDetails({ spec: flat, answers: { tyretype: "tube", spare: "spare" }, context: bike });
    expect(details.answers.map((answer) => answer.id)).toEqual(["tyretype"]);
  });

  it("marks someone inside or hurt as urgent", () => {
    expect(isUrgent({ inside: "yes" })).toBe(true);
    expect(isUrgent({ hurt: "yes" })).toBe(true);
    expect(isUrgent({ hurt: "no", inside: "no" })).toBe(false);
    expect(buildRequestDetails({ spec: SERVICE_SPECS.sos, answers: { hurt: "yes" }, context: car }).urgent).toBe(true);
  });
});
