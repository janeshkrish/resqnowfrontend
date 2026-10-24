import { describe, expect, it } from "vitest";
import { SERVICE_SPECS, type ServiceKey } from "@/config/requestQuestions";
import { TYRES } from "@/lib/requestForm";
import { ANSWER_WORDS, CALLOUT_LINES, FAMILY_TALK, LINES, LITRE_QUESTIONS, QUESTION_PROMPTS, SERVICE_TALK, type L3 } from "./lexicon";

// The voice agent must cover the form exactly: when the form gains a question, an option or a
// callout, these tests fail until ResQNow-Thozhan can ask it, hear it and say it.
describe("ResQNow-Thozhan covers the request form", () => {
  const services = Object.keys(SERVICE_SPECS) as ServiceKey[];

  it("has a name and a reaction for every service", () => {
    for (const service of services) {
      expect(SERVICE_TALK[service], service).toBeTruthy();
      for (const lang of ["en", "tg", "ta"] as const) expect(SERVICE_TALK[service].label[lang], `${service} ${lang}`).not.toBe("");
    }
  });

  it("can ask every question of every service, in all three languages", () => {
    for (const service of services) {
      for (const q of SERVICE_SPECS[service].questions) {
        if (q.kind === "fuelcalc") continue;
        const prompt = QUESTION_PROMPTS[service]?.[q.id];
        expect(prompt, `${service}.${q.id} has no prompt`).toBeTruthy();
        for (const lang of ["en", "tg", "ta"] as const) expect(prompt![lang], `${service}.${q.id} ${lang}`).not.toBe("");
      }
    }
  });

  it("can hear every option of every question", () => {
    for (const service of services) {
      for (const q of SERVICE_SPECS[service].questions) {
        if (q.kind === "fuelcalc" || LITRE_QUESTIONS.has(`${service}.${q.id}`)) continue;
        const options = q.kind === "tyres" ? [...TYRES.car, ...TYRES.bike]
          : [...(q.options ?? []), ...Object.values(q.byType ?? {}).flat(), ...(q.extra ? [q.extra] : [])];
        for (const option of options) {
          expect(ANSWER_WORDS[service]?.[q.id]?.[option.v], `${service}.${q.id} = ${option.v} has no words`).toBeInstanceOf(RegExp);
        }
      }
    }
  });

  it("says every callout in all three languages", () => {
    for (const service of services) {
      for (const q of SERVICE_SPECS[service].questions) {
        for (const callout of q.callouts ?? []) {
          const line = CALLOUT_LINES[`${service}.${q.id}.${callout.when}`];
          expect(line, `${service}.${q.id}.${callout.when} has no spoken line`).toBeTruthy();
          for (const lang of ["en", "tg", "ta"] as const) expect(line![lang]).not.toBe("");
        }
      }
    }
  });

  it("has a Tamil-script reading of every Tanglish line, with the same holes", () => {
    // Tanglish is spoken by a Tamil voice from these; an English voice reading "Enna aachu" sounds wrong.
    const spoken: Array<[string, L3]> = [
      ...Object.entries(LINES),
      ...Object.entries(CALLOUT_LINES),
      ...Object.entries(FAMILY_TALK),
      ...Object.entries(SERVICE_TALK).flatMap(([service, talk]) => [[`${service}.label`, talk.label], [`${service}.react`, talk.react]] as Array<[string, L3]>),
      ...Object.entries(QUESTION_PROMPTS).flatMap(([service, prompts]) => Object.entries(prompts).map(([id, line]) => [`${service}.${id}`, line] as [string, L3])),
    ];
    const holes = (text: string) => (text.match(/\[\[\w+\]\]/g) ?? []).sort().join(" ");
    for (const [name, line] of spoken) {
      expect(line.say ?? "", `${name} has no Tamil-script reading`).toMatch(/[\u0B80-\u0BFF]/);
      expect(holes(line.say!), `${name} holes`).toBe(holes(line.tg));
    }
  });
});
