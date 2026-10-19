import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { Vehicle } from "@/lib/garage";
import { summarizePlace } from "@/lib/placeSummary";
import { displayName, garageForFamily, brandById } from "@/lib/vehicleChoice";
import type { Mood } from "@/components/voice/Thozhan";
import { askVoiceAi } from "@/lib/voice/api";
import {
  aiContext, applyReply, calloutFor, detectLang, emptyDraft, formHandoff, hear, isMulti, mergeAi, mergeHeard, nextStep, understandReply,
  type Said, type Step, type Via, type VoiceDraft,
} from "@/lib/voice/engine";
import { LINES, NOD, SERVICE_TALK, type Lang } from "@/lib/voice/lexicon";
import { listen, silence, speak, type Listening } from "@/lib/voice/speech";
import { placeChip, serviceChip, spokenText, vehicleChip, type Line } from "@/lib/voice/talk";
import type { ServiceKey } from "@/config/requestQuestions";
import type { VehicleFamily } from "@/lib/vehicleClasses";

export type Turn =
  | { id: number; who: "you"; text: string; via: Via; keys: string[] }
  | { id: number; who: "thozhan"; line: Line; call?: string };
export type Status = "idle" | "listening" | "thinking" | "talking";
type NewTurn = Turn extends infer T ? (T extends Turn ? Omit<T, "id"> : never) : never;
export type Phase = "hello" | "convo" | "handing";
export type FoundPlace = { address: string; lat: number; lng: number; title: string; subtitle: string };
export type MicTrouble = null | "permission" | "unavailable" | "unheard";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MUTE_KEY = "resqnow_thozhan_muted";

/** Where the customer is: the device's location, named by the same lookup the request form uses. */
function locate(): Promise<FoundPlace | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const res = await fetch(apiUrl(`/api/public/reverse-geocode?lat=${lat}&lng=${lng}`));
        const data = res.ok ? await res.json() : null;
        const summary = summarizePlace(data);
        const address = String(data?.display_name || fallback);
        resolve({ address, lat, lng, title: summary?.title || address.split(",")[0], subtitle: summary?.subtitle || address });
      } catch {
        resolve({ address: fallback, lat, lng, title: fallback, subtitle: "" });
      }
    }, () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}

const stepName = (step: Step | null) => (!step ? "" : step.kind === "question" ? step.id : step.kind);

