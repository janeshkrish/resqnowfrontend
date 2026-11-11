import { describe, expect, it } from "vitest";
import { serviceSpecFor } from "@/config/requestQuestions";
import type { Vehicle } from "@/lib/garage";
import { firstMissingAnswer } from "@/lib/requestForm";
import { hasVehicle } from "@/lib/vehicleChoice";
import {
  answerChips, applyReply, contextOf, emptyDraft, findVehicle, formHandoff, formStepOneComplete, hear, mergeHeard, nextStep, repliesFor,
  mergeAi, mergeAiWithFeedback, understandReply, type Step, type VoiceDraft,
} from "./engine";
import { UI } from "./lexicon";
import { normalize, tamilToLatin } from "./words";

const GARAGE: Vehicle[] = [
  { id: 7, type: "bike", make: "Honda", model: "Activa 6G", license_plate: "TN37AB1234", status: "ready", created_at: "2026-01-01" } as Vehicle,
  { id: 8, type: "car", make: "Hyundai", model: "i20", license_plate: "TN37CK4521", status: "ready", created_at: "2026-01-01" } as Vehicle,
];

/** Says a sentence, then answers each question: with `answers` where given, else the first button (Skip for optional ones). */
function talk(sentence: string, answers: Record<string, string> = {}, garage: Vehicle[] = GARAGE) {
  let draft = mergeHeard({ ...emptyDraft(), note: sentence }, hear(sentence, emptyDraft(), garage), "voice").draft;
  const asked: string[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const step = nextStep(draft, garage);
    if (step.kind === "done") break;
    const name = step.kind === "question" ? step.id : step.kind;
    asked.push(name);
    const given = answers[name];
    if (given !== undefined) {
      const heard = understandReply(step, draft, given, garage);
      if (!heard) throw new Error(`"${given}" didn't answer ${name}`);
      draft = applyReply(draft, step, heard.value, garage, "voice", heard.quote).draft;
      continue;
    }
    const replies = repliesFor(step, draft, garage, UI, "tg");
    const pick = step.kind === "landmark" ? "none" : step.kind === "location" ? "yes" : step.kind === "switch" ? "yes"
      : replies.find((r) => r.v === "__skip")?.v ?? replies.find((r) => r.main)?.v ?? replies[0].v;
    draft = applyReply(draft, step, pick, garage, "tap").draft;
  }
  return { draft, asked };
}

const formNeeds = (draft: VoiceDraft) => firstMissingAnswer(serviceSpecFor(draft.service), draft.answers, contextOf(draft));

