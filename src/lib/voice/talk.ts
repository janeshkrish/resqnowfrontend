/**
 * What ResQNow-Thozhan says, as the screen shows it: words, with little picture chips where a
 * line names the service, the vehicle or a place ("Note pannitten: unga [bike]-ku [Puncture]").
 */
import { serviceSpecFor, type ServiceKey } from "@/config/requestQuestions";
import { ACK, ACK_SAY, FAMILY_TALK, LINES, QUESTION_PROMPTS, SERVICE_TALK, type L3, type Lang } from "./lexicon";
import type { VehicleFamily } from "@/lib/vehicleClasses";

/** `say` is how a Tamil voice should read the chip in a Tanglish line. */
export type Chip = { text: string; art?: string | null; icon?: string; say?: string };
export type Segment = { chip: false; text: string } | { chip: true; text: string; art: string | null; icon: string; after: string };

export type LineKey = keyof typeof LINES;
export type Line =
  | { kind: "line"; key: LineKey; chips?: Record<string, Chip>; ack?: number }
  | { kind: "question"; service: ServiceKey; id: string; ack?: number }
  | { kind: "text"; text: L3; ack?: number };

const VEHICLE_ART: Record<VehicleFamily, string> = {
  bike: "/images/vehicles/bike.webp", car: "/images/vehicles/car.webp", commercial: "/images/vehicles/truck.webp", ev: "/images/vehicles/ev.webp",
};

export const serviceChip = (service: ServiceKey, lang: Lang): Chip => {
  const label = SERVICE_TALK[service].label;
  return { text: label[lang], art: serviceSpecFor(service).art, icon: "build", say: label.say ?? label.ta };
};
/** A vehicle's name as a voice should say it: "Splendor+" is "Splendor plus". */
const spokenName = (name: string) => name.replace(/\s*\+/g, " plus");
export const vehicleChip = (family: VehicleFamily, lang: Lang, name?: string): Chip => {
  const word = FAMILY_TALK[family];
  return { text: name || word[lang], art: VEHICLE_ART[family], say: name ? spokenName(name) : word.say || word.ta };
};
export const placeChip = (text: string): Chip => ({ text, icon: "location_on", say: text });
export const reactChip = (service: ServiceKey, lang: Lang): Chip => {
  const react = SERVICE_TALK[service].react;
  return { text: react[lang], say: react.say ?? react.ta };
};
export const vehicleArt = (family: VehicleFamily) => VEHICLE_ART[family];

/** The words of a line in the chosen language, with [[name]] holes still in. */
export function lineText(line: Line, lang: Lang): string {
  let text = "";
  if (line.kind === "line") text = LINES[line.key][lang];
  else if (line.kind === "question") text = QUESTION_PROMPTS[line.service]?.[line.id]?.[lang] ?? "";
  else text = line.text[lang];
  if (line.ack != null) text = `${ACK[lang][line.ack % ACK[lang].length]} ${text}`;
  return text;
}

/** A line as words and chips; punctuation sticks to whatever it follows. */
export function segments(line: Line, lang: Lang): Segment[] {
  const chips = line.kind === "line" ? line.chips ?? {} : {};
  const out: Segment[] = [];
  for (const part of lineText(line, lang).split(/(\[\[\w+\]\])/)) {
    if (!part) continue;
    const hole = /^\[\[(\w+)\]\]$/.exec(part);
    if (hole) {
      const chip = chips[hole[1]];
      if (hole[1] === "react" || !chip) {
        // [[react]] is plain words, not a chip.
        const words = (chip?.text ?? "").split(/\s+/).filter(Boolean);
        for (const w of words) out.push({ chip: false, text: w });
        continue;
      }
      out.push({ chip: true, text: chip.text, art: chip.art ?? null, icon: chip.icon ?? "", after: "" });
      continue;
    }
    const lead = /^\s/.test(part);
    part.split(/\s+/).filter(Boolean).forEach((word, i) => {
      const last = out[out.length - 1];
      if (i === 0 && !lead && last) {
        if (last.chip) last.after += word; else last.text += word;
      } else out.push({ chip: false, text: word });
    });
  }
  return out;
}

/** The Tanglish line in Tamil script, for a Tamil voice; null when it has none. */
function sayTemplate(line: Line): string | null {
  let template: string | undefined;
  if (line.kind === "line") template = LINES[line.key].say;
  else if (line.kind === "question") template = QUESTION_PROMPTS[line.service]?.[line.id]?.say;
  else template = line.text.say;
  if (!template) return null;
  return line.ack != null ? `${ACK_SAY[line.ack % ACK_SAY.length]} ${template}` : template;
}

/**
 * The line read aloud. English and Tamil are read as written. Tanglish (Tamil words in English
 * letters) sounds wrong in any voice, so it is read from its Tamil-script form by a Tamil voice;
 * a Tanglish line without one is not read at all.
 */
export function spokenText(line: Line, lang: Lang): string {
  if (lang !== "tg") return segments(line, lang).map((s) => (s.chip ? s.text + s.after : s.text)).join(" ");
  const template = sayTemplate(line);
  if (!template) return "";
  const chips = line.kind === "line" ? line.chips ?? {} : {};
  return template.replace(/\[\[(\w+)\]\]/g, (_hole, name: string) => chips[name]?.say ?? chips[name]?.text ?? "").replace(/\s+/g, " ").trim();
}
