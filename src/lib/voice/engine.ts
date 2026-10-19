/**
 * ResQNow-Thozhan's brain: turns what the customer says into the request form's own data and
 * decides what to ask next. It reads the form's questions (config/requestQuestions.ts), its rules
 * (lib/requestForm.ts) and the vehicle catalog (data/indianVehicles.ts) directly, so a voice
 * request carries exactly what the form would have sent. Nothing here touches the screen.
 */
import { serviceSpecFor, type Question, type QuestionOption, type ServiceKey } from "@/config/requestQuestions";
import { VEHICLE_CATALOG, CATALOG_BRANDS, type CatalogBrand, type CatalogModel } from "@/data/indianVehicles";
import { vehicleTypeOf, type Vehicle } from "@/lib/garage";
import { hasAnswer, optionsFor, shownQuestions, type AnswerValue, type Answers, type FormContext } from "@/lib/requestForm";
import {
  brandsFor, catalogFor, choiceFromCatalog, choiceFromGarage, clearedChoice, findCatalogModel, garageForFamily, hasVehicle, manualChoice,
  type VehicleChoice,
} from "@/lib/vehicleChoice";
import { classesFor, type VehicleFamily } from "@/lib/vehicleClasses";
import {
  ANSWER_WORDS, CALLOUT_LINES, FAMILY_WORDS, GENERIC_VEHICLE, HIGHWAY, LITRE_QUESTIONS, NO, SERVICE_WORDS, SKIP, YES, litresIn,
  type L3, type Lang,
} from "./lexicon";
import { findPhrase, normalize } from "./words";

export const VOICE_SERVICES: ServiceKey[] = ["flat-tire", "battery", "fuel", "towing", "lockout", "mechanical", "winching", "ev-charging", "sos", "other"];
export const FAMILIES: VehicleFamily[] = ["bike", "car", "commercial", "ev"];
export const FAMILY_TITLES: Record<VehicleFamily, string> = { bike: "Bike", car: "Car", commercial: "Commercial", ev: "EV" };

export type Via = "voice" | "typed" | "tap" | "garage" | "ai";
export type Source = { via: Via; quote?: string };

export type VoiceDraft = {
  service: ServiceKey | null;
  family: VehicleFamily | null;
  /** The customer's own word for the vehicle ("lorry", "scooty"), said back to them. */
  familyWord: string;
  vehicle: VehicleChoice;
  garageAsked: boolean;
  /** "Not listed": the customer says the name, then picks the closest size. */
  wantsName: boolean;
  answers: Answers;
  /** Optional questions already offered once. */
  asked: Record<string, true>;
  /** A form callout that offers towing, waiting for a yes or no. */
  pendingSwitch: { question: string; value: string } | null;
  note: string;
  landmark: string;
  landmarkAsked: boolean;
  dropText: string;
  dropAsked: boolean;
  located: boolean;
  sources: Record<string, Source>;
};

export const emptyDraft = (): VoiceDraft => ({
  service: null, family: null, familyWord: "", vehicle: clearedChoice("choose"), garageAsked: false, wantsName: false, answers: {}, asked: {},
  pendingSwitch: null, note: "", landmark: "", landmarkAsked: false, dropText: "", dropAsked: false, located: false, sources: {},
});

export type Step =
  | { kind: "service" } | { kind: "family" } | { kind: "garage" } | { kind: "brand" } | { kind: "model" } | { kind: "name" } | { kind: "class" }
  | { kind: "question"; id: string } | { kind: "switch"; question: string; value: string }
  | { kind: "location" } | { kind: "drop" } | { kind: "landmark" } | { kind: "done" };

export type Reply = { v: string; label: string; main?: boolean; danger?: boolean; art?: string | null };

/* ------------------------------------------------------------------ the form's rules */

export function contextOf(draft: VoiceDraft): FormContext {
  return { family: draft.family ?? "car", classId: draft.vehicle.vehicleSubtype || null, baseSubtype: draft.vehicle.vehicleBaseSubtype || null };
}

export function questionOf(service: ServiceKey | null, id: string): Question | null {
  if (!service) return null;
  return serviceSpecFor(service).questions.find((q) => q.id === id) ?? null;
}

