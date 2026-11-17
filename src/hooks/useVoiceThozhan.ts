import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { Vehicle } from "@/lib/garage";
import { summarizePlace } from "@/lib/placeSummary";
import { displayName, garageForFamily, brandById } from "@/lib/vehicleChoice";
import type { Mood } from "@/components/voice/Thozhan";
import { askVoiceAi } from "@/lib/voice/api";
import {
  aiContext, applyReply, calloutFor, detectLang, emptyDraft, formHandoff, hear, isExplicitCorrection, isMulti, mergeAiWithFeedback, mergeHeard, nextStep, understandReply,
  type Said, type Step, type Via, type VoiceDraft,
} from "@/lib/voice/engine";
import { LINES, NOD, type L3, type Lang } from "@/lib/voice/lexicon";
import {
  explainMicError, listen, prepareSpeech, setNaturalVoice, silence, speak, speechReady, unlockAudio, type Listening, type MicProblem,
} from "@/lib/voice/speech";
import { placeChip, reactChip, serviceChip, spokenText, vehicleChip, type Line } from "@/lib/voice/talk";
import type { ServiceKey } from "@/config/requestQuestions";
import type { VehicleFamily } from "@/lib/vehicleClasses";

export type Turn =
  | { id: number; who: "you"; text: string; via: Via; keys: string[] }
  | { id: number; who: "thozhan"; line: Line; call?: string };
export type Status = "idle" | "starting" | "listening" | "thinking" | "talking";
type NewTurn = Turn extends infer T ? (T extends Turn ? Omit<T, "id"> : never) : never;
export type Phase = "hello" | "convo" | "handing";
export type FoundPlace = { address: string; lat: number; lng: number; title: string; subtitle: string };
export type MicTrouble = null | MicProblem;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MUTE_KEY = "resqnow_thozhan_muted";
const LANGUAGE_KEY = "resqnow_thozhan_language";
function preferredLanguage(): "auto" | Lang {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    if (value === "tg" || value === "en" || value === "ta") return value;
  } catch { /* storage may be unavailable */ }
  return "auto";
}

/** Where the customer is: the device's location, named by the same lookup the request form uses. */
function locate(signal: AbortSignal): Promise<FoundPlace | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (signal.aborted) { resolve(null); return; }
      const { latitude: lat, longitude: lng } = position.coords;
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const res = await fetch(apiUrl(`/api/public/reverse-geocode?lat=${lat}&lng=${lng}`), { signal: AbortSignal.any([signal, AbortSignal.timeout(3500)]) });
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