describe("interpreting corrections and safety answers", () => {
  it.each([
    "My car does not have a puncture. The battery is dead.",
    "My car tyre isn't flat, the battery is dead.",
    "It's not a flat tyre, the battery is dead.",
    "Tyre puncture illa, battery dead aayiduchu",
    "Puncture illa, battery dead aayiduchu",
    "பஞ்சர் இல்லை, பேட்டரி வேலை செய்யவில்லை",
    "It's a puncture. Actually I need a jump for my battery.",
  ])("uses the service the customer affirms in %s", (text) => {
    expect(hear(text, emptyDraft(), []).service).toBe("battery");
    expect(understandReply({ kind: "service" }, emptyDraft(), text, [])?.value).toBe("battery");
  });

  it.each([
    ["SOS, nobody is hurt", "no"], ["SOS, no one is injured", "no"],
    ["SOS, யாருக்கும் காயம் இல்லை", "no"], ["SOS, yaarukkum kaayam illa", "no"],
    ["SOS, my passenger is hurt but I am not hurt", "yes"],
    ["SOS, I'm not hurt but my passenger is bleeding", "yes"],
    ["SOS, nobody is hurt. Actually someone is hurt", "yes"],
    ["SOS, someone is hurt. Correction, nobody is injured", "no"],
    ["Keys locked in car, no child inside", "no"],
    ["Keys locked in car, my dog is inside but no child is inside", "yes"],
    ["சாவி உள்ளே, குழந்தை உள்ளே இல்லை", "no"],
  ])("interprets the safety cue in %s as %s", (text, expected) => {
    const result = mergeHeard(emptyDraft(), hear(text, emptyDraft(), []), "voice");
    const id = result.draft.service === "lockout" ? "inside" : "hurt";
    expect(result.draft.answers[id]).toBe(expected);
    expect(result.said.some(line => line.urgent)).toBe(expected === "yes");
  });

  it.each([["yes", "yes"], ["no", "no"], ["ஆமாம்", "yes"], ["இல்லை", "no"]])(
    "accepts %s as a direct reply to the injury question", (text, value) => {
      expect(understandReply({ kind: "question", id: "hurt" }, { ...emptyDraft(), service: "sos" }, text, [])?.value).toBe(value);
    });

  it("collects affirmative issues and drops a negated issue", () => {
    const heard = hear("Engine overheating and no smoke, but the brakes are failing", emptyDraft(), []);
    expect(heard.answers.issue).toEqual(["heat", "brakes"]);
  });

  it("takes the last correction even when an option is repeated", () => {
    const heard = hear("I need petrol, diesel, sorry petrol", emptyDraft(), []);
    expect(heard.answers.fuel).toBe("petrol");
  });

  it("keeps the family and service when the negation describes a fault", () => {
    expect(hear("My car isn't running; its battery isn't working", emptyDraft(), [])).toMatchObject({ family: "car", service: "battery" });
  });

  it("reopens service selection and discards its answers when a customer retracts a diagnosis", () => {
    const previous = talk("My car has a puncture").draft;
    const heard = hear("Actually there is no puncture", previous, []);
    const next = mergeHeard(previous, heard, "voice").draft;
    expect(next.service).toBeNull();
    expect(next.answers).toEqual({});
    expect(nextStep(next, [])).toEqual({ kind: "service" });
    expect(mergeAiWithFeedback(next, { service: "flat-tire" }, [], heard.deniedServices).draft.service).toBeNull();
    expect(hear("A puncture. Actually there is no puncture", emptyDraft(), []).service).toBeNull();
  });

  it("cancels a towing offer after the customer corrects the triggering fuel answer", () => {
    const first = mergeHeard(emptyDraft(), hear("CNG car", emptyDraft(), []), "voice").draft;
    expect(first.pendingSwitch).toMatchObject({ question: "fuel" });
    const next = mergeHeard(first, hear("Actually diesel", first, []), "voice").draft;
    expect(next.answers.fuel).toBe("diesel");
    expect(next.pendingSwitch).toBeNull();
  });

  it("keeps the safety callout when a checked AI answer fills the gap", () => {
    const draft: VoiceDraft = { ...emptyDraft(), service: "lockout", family: "car" };
    const result = mergeAiWithFeedback(draft, { answers: { inside: "yes" } }, []);
    expect(result.said).toEqual(applyReply(draft, { kind: "question", id: "inside" }, "yes", [], "voice").said);
    expect(result.said).toEqual([expect.objectContaining({ urgent: true })]);
    expect(mergeAi(result.draft, { answers: { inside: "no" } }, []).answers.inside).toBe("yes");
  });
});