const shown = (draft: VoiceDraft) => draft.service ? shownQuestions(serviceSpecFor(draft.service), draft.answers, contextOf(draft)) : [];

/** The next thing to ask, in the form's own order: safety first, then the vehicle, its size, the service's questions, then where. */
export function nextStep(draft: VoiceDraft, garage: Vehicle[]): Step {
  if (draft.pendingSwitch) return { kind: "switch", ...draft.pendingSwitch };
  if (!draft.service) return { kind: "service" };
  const questions = shown(draft);
  for (const q of questions) if (q.first && !hasAnswer(draft.answers, q.id)) return { kind: "question", id: q.id };
  if (!draft.family) return { kind: "family" };
  if (draft.service !== "sos") {
    if (!hasVehicle(draft.vehicle)) {
      if (draft.wantsName) return { kind: "name" };
      if (!draft.garageAsked && garageForFamily(garage, draft.family).length) return { kind: "garage" };
      return draft.vehicle.catalogBrandId ? { kind: "model" } : { kind: "brand" };
    }
    if (!draft.vehicle.vehicleSubtype) return { kind: "class" };
  }
  for (const q of questions) {
    if (q.first || hasAnswer(draft.answers, q.id)) continue;
    if (!q.optional || !draft.asked[q.id]) return { kind: "question", id: q.id };
  }
  if (draft.service === "ev-charging" && draft.answers.port === "brand" && !draft.vehicle.vehicleBrand) return { kind: "brand" };
  if (!draft.located) return { kind: "location" };
  if (draft.service === "towing" && !draft.dropAsked) return { kind: "drop" };
  if (draft.service !== "towing" && !draft.landmark && !draft.landmarkAsked) return { kind: "landmark" };
  return { kind: "done" };
}

/** True when every answer the form needs on its first step is in place. */
export function formStepOneComplete(draft: VoiceDraft): boolean {
  if (!draft.service || !draft.family) return false;
  if (draft.service !== "sos" && (!hasVehicle(draft.vehicle) || !draft.vehicle.vehicleSubtype)) return false;
  return shown(draft).every((q) => q.optional || hasAnswer(draft.answers, q.id));
}

const optionLabel = (q: Question, v: string, ctx: FormContext) =>
  (optionsFor(q, ctx).find((o) => o.v === v) ?? (q.extra?.v === v ? q.extra : null))?.label ?? v;

/** The form's own chips for the answers so far ("Tubeless", "Back tyre", "Only flat"). */
export function answerChips(draft: VoiceDraft): string[] {
  const ctx = contextOf(draft);
  return shown(draft).flatMap((q) => {
    const value = draft.answers[q.id];
    const values = Array.isArray(value) ? value : value != null && value !== "" ? [value] : [];
    return values.map((v) => {
      const option = optionsFor(q, ctx).find((o) => o.v === v) ?? (q.extra?.v === v ? q.extra : null);
      if (!option) return null;
      if (option === q.extra) return option.chip ?? `${q.label}: not sure`;
      return option.chip ?? option.label;
    }).filter((chip): chip is string => Boolean(chip));
  });
}

/* ------------------------------------------------------------------ hearing */

