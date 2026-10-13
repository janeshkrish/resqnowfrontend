import { useCallback, useSyncExternalStore } from "react";

import { serviceName, serviceOf } from "@/lib/services";
import { TECH_LANGUAGES, TECH_TEXT, type TechLang, type TechTextKey } from "@/lib/technicianText";

/** Where the technician's language choice is kept on this phone. */
export const TECH_LANGUAGE_KEY = "resqnow_technician_language";

const LOCALES: Record<TechLang, string> = { en: "en-IN", ta: "ta-IN", hi: "hi-IN" };
const listeners = new Set<() => void>();

const isLang = (value: unknown): value is TechLang => TECH_LANGUAGES.some((language) => language.code === value);

export function readTechLanguage(): TechLang {
  try {
    const saved = localStorage.getItem(TECH_LANGUAGE_KEY);
    return isLang(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

export function setTechLanguage(lang: TechLang) {
  try {
    localStorage.setItem(TECH_LANGUAGE_KEY, lang);
  } catch {
    // The choice then lasts for this visit only.
  }
  current = lang;
  listeners.forEach((listener) => listener());
}

let current: TechLang = readTechLanguage();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export type TechVars = Record<string, string | number>;

/** The line for a key in a language, with its `{values}` filled in. English stands in for a missing line. */
export function techText(lang: TechLang, key: TechTextKey, vars?: TechVars) {
  const line = TECH_TEXT[lang]?.[key] ?? TECH_TEXT.en[key];
  if (!vars) return line;
  return line.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A service's name in the chosen language. English keeps the app's own names. */
export function techServiceName(lang: TechLang, serviceType: unknown) {
  if (lang === "en") return serviceName(serviceType as string | null | undefined);
  const id = serviceOf(serviceType as string | null | undefined)?.id ?? "other";
  const key = `service.${id}` as TechTextKey;
  return TECH_TEXT[lang][key] ?? TECH_TEXT.en[key] ?? serviceName(serviceType as string | null | undefined);
}

/** Rupees written the Indian way, with paise only when there are some: ₹1,23,456 or ₹314.50. */
export function techRupees(value: unknown) {
  const amount = Number(value) || 0;
  const digits = Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2;
  return `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)}`;
}

const validDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "7 Oct" in the chosen language; empty when there is no date. */
export function techDate(lang: TechLang, value: unknown) {
  const date = validDate(value);
  return date ? date.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short" }) : "";
}

/** "3:14 pm" in the chosen language; empty when there is no date. */
export function techTime(lang: TechLang, value: unknown) {
  const date = validDate(value);
  return date ? date.toLocaleTimeString(LOCALES[lang], { hour: "numeric", minute: "2-digit" }).toLowerCase() : "";
}

/** The heading a day's jobs sit under: Today, Yesterday, or "Monday, 5 Oct". */
export function techDayLabel(lang: TechLang, value: unknown, now = new Date()) {
  const date = validDate(value);
  if (!date) return "";
  if (sameDay(date, now)) return techText(lang, "common.today");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return techText(lang, "common.yesterday");
  return date.toLocaleDateString(LOCALES[lang], { weekday: "long", day: "numeric", month: "short" });
}

/** The short name of a day for the week's bars: "Mon", or Today. */
export function techWeekday(lang: TechLang, value: unknown, now = new Date()) {
  const date = validDate(value);
  if (!date) return "";
  if (sameDay(date, now)) return techText(lang, "common.today");
  return date.toLocaleDateString(LOCALES[lang], { weekday: "short" });
}

/** The technician app's words in the language chosen on this phone. */
export function useTechText() {
  const lang = useSyncExternalStore(subscribe, () => current, () => "en" as TechLang);
  const t = useCallback((key: TechTextKey, vars?: TechVars) => techText(lang, key, vars), [lang]);
  return { lang, setLang: setTechLanguage, t };
}
