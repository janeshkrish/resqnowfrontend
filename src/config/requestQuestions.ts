/**
 * What the request form asks for each service. Every answer is a tap; the few questions
 * that change the price or the truck come first, safety questions sit above everything.
 * Answers go to the backend as `details.answers` and reach the technician as chips.
 */
export type OptionArt = "tubeless" | "tube" | "ccs2" | "type2" | "home3pin" | "brand";

export type QuestionOption = {
  v: string;
  label: string;
  sub?: string;
  icon?: string;
  /** Summary and technician chip when the label alone wouldn't make sense ("No" → "No one inside"). */
  chip?: string;
  danger?: boolean;
  art?: OptionArt;
};

export type Callout = {
  /** Shown when this answer is picked. */
  when: string;
  tone: "red" | "amber" | "info";
  icon: string;
  text: string;
  call?: string;
  /** Offers to move the request to another service. */
  switchTo?: "towing";
};

export type QuestionKind = "seg" | "cards" | "visual" | "list" | "chips" | "tyres" | "fuelcalc";

/** Four-wheelers use "car" options, two-wheelers "bike"; commercial falls back to "car". */
export type OptionSet = "car" | "bike" | "commercial";

export type Question = {
  id: string;
  label: string;
  kind: QuestionKind;
  /** Finishes "Choose …" on the Continue button while it's unanswered. */
  need?: string;
  helper?: string;
  /** Small text beside the label. */
  aside?: string;
  optional?: boolean;
  multi?: boolean;
  /** Taller buttons for a safety question. */
  big?: boolean;
  /** Pictures side by side with a "Not sure" tile, instead of big cards. */
  compact?: boolean;
  /** One swipeable row instead of wrapping. */
  scroll?: boolean;
  /** Asked before the vehicle (safety first). */
  first?: boolean;
  options?: QuestionOption[];
  byType?: Partial<Record<OptionSet, QuestionOption[]>>;
  extra?: QuestionOption;
  only?: "four-wheeler" | "two-wheeler";
  hideIf?: { q: string; is: string };
  callouts?: Callout[];
};

export type ServiceKey =
  | "sos" | "towing" | "flat-tire" | "battery" | "mechanical" | "fuel" | "lockout" | "winching" | "ev-charging" | "other";

export type ServiceSpec = {
  key: ServiceKey;
  title: string;
  /** Picture from public/images/services; SOS shows its own badge. */
  art: string | null;
  questions: Question[];
  /** Shown after sending. */
  tip: string;
};

const HURT = (callText: string): Question => ({
  id: "hurt",
  label: "Is anyone hurt?",
  kind: "seg",
  need: "is anyone hurt",
  first: true,
  options: [
    { v: "no", label: "No one is hurt", icon: "verified_user", chip: "No one hurt" },
    { v: "yes", label: "Yes, someone is", icon: "personal_injury", danger: true, chip: "Someone hurt" },
  ],
  callouts: [{ when: "yes", tone: "red", icon: "emergency", text: callText, call: "108" }],
});

const DEFAULT_TIP = "Switch on the hazard lights and wait away from traffic.";

