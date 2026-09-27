import { useMemo, useState } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { BrandLogo, VehiclePhoto } from "@/components/garage/GarageParts";
import { brandsFor, formatPlate, type VehicleType } from "@/lib/garage";
import { studioImage } from "@/lib/vehiclePhoto";
import { cn } from "@/lib/utils";

type Step = "type" | "brand" | "model" | "plate";
const STEPS: Step[] = ["type", "brand", "model", "plate"];

export type NewVehicle = { type: VehicleType; make: string; model: string; license_plate: string };

export default function AddVehicleFlow({
  onCancel, onSave, saving, error,
}: {
  onCancel: () => void;
  onSave: (vehicle: NewVehicle) => void;
  saving: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<VehicleType | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [query, setQuery] = useState("");

  const brands = useMemo(() => (type ? brandsFor(type) : []), [type]);
  const brand = brands.find((entry) => entry.id === brandId) ?? null;
  const q = query.trim().toLowerCase();
  const shownBrands = brands.filter((entry) => !q || entry.name.toLowerCase().includes(q));
  const shownModels = (brand?.models ?? []).filter((entry) => !q || entry.toLowerCase().includes(q));
  const stepIndex = STEPS.indexOf(step);
  const kind = type === "bike" ? "bike" : "car";

  const go = (next: Step) => { setQuery(""); setStep(next); };
  const back = () => (stepIndex === 0 ? onCancel() : go(STEPS[stepIndex - 1]));

  return (
    <div className="rqg-add">
      <div className="rqg-top">
        <button type="button" className="rqg-icon-btn rq-press" aria-label="Back" onClick={back}><MaterialSymbol name="arrow_back" /></button>
        <div className="rqg-steps">
          <span>Step {stepIndex + 1} of 4</span>
          <span className="rqg-bars" aria-hidden="true">{STEPS.map((entry, index) => <span key={entry} className={cn("rqg-bar", index <= stepIndex && "on")} />)}</span>
        </div>
      </div>

      {step === "type" ? (
        <>
          <div className="rqg-head">
            <p className="rqg-kicker">Add a vehicle</p>
            <h1 className="rqg-h1">What do you <em>drive?</em></h1>
            <p className="rqg-sub">Pick one. You can save more vehicles later.</p>
          </div>
          <div className="rqg-types">
            {(["car", "bike"] as VehicleType[]).map((option) => (
              <button
                key={option}
                type="button"
                className={cn("rqg-type-card rq-press", type === option && "is-selected")}
                aria-label={option === "car" ? "Car: hatchback, sedan or SUV" : "Bike: motorcycle or scooter"}
                onClick={() => { setType(option); setBrandId(null); setModel(null); go("brand"); }}
              >
                <img className={cn("rqg-type-art", option)} src={studioImage(option)} alt="" draggable={false} />
                <span className="rqg-type-copy">
                  <span className="rqg-type-kicker">I have a</span>
                  <span className="rqg-type-word">{option === "car" ? "CAR" : "BIKE"}</span>
                  <span className="rqg-type-sub">{option === "car" ? "Hatchback · Sedan · SUV" : "Motorcycle · Scooter"}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="rqg-note"><MaterialSymbol name="electric_car" className="rq-symbol-sm" />Electric cars and scooters are listed under their brand.</p>
        </>
      ) : null}

      {step === "brand" ? (
        <>
          <div className="rqg-head">
            <p className="rqg-kicker">Add a {kind}</p>
            <h1 className="rqg-h1">Which <em>brand?</em></h1>
          </div>
          <label className="rqg-search">
            <MaterialSymbol name="search" />
            <input id="rqg-brand-search" type="search" placeholder={`Search ${kind} brands`} aria-label={`Search ${kind} brands`} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </label>
          <div className="rqg-brands">
            {shownBrands.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={cn("rqg-brand-tile rq-press", entry.id === brandId && "is-on")}
                aria-pressed={entry.id === brandId}
                onClick={() => { setBrandId(entry.id); setModel(null); go("model"); }}
              >
                {entry.id === brandId ? <MaterialSymbol name="check_circle" className="rqg-check" /> : null}
                <BrandLogo make={entry.name} size="tile" />
                <span>{entry.name}</span>
              </button>
            ))}
          </div>
          {shownBrands.length ? null : <p className="rqg-note">No brand matches “{query}”.</p>}
        </>
      ) : null}

      {step === "model" && brand ? (
        <>
          <div className="rqg-head">
            <p className="rqg-kicker">Add a {kind}</p>
            <h1 className="rqg-h1">Which <em>model?</em></h1>
          </div>
          <div className="rqg-context">
            <BrandLogo make={brand.name} />
            <span className="rqg-context-id"><b>{brand.name}</b><small>{brand.models.length} models</small></span>
            <button type="button" className="rqg-change rq-press" onClick={() => go("brand")}>Change</button>
          </div>
          <label className="rqg-search">
            <MaterialSymbol name="search" />
            <input id="rqg-model-search" type="search" placeholder={`Search ${brand.name} models`} aria-label={`Search ${brand.name} models`} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </label>
          <div className="rqg-models" role="radiogroup" aria-label="Model">
            {shownModels.map((entry) => (
              <button
                key={entry}
                type="button"
                role="radio"
                aria-checked={entry === model}
                className={cn("rqg-model-row rq-press", entry === model && "is-on")}
                onClick={() => { setModel(entry); go("plate"); }}
              >
                {entry}<span className="rqg-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
          {shownModels.length ? null : <p className="rqg-note">No model matches “{query}”.</p>}
        </>
      ) : null}

      {step === "plate" && brand && model && type ? (
        <>
          <div className="rqg-head">
            <p className="rqg-kicker">Add a {kind}</p>
            <h1 className="rqg-h1">Number <em>plate</em></h1>
            <p className="rqg-sub">Optional. It helps the technician spot your vehicle when they arrive.</p>
          </div>
          <label className="rqg-field-label" htmlFor="rqg-plate">Registration number</label>
          <div className="rqg-plate-big">
            <span className="rqg-plate-ind" aria-hidden="true"><span className="rqg-chakra" />IND</span>
            <input
              id="rqg-plate"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={16}
              placeholder="KA 01 AB 1234"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              onBlur={() => setPlate((value) => formatPlate(value))}
            />
          </div>
          <p className="rqg-hint">Letters and numbers as they appear on the plate, e.g. KA 01 AB 1234.</p>
          <div className="rqg-summary">
            <span className="rqg-thumb" aria-hidden="true"><VehiclePhoto vehicle={{ make: brand.name, model, type }} /></span>
            <span className="rqg-summary-id"><small>{brand.name} · {type === "bike" ? "Bike" : "Car"}</small><b>{model}</b></span>
            <button type="button" className="rqg-change rq-press" onClick={() => go("model")}>Change</button>
          </div>
          {error ? <p className="rqg-error" role="alert">{error} Check your connection and try again.</p> : null}
          <div className="rqg-cta">
            <button
              type="button"
              className="rqg-btn rqg-block rq-press"
              disabled={saving}
              onClick={() => onSave({ type, make: brand.name, model, license_plate: formatPlate(plate) })}
            >
              <MaterialSymbol name="garage_home" />{saving ? "Saving…" : "Save vehicle"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
