import type { ReactNode } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import type { Callout, Question, QuestionOption } from "@/config/requestQuestions";
import { isPicked, optionSetFor, optionsFor, type Answers, type FormContext } from "@/lib/requestForm";
import { studioImage } from "@/lib/vehiclePhoto";
import { cn } from "@/lib/utils";
import { CarTopView, OptionArtwork } from "./art";

export type FuelEstimate = {
  /** ₹ per litre for the chosen fuel in the customer's area, when known. */
  pricePerLitre: number | null;
  area?: string | null;
  /** The service's own starting charge. */
  serviceFee: number | null;
};

type Props = {
  question: Question;
  context: FormContext;
  answers: Answers;
  onPick: (question: Question, value: string) => void;
  onSwitch?: (service: "towing") => void;
  fuel?: FuelEstimate;
};

const rupees = (value: number, exact = false) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 })}`;

function Tick() {
  return <span className="rqf-tick" aria-hidden="true"><MaterialSymbol name="check" /></span>;
}

function Label({ question }: { question: Question }) {
  const aside = question.aside ?? (question.optional ? "Optional" : null);
  return (
    <>
      <p className="rqf-lbl" id={`rqf-lbl-${question.id}`}>
        <span>{question.label}</span>
        {aside ? <small>{aside}</small> : null}
      </p>
      {question.helper ? <p className="rqf-help">{question.helper}</p> : null}
    </>
  );
}

function Callouts({ question, answers, onSwitch }: { question: Question; answers: Answers; onSwitch?: Props["onSwitch"] }) {
  const shown = (question.callouts ?? []).filter((callout: Callout) => isPicked(answers, question.id, callout.when));
  return (
    <>
      {shown.map((callout) => (
        <div key={callout.when} className={cn("rqf-callout", callout.tone)} role="note">
          <MaterialSymbol name={callout.icon} />
          <p>{callout.text}</p>
          {callout.call ? (
            <a className="rqf-call rq-press" href={`tel:${callout.call}`}>
              <MaterialSymbol name="call" />Call {callout.call}
            </a>
          ) : null}
          {callout.switchTo && onSwitch ? (
            <button type="button" className="rqf-switch-to rq-press" onClick={() => onSwitch(callout.switchTo!)}>Go to towing</button>
          ) : null}
        </div>
      ))}
    </>
  );
}

export default function QuestionField({ question, context, answers, onPick, onSwitch, fuel }: Props) {
  const options = optionsFor(question, context);
  const on = (option: QuestionOption) => isPicked(answers, question.id, option.v);
  const pick = (value: string) => onPick(question, value);
  const labelledBy = `rqf-lbl-${question.id}`;
  let body: ReactNode = null;

  if (question.kind === "seg") {
    body = (
      <div className="rqf-seg" role="radiogroup" aria-labelledby={labelledBy} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.v}
            type="button"
            role="radio"
            aria-checked={on(option)}
            className={cn("rqf-seg-btn rq-press", question.big && "big", on(option) && "is-on", option.danger && "danger")}
            onClick={() => pick(option.v)}
          >
            {option.icon ? <MaterialSymbol name={option.icon} /> : null}
            {option.label}
          </button>
        ))}
      </div>
    );
  } else if (question.kind === "cards") {
    body = (
      <div className="rqf-cards" role="radiogroup" aria-labelledby={labelledBy}>
        {options.map((option) => (
          <button key={option.v} type="button" role="radio" aria-checked={on(option)} className={cn("rqf-card rq-press", on(option) && "is-on")} onClick={() => pick(option.v)}>
            {option.icon ? <MaterialSymbol name={option.icon} /> : null}
            <b>{option.label}</b>
            {option.sub ? <small>{option.sub}</small> : null}
            {on(option) ? <Tick /> : null}
          </button>
        ))}
      </div>
    );
  } else if (question.kind === "visual") {
    const extraOn = question.extra ? isPicked(answers, question.id, question.extra.v) : false;
    const extra = question.extra ? (
      <button
        type="button"
        role="radio"
        aria-checked={extraOn}
        className={cn("rqf-extra rq-press", extraOn && "is-on")}
        onClick={() => pick(question.extra!.v)}
      >
        {question.extra.icon ? <MaterialSymbol name={question.extra.icon} /> : null}
        {question.extra.label}
      </button>
    ) : null;
    body = (
      <div className={question.compact ? "rqf-vseg" : "rqf-visual"} role="radiogroup" aria-labelledby={labelledBy}>
        <div className={question.compact ? "rqf-vseg-row" : "rqf-cards"}>
          {options.map((option) => (
            <button key={option.v} type="button" role="radio" aria-checked={on(option)} className={cn("rqf-card visual rq-press", on(option) && "is-on")} onClick={() => pick(option.v)}>
              {option.art ? <span className="rqf-port"><OptionArtwork art={option.art} /></span> : null}
              <b>{option.label}</b>
              {option.sub ? <small>{option.sub}</small> : null}
              {on(option) ? <Tick /> : null}
            </button>
          ))}
          {question.compact ? extra : null}
        </div>
        {question.compact ? null : extra}
      </div>
    );
  } else if (question.kind === "list") {
    body = (
      <div className="rqf-list" role="radiogroup" aria-labelledby={labelledBy}>
        {options.map((option) => (
          <button key={option.v} type="button" role="radio" aria-checked={on(option)} className={cn("rqf-row rq-press", on(option) && "is-on")} onClick={() => pick(option.v)}>
            {option.icon ? <span className="rqf-row-ic"><MaterialSymbol name={option.icon} /></span> : null}
            <span className="rqf-row-id"><b>{option.label}</b>{option.sub ? <small>{option.sub}</small> : null}</span>
            <span className="rqf-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
    );
  } else if (question.kind === "chips") {
    body = (
      <div className={cn("rqf-chips", question.scroll && "scroll")} role={question.multi ? "group" : "radiogroup"} aria-labelledby={labelledBy}>
        {options.map((option) => (
          <button
            key={option.v}
            type="button"
            {...(question.multi ? { "aria-pressed": on(option) } : { role: "radio", "aria-checked": on(option) })}
            className={cn("rqf-chip rq-press", on(option) && "is-on")}
            onClick={() => pick(option.v)}
          >
            {option.icon ? <MaterialSymbol name={option.icon} /> : null}
            {option.label}
          </button>
        ))}
      </div>
    );
  } else if (question.kind === "tyres") {
    if (optionSetFor(context) === "bike") {
      // The studio bike, with a ring over each wheel.
      body = (
        <div className="rqf-bikepick" role="group" aria-labelledby={labelledBy}>
          <img src={studioImage("bike")} alt="" draggable={false} />
          {options.map((option) => (
            <button
              key={option.v}
              type="button"
              aria-pressed={on(option)}
              className={cn("rqf-wheel", option.v === "front" ? "front" : "rear", on(option) && "is-on")}
              onClick={() => pick(option.v)}
            >
              <span className="rqf-ring" aria-hidden="true" />
              <span className="rqf-wheel-lbl">{on(option) ? <MaterialSymbol name="check" /> : null}{option.label}</span>
            </button>
          ))}
        </div>
      );
    } else {
      const flat = options.filter(on).map((option) => option.v);
      body = (
        <div className="rqf-tyres" role="group" aria-labelledby={labelledBy}>
          {options.map((option, index) => (
            <button
              key={option.v}
              type="button"
              aria-pressed={on(option)}
              className={cn("rqf-tyre rq-press", index % 2 === 0 ? "left" : "right", on(option) && "is-on")}
              style={{ gridColumn: index % 2 === 0 ? 1 : 3, gridRow: index < 2 ? 1 : 2 }}
              onClick={() => pick(option.v)}
            >
              {index % 2 === 1 ? <MaterialSymbol name={on(option) ? "check_circle" : "radio_button_unchecked"} /> : null}
              {option.label}
              {index % 2 === 0 ? <MaterialSymbol name={on(option) ? "check_circle" : "radio_button_unchecked"} /> : null}
            </button>
          ))}
          <CarTopView flat={flat} />
        </div>
      );
    }
  } else if (question.kind === "fuelcalc") {
    const litres = Number(answers.qty || 0);
    const kind = answers.fuel === "diesel" ? "Diesel" : "Petrol";
    const price = fuel?.pricePerLitre ?? null;
    const fee = fuel?.serviceFee ?? null;
    if (!litres) return null;
    return (
      <div className="rqf-sec">
        <div className="rqf-calc" aria-label="Fuel cost">
          <div className="rqf-calc-row">
            <span>{kind} {litres} L{price ? ` × ${rupees(price, true)}` : ""}</span>
            <b>{price ? rupees(litres * price) : "Pump price"}</b>
          </div>
          <div className="rqf-calc-row"><span>Delivery</span><b>{fee ? `from ${rupees(fee)}` : "Told before we start"}</b></div>
          <div className="rqf-calc-row total">
            <span>You pay about</span>
            <b>{price && fee ? rupees(litres * price + fee) : "After delivery"}</b>
          </div>
        </div>
        <p className="rqf-note">
          {price ? `Today’s ${kind.toLowerCase()} price${fuel?.area ? ` in ${fuel.area}` : ""}. Pay after the fuel is delivered.` : "The helper charges the pump price for the fuel. Pay after it’s delivered."}
        </p>
      </div>
    );
  }

  return (
    <div className="rqf-sec">
      <Label question={question} />
      {body}
      <Callouts question={question} answers={answers} onSwitch={onSwitch} />
    </div>
  );
}
