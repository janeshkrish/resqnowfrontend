import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { VehiclePhoto } from "@/components/garage/GarageParts";
import type { CatalogBrand, CatalogModel } from "@/data/indianVehicles";
import { formatPlate, initialsOf, shortMake, type Vehicle } from "@/lib/garage";
import { classesFor, vehicleClassInfo, type VehicleFamily } from "@/lib/vehicleClasses";
import {
  brandById,
  brandsFor,
  catalogFor,
  choiceFromCatalog,
  choiceFromGarage,
  classOf,
  classSentence,
  clearedChoice,
  manualChoice,
  modelById,
  searchCatalog,
  shortName,
  vehicleWord,
  type VehicleChoice,
} from "@/lib/vehicleChoice";
import { cn } from "@/lib/utils";
import { VehicleArt } from "./art";

type Sheet = "search" | "brands" | "models" | null;

const STATUS_TAG: Record<string, string> = { old: "No longer sold", import: "Imported" };

function Logo({ brand, className }: { brand: Pick<CatalogBrand, "name" | "short" | "logo"> | null; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!brand) return null;
  if (brand.logo && !failed) {
    return <span className={className}><img src={brand.logo} alt="" draggable={false} onError={() => setFailed(true)} /></span>;
  }
  return <span className={cn(className, "ini")} aria-hidden="true">{initialsOf(brand.short || brand.name)}</span>;
}

function Tag({ status }: { status: string }) {
  return STATUS_TAG[status] ? <span className={cn("rqf-tag", status)}>{STATUS_TAG[status]}</span> : null;
}

function SheetTop({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="rqf-sheet-top">
      <button type="button" className="rqf-icon-btn rq-press" aria-label="Back" onClick={onBack}><MaterialSymbol name="arrow_back" /></button>
      <Dialog.Title className="rqf-sheet-title">{title}</Dialog.Title>
    </div>
  );
}

function ModelRow({ model, family, on, onPick, short = false }: { model: CatalogModel; family: VehicleFamily; on: boolean; onPick: () => void; short?: boolean }) {
  const brand = brandById(model.brandId);
  return (
    <button type="button" className={cn("rqf-place", on && "is-on")} onClick={onPick}>
      <Logo brand={brand} className="rqf-dd-logo" />
      <span className="rqf-row-id">
        {/* In a brand's list the old models sit under their own heading, so they skip the tag. */}
        <b><span className="rqf-name">{short ? model.model : shortName(model)}</span>{short && model.status === "old" ? null : <Tag status={model.status} />}</b>
        <small>{vehicleClassInfo(classOf(model, family))?.label}</small>
      </span>
      <MaterialSymbol name="chevron_right" className="rqf-chev" />
    </button>
  );
}

export type VehiclePickerProps = {
  family: VehicleFamily;
  choice: VehicleChoice;
  garage: Vehicle[];
  onChange: (patch: VehicleChoice) => void;
  /** Class tiles below the vehicle (hidden on SOS, where the vehicle is optional). */
  showClasses?: boolean;
  /** Towing prices by size, so say so. */
  classSetsPrice?: boolean;
};