export const SERVICE_SPECS: Record<ServiceKey, ServiceSpec> = {
  sos: {
    key: "sos",
    title: "Emergency help",
    art: null,
    tip: "Keep your phone close. Share the live location link with family.",
    questions: [
      { ...HURT("Call 108 for an ambulance first. We’ll still send help to your vehicle."), big: true },
      {
        id: "what",
        label: "What happened?",
        kind: "cards",
        optional: true,
        options: [
          { v: "accident", label: "Accident", sub: "Vehicle hit or damaged", icon: "car_crash" },
          { v: "breakdown", label: "Breakdown", sub: "It stopped suddenly", icon: "car_repair" },
          { v: "stuck", label: "Stuck", sub: "In a ditch, mud or water", icon: "terrain" },
          { v: "unsure", label: "Don’t know", sub: "We’ll ask you on the call", icon: "help" },
        ],
      },
    ],
  },
  towing: {
    key: "towing",
    title: "Towing",
    art: "/images/services/towing.png",
    tip: "Keep the key with you. The driver needs it to unlock the steering.",
    questions: [
      {
        id: "why",
        label: "What happened?",
        kind: "chips",
        need: "what happened",
        options: [
          { v: "breakdown", label: "Breakdown", icon: "car_repair" },
          { v: "accident", label: "Accident", icon: "car_crash" },
          { v: "nostart", label: "Won’t start", icon: "key_off" },
          { v: "other", label: "Something else", icon: "more_horiz" },
        ],
        callouts: [{ when: "accident", tone: "amber", icon: "photo_camera", text: "If anyone is hurt, call 108 first. Take photos of the damage for insurance." }],
      },
      {
        id: "roll",
        label: "Can the vehicle be pushed?",
        helper: "Put it in neutral and try pushing it a little",
        kind: "list",
        need: "can it be pushed",
        byType: {
          car: [
            { v: "yes", label: "Yes, it moves", sub: "A normal tow truck will do", icon: "check_circle", chip: "Can be pushed" },
            { v: "no", label: "No, it won’t move", sub: "We’ll send a flatbed truck", icon: "block", chip: "Won’t move" },
            { v: "dk", label: "Don’t know", sub: "The driver will check", icon: "help", chip: "Not sure if it moves" },
          ],
          bike: [
            { v: "yes", label: "Yes, it rolls", sub: "A bike carrier will do", icon: "check_circle", chip: "Can be pushed" },
            { v: "no", label: "No, wheel locked or damaged", sub: "We’ll bring a ramp to load it", icon: "block", chip: "Wheel locked" },
            { v: "dk", label: "Don’t know", sub: "The driver will check", icon: "help", chip: "Not sure if it moves" },
          ],
          commercial: [
            { v: "yes", label: "Yes, it moves", sub: "We’ll send a heavy tow truck", icon: "check_circle", chip: "Can be pushed" },
            { v: "no", label: "No, it won’t move", sub: "The crew brings lifting gear", icon: "block", chip: "Won’t move" },
            { v: "dk", label: "Don’t know", sub: "The driver will check", icon: "help", chip: "Not sure if it moves" },
          ],
        },
      },
    ],
  },
  "flat-tire": {
    key: "flat-tire",
    title: "Puncture",
    art: "/images/services/flat-tire.png",
    tip: DEFAULT_TIP,
    questions: [
      {
        id: "tyretype",
        label: "Tyre type",
        kind: "visual",
        compact: true,
        need: "the tyre type",
        aside: "Most new vehicles are tubeless",
        options: [
          { v: "tubeless", label: "Tubeless", sub: "No tube inside the tyre", art: "tubeless" },
          { v: "tube", label: "Tube tyre", sub: "Has a rubber tube inside", art: "tube" },
        ],
        extra: { v: "dk", label: "Not sure", icon: "help", chip: "Tyre type not sure" },
      },
      { id: "tyre", label: "Which tyre is flat?", kind: "tyres", multi: true, need: "the flat tyre", aside: "Tap all that apply" },
      {
        id: "spare",
        label: "Do you have a stepney (spare tyre)?",
        kind: "seg",
        only: "four-wheeler",
        need: "stepney or repair",
        options: [
          { v: "repair", label: "No, repair it", icon: "tire_repair", chip: "Repair it" },
          { v: "spare", label: "Yes, fit stepney", icon: "swap_horiz", chip: "Fit stepney" },
        ],
      },
      {
        id: "damage",
        label: "How does the tyre look?",
        kind: "seg",
        need: "how the tyre looks",
        options: [
          { v: "flat", label: "Only flat" },
          { v: "torn", label: "Torn or cut" },
          { v: "rim", label: "Wheel bent" },
        ],
        callouts: [
          { when: "torn", tone: "amber", icon: "warning", text: "A torn tyre can’t be repaired. The mechanic will fit a stepney or arrange a tow." },
          { when: "rim", tone: "amber", icon: "warning", text: "A bent wheel may not hold air. The mechanic will check and suggest a tow if needed." },
        ],
      },
    ],
  },
  battery: {
    key: "battery",
    title: "Battery problem",
    art: "/images/services/battery.png",
    tip: DEFAULT_TIP,
    questions: [
      {
        id: "symptom",
        label: "When you start it, what happens?",
        kind: "cards",
        need: "what happens",
        options: [
          { v: "dead", label: "Nothing at all", sub: "No lights, no sound", icon: "power_off" },
          { v: "click", label: "Tik-tik sound", sub: "Clicks but won’t start", icon: "graphic_eq" },
          { v: "slow", label: "Starts weakly", sub: "Engine tries, then stops", icon: "slow_motion_video" },
          { v: "lights", label: "Only lights work", sub: "Engine doesn’t try at all", icon: "lightbulb" },
        ],
      },
      {
        id: "need",
        label: "What do you need?",
        kind: "seg",
        need: "what you need",
        options: [
          { v: "jump", label: "Jump-start" },
          { v: "new", label: "New battery" },
          { v: "dk", label: "Not sure" },
        ],
      },
      {
        id: "age",
        label: "How old is the battery?",
        kind: "chips",
        optional: true,
        options: [
          { v: "lt2", label: "Less than 2 years" },
          { v: "2to4", label: "2–4 years" },
          { v: "gt4", label: "More than 4 years" },
          { v: "dk", label: "Don’t know", chip: "Battery age not known" },
        ],
      },
    ],
  },
  mechanical: {
    key: "mechanical",
    title: "Mechanic",
    art: "/images/services/mechanical.png",
    tip: DEFAULT_TIP,
    questions: [
      {
        id: "help",
        label: "How can we help?",
        kind: "seg",
        need: "how we can help",
        helper: "Mechanic checks, tells the cost, fixes only if you say yes",
        options: [
          { v: "inspect", label: "Roadside inspection" },
          { v: "tow", label: "Take to a garage" },
        ],
        callouts: [{ when: "tow", tone: "info", icon: "local_shipping", text: "We’ll move you to towing so you can pick the garage.", switchTo: "towing" }],
      },
      {
        id: "issue",
        label: "What do you notice?",
        kind: "chips",
        multi: true,
        optional: true,
        scroll: true,
        options: [
          { v: "nostart", label: "Won’t start", icon: "key_off" },
          { v: "heat", label: "Overheating", icon: "thermostat" },
          { v: "noise", label: "Strange sound", icon: "graphic_eq" },
          { v: "light", label: "Warning light", icon: "warning" },
          { v: "smoke", label: "Smoke", icon: "cloud" },
          { v: "brakes", label: "Brake problem", icon: "do_not_step" },
          { v: "gears", label: "Gear problem", icon: "settings" },
          { v: "leak", label: "Oil or water leak", icon: "water_drop" },
          { v: "other", label: "Something else", icon: "more_horiz" },
        ],
        callouts: [{ when: "heat", tone: "amber", icon: "thermostat", text: "Switch the engine off. Don’t open the radiator cap while it’s hot." }],
      },
      {
        id: "drive",
        label: "Can you drive it?",
        kind: "seg",
        need: "can you drive it",
        options: [
          { v: "yes", label: "Yes, slowly", chip: "Can drive slowly" },
          { v: "no", label: "No, it’s stuck", chip: "Can’t drive" },
        ],
      },
    ],
  },
  fuel: {
    key: "fuel",
    title: "Fuel delivery",
    art: "/images/services/fuel.png",
    tip: DEFAULT_TIP,
    questions: [
      {
        id: "fuel",
        label: "Which fuel?",
        helper: "It’s written near the fuel cap",
        kind: "seg",
        need: "the fuel",
        options: [
          { v: "petrol", label: "Petrol", icon: "local_gas_station" },
          { v: "diesel", label: "Diesel", icon: "local_gas_station" },
          { v: "cng", label: "CNG", icon: "propane_tank" },
        ],
        callouts: [{ when: "cng", tone: "amber", icon: "propane_tank", text: "CNG can’t be brought in a can. We can tow you to the nearest CNG pump.", switchTo: "towing" }],
      },
      {
        id: "qty",
        label: "How much fuel?",
        kind: "seg",
        need: "how much fuel",
        hideIf: { q: "fuel", is: "cng" },
        byType: {
          car: [
            { v: "2", label: "2 litres" },
            { v: "3", label: "3 litres" },
            { v: "5", label: "5 litres" },
          ],
          bike: [
            { v: "1", label: "1 litre" },
            { v: "2", label: "2 litres" },
          ],
          commercial: [
            { v: "5", label: "5 litres" },
            { v: "10", label: "10 litres" },
            { v: "20", label: "20 litres" },
          ],
        },
      },
      { id: "fuelcalc", label: "Fuel cost", kind: "fuelcalc", hideIf: { q: "fuel", is: "cng" } },
    ],
  },
  lockout: {
    key: "lockout",
    title: "Locked out",
    art: "/images/services/lockout.png",
    tip: "Keep your ID or RC ready. The helper checks it before opening the vehicle.",
    questions: [
      {
        id: "inside",
        label: "Is a child, person or pet stuck inside?",
        kind: "seg",
        need: "is anyone inside",
        first: true,
        options: [
          { v: "no", label: "No", chip: "No one inside" },
          { v: "yes", label: "Yes", danger: true, chip: "Someone inside" },
        ],
        callouts: [{ when: "yes", tone: "red", icon: "emergency", text: "If it’s hot or they look unwell, call 112 now. We’ve marked this urgent.", call: "112" }],
      },
      {
        id: "what",
        label: "Where is your key?",
        kind: "cards",
        need: "where the key is",
        options: [
          { v: "inside", label: "Locked inside", sub: "Key is in the vehicle", icon: "lock" },
          { v: "lost", label: "Lost", sub: "Can’t find the key", icon: "key_off" },
          { v: "broken", label: "Broken", sub: "Stuck in the lock", icon: "key" },
          { v: "remote", label: "Remote not working", sub: "Vehicle won’t unlock", icon: "settings_remote" },
        ],
      },
    ],
  },
  winching: {
    key: "winching",
    title: "Stuck vehicle",
    art: "/images/services/winching.png",
    tip: DEFAULT_TIP,
    questions: [
      HURT("Call 108 for an ambulance first. Don’t try to move the vehicle yourself."),
      {
        id: "where",
        label: "Where is it stuck?",
        kind: "cards",
        need: "where it’s stuck",
        options: [
          { v: "ditch", label: "In a ditch", sub: "Wheels slipped off the road", icon: "landslide" },
          { v: "mud", label: "Mud or sand", sub: "Wheels spin, won’t move", icon: "grain" },
          { v: "water", label: "Water", sub: "Flooded road or drain", icon: "flood" },
          { v: "slope", label: "Slope", sub: "Can’t climb back up", icon: "terrain" },
        ],
      },
      {
        id: "upright",
        label: "Is it standing on its wheels?",
        kind: "seg",
        need: "is it on its wheels",
        options: [
          { v: "yes", label: "Yes", chip: "Upright" },
          { v: "no", label: "No, it fell over", chip: "Fell over" },
        ],
        callouts: [{ when: "no", tone: "amber", icon: "warning", text: "This needs a crane. We’ll send a bigger recovery truck, which costs more." }],
      },
      {
        id: "far",
        label: "How far is it from the road?",
        kind: "seg",
        need: "how far from the road",
        aside: "1 m ≈ one big step",
        options: [
          { v: "lt5", label: "Under 5 m", chip: "Under 5 m from road" },
          { v: "5to15", label: "5 to 15 m", chip: "5–15 m from road" },
          { v: "more", label: "More", chip: "Far from road" },
        ],
      },
    ],
  },
  "ev-charging": {
    key: "ev-charging",
    title: "EV charging",
    art: "/images/services/ev-charging.png",
    tip: DEFAULT_TIP,
    questions: [
      {
        id: "left",
        label: "How much charge is left?",
        kind: "seg",
        need: "charge left",
        options: [
          { v: "0", label: "0%", chip: "0% charge" },
          { v: "lt5", label: "Below 5%", chip: "Below 5%" },
          { v: "5to10", label: "5–10%", chip: "5–10%" },
          { v: "dk", label: "Don’t know", chip: "Charge not sure" },
        ],
      },
      {
        id: "port",
        label: "Which socket does it have?",
        helper: "Open the charging flap and match the shape",
        kind: "visual",
        need: "the socket",
        byType: {
          car: [
            { v: "ccs2", label: "CCS2", sub: "Round top with 2 big holes below", art: "ccs2" },
            { v: "type2", label: "Type 2", sub: "Round top only, 7 holes", art: "type2" },
          ],
          bike: [
            { v: "home", label: "Home plug", sub: "Normal 3-pin wall plug", art: "home3pin" },
            { v: "brand", label: "Brand’s own plug", sub: "Ather, Ola, TVS or Bajaj charger", art: "brand" },
          ],
        },
        extra: { v: "dk", label: "Don’t know? Add a photo of the socket on the last step", icon: "photo_camera", chip: "Socket not known" },
      },
      {
        id: "plan",
        label: "What do you need?",
        kind: "seg",
        need: "what you need",
        options: [
          { v: "charge", label: "Charge it here", icon: "ev_station", chip: "Charge here" },
          { v: "tow", label: "Tow to a charger", icon: "local_shipping", chip: "Tow to charger" },
        ],
      },
    ],
  },
  other: {
    key: "other",
    title: "Roadside help",
    art: null,
    tip: DEFAULT_TIP,
    questions: [],
  },
};

const SERVICE_ALIASES: Record<string, ServiceKey> = {
  emergency: "sos",
  sos: "sos",
  towing: "towing",
  "flat-tire": "flat-tire",
  "flat-tyre": "flat-tire",
  puncture: "flat-tire",
  battery: "battery",
  "battery-jumpstart": "battery",
  mechanical: "mechanical",
  fuel: "fuel",
  "fuel-delivery": "fuel",
  lockout: "lockout",
  winching: "winching",
  "ev-charging": "ev-charging",
};

export function serviceSpecFor(serviceId?: string | null): ServiceSpec {
  const key = SERVICE_ALIASES[String(serviceId || "").trim().toLowerCase()] ?? "other";
  return SERVICE_SPECS[key];
}