export function detectLang(text: string): Lang | null {
  if (/[஀-௿]/.test(text)) return "ta";
  if (/\b(aayiduchu|aachu|ennoda|enoda|illa|pochu|theernduchu|nikkudhu|irukku|vandi|vaaganam|seekiram|venum|pannunga|aagala|thaan|dhaan|enga|evlo|maattikichu|theriyala|munnadi|pinnadi|aamaa|aama|sari|vaanga|kuzhila|sethula|varudhu)\b|-la\b|-ku\b/i.test(text)) return "tg";
  return text.trim().split(/\s+/).length >= 3 && /\b(the|is|my|it|has|have|won'?t|can'?t|i|i'?m|need|please|there|stuck|ran)\b/i.test(text) ? "en" : null;
}

type FoundVehicle = { family: VehicleFamily; choice: VehicleChoice; quote: string; complete: boolean };

// Model names that are everyday words or bare numbers count only when the brand is said too.
const NEEDS_BRAND = new Set(["city", "boss", "partner", "magic", "dream", "street", "sport", "venue", "access", "pleasure", "passion", "glamour",
  "shine", "x", "s1", "indie", "ace", "star city plus", "cliq", "navi", "aviator", "plus", "pro", "max", "one", "go", "life", "storm", "tour"]);

const modelWords = (model: CatalogModel) => normalize(model.model).split(" ");
const brandNames = (brand: CatalogBrand) => Array.from(new Set([brand.name, brand.short].map((n) => normalize(n)).filter(Boolean)));
const familyOfModel = (model: CatalogModel): VehicleFamily => (model.evClass ? "ev" : model.family);
const garageFamily = (vehicle: Vehicle): VehicleFamily => (findCatalogModel(vehicle.make, vehicle.model, "ev") ? "ev" : vehicleTypeOf(vehicle.type));

/** The vehicle a sentence names: one of the customer's own, a catalog model, or just a brand. */
export function findVehicle(text: string, family: VehicleFamily | null, garage: Vehicle[], { lenient = false } = {}): FoundVehicle | null {
  const spoken = normalize(text).split(" ").filter(Boolean);
  if (!spoken.length) return null;
  const said = (words: string[]) => findPhrase(spoken, words) >= 0;
  // The customer's own vehicles first, by model or by make and model.
  for (const vehicle of garage) {
    const fam = garageFamily(vehicle);
    if (family && family !== fam) continue;
    const model = normalize(vehicle.model).split(" ");
    // "Activa" is enough for a saved "Activa 6G": the customer's own vehicle needs only its first name.
    const firstName = model[0] && model[0].length >= 4 ? [model[0]] : model;
    if (said(model) || said(firstName) || said([...normalize(vehicle.make).split(" "), ...model])) {
      return { family: fam, choice: choiceFromGarage(vehicle, fam), quote: vehicle.model, complete: true };
    }
  }
  const brandSaid = (brandId: string) => {
    const brand = CATALOG_BRANDS.find((b) => b.id === brandId);
    return Boolean(brand && brandNames(brand).some((n) => said(n.split(" "))));
  };
  let best: { model: CatalogModel; score: number } | null = null;
  for (const model of VEHICLE_CATALOG) {
    const fam = familyOfModel(model);
    if (family && family !== fam && !(family === "ev" && model.evClass)) continue;
    // "Splendor+" is also just "Splendor" when spoken.
    const full = modelWords(model);
    const words = said(full) ? full : full.length > 1 && full[full.length - 1] === "plus" && said(full.slice(0, -1)) ? full.slice(0, -1) : null;
    if (!words) continue;
    const key = words.join(" ");
    if ((NEEDS_BRAND.has(key) || /^\d+$/.test(key) || key.length < 3) && !lenient && !brandSaid(model.brandId)) continue;
    const score = key.length * 10 + (brandSaid(model.brandId) ? 50 : 0) + (model.popular ? 5 : 0) + (model.status === "sale" ? 2 : 0) + (family === fam ? 20 : 0);
    if (!best || score > best.score) best = { model, score };
  }
  if (best) {
    const fam = family === "ev" || best.model.evClass ? "ev" : best.model.family;
    const model = fam === "ev" && !best.model.evClass ? null : best.model;
    if (model) return { family: fam, choice: choiceFromCatalog(model, fam), quote: best.model.model, complete: true };
  }
  for (const brand of CATALOG_BRANDS) {
    const fam: VehicleFamily = family === "ev" && brand.hasEv ? "ev" : brand.family;
    if (family && family !== fam) continue;
    if (!brandNames(brand).some((n) => said(n.split(" ")))) continue;
    // A brand that only sells electric vehicles (Ather, Ola) makes it an EV.
    const onlyEv = brand.hasEv && !VEHICLE_CATALOG.some((m) => m.brandId === brand.id && !m.evClass);
    const finalFamily = onlyEv ? "ev" : fam;
    if (!brandsFor(finalFamily).some((b) => b.id === brand.id)) continue;
    return { family: finalFamily, choice: { ...clearedChoice("choose"), catalogBrandId: brand.id, vehicleBrand: brand.name }, quote: brand.short, complete: false };
  }
  return null;
}

/** A question's answer in a sentence: the option said last wins; pick-all questions take every one. */
export function hearAnswer(service: ServiceKey, q: Question, text: string, ctx: FormContext): { value: AnswerValue; quote: string } | null {
  if (LITRE_QUESTIONS.has(`${service}.${q.id}`)) {
    const l = litresIn(text);
    if (!l) return null;
    const option = optionsFor(q, ctx).find((o) => Number(o.v) === l.n);
    return option ? { value: option.v, quote: l.quote } : null;
  }
  const words = ANSWER_WORDS[service]?.[q.id];
  if (!words) return null;
  const options: QuestionOption[] = [...optionsFor(q, ctx), ...(q.extra ? [q.extra] : [])];
  const hits: Array<{ v: string; quote: string; at: number }> = [];
  for (const option of options) {
    const m = words[option.v]?.exec(text);
    if (m) hits.push({ v: option.v, quote: m[0], at: m.index });
  }
  if (!hits.length) return null;
  if (q.multi) return { value: hits.map((h) => h.v), quote: hits.map((h) => h.quote).join(", ") };
  const last = hits.sort((a, b) => b.at - a.at)[0];
  return { value: last.v, quote: last.quote };
}

export type Heard = {
  service: ServiceKey | null;
  family: VehicleFamily | null;
  familyWord: string;
  vehicle: FoundVehicle | null;
  answers: Answers;
  quotes: Record<string, string>;
  highway: boolean;
  evSwitched: boolean;
};

/** Everything a free sentence says: the problem, the vehicle, and any answers it already gives. */
export function hear(text: string, draft: VoiceDraft, garage: Vehicle[]): Heard {
  const quotes: Record<string, string> = {};
  let service: ServiceKey | null = null;
  for (const [key, re] of SERVICE_WORDS) { const m = re.exec(text); if (m) { service = key; quotes.service = m[0]; break; } }
  let family: VehicleFamily | null = null;
  let familyWord = "";
  for (const [key, re] of FAMILY_WORDS) { const m = re.exec(text); if (m) { family = key; familyWord = m[0]; quotes.family = m[0]; break; } }
  if (!family && GENERIC_VEHICLE.test(text)) quotes.family = (GENERIC_VEHICLE.exec(text) ?? [""])[0];
  const vehicle = findVehicle(text, family ?? draft.family, garage) ?? (family ? null : findVehicle(text, null, garage));
  if (vehicle) { family = vehicle.family; quotes.vehicle = vehicle.quote; }
  const svc = service ?? draft.service;
  let evSwitched = false;
  if (svc === "ev-charging") family = "ev";
  if (svc === "fuel" && (family ?? draft.family) === "ev") { service = "ev-charging"; evSwitched = true; }
  const answers: Answers = {};
  const finalService = service ?? draft.service;
  if (finalService) {
    const ctx: FormContext = { family: family ?? draft.family ?? "car", classId: vehicle?.choice.vehicleSubtype || draft.vehicle.vehicleSubtype || null };
    for (const q of shownQuestions(serviceSpecFor(finalService), {}, ctx)) {
      const found = hearAnswer(finalService, q, text, ctx);
      if (found) { answers[q.id] = found.value; quotes[q.id] = found.quote; }
    }
  }
  return { service, family, familyWord: familyWord && !GENERIC_VEHICLE.test(familyWord) ? familyWord : "", vehicle, answers, quotes, highway: HIGHWAY.test(text), evSwitched };
}

export type Said = { line: L3 | "understood" | "evSwitch" | "safetyHighway"; urgent?: boolean; call?: string };

/** Adds what was heard to the draft. Returns the draft and what Thozhan should say about it. */
export function mergeHeard(draft: VoiceDraft, heard: Heard, via: Via): { draft: VoiceDraft; said: Said[] } {
  const next: VoiceDraft = { ...draft, answers: { ...draft.answers }, asked: { ...draft.asked }, sources: { ...draft.sources } };
  const said: Said[] = [];
  if (heard.service && heard.service !== next.service) {
    next.service = heard.service; next.answers = {}; next.asked = {}; next.pendingSwitch = null;
    next.sources.service = { via, quote: heard.quotes.service };
  }
  if (heard.family && heard.family !== next.family) {
    next.family = heard.family; next.vehicle = clearedChoice("choose"); next.garageAsked = false; next.wantsName = false;
    next.sources.vehicle = { via, quote: heard.quotes.family };
  }
  if (heard.familyWord) next.familyWord = heard.familyWord;
  if (heard.vehicle) {
    next.vehicle = heard.vehicle.choice; next.garageAsked = true;
    next.sources.vehicle = { via: heard.vehicle.choice.vehicleSource === "garage" ? "garage" : via, quote: heard.vehicle.quote };
  }
  for (const [id, value] of Object.entries(heard.answers)) {
    next.answers[id] = value; next.sources[id] = { via, quote: heard.quotes[id] };
  }
  if (heard.service || heard.vehicle) said.push({ line: "understood" });
  if (heard.evSwitched) said.push({ line: "evSwitch" });
  if (heard.highway) said.push({ line: "safetyHighway" });
  for (const [id, value] of Object.entries(heard.answers)) {
    const result = calloutFor(next, id, value);
    if (result?.switchTo) next.pendingSwitch = next.pendingSwitch ?? { question: id, value: Array.isArray(value) ? value[0] : value };
    else if (result) said.push({ line: result.line, urgent: result.urgent, call: result.call });
  }
  return { draft: next, said };
}

/** The form's callout for an answer, as Thozhan says it, and whether it offers towing. */
export function calloutFor(draft: VoiceDraft, id: string, value: AnswerValue): { line: L3; switchTo?: "towing"; urgent: boolean; call?: string } | null {
  const q = questionOf(draft.service, id);
  if (!q?.callouts || !draft.service) return null;
  const values = Array.isArray(value) ? value : [value];
  const callout = q.callouts.find((c) => values.includes(c.when));
  if (!callout) return null;
  const line = CALLOUT_LINES[`${draft.service}.${id}.${callout.when}`] ?? { en: callout.text, tg: callout.text, ta: callout.text };
  return { line, switchTo: callout.switchTo, urgent: callout.tone === "red", call: callout.call };
}

/* ------------------------------------------------------------------ answering */

/** The buttons for a step; every label is the form's own. */
export function repliesFor(step: Step, draft: VoiceDraft, garage: Vehicle[], ui: { [key: string]: L3 }, lang: Lang): Reply[] {
  const family = draft.family;
  switch (step.kind) {
    case "service": return VOICE_SERVICES.map((k) => ({ v: k, label: serviceSpecFor(k).title, art: serviceSpecFor(k).art }));
    case "family": return FAMILIES.map((f) => ({ v: f, label: FAMILY_TITLES[f] }));
    case "garage": return [...garageForFamily(garage, family!).slice(0, 3).map((v, i) => ({ v: String(v.id), label: `${v.make} ${v.model}`, main: i === 0 })), { v: "other", label: ui.differentOne[lang] }];
    case "brand": return [...brandsFor(family!).filter((b) => b.popular).slice(0, 7).map((b) => ({ v: b.id, label: b.short })), { v: "other", label: ui.notListed[lang] }];
    case "model": {
      const models = catalogFor(family!).filter((m) => m.brandId === draft.vehicle.catalogBrandId);
      const top = [...models.filter((m) => m.popular), ...models.filter((m) => !m.popular && m.status === "sale")].slice(0, 7);
      return [...top.map((m) => ({ v: m.id, label: m.model })), { v: "other", label: ui.otherModel[lang] }];
    }
    case "class": return classesFor(family!).map((c) => ({ v: c.id, label: c.label }));
    case "question": {
      const q = questionOf(draft.service, step.id)!;
      const ctx = contextOf(draft);
      const options = optionsFor(q, ctx).map((o, i) => ({ v: o.v, label: o.label, danger: o.danger, main: !q.multi && i === 0 && !o.danger }));
      if (q.extra) options.push({ v: q.extra.v, label: q.extra.label, danger: false, main: false });
      if (q.optional && !q.multi) options.push({ v: "__skip", label: ui.skip[lang], danger: false, main: false });
      return options;
    }
    case "switch": return [{ v: "yes", label: ui.switchYes[lang], main: true }, { v: "no", label: ui.switchNo[lang] }];
    case "location": return [{ v: "yes", label: ui.yesHere[lang], main: true }, { v: "map", label: ui.onMap[lang] }];
    case "drop": return [{ v: "map", label: ui.onMap[lang], main: true }];
    case "landmark": return [{ v: "none", label: ui.noLandmark[lang] }];
    default: return [];
  }
}

export const isMulti = (step: Step, draft: VoiceDraft) => step.kind === "question" && Boolean(questionOf(draft.service, step.id)?.multi);

export type Applied = { draft: VoiceDraft; said: Said[]; switched?: boolean };

/** A tapped or recognised answer, applied the way the form would apply it. */
export function applyReply(draft: VoiceDraft, step: Step, value: AnswerValue, garage: Vehicle[], via: Via, quote?: string): Applied {
  const next: VoiceDraft = { ...draft, answers: { ...draft.answers }, asked: { ...draft.asked }, sources: { ...draft.sources } };
  const one = Array.isArray(value) ? value[0] : value;
  switch (step.kind) {
    case "service":
      next.service = one as ServiceKey; next.answers = {}; next.asked = {}; next.sources.service = { via, quote };
      if (one === "ev-charging" && next.family !== "ev") { next.family = "ev"; next.vehicle = clearedChoice("choose"); next.garageAsked = false; }
      return { draft: next, said: [] };
    case "family":
      next.family = one as VehicleFamily; next.vehicle = clearedChoice("choose"); next.garageAsked = false; next.wantsName = false; next.familyWord = "";
      if (next.service === "fuel" && one === "ev") { next.service = "ev-charging"; next.answers = {}; return { draft: next, said: [{ line: "evSwitch" }] }; }
      return { draft: next, said: [] };
    case "garage": {
      next.garageAsked = true;
      if (one.startsWith("model:") || one.startsWith("brand:")) return applyReply(next, { kind: one.startsWith("model:") ? "model" : "brand" }, one.slice(6), garage, via, quote);
      const vehicle = garage.find((v) => String(v.id) === one);
      if (vehicle) { next.vehicle = choiceFromGarage(vehicle, next.family!); next.sources.vehicle = { via: "garage" }; }
      return { draft: next, said: [] };
    }
    case "brand": {
      if (one === "other") { next.wantsName = true; return { draft: next, said: [] }; }
      const brand = CATALOG_BRANDS.find((b) => b.id === one);
      if (brand) { next.vehicle = { ...clearedChoice("choose"), catalogBrandId: brand.id, vehicleBrand: brand.name }; next.sources.vehicle = { via, quote }; }
      return { draft: next, said: [] };
    }
    case "model": {
      if (one === "other") { next.wantsName = true; return { draft: next, said: [] }; }
      const model = VEHICLE_CATALOG.find((m) => m.id === one);
      if (model) { next.vehicle = choiceFromCatalog(model, next.family!); next.sources.vehicle = { via, quote }; }
      return { draft: next, said: [] };
    }
    case "name":
      next.vehicle = manualChoice(String(one), next.vehicle.vehicleBrand || ""); next.wantsName = false; next.sources.vehicle = { via, quote: String(one) };
      return { draft: next, said: [] };
    case "class":
      next.vehicle = { ...next.vehicle, vehicleSubtype: one };
      return { draft: next, said: [] };
    case "switch": {
      next.pendingSwitch = null;
      if (one === "yes") { next.service = "towing"; next.answers = {}; next.asked = {}; next.sources.service = { via }; return { draft: next, said: [], switched: true }; }
      delete next.answers[step.question];
      return { draft: next, said: [] };
    }
    case "question": {
      if (one === "__skip") { next.asked[step.id] = true; return { draft: next, said: [] }; }
      const q = questionOf(next.service, step.id);
      next.answers[step.id] = q?.multi ? (Array.isArray(value) ? value : [one]) : one;
      next.asked[step.id] = true;
      next.sources[step.id] = { via, quote };
      const result = calloutFor(next, step.id, next.answers[step.id]);
      if (result?.switchTo) { next.pendingSwitch = { question: step.id, value: one }; return { draft: next, said: [] }; }
      return { draft: next, said: result ? [{ line: result.line, urgent: result.urgent, call: result.call }] : [] };
    }
    case "location":
      if (one === "yes") next.located = true;
      return { draft: next, said: [] };
    case "drop":
      next.dropAsked = true; if (one !== "map") next.dropText = String(one);
      return { draft: next, said: [] };
    case "landmark":
      next.landmarkAsked = true; if (one !== "none") next.landmark = String(one).slice(0, 120);
      return { draft: next, said: [] };
    default:
      return { draft: next, said: [] };
  }
}

/** A spoken or typed answer to the current step, if the words make it clear. */
export function understandReply(step: Step, draft: VoiceDraft, text: string, garage: Vehicle[]): { value: AnswerValue; quote?: string } | null {
  const t = text.trim();
  if (!t) return null;
  switch (step.kind) {
    case "service": { const m = SERVICE_WORDS.find(([, re]) => re.test(t)); return m ? { value: m[0], quote: t } : null; }
    case "family": { const m = FAMILY_WORDS.find(([, re]) => re.test(t)); return m ? { value: m[0], quote: t } : null; }
    case "garage": {
      const mine = garageForFamily(garage, draft.family!);
      if (YES.test(t) && mine[0]) return { value: String(mine[0].id) };
      const named = findVehicle(t, draft.family, mine, { lenient: true });
      if (named?.choice.vehicleSource === "garage") return { value: String(named.choice.garageVehicleId) };
      // "No, Honda Shine": a different vehicle, named straight away.
      const other = findVehicle(t, draft.family, [], { lenient: true });
      if (other?.choice.catalogModelId) return { value: `model:${other.choice.catalogModelId}`, quote: t };
      if (other?.choice.catalogBrandId) return { value: `brand:${other.choice.catalogBrandId}`, quote: t };
      return NO.test(t) ? { value: "other" } : null;
    }
    case "brand": case "model": {
      const found = findVehicle(t, draft.family, [], { lenient: true });
      if (!found) return null;
      if (step.kind === "brand") return { value: found.choice.catalogBrandId || "", quote: t };
      return found.choice.catalogModelId ? { value: found.choice.catalogModelId, quote: t } : null;
    }
    case "name": return { value: t.slice(0, 80), quote: t };
    case "class": {
      const c = classesFor(draft.family!).find((entry) => new RegExp(`\\b${entry.label.split(/[ /]/)[0]}`, "i").test(t));
      return c ? { value: c.id, quote: t } : null;
    }
    case "switch": return YES.test(t) ? { value: "yes" } : NO.test(t) ? { value: "no" } : null;
    case "question": {
      const q = questionOf(draft.service, step.id);
      if (!q || !draft.service) return null;
      const found = hearAnswer(draft.service, q, t, contextOf(draft));
      if (found) return { value: found.value, quote: found.quote };
      const byLabel = [...optionsFor(q, contextOf(draft)), ...(q.extra ? [q.extra] : [])].find((o) => o.label.toLowerCase() === t.toLowerCase());
      if (byLabel) return { value: q.multi ? [byLabel.v] : byLabel.v, quote: t };
      if (q.optional && SKIP.test(t)) return { value: "__skip" };
      return null;
    }
    case "location": return YES.test(t) ? { value: "yes" } : NO.test(t) ? { value: "map" } : null;
    case "drop": return { value: t.slice(0, 160), quote: t };
    case "landmark": return SKIP.test(t) ? { value: "none" } : { value: t.slice(0, 120), quote: t };
    default: return null;
  }
}

/* ------------------------------------------------------------------ the AI step */

/** What the server-side model may return; every value is checked against the form before use. */
export type AiResult = { service?: string; family?: string; brand?: string; model?: string; answers?: Record<string, unknown>; landmark?: string; drop?: string };

/** The questions the AI may answer, with the form's own options, for the server to constrain the model. */
export function aiContext(draft: VoiceDraft, service: ServiceKey | null) {
  const svc = service ?? draft.service;
  const ctx = contextOf(draft);
  return {
    services: VOICE_SERVICES.map((k) => ({ id: k, title: serviceSpecFor(k).title })),
    families: FAMILIES,
    service: svc,
    family: draft.family,
    questions: svc ? serviceSpecFor(svc).questions.filter((q) => q.kind !== "fuelcalc").map((q) => ({
      id: q.id, label: q.label, multi: Boolean(q.multi), options: [...optionsFor(q, ctx), ...(q.extra ? [q.extra] : [])].map((o) => ({ v: o.v, label: o.label })),
    })) : [],
  };
}

/** Folds a checked AI reading into the draft, only where the words alone left a gap. */
export function mergeAi(draft: VoiceDraft, ai: AiResult, garage: Vehicle[]): VoiceDraft {
  const heard: Heard = { service: null, family: null, familyWord: "", vehicle: null, answers: {}, quotes: {}, highway: false, evSwitched: false };
  if (!draft.service && ai.service && (VOICE_SERVICES as string[]).includes(ai.service)) heard.service = ai.service as ServiceKey;
  if (!draft.family && ai.family && (FAMILIES as string[]).includes(ai.family)) heard.family = ai.family as VehicleFamily;
  if (!hasVehicle(draft.vehicle) && (ai.brand || ai.model)) {
    const found = findVehicle(`${ai.brand ?? ""} ${ai.model ?? ""}`, heard.family ?? draft.family, garage, { lenient: true });
    if (found) { heard.vehicle = found; heard.family = found.family; }
  }
  const service = heard.service ?? draft.service;
  if (service && ai.answers && typeof ai.answers === "object") {
    const ctx: FormContext = { family: heard.family ?? draft.family ?? "car", classId: heard.vehicle?.choice.vehicleSubtype || draft.vehicle.vehicleSubtype || null };
    for (const q of shownQuestions(serviceSpecFor(service), draft.answers, ctx)) {
      if (hasAnswer(draft.answers, q.id)) continue;
      const raw = ai.answers[q.id];
      const allowed = new Set([...optionsFor(q, ctx), ...(q.extra ? [q.extra] : [])].map((o) => o.v));
      if (q.multi && Array.isArray(raw)) { const values = raw.map(String).filter((v) => allowed.has(v)); if (values.length) heard.answers[q.id] = values; }
      else if (!q.multi && typeof raw === "string" && allowed.has(raw)) heard.answers[q.id] = raw;
    }
  }
  let next = mergeHeard(draft, heard, "ai").draft;
  if (!next.landmark && typeof ai.landmark === "string" && ai.landmark.trim()) next = { ...next, landmark: ai.landmark.trim().slice(0, 120) };
  if (!next.dropText && typeof ai.drop === "string" && ai.drop.trim()) next = { ...next, dropText: ai.drop.trim().slice(0, 160) };
  return next;
}

/* ------------------------------------------------------------------ handing over to the form */

export type Place = { address: string; lat: number; lng: number; placeId?: string | null };

/**
 * The request form's own saved state, filled in: the form opens on its Confirm step (or its
 * location step for towing, or when no location was found) and sends the request as it always does.
 */
export function formHandoff(draft: VoiceDraft, place: Place | null, { atLocation = false } = {}) {
  const service = draft.service!;
  const family = draft.family!;
  const v = draft.vehicle;
  const formData = {
    vehicleType: family, vehicleSubtype: v.vehicleSubtype || "", vehicleBaseSubtype: v.vehicleBaseSubtype || "", vehicleModel: v.vehicleModel || "",
    vehicleBrand: v.vehicleBrand || "", vehicleTab: v.vehicleTab || (v.vehicleSource === "garage" ? "garage" : "choose"), vehicleSource: v.vehicleSource || "",
    garageVehicleId: v.garageVehicleId ?? null, catalogBrandId: v.catalogBrandId ?? null, catalogModelId: v.catalogModelId ?? null, manualName: v.manualName || "",
    plate: v.plate || "", saveToGarage: true,
    location: place?.address ?? "", locationLat: place?.lat, locationLng: place?.lng,
    locationCoordinates: place ? { lat: place.lat, lng: place.lng } : undefined,
    locationPlaceId: place?.placeId ?? null,
    locationPlace: place ? { address: place.address, formatted_address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId ?? null } : null,
    dropLocation: draft.dropText || "",
    name: "", phone: "", email: "", details: "", selectedTechnicianId: null,
    answers: draft.answers, landmark: draft.landmark, note: draft.note, attachments: [], channel: "voice",
  };
  const currentStep = atLocation || service === "towing" || !place ? 2 : 3;
  return {
    path: `/request-service/${service}/${family}`,
    storageKey: `resqnow_service_request_${service}_${family}`,
    saved: { formData, currentStep },
  };
}
