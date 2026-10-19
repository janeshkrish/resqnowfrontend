/**
 * What ResQNow-Thozhan says, as the screen shows it: words, with little picture chips where a
 * line names the service, the vehicle or a place ("Note pannitten: unga [bike]-ku [Puncture]").
 */
import { serviceSpecFor, type ServiceKey } from "@/config/requestQuestions";
import { ACK, FAMILY_TALK, LINES, QUESTION_PROMPTS, SERVICE_TALK, type L3, type Lang } from "./lexicon";
import type { VehicleFamily } from "@/lib/vehicleClasses";

export type Chip = { text: string; art?: string | null; icon?: string };
export type Segment = { chip: false; text: string } | { chip: true; text: string; art: string | null; icon: string; after: string };

export type LineKey = keyof typeof LINES;
export type Line =
  | { kind: "line"; key: LineKey; chips?: Record<string, Chip>; ack?: number }
  | { kind: "question"; service: ServiceKey; id: string; ack?: number }
  | { kind: "text"; text: L3; ack?: number };

const VEHICLE_ART: Record<VehicleFamily, string> = {
  bike: "/images/vehicles/bike.webp", car: "/images/vehicles/car.webp", commercial: "/images/vehicles/truck.webp", ev: "/images/vehicles/ev.webp",
};

export const serviceChip = (service: ServiceKey, lang: Lang): Chip => ({ text: SERVICE_TALK[service].label[lang], art: serviceSpecFor(service).art, icon: "build" });
export const vehicleChip = (family: VehicleFamily, lang: Lang, name?: string): Chip => ({ text: name || FAMILY_TALK[family][lang], art: VEHICLE_ART[family] });
export const placeChip = (text: string): Chip => ({ text, icon: "location_on" });
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

/** The line read aloud: chips become their words. */
export function spokenText(line: Line, lang: Lang): string {
  return segments(line, lang).map((s) => (s.chip ? s.text + s.after : s.text)).join(" ");
}