export default function VehiclePicker({ family, choice, garage, onChange, showClasses = true, classSetsPrice = false }: VehiclePickerProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const word = vehicleWord(family);
  const tab = garage.length ? choice.vehicleTab ?? "garage" : "choose";
  const manual = tab === "choose" && choice.vehicleSource === "manual";
  const brand = brandById(choice.catalogBrandId);
  const model = modelById(choice.catalogModelId);
  const brands = useMemo(() => brandsFor(family), [family]);
  const results = useMemo(() => searchCatalog(family, query), [family, query]);
  const brandModels = useMemo(() => (brand ? catalogFor(family).filter((entry) => entry.brandId === brand.id) : []), [brand, family]);
  const q = brandQuery.trim().toLowerCase();
  const allBrands = [...brands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((entry) => !q || entry.name.toLowerCase().includes(q) || entry.short.toLowerCase().includes(q));
  const typed = query.trim();

  const close = () => { setSheet(null); setQuery(""); setBrandQuery(""); };
  const pickModel = (entry: CatalogModel) => { onChange(choiceFromCatalog(entry, family)); close(); };
  const startManual = (name: string) => { onChange(manualChoice(name)); close(); };
  const sentence = classSentence(choice);
  const classHelp = sentence ?? (classSetsPrice ? "Sets the towing price" : "Pick the closest");
  const classes = classesFor(family);

  return (
    <>
      <div className="rqf-sec">
        <div className="rqf-vhead">
          <span className="rqf-vhead-t" id="rqf-lbl-vehicle">Your {word}</span>
          {garage.length ? (
            <span className="rqf-mini-tabs" role="tablist" aria-label="How to choose your vehicle">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "garage"}
                className={cn("rqf-mini-tab", tab === "garage" && "is-on")}
                onClick={() => tab !== "garage" && onChange(clearedChoice("garage"))}
              >
                <MaterialSymbol name="garage_home" />My garage
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "choose"}
                className={cn("rqf-mini-tab", tab === "choose" && "is-on")}
                onClick={() => tab !== "choose" && onChange(clearedChoice("choose"))}
              >
                Other
              </button>
            </span>
          ) : null}
          {manual && !garage.length ? (
            <button type="button" className="rqf-type-link rq-press" onClick={() => onChange(clearedChoice("choose"))}>
              <MaterialSymbol name="list" />Pick from list
            </button>
          ) : null}
        </div>

        {tab === "garage" ? (
          <div className="rqf-vehicles" role="radiogroup" aria-labelledby="rqf-lbl-vehicle">
            {garage.map((vehicle) => {
              const on = choice.vehicleSource === "garage" && choice.garageVehicleId === vehicle.id;
              const info = on ? vehicleClassInfo(choice.vehicleSubtype) : null;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn("rqf-veh rq-press", on && "is-on")}
                  onClick={() => onChange(choiceFromGarage(vehicle, family))}
                >
                  <span className="rqf-vthumb"><VehiclePhoto vehicle={vehicle} /></span>
                  <span className="rqf-vid">
                    <b>{shortMake(vehicle.make)} {vehicle.model}</b>
                    <small>{[info?.label, vehicle.license_plate ? formatPlate(vehicle.license_plate) : null].filter(Boolean).join(" · ") || "Tap to choose"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : manual ? (
          <>
            <label className="rqf-search">
              <MaterialSymbol name="edit" />
              <input
                type="text"
                value={choice.manualName ?? ""}
                onChange={(event) => onChange(manualChoice(event.target.value))}
                placeholder={`Type your ${word}’s name, e.g. ${family === "bike" ? "Yamaha RX 100" : "Opel Astra"}`}
                aria-label={`Name of your ${word}`}
                autoComplete="off"
              />
            </label>
            {garage.length ? (
              <button type="button" className="rqf-type-link rq-press" onClick={() => onChange(clearedChoice("choose"))}>
                <MaterialSymbol name="list" />Pick from list
              </button>
            ) : null}
          </>
        ) : (
          <div className="rqf-dd-row">
            <button type="button" className={cn("rqf-dd rq-press", brand && "is-set")} onClick={() => setSheet("brands")} aria-haspopup="dialog">
              <Logo brand={brand} className="rqf-dd-logo" />
              <span className="rqf-dd-id"><span className="rqf-dd-lbl">Brand</span><span className={cn("rqf-dd-val", !brand && "ph")}>{brand ? brand.short : "Choose"}</span></span>
              <MaterialSymbol name="expand_more" />
            </button>
            <button
              type="button"
              className={cn("rqf-dd rq-press", model && "is-set", !brand && "is-off")}
              onClick={() => setSheet(brand ? "models" : "brands")}
              aria-haspopup="dialog"
            >
              <span className="rqf-dd-id"><span className="rqf-dd-lbl">Model</span><span className={cn("rqf-dd-val", !model && "ph")}>{model ? model.model : brand ? "Choose" : "Brand first"}</span></span>
              <MaterialSymbol name="expand_more" />
            </button>
            <button type="button" className="rqf-dd-search rq-press" onClick={() => setSheet("search")} aria-label={`Type your ${word}’s name`} aria-haspopup="dialog">
              <MaterialSymbol name="search" />Type
            </button>
          </div>
        )}
      </div>

      {showClasses ? (
        <div className="rqf-sec">
          <p className="rqf-lbl" id="rqf-lbl-class">
            <span>{family === "car" ? "Car size" : family === "bike" ? "Bike type" : "Vehicle type"}</span>
            <small>{classHelp}</small>
          </p>
          <div className={cn("rqf-class-grid", `n${classes.length}`)} role="radiogroup" aria-labelledby="rqf-lbl-class">
            {classes.map((entry) => {
              const on = choice.vehicleSubtype === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn("rqf-class-tile rq-press", on && "is-on")}
                  onClick={() => onChange({ vehicleSubtype: entry.id })}
                >
                  <span className="rqf-class-pic"><VehicleArt art={entry.art} electric={entry.electric} /></span>
                  <b>{entry.label}</b>
                  {on ? <span className="rqf-tick" aria-hidden="true"><MaterialSymbol name="check" /></span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog.Root open={sheet !== null} onOpenChange={(open) => { if (!open) close(); }}>
        <Dialog.Portal>
          <Dialog.Content className="rqf-drop" aria-describedby={undefined}>
            {sheet === "search" ? (
              <>
                <SheetTop title={`Find your ${word}`} onBack={close} />
                <label className="rqf-search rqf-sheet-search">
                  <MaterialSymbol name="search" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={family === "bike" ? "e.g. Splendor, RX 100, Activa" : family === "commercial" ? "e.g. Ace, Dost, 407" : family === "ev" ? "e.g. Nexon EV, Ather, Chetak" : "e.g. Swift, Esteem, Defender"}
                    aria-label={`Type your ${word}’s name`}
                    autoComplete="off"
                    autoFocus
                  />
                  {query ? <button type="button" className="rqf-clear" aria-label="Clear" onClick={() => setQuery("")}><MaterialSymbol name="close" /></button> : null}
                </label>
                <p className="rqf-drop-sec">{typed ? (results.length ? `Matching ${word}s` : "Not in our list yet") : `Popular ${word}s`}</p>
                {results.map((entry) => (
                  <ModelRow key={entry.id} model={entry} family={family} on={model?.id === entry.id} onPick={() => pickModel(entry)} />
                ))}
                <button type="button" className="rqf-place rqf-place-add" onClick={() => startManual(typed)}>
                  <span className="rqf-row-ic"><MaterialSymbol name="add" /></span>
                  <span className="rqf-row-id">
                    <b>{typed ? `Use “${typed}”` : "Not in the list? Type the name"}</b>
                    <small>Then tap the closest {family === "car" ? "size" : "type"}</small>
                  </span>
                </button>
              </>
            ) : null}

            {sheet === "brands" ? (
              <>
                <SheetTop title="Choose the brand" onBack={close} />
                <label className="rqf-search rqf-sheet-search">
                  <MaterialSymbol name="search" />
                  <input type="search" value={brandQuery} onChange={(event) => setBrandQuery(event.target.value)} placeholder="Search brands" aria-label="Search brands" autoComplete="off" />
                </label>
                {!q ? (
                  <>
                    <p className="rqf-drop-sec">Popular</p>
                    <div className="rqf-brand-grid">
                      {brands.filter((entry) => entry.popular).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={cn("rqf-brand-tile rq-press", brand?.id === entry.id && "is-on")}
                          onClick={() => { onChange({ ...clearedChoice("choose"), catalogBrandId: entry.id }); setSheet("models"); }}
                        >
                          <Logo brand={entry} className="rqf-brand-logo" />
                          <span>{entry.short}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className="rqf-drop-sec">{q ? "Matching brands" : "All brands, A to Z"}</p>
                {allBrands.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={cn("rqf-place", brand?.id === entry.id && "is-on")}
                    onClick={() => { onChange({ ...clearedChoice("choose"), catalogBrandId: entry.id }); setSheet("models"); setBrandQuery(""); }}
                  >
                    <Logo brand={entry} className="rqf-dd-logo" />
                    <span className="rqf-row-id"><b><span className="rqf-name">{entry.name}</span><Tag status={entry.status} /></b></span>
                    <MaterialSymbol name="chevron_right" className="rqf-chev" />
                  </button>
                ))}
                {!allBrands.length ? (
                  <button type="button" className="rqf-place rqf-place-add" onClick={() => startManual(brandQuery.trim())}>
                    <span className="rqf-row-ic"><MaterialSymbol name="add" /></span>
                    <span className="rqf-row-id"><b>Not in the list? Type the name</b><small>Then tap the closest {family === "car" ? "size" : "type"}</small></span>
                  </button>
                ) : null}
              </>
            ) : null}

            {sheet === "models" && brand ? (
              <>
                <SheetTop title="Choose the model" onBack={close} />
                <div className="rqf-context">
                  <Logo brand={brand} className="rqf-brand-logo" />
                  <span className="rqf-row-id"><b>{brand.name}</b><small>{brandModels.length} models</small></span>
                  <button type="button" className="rqf-change rq-press" onClick={() => setSheet("brands")}>Change</button>
                </div>
                {[
                  { title: "On sale now", rows: brandModels.filter((entry) => entry.status !== "old") },
                  { title: "No longer sold", rows: brandModels.filter((entry) => entry.status === "old") },
                ].map((group) => (group.rows.length ? (
                  <div key={group.title}>
                    <p className="rqf-drop-sec">{group.title}</p>
                    {group.rows.map((entry) => (
                      <ModelRow key={entry.id} model={entry} family={family} short on={model?.id === entry.id} onPick={() => pickModel(entry)} />
                    ))}
                  </div>
                ) : null))}
                <button type="button" className="rqf-place rqf-place-add" onClick={() => startManual(`${brand.name} `)}>
                  <span className="rqf-row-ic"><MaterialSymbol name="add" /></span>
                  <span className="rqf-row-id"><b>Model not listed? Type the name</b><small>Then tap the closest {family === "car" ? "size" : "type"}</small></span>
                </button>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