describe("ResQNow-Thozhan fills the request form", () => {
  it("asks only what a bike puncture is missing, in the form's order", () => {
    const { draft, asked } = talk("Ennoda bike puncture aayiduchu");
    expect(draft.service).toBe("flat-tire");
    expect(draft.family).toBe("bike");
    // The saved "Activa 6G" isn't a catalog name, so the form itself asks its type: so does Thozhan.
    expect(asked).toEqual(["garage", "class", "tyretype", "tyre", "damage", "location", "landmark"]);
    expect(draft.vehicle.vehicleSource).toBe("garage");
    expect(draft.vehicle.vehicleSubtype).toBe("scooter");
    expect(formNeeds(draft)).toBeNull();
  });

  it("takes a different bike by name, as in the owner's script (Honda Shine)", () => {
    const { draft, asked } = talk("Ennoda bike puncture aayiduchu", { garage: "Honda Shine" });
    expect(asked[0]).toBe("garage");
    expect(draft.vehicle.vehicleModel).toMatch(/Shine/);
    expect(draft.vehicle.vehicleSubtype).toBe("commuter-bike");
  });

  it("uses what the first sentence already says and asks the rest", () => {
    const { draft, asked } = talk("My car puncture, front left, tubeless");
    expect(asked).toEqual(["garage", "spare", "damage", "location", "landmark"]);
    expect(answerChips(draft)).toEqual(expect.arrayContaining(["Tubeless", "Front left tyre"]));
  });

  it("finds the model in the sentence and skips the vehicle questions", () => {
    const { draft, asked } = talk("En Splendor-la petrol theernduchu");
    expect(draft.vehicle.vehicleModel).toMatch(/Splendor/);
    expect(draft.answers.fuel).toBe("petrol");
    expect(asked).toEqual(["qty", "location", "landmark"]);
  });

  it("asks which vehicle when the customer only says vandi, safety question first", () => {
    const { draft, asked } = talk("Vandi kuzhila maattikichu", { family: "car", garage: "no", brand: "Maruti Suzuki", model: "Swift" });
    expect(draft.service).toBe("winching");
    expect(asked.slice(0, 2)).toEqual(["hurt", "family"]);
    expect(draft.answers.where).toBe("ditch");
    expect(draft.vehicle.vehicleModel).toMatch(/Swift/);
    expect(formNeeds(draft)).toBeNull();
  });

  it("offers towing when the form does (CNG), and switches on yes", () => {
    const { draft, asked } = talk("Petrol illa, CNG car");
    expect(asked).toContain("switch");
    expect(draft.service).toBe("towing");
    expect(asked).toEqual(expect.arrayContaining(["why", "roll", "location", "drop"]));
  });

  it("turns an EV's fuel request into EV charging", () => {
    const heard = hear("My Ola scooter petrol theernduchu", emptyDraft(), GARAGE);
    expect(heard.family).toBe("ev");
    expect(heard.service).toBe("ev-charging");
    expect(heard.evSwitched).toBe(true);
  });

  it("marks a lockout urgent and says the form's warning when someone is inside", () => {
    const merged = mergeHeard(emptyDraft(), hear("Car-la keys ulla maattikichu, baby inside", emptyDraft(), GARAGE), "voice");
    expect(merged.draft.answers).toMatchObject({ inside: "yes", what: "inside" });
    expect(merged.said.some((s) => s.urgent)).toBe(true);
  });

  it("understands Tamil script", () => {
    const heard = hear("என் பைக்கில் பஞ்சர் ஆகிவிட்டது", emptyDraft(), []);
    expect(heard.service).toBe("flat-tire");
    expect(heard.family).toBe("bike");
    expect(tamilToLatin("ஆக்டிவா")).toBe("aaktivaa");
    expect(findVehicle("என் ஆக்டிவா", null, [])?.choice.vehicleModel).toMatch(/Activa/);
    expect(normalize("ஸ்ப்ளெண்டர்")).toBe("splentar");
    expect(findVehicle("ஹீரோ ஸ்ப்ளெண்டர்", null, [])?.choice.vehicleModel).toMatch(/Splendor/);
  });

  it("does not take an everyday word for a model without its brand", () => {
    expect(findVehicle("my car is in the city", "car", [])).toBeNull();
    expect(findVehicle("Honda City", "car", [])?.choice.vehicleModel).toMatch(/City/);
  });

  it("reaches the form's Confirm step with every required answer, for every service", () => {
    const sentences = [
      "Ennoda bike puncture aayiduchu", "My car won't start, I think the battery is dead", "En Splendor-la petrol theernduchu",
      "Highway-la lorry breakdown aayiduchu, tow venum", "Car-la keys ulla maattikichu", "Engine overheating, smoke varudhu, car",
      "Vandi kuzhila maattikichu", "My Ather charge illa", "Emergency! accident aayiduchu, bike", "En vaaganam nikkudhu, motorbike",
    ];
    for (const sentence of sentences) {
      const { draft } = talk(sentence);
      expect(nextStep(draft, GARAGE).kind, sentence).toBe("done");
      expect(formStepOneComplete(draft), sentence).toBe(true);
      expect(formNeeds(draft), sentence).toBeNull();
      if (draft.service !== "sos") expect(hasVehicle(draft.vehicle), sentence).toBe(true);
    }
  });
});

describe("handing over to the request form", () => {
  it("fills the form's own saved state and opens its Confirm step", () => {
    const { draft } = talk("Ennoda bike puncture aayiduchu");
    const handoff = formHandoff({ ...draft, note: "Ennoda bike puncture aayiduchu" }, { address: "Avinashi Road, Peelamedu", lat: 11.02, lng: 77.0 });
    expect(handoff.path).toBe("/request-service/flat-tire/bike");
    expect(handoff.storageKey).toBe("resqnow_service_request_flat-tire_bike");
    expect(handoff.saved.currentStep).toBe(3);
    expect(handoff.saved.formData).toMatchObject({
      vehicleType: "bike", vehicleSubtype: "scooter", vehicleSource: "garage", location: "Avinashi Road, Peelamedu", locationLat: 11.02,
      note: "Ennoda bike puncture aayiduchu", channel: "voice",
    });
    expect(handoff.saved.formData.answers).toEqual(draft.answers);
  });

  it("opens towing on the location step, for the drop point and the route price", () => {
    const { draft } = talk("Highway-la lorry breakdown aayiduchu, tow venum", { drop: "Gandhipuram bus stand" });
    const handoff = formHandoff(draft, { address: "Avinashi Road", lat: 11, lng: 77 });
    expect(handoff.saved.currentStep).toBe(2);
    expect(handoff.saved.formData.dropLocation).toBe("Gandhipuram bus stand");
  });

  it("opens the location step when no location was found", () => {
    const { draft } = talk("Ennoda bike puncture aayiduchu");
    expect(formHandoff(draft, null).saved.currentStep).toBe(2);
  });
});

it("steps are plain data", () => {
  const step: Step = { kind: "question", id: "tyre" };
  expect(step.kind).toBe("question");
});