export function useVoiceThozhan({ garage, ai, naturalVoice = false, preset, onHandoff }: {
  garage: Vehicle[];
  ai: boolean;
  /** The server has a natural, human-sounding voice; else the phone's own voice speaks. */
  naturalVoice?: boolean;
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
  const [langPref, setLangPref] = useState<"auto" | Lang>(preferredLanguage);
  const [lastLang, setLastLang] = useState<Lang>(() => /^ta\b/i.test(navigator.language) ? "ta" : "tg");
  const [reviewText, setReviewText] = useState("");
  const [busy, setBusy] = useState(false);
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
  const micGeneration = useRef(0);
  const micOpen = useRef(false);
  const micTimer = useRef<ReturnType<typeof setTimeout>>();
  const handsFree = useRef(false);
  const turnBusy = useRef(false);
  const handing = useRef(false);
  const resumeMic = useRef<() => void>(() => {});
  const nodSeen = useRef<Record<string, true>>({});
  const turnController = useRef(new AbortController());
  const isActive = useCallback((signal: AbortSignal) => alive.current && !signal.aborted && document.visibilityState !== 'hidden', []);

  const stopCapture = useCallback(() => {
    handsFree.current = false;
    micGeneration.current++;
    micOpen.current = false;
    clearTimeout(micTimer.current);
    listening.current?.abort?.();
    listening.current = null;
    if (alive.current) {
      setStatus(current => current === "listening" || current === "starting" ? "idle" : current);
      setLive("");
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const calm = setTimeout(() => setMood((m) => (m === "happy" ? "idle" : m)), 2600);
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        turnController.current.abort();
        turnBusy.current = false;
        handing.current = false;
        setBusy(false);
        setBurst(false);
        setPhase(phase => phase === 'handing' ? 'convo' : phase);
        stopCapture();
        silence();
        setStatus("idle"); setLive(""); setMood("idle");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false; turnController.current.abort(); clearTimeout(calm); stopCapture(); silence();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stopCapture]);

  useEffect(() => { setNaturalVoice(naturalVoice); }, [naturalVoice]);

  const commit = useCallback((next: VoiceDraft) => { refs.current.draft = next; setDraft(next); }, []);
  const addTurn = useCallback((turn: NewTurn) => { ids.current += 1; const id = ids.current; setTurns((prev) => [...prev, { ...turn, id } as Turn]); }, []);

  /** Says a line: a beat of thinking, the words on screen (and aloud unless muted), then quiet. Lines never overlap. */
  const say = useCallback((line: Line, nextMood: Mood, call?: string) => {
    const signal = turnController.current.signal;
    const run = async () => {
      if (!isActive(signal)) return;
      setStatus("thinking");
      const asks = line.kind === "question" || (line.kind === "line" && line.key.startsWith("ask") && line.key !== "askModel");
      const shown: Line = answered.current && asks ? { ...line, ack: acks.current++ } : line;
      answered.current = false;
      const words = spokenText(shown, refs.current.lang);
      // The natural voice is made while Thozhan "thinks", and the words appear as it starts to speak.
      const aloud = !refs.current.muted;
      if (aloud) prepareSpeech(words, refs.current.lang);
      await wait(420);
      if (!isActive(signal)) return;
      if (aloud) await speechReady(words, refs.current.lang, 2500);
      if (!isActive(signal)) return;
      addTurn({ who: "thozhan", line: shown, call });
      setMood(nextMood);
      setStatus("talking");
      const least = 500 + words.split(/\s+/).length * 110;
      if (refs.current.muted) await wait(least);
      else await Promise.all([speak(words, refs.current.lang), wait(least)]);
      if (isActive(signal)) setStatus("idle");
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, [addTurn, isActive]);

  const vehicleName = (d: VoiceDraft) => (d.vehicle.vehicleModel ? displayName(d.vehicle) : d.familyWord || undefined);

  const sayAll = useCallback(async (said: Said[], d: VoiceDraft) => {
    const signal = turnController.current.signal;
    const l = refs.current.lang;
    for (const item of said) {
      if (!isActive(signal)) return;
      if (item.line === "understood" && d.service) {
        const chips = { react: reactChip(d.service, l), svc: serviceChip(d.service, l), ...(d.family ? { veh: vehicleChip(d.family, l, vehicleName(d)) } : {}) };
        await say({ kind: "line", key: d.family ? "understood" : "understoodNoVeh", chips }, "concern");
      } else if (item.line === "evSwitch" || item.line === "safetyHighway") {
        await say({ kind: "line", key: item.line }, "concern");
      } else if (typeof item.line === "object") {
        await say({ kind: "text", text: item.line }, "concern", item.call);
      }
    }
  }, [say, isActive]);

  const handoff = useCallback((atLocation: boolean) => {
    const signal = turnController.current.signal;
    if (!isActive(signal) || handing.current) return;
    handing.current = true;
    stopCapture();
    setPhase("handing");
    setBurst(true);
    silence();
    const p = refs.current.place;
    const { path, storageKey, saved } = formHandoff(refs.current.draft, p ? { address: p.address, lat: p.lat, lng: p.lng } : null, { atLocation });
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* private mode: the form starts on its own */ }
    setTimeout(() => { if (isActive(signal)) onHandoff(path); }, 950);
  }, [onHandoff, stopCapture, isActive]);

  /** Asks the next thing the form still needs, or hands over once nothing is missing. */
  const askNext = useCallback(async () => {
    const signal = turnController.current.signal;
    if (!isActive(signal)) return;
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
        const fill = (lang: keyof L3) => (ask[lang] ?? "").replace("[[callout]]", callout?.line[lang] ?? callout?.line.ta ?? "");
        const text: L3 = callout ? { en: fill("en"), tg: fill("tg"), ta: fill("ta"), ...(ask.say ? { say: fill("say") } : {}) } : ask;
        await say({ kind: "text", text }, "concern");
        return;
      }
      case "location": {
        setStatus("thinking");
        const found = await locate(signal);
        if (!isActive(signal)) return;
        if (!found) {
          await say({ kind: "line", key: "noLocation" }, "concern");
          if (!isActive(signal)) return;
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
        if (!isActive(signal)) return;
        handoff(false);
        return;
    }
  }, [handoff, say, isActive]);

  const applyAndContinue = useCallback(async (current: Step, value: string | string[], via: Via, quote?: string) => {
    const signal = turnController.current.signal;
    const result = applyReply(refs.current.draft, current, value, refs.current.garage, via, quote);
    commit(result.draft);
    if (result.switched) await say({ kind: "line", key: "switched" }, "happy");
    if (!isActive(signal)) return;
    await sayAll(result.said, result.draft);
    if (!isActive(signal)) return;
    if (current.kind === "location" && value === "map") { handoff(true); return; }
    await askNext();
  }, [askNext, commit, handoff, say, sayAll, isActive]);

  /** Whatever the customer said or typed. */
  const processInput = useCallback(async (raw: string, via: Via) => {
    const signal = turnController.current.signal;
    const text = raw.trim();
    if (!text) return;
    if (via !== "voice") unlockAudio();
    const detected = detectLang(text);
    if (detected) { setLastLang(detected); refs.current.lang = langPref === "auto" ? detected : langPref; }
    setPhase("convo");
    setTrouble(null);
    answered.current = true;
    const d = refs.current.draft;
    const current = refs.current.step;
    const g = refs.current.garage;
    if (!hadInput.current || !d.service || !current) {
      hadInput.current = true;
      const heard = hear(text, d, g);
      const merged = mergeHeard({ ...d, note: d.note || text }, heard, via);
      let next = merged.draft;
      let said = merged.said;
      addTurn({ who: "you", text, via, keys: Object.values(heard.quotes).filter(Boolean).map((q) => q.toLowerCase()) });
      if (refs.current.ai && (!next.service || !next.family)) {
        setStatus("thinking");
        const reading = await askVoiceAi({ text, lang: detected, ...aiContext(next, next.service) }, signal);
        if (!isActive(signal)) return;
        if (reading) {
          const ai = mergeAiWithFeedback(next, reading, g, heard.deniedServices, heard.ambiguousFamily);
          next = ai.draft;
          said = [...said, ...ai.said.filter(item => item.line !== "understood" || !said.some(old => old.line === "understood"))];
        }
      }
      commit(next);
      await sayAll(said, next);
      if (!isActive(signal)) return;
      await askNext();
      return;
    }
    const heard = hear(text, d, g);
    const retracted = !!d.service && heard.deniedServices.includes(d.service);
    const hazardChanged = ["inside", "hurt"].some(id => heard.answers[id] !== undefined && heard.answers[id] !== d.answers[id]);
    const correcting = isExplicitCorrection(text) && (heard.service || heard.family || Object.keys(heard.answers).length);
    const reply = retracted || hazardChanged || correcting || heard.ambiguousFamily ? null : understandReply(current, d, text, g);
    addTurn({ who: "you", text, via, keys: reply ? [text.toLowerCase()] : [] });
    if (reply) { await applyAndContinue(current, reply.value as string | string[], via, reply.quote); return; }
    // Something else useful in the words (a different problem, or the vehicle), even if not this answer.
    if (retracted || correcting || heard.ambiguousFamily || heard.vehicle || Object.keys(heard.answers).length || (heard.service && heard.service !== d.service)) {
      const merged = mergeHeard(d, heard, via);
      commit(merged.draft);
      await sayAll(merged.said.filter((s) => s.line !== "understood"), merged.draft);
      if (!isActive(signal)) return;
      await askNext();
      return;
    }
    if (refs.current.ai) {
      setStatus("thinking");
      const reading = await askVoiceAi({ text, lang: detected, asking: stepName(current), ...aiContext(d, d.service) }, signal);
      if (!isActive(signal)) return;
      if (reading) {
        const ai = mergeAiWithFeedback(d, reading, g, heard.deniedServices, heard.ambiguousFamily);
        if (JSON.stringify(ai.draft) !== JSON.stringify(d)) {
          commit(ai.draft); await sayAll(ai.said, ai.draft);
          if (isActive(signal)) await askNext();
          return;
        }
      }
    }
    await say({ kind: "line", key: "again" }, "concern");
    if (!isActive(signal)) return;
    await askNext();
  }, [addTurn, applyAndContinue, askNext, commit, langPref, say, sayAll, isActive]);

  const handleInput = useCallback(async (text: string, via: Via) => {
    if (!text.trim() || turnBusy.current || handing.current || document.visibilityState === 'hidden') return;
    if (via !== "voice") stopCapture();
    turnController.current.abort();
    const controller = turnController.current = new AbortController();
    turnBusy.current = true;
    setBusy(true);
    setReviewText("");
    try { await processInput(text, via); }
    finally {
      if (turnController.current === controller) { turnBusy.current = false; if (alive.current) setBusy(false); }
    }
    if (!isActive(controller.signal)) return;
    if (handsFree.current && !handing.current) resumeMic.current();
  }, [processInput, stopCapture, isActive]);

  /** A tapped answer. Pick-all questions collect taps until "That's all". */
  const choose = useCallback((value: string, label: string) => {
    const current = refs.current.step;
    if (!current || status === "thinking" || turnBusy.current) return;
    const controller = turnController.current = new AbortController();
    stopCapture();
    unlockAudio();
    if (isMulti(current, refs.current.draft)) {
      setPicks((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
      return;
    }
    answered.current = true;
    addTurn({ who: "you", text: label, via: "tap", keys: [] });
    turnBusy.current = true;
    setBusy(true);
    void applyAndContinue(current, value, "tap").finally(() => {
      if (turnController.current === controller) { turnBusy.current = false; if (alive.current) setBusy(false); }
    });
  }, [addTurn, applyAndContinue, status, stopCapture]);

  const finishPicks = useCallback((labels: string[], skipLabel: string) => {
    const current = refs.current.step;
    if (!current || turnBusy.current) return;
    const controller = turnController.current = new AbortController();
    stopCapture();
    answered.current = true;
    addTurn({ who: "you", text: labels.length ? labels.join(", ") : skipLabel, via: "tap", keys: [] });
    turnBusy.current = true;
    setBusy(true);
    void applyAndContinue(current, picks.length ? picks : "__skip", "tap").finally(() => {
      if (turnController.current === controller) { turnBusy.current = false; if (alive.current) setBusy(false); }
    });
  }, [addTurn, applyAndContinue, picks, stopCapture]);

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

  const startMic = useCallback(async () => {
    if (!alive.current || handing.current || micOpen.current || turnBusy.current || document.visibilityState === "hidden") return;
    const generation = ++micGeneration.current;
    const active = () => alive.current && micGeneration.current === generation && micOpen.current;
    micOpen.current = true;
    silence();
    unlockAudio();
    setTrouble(null);
    setReviewText("");
    setStatus("starting");
    setMood("listen");
    setLive("");
    refs.current.live = "";
    nodSeen.current = {};
    let finalText = "";
    let confidence: number | undefined;
    let error = "";
    const finish = () => {
      if (!active()) return;
      clearTimeout(micTimer.current);
      listening.current = null;
      micOpen.current = false;
      setLive(""); setNod(null); setStatus("idle"); setMood("idle");
      if (!error && finalText && (confidence === undefined || confidence >= 0.55)) {
        void handleInput(finalText, "voice");
        return;
      }
      handsFree.current = false;
      setReviewText((finalText || refs.current.live).trim());
      void explainMicError(error || "no-speech").then(problem => {
        if (alive.current && generation === micGeneration.current) setTrouble(problem);
      });
    };
    const deadline = (ms: number) => {
      clearTimeout(micTimer.current);
      micTimer.current = setTimeout(() => {
        if (!active()) return;
        const current = listening.current;
        error = "no-speech";
        finish();
        current?.abort?.();
      }, ms);
    };
    deadline(15000);
    try {
      const session = await listen(refs.current.lang, {
        onReady: () => { if (active()) { setStatus("listening"); deadline(30000); } },
        onPartial: (t) => { if (active()) { setStatus("listening"); refs.current.live = t; setLive(t); backchannel(t); } },
        onFinal: (t, score) => { finalText = t.trim(); confidence = score; },
        onError: (code) => { error = code; },
        onEnd: finish,
      });
      if (active()) listening.current = session;
      else session.abort?.();
    } catch { error = "unavailable"; finish(); }
  }, [backchannel, handleInput]);
  resumeMic.current = () => { void startMic(); };
  const toggleMic = useCallback(async () => {
    if (micOpen.current) {
      handsFree.current = false;
      if (listening.current) listening.current.stop();
      else { stopCapture(); setStatus("idle"); }
      return;
    }
    handsFree.current = true;
    await startMic();
  }, [startMic, stopCapture]);
  const startHandsFree = useCallback(() => {
    handsFree.current = true;
    void startMic();
  }, [startMic]);

  const cycleLang = useCallback(() => {
    const order: Array<"auto" | Lang> = ["auto", "tg", "en", "ta"];
    stopCapture();
    setStatus(s => s === "starting" || s === "listening" ? "idle" : s);
    const next = order[(order.indexOf(langPref) + 1) % order.length];
    setLangPref(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* device storage unavailable */ }
  }, [langPref, stopCapture]);

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
    handleInput, choose, finishPicks, toggleMic, startHandsFree, stopCapture, cycleLang, toggleMute, handoff, reviewText, busy,
  };
}