export function useVoiceThozhan({ garage, ai, preset, onHandoff }: {
  garage: Vehicle[];
  ai: boolean;
  preset?: { service?: ServiceKey | null; family?: VehicleFamily | null };
  onHandoff: (path: string) => void;
}) {
  const [draft, setDraft] = useState<VoiceDraft>(() => ({ ...emptyDraft(), service: preset?.service ?? null, family: preset?.family ?? null }));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("hello");
  const [status, setStatus] = useState<Status>("idle");
  const [live, setLive] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [mood, setMood] = useState<Mood>("happy");
  const [langPref, setLangPref] = useState<"auto" | Lang>("auto");
  const [lastLang, setLastLang] = useState<Lang>("tg");
  const [picks, setPicks] = useState<string[]>([]);
  const [place, setPlace] = useState<FoundPlace | null>(null);
  const [nod, setNod] = useState<keyof typeof NOD | null>(null);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } });
  const [trouble, setTrouble] = useState<MicTrouble>(null);
  const [burst, setBurst] = useState(false);

  const lang = langPref === "auto" ? lastLang : langPref;
  const refs = useRef({ draft, step: null as Step | null, lang, muted, garage, ai, place: null as FoundPlace | null, live: "" });
  refs.current.lang = lang;
  refs.current.muted = muted;
  refs.current.garage = garage;
  refs.current.ai = ai;
  const alive = useRef(true);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const ids = useRef(0);
  const answered = useRef(false);
  const acks = useRef(0);
  const hadInput = useRef(false);
  const listening = useRef<Listening | null>(null);
  const nodSeen = useRef<Record<string, true>>({});

  useEffect(() => {
    alive.current = true;
    const calm = setTimeout(() => setMood((m) => (m === "happy" ? "idle" : m)), 2600);
    return () => { alive.current = false; clearTimeout(calm); listening.current?.stop(); silence(); };
  }, []);

  const commit = useCallback((next: VoiceDraft) => { refs.current.draft = next; setDraft(next); }, []);
  const addTurn = useCallback((turn: NewTurn) => { ids.current += 1; const id = ids.current; setTurns((prev) => [...prev, { ...turn, id } as Turn]); }, []);

  /** Says a line: a beat of thinking, the words on screen (and aloud unless muted), then quiet. Lines never overlap. */
  const say = useCallback((line: Line, nextMood: Mood, call?: string) => {
    const run = async () => {
      if (!alive.current) return;
      setStatus("thinking");
      await wait(420);
      if (!alive.current) return;
      const asks = line.kind === "question" || (line.kind === "line" && line.key.startsWith("ask") && line.key !== "askModel");
      const shown: Line = answered.current && asks ? { ...line, ack: acks.current++ } : line;
      answered.current = false;
      addTurn({ who: "thozhan", line: shown, call });
      setMood(nextMood);
      setStatus("talking");
      const words = spokenText(shown, refs.current.lang);
      const least = 500 + words.split(/\s+/).length * 110;
      if (refs.current.muted) await wait(least);
      else await Promise.all([speak(words, refs.current.lang), wait(least)]);
      if (alive.current) setStatus("idle");
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, [addTurn]);

  const vehicleName = (d: VoiceDraft) => (d.vehicle.vehicleModel ? displayName(d.vehicle) : d.familyWord || undefined);

  const sayAll = useCallback(async (said: Said[], d: VoiceDraft) => {
    const l = refs.current.lang;
    for (const item of said) {
      if (item.line === "understood" && d.service) {
        const chips = { react: { text: SERVICE_TALK[d.service].react[l] }, svc: serviceChip(d.service, l), ...(d.family ? { veh: vehicleChip(d.family, l, vehicleName(d)) } : {}) };
        await say({ kind: "line", key: d.family ? "understood" : "understoodNoVeh", chips }, "concern");
      } else if (item.line === "evSwitch" || item.line === "safetyHighway") {
        await say({ kind: "line", key: item.line }, "concern");
      } else if (typeof item.line === "object") {
        await say({ kind: "text", text: item.line }, "concern", item.call);
      }
    }
  }, [say]);

  const handoff = useCallback((atLocation: boolean) => {
    if (!alive.current) return;
    setPhase("handing");
    setBurst(true);
    silence();
    const p = refs.current.place;
    const { path, storageKey, saved } = formHandoff(refs.current.draft, p ? { address: p.address, lat: p.lat, lng: p.lng } : null, { atLocation });
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* private mode: the form starts on its own */ }
    setTimeout(() => { if (alive.current) onHandoff(path); }, 950);
  }, [onHandoff]);

  /** Asks the next thing the form still needs, or hands over once nothing is missing. */
  const askNext = useCallback(async () => {
    const d = refs.current.draft;
    const g = refs.current.garage;
    const next = nextStep(d, g);
    refs.current.step = next;
    setStep(next);
    setPicks([]);
    const l = refs.current.lang;
    switch (next.kind) {
      case "service": await say({ kind: "line", key: "askService" }, "curious"); return;
      case "family": await say({ kind: "line", key: "askFamily" }, "curious"); return;
      case "garage": {
        const mine = garageForFamily(g, d.family!)[0];
        await say({ kind: "line", key: "askGarage", chips: { garage: vehicleChip(d.family!, l, mine ? mine.model : undefined) } }, "curious");
        return;
      }
      case "brand": await say({ kind: "line", key: "askBrand", chips: { veh: vehicleChip(d.family!, l, d.familyWord || undefined) } }, "curious"); return;
      case "model": await say({ kind: "line", key: "askModel", chips: { brand: { text: brandById(d.vehicle.catalogBrandId)?.short || d.vehicle.vehicleBrand || "" } } }, "curious"); return;
      case "name": await say({ kind: "line", key: "askName" }, "curious"); return;
      case "class": await say({ kind: "line", key: "askClass" }, "curious"); return;
      case "question": await say({ kind: "question", service: d.service!, id: next.id }, "curious"); return;
      case "switch": {
        const callout = calloutFor(d, next.question, next.value);
        const ask = LINES.askSwitch;
        const text = callout ? { en: ask.en.replace("[[callout]]", callout.line.en), tg: ask.tg.replace("[[callout]]", callout.line.tg), ta: ask.ta.replace("[[callout]]", callout.line.ta) } : ask;
        await say({ kind: "text", text }, "concern");
        return;
      }
      case "location": {
        setStatus("thinking");
        const found = await locate();
        if (!alive.current) return;
        if (!found) {
          await say({ kind: "line", key: "noLocation" }, "concern");
          handoff(true);
          return;
        }
        refs.current.place = found;
        setPlace(found);
        await say({ kind: "line", key: "askLocation", chips: { place: placeChip(found.title) } }, "curious");
        return;
      }
      case "drop": await say({ kind: "line", key: "askDrop" }, "curious"); return;
      case "landmark": await say({ kind: "line", key: "askLandmark" }, "curious"); return;
      case "done":
        await say({ kind: "line", key: d.service === "towing" ? "readyMap" : "ready" }, "happy");
        handoff(false);
        return;
    }
  }, [handoff, say]);

  const applyAndContinue = useCallback(async (current: Step, value: string | string[], via: Via, quote?: string) => {
    const result = applyReply(refs.current.draft, current, value, refs.current.garage, via, quote);
    commit(result.draft);
    if (result.switched) await say({ kind: "line", key: "switched" }, "happy");
    await sayAll(result.said, result.draft);
    if (current.kind === "location" && value === "map") { handoff(true); return; }
    await askNext();
  }, [askNext, commit, handoff, say, sayAll]);

  /** Whatever the customer said or typed. */
  const handleInput = useCallback(async (raw: string, via: Via) => {
    const text = raw.trim();
    if (!text) return;
    const detected = detectLang(text);
    if (detected) { setLastLang(detected); refs.current.lang = langPref === "auto" ? detected : langPref; }
    setPhase("convo");
    setTrouble(null);
    answered.current = true;
    const d = refs.current.draft;
    const current = refs.current.step;
    const g = refs.current.garage;
    if (!hadInput.current || (current?.kind === "service" && !d.service)) {
      hadInput.current = true;
      const heard = hear(text, d, g);
      const merged = mergeHeard({ ...d, note: d.note || text }, heard, via);
      let next = merged.draft;
      let said = merged.said;
      addTurn({ who: "you", text, via, keys: Object.values(heard.quotes).filter(Boolean).map((q) => q.toLowerCase()) });
      if (refs.current.ai && (!next.service || !next.family)) {
        setStatus("thinking");
        const reading = await askVoiceAi({ text, lang: detected, ...aiContext(next, next.service) });
        if (reading) {
          const before = next.service;
          next = mergeAi(next, reading, g);
          if (!before && next.service) said = [{ line: "understood" }, ...said];
        }
      }
      commit(next);
      await sayAll(said, next);
      await askNext();
      return;
    }
    if (!current) { addTurn({ who: "you", text, via, keys: [] }); await askNext(); return; }
    const reply = understandReply(current, d, text, g);
    addTurn({ who: "you", text, via, keys: reply ? [text.toLowerCase()] : [] });
    if (reply) { await applyAndContinue(current, reply.value as string | string[], via, reply.quote); return; }
    if (refs.current.ai) {
      setStatus("thinking");
      const reading = await askVoiceAi({ text, lang: detected, asking: stepName(current), ...aiContext(d, d.service) });
      const next = reading ? mergeAi(d, reading, g) : d;
      if (next !== d && JSON.stringify(next) !== JSON.stringify(d)) { commit(next); await askNext(); return; }
    }
    // Something else useful in the words (a different problem, or the vehicle), even if not this answer.
    const heard = hear(text, d, g);
    if (heard.vehicle || Object.keys(heard.answers).length || (heard.service && heard.service !== d.service)) {
      const merged = mergeHeard(d, heard, via);
      commit(merged.draft);
      await sayAll(merged.said.filter((s) => s.line !== "understood"), merged.draft);
      await askNext();
      return;
    }
    await say({ kind: "line", key: "again" }, "concern");
    await askNext();
  }, [addTurn, applyAndContinue, askNext, commit, langPref, say, sayAll]);

  /** A tapped answer. Pick-all questions collect taps until "That's all". */
  const choose = useCallback((value: string, label: string) => {
    const current = refs.current.step;
    if (!current || status === "thinking") return;
    if (isMulti(current, refs.current.draft)) {
      setPicks((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
      return;
    }
    answered.current = true;
    addTurn({ who: "you", text: label, via: "tap", keys: [] });
    void applyAndContinue(current, value, "tap");
  }, [addTurn, applyAndContinue, status]);

  const finishPicks = useCallback((labels: string[], skipLabel: string) => {
    const current = refs.current.step;
    if (!current) return;
    answered.current = true;
    addTurn({ who: "you", text: labels.length ? labels.join(", ") : skipLabel, via: "tap", keys: [] });
    void applyAndContinue(current, picks.length ? picks : "__skip", "tap");
  }, [addTurn, applyAndContinue, picks]);

  /** Little reactions while the customer is still talking, the way a friend says "mm" or "aiyo". */
  const backchannel = useCallback((partial: string) => {
    if (hadInput.current) return;
    const heard = hear(partial, refs.current.draft, refs.current.garage);
    const pick = (heard.answers.hurt === "yes" || heard.answers.inside === "yes") && !nodSeen.current.urgent ? "urgent"
      : heard.service && !nodSeen.current.svc ? "svc" : heard.family && !nodSeen.current.veh ? "veh" : null;
    if (!pick) return;
    nodSeen.current[pick] = true;
    setNod(pick);
    setTimeout(() => { if (alive.current) setNod((n) => (n === pick ? null : n)); }, 1500);
  }, []);

  const toggleMic = useCallback(async () => {
    if (status === "listening") { listening.current?.stop(); return; }
    if (phase === "handing") return;
    silence();
    setTrouble(null);
    setStatus("listening");
    setMood("listen");
    setLive("");
    refs.current.live = "";
    nodSeen.current = {};
    let finalText = "";
    let error = "";
    listening.current = await listen(refs.current.lang, {
      onPartial: (t) => { refs.current.live = t; setLive(t); backchannel(t); },
      onFinal: (t) => { finalText = t; },
      onError: (code) => { error = code; },
      onEnd: () => {
        listening.current = null;
        if (!alive.current) return;
        const said = (finalText || refs.current.live).trim();
        setLive("");
        setNod(null);
        setStatus("idle");
        setMood("idle");
        if (said) { void handleInput(said, "voice"); return; }
        if (error === "permission") setTrouble("permission");
        else if (error === "unavailable" || error === "language" || error === "not-allowed" || error === "service-not-allowed") setTrouble("unavailable");
        else setTrouble("unheard");
      },
    });
  }, [backchannel, handleInput, phase, status]);

  const cycleLang = useCallback(() => {
    const order: Array<"auto" | Lang> = ["auto", "tg", "en", "ta"];
    setLangPref((p) => order[(order.indexOf(p) + 1) % order.length]);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* fine */ }
      if (next) silence();
      return next;
    });
  }, []);

  return {
    draft, turns, phase, status, live, step, mood, lang, langPref, picks, place, nod, muted, trouble, burst,
    handleInput, choose, finishPicks, toggleMic, cycleLang, toggleMute, handoff,
  };
}
