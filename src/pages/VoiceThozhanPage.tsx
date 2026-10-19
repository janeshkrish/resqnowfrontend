import { Fragment, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import Thozhan from "@/components/voice/Thozhan";
import VoiceWave from "@/components/voice/VoiceWave";
import { SERVICE_SPECS, serviceSpecFor, type ServiceKey } from "@/config/requestQuestions";
import { useVoiceThozhan, type Turn } from "@/hooks/useVoiceThozhan";
import { GARAGE_QUERY_KEY, listVehicles } from "@/lib/garage";
import { hasAnswer, shownQuestions } from "@/lib/requestForm";
import { displayName, hasVehicle } from "@/lib/vehicleChoice";
import { vehicleClassInfo, type VehicleFamily } from "@/lib/vehicleClasses";
import { cn } from "@/lib/utils";
import { fetchVoiceStatus, VOICE_STATUS_KEY } from "@/lib/voice/api";
import { answerChips, contextOf, FAMILIES, FAMILY_TITLES, isMulti, questionOf, repliesFor, type VoiceDraft } from "@/lib/voice/engine";
import { LINES, NOD, UI } from "@/lib/voice/lexicon";
import { segments, vehicleArt } from "@/lib/voice/talk";

const SAMPLES = [
  { text: "Ennoda bike puncture aayiduchu", tag: "Tanglish" },
  { text: "En Splendor-la petrol theernduchu", tag: "Tanglish" },
  { text: "My car won't start, I think the battery is dead", tag: "English" },
  { text: "Vandi kuzhila maattikichu", tag: "Tanglish" },
];
const LANG_NAMES = { en: "English", tg: "Tanglish", ta: "தமிழ்" } as const;

type Token = { label: string; value: string; sub: string; art: string | null; icon: string; filled: boolean; done: boolean; active: boolean };

/** The four parts of the request form, as they fill: problem, vehicle, the service's questions, location. */
function tokensFor(draft: VoiceDraft, stepKind: string | undefined, stepId: string | undefined, placeTitle: string | null): Token[] {
  const spec = draft.service ? serviceSpecFor(draft.service) : null;
  const questions = spec ? shownQuestions(spec, draft.answers, contextOf(draft)) : [];
  const answered = questions.filter((q) => hasAnswer(draft.answers, q.id));
  const required = questions.filter((q) => !q.optional);
  const chips = answerChips(draft);
  const vehicleKinds = ["family", "garage", "brand", "model", "name", "class"];
  const classLabel = vehicleClassInfo(draft.vehicle.vehicleSubtype)?.label;
  const quote = (key: string) => draft.sources[key]?.quote;
  return [
    { label: "Problem", value: spec?.title ?? "Problem", sub: spec ? (quote("service") ? `“${quote("service")}”` : "you chose") : stepKind === "service" ? "asking…" : "what happened",
      art: spec?.art ?? null, icon: "build", filled: Boolean(spec), done: Boolean(spec), active: stepKind === "service" },
    { label: "Vehicle", value: hasVehicle(draft.vehicle) ? displayName(draft.vehicle) : draft.family ? FAMILY_TITLES[draft.family] : "Vehicle",
      sub: vehicleKinds.includes(stepKind ?? "") ? "asking…" : classLabel || (draft.family ? "which one?" : "bike, car…"),
      art: draft.family ? vehicleArt(draft.family) : null, icon: "two_wheeler", filled: Boolean(draft.family),
      done: Boolean(draft.family && (draft.service === "sos" || (hasVehicle(draft.vehicle) && draft.vehicle.vehicleSubtype))), active: vehicleKinds.includes(stepKind ?? "") },
    { label: "Details", value: chips.length ? chips.join(" · ") : "Details", sub: stepKind === "question" ? "asking…" : spec ? `${answered.length} of ${questions.length} answered` : "form questions",
      art: null, icon: "tune", filled: answered.length > 0, done: Boolean(spec) && required.every((q) => hasAnswer(draft.answers, q.id)) && (questions.length === 0 || answered.length > 0), active: stepKind === "question" && Boolean(stepId) },
    { label: "Location", value: placeTitle ?? "Location", sub: stepKind === "location" ? "checking…" : stepKind === "drop" ? "drop point?" : stepKind === "landmark" ? "landmark?" : placeTitle ? "pin on the map" : "where you are",
      art: null, icon: "location_on", filled: Boolean(placeTitle), done: draft.located, active: ["location", "drop", "landmark"].includes(stepKind ?? "") },
  ];
}

export default function VoiceThozhanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useQuery({ queryKey: VOICE_STATUS_KEY, queryFn: fetchVoiceStatus, staleTime: 60_000 });
  const garageQuery = useQuery({ queryKey: GARAGE_QUERY_KEY, queryFn: listVehicles, staleTime: 60_000 });
  const preset = useMemo(() => {
    const service = params.get("service");
    const family = params.get("family");
    return {
      service: service && service in SERVICE_SPECS ? (service as ServiceKey) : null,
      family: family && (FAMILIES as string[]).includes(family) ? (family as VehicleFamily) : null,
    };
  }, [params]);
  const vt = useVoiceThozhan({
    garage: garageQuery.data ?? [],
    ai: Boolean(status.data?.ai),
    preset,
    onHandoff: (path) => navigate(path, { replace: true }),
  });
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");

  if (status.data && !status.data.enabled) return <Navigate to="/" replace />;

  const { draft, turns, phase, step, lang, langPref, picks, place } = vt;
  const listening = vt.status === "listening";
  const thinking = vt.status === "thinking";
  const talking = vt.status === "talking";
  const mood = listening ? "listen" : thinking ? "think" : vt.mood;
  const replies = step && phase === "convo" && !listening && !thinking ? repliesFor(step, draft, garageQuery.data ?? [], UI, lang) : [];
  const multi = step ? isMulti(step, draft) : false;
  const optionalMulti = multi && step?.kind === "question" && Boolean(questionOf(draft.service, step.id)?.optional);
  const tokens = tokensFor(draft, step?.kind, step?.kind === "question" ? step.id : undefined, place?.title ?? null);
  const doneCount = tokens.filter((t) => t.done).length;
  const showTyping = typing || vt.trouble === "permission" || vt.trouble === "unavailable";
  const lastThozhan = turns.reduce((last, t, i) => (t.who === "thozhan" ? i : last), -1);
  const lastLength = lastThozhan >= 0 ? segments((turns[lastThozhan] as Extract<Turn, { who: "thozhan" }>).line, lang).length : 0;
  const after = lastLength * 0.075 + 0.35;

  let caption = "Tap the mic and say what happened · or type";
  if (phase === "handing") caption = "Opening your request…";
  else if (vt.trouble === "permission") caption = "Allow the microphone to talk, or type instead";
  else if (vt.trouble === "unavailable") caption = "This phone can’t listen right now. Type instead.";
  else if (vt.trouble === "unheard") caption = "I didn’t catch that. Tap the mic and try again.";
  else if (listening) caption = "Listening · tap when you’re done";
  else if (thinking) caption = "ResQNow-Thozhan is thinking…";
  else if (talking) caption = "ResQNow-Thozhan is talking";
  else if (multi) caption = "Tap all that apply, then “That’s all”";
  else if (step && phase === "convo") caption = "Tap an answer, or tap the mic and say it";
  const statusText = phase === "handing" ? "Opening your request" : listening ? "Listening to you" : thinking ? "Thinking" : talking ? "Talking" : "Here for you";

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    setTyping(false);
    void vt.handleInput(text, "typed");
  };

  const helloWords = LINES.hello[lang].split(/\s+/);

  return (
    <div className={cn("vt", listening && "is-listening", phase !== "hello" && "is-talking-phase", phase === "handing" && "is-handing")} data-testid="voice-thozhan">
      <div className="vt-frame">
        <div className="vt-aurora" aria-hidden="true"><i className="a1" /><i className="a2" /><i className="a3" /></div>
        <div className="vt-edge" aria-hidden="true" />

        <header className="vt-top">
          <span className="vt-name">
            <b>ResQNow<span>-Thozhan</span></b>
            <small className={cn((listening || thinking || phase === "handing") && "is-live")}><i />{statusText}</small>
          </span>
          <button type="button" className="vt-chip" onClick={vt.cycleLang} aria-label="Change the language ResQNow-Thozhan speaks">
            <MaterialSymbol name="translate" />{LANG_NAMES[lang]}{langPref === "auto" ? " · auto" : ""}
          </button>
          <button type="button" className="vt-round" onClick={vt.toggleMute} aria-label={vt.muted ? "Let ResQNow-Thozhan speak aloud" : "Mute ResQNow-Thozhan's voice"}>
            <MaterialSymbol name={vt.muted ? "volume_off" : "volume_up"} />
          </button>
          <button type="button" className="vt-round" onClick={() => navigate(-1)} aria-label="Close ResQNow-Thozhan">
            <MaterialSymbol name="close" />
          </button>
        </header>

        <div className="vt-charbox">
          <button type="button" className="vt-charbtn" onClick={() => void vt.toggleMic()} aria-label={listening ? "Stop listening" : "Talk to ResQNow-Thozhan"}>
            <Thozhan size={160} mood={mood} talking={talking} burst={vt.burst} full />
          </button>
          {vt.nod && listening ? <span className="vt-nod" key={vt.nod}>{NOD[vt.nod][lang]}</span> : null}
        </div>

        {phase === "hello" ? (
          <div className="vt-hello">
            <p className="vt-hi">
              {helloWords.map((word, i) => (
                <Fragment key={i}>{i ? " " : null}<span className="kw" style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", animationDelay: `${0.25 + i * 0.08}s` }}>
                  <span className={cn(/ResQNow/.test(word) && "is-name")} style={{ display: "inline-block", animation: "vtRise .7s cubic-bezier(.2,.8,.2,1) both", animationDelay: "inherit" }}>{word}</span>
                </span></Fragment>
              ))}
            </p>
            <p className="vt-hi-sub">{LINES.helloSub[lang]}</p>
            <span className="vt-trust"><MaterialSymbol name="verified_user" />Verified technicians · pay only after the work</span>
            <div className="vt-try">
              <small>Try saying</small>
              {SAMPLES.map((sample, i) => (
                <button key={sample.text} type="button" style={{ animationDelay: `${0.8 + i * 0.08}s` }} onClick={() => void vt.handleInput(sample.text, "typed")}>
                  <MaterialSymbol name="graphic_eq" /><span>{sample.text}</span><em>{sample.tag}</em>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="vt-thread" aria-live="polite">
            {turns.map((turn, index) => {
              const old = index < turns.length - 3;
              if (turn.who === "you") {
                const keys = turn.keys;
                return (
                  <div key={turn.id} className={cn("vt-you", old && "is-old", turn.via === "tap" && "is-tap")}>
                    <small><MaterialSymbol name={turn.via === "typed" ? "keyboard" : turn.via === "tap" ? "touch_app" : "graphic_eq"} />{turn.via === "typed" ? "You typed" : turn.via === "tap" ? "You tapped" : "You said"}</small>
                    <p>{turn.text.split(/\s+/).map((word, i) => {
                      const clean = word.toLowerCase().replace(/[^\w஀-௿'-]/g, "");
                      const key = keys.some((k) => k && clean.length > 2 && (k.includes(clean) || clean.includes(k)));
                      return <Fragment key={i}>{i ? " " : null}<span className={cn("uw", key && "is-key")}>{word}</span></Fragment>;
                    })}</p>
                  </div>
                );
              }
              const fresh = index === lastThozhan;
              return (
                <div key={turn.id} style={{ display: "contents" }}>
                  <p className={cn("vt-say", old && "is-old")}>
                    {segments(turn.line, lang).map((seg, k) => (
                      <Fragment key={k}>{k ? " " : null}{seg.chip ? (
                        <span className="kwrap"><span className="kc" style={{ animationDelay: fresh ? `${k * 0.075}s` : "0s" }}>
                          {seg.art ? <img src={seg.art} alt="" /> : <MaterialSymbol name={seg.icon || "build"} />}{seg.text}
                        </span>{seg.after}</span>
                      ) : (
                        <span className="kw" style={{ animationDelay: fresh ? `${k * 0.075}s` : "0s" }}><span>{seg.text}</span></span>
                      )}</Fragment>
                    ))}
                  </p>
                  {turn.call ? <a className="vt-call" href={`tel:${turn.call}`}><MaterialSymbol name="call" />Call {turn.call}</a> : null}
                </div>
              );
            })}
            {listening && vt.live ? (
              <div className="vt-you is-live">
                <small><MaterialSymbol name="mic" />You · listening</small>
                <p>{vt.live.split(/\s+/).map((word, i) => <Fragment key={i}>{i ? " " : null}<span className="uw">{word}</span></Fragment>)}<span className="vt-caret" /></p>
              </div>
            ) : null}
            {thinking ? <div className="vt-typing" aria-label="ResQNow-Thozhan is thinking"><i /><i /><i /></div> : null}
            {step?.kind === "location" && place && !thinking ? (
              <div className="vt-place" style={{ animationDelay: `${after}s` }}>
                <MaterialSymbol name="location_on" />
                <span><b>{place.title}</b><small>{place.subtitle}</small></span>
              </div>
            ) : null}
            {replies.length ? (
              <div className="vt-replies">
                <small style={{ animationDelay: `${after}s` }}>Tap one, or just say it</small>
                <div className="vt-reps">
                  {replies.map((reply, i) => (
                    <button key={reply.v} type="button"
                      className={cn("vt-rep", reply.main && "is-main", reply.art && "has-art", reply.danger && "is-danger", multi && picks.includes(reply.v) && "is-on")}
                      style={{ animationDelay: `${after + 0.1 + i * 0.05}s` }}
                      onClick={() => vt.choose(reply.v, reply.label)}>
                      {reply.art ? <img src={reply.art} alt="" /> : null}{reply.label}
                    </button>
                  ))}
                  {multi ? (
                    <button type="button" className="vt-rep is-main" disabled={!picks.length && !optionalMulti}
                      style={{ animationDelay: `${after + 0.1 + replies.length * 0.05}s` }}
                      onClick={() => vt.finishPicks(replies.filter((r) => picks.includes(r.v)).map((r) => r.label), UI.skip[lang])}>
                      {picks.length ? UI.done[lang] : UI.skip[lang]}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {phase !== "hello" ? (
          <div className="vt-strip" aria-label="What ResQNow-Thozhan has so far">
            <span className="vt-strip-bar" style={{ width: `${doneCount * 25}%` }} />
            <ul className="vt-toks">
              {tokens.map((token) => (
                <li key={token.label} className={cn("vt-tok", token.filled && "is-filled", token.active && "is-active")}>
                  <span className="vt-tok-pic">
                    {token.art ? <img src={token.art} alt="" /> : <MaterialSymbol name={token.icon} />}
                    {token.done ? <span className="vt-tok-tick"><MaterialSymbol name="check" /></span> : null}
                  </span>
                  <b>{token.value}</b>
                  <small>{token.sub}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="vt-dock">
          <VoiceWave who={listening ? "you" : talking ? "thozhan" : null} />
          {showTyping ? (
            <form className="vt-type" onSubmit={submitTyped}>
              <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={UI.typeHere[lang]} aria-label="Type to ResQNow-Thozhan" autoFocus />
              <button type="submit" className="vt-send" aria-label="Send"><MaterialSymbol name="arrow_forward" /></button>
            </form>
          ) : (
            <>
              <button type="button" className="vt-side" style={{ left: 22 } as CSSProperties} onClick={() => setTyping(true)} aria-label="Type instead"><MaterialSymbol name="keyboard" /></button>
              <button type="button" className={cn("vt-mic", listening && "is-live")} onClick={() => void vt.toggleMic()} disabled={phase === "handing"}
                aria-label={listening ? "Stop listening" : "Talk to ResQNow-Thozhan"}>
                {listening ? <span className="vt-stop" /> : <MaterialSymbol name="mic" />}
              </button>
              <button type="button" className="vt-side" style={{ right: 22 } as CSSProperties} onClick={() => navigate(0)} aria-label="Start again"><MaterialSymbol name="replay" /></button>
              <p className="vt-cap">{caption}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
