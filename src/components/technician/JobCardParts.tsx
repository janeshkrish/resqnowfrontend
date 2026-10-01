import MaterialSymbol from "@/components/home/MaterialSymbol";
import { apiUrl } from "@/lib/api";
import { vehicleImageFor } from "@/lib/technicianJobCard";
import type { TechnicianJobDetails } from "@/lib/technicianJobDetails";
import { cn } from "@/lib/utils";

/**
 * The pieces the new-request card and the active job card share, so a technician reads
 * earnings, distance, time, the address and the vehicle in the same place on both.
 * Styles: the `tj-` block in index.css.
 */

export function JobKeyStrip({ earn, distance, eta, className }: { earn: string; distance: string; eta: string; className?: string }) {
  return (
    <dl className={cn("tj-strip", className)}>
      <div className="tj-cell is-earn"><dt>You earn</dt><dd>{earn}</dd></div>
      <div className="tj-cell"><dt>Distance</dt><dd>{distance}</dd></div>
      <div className="tj-cell"><dt>Reach in</dt><dd>{eta}</dd></div>
    </dl>
  );
}

export function JobLocationBox({
  label, address, landmark, drop,
}: {
  label: string;
  address: string;
  landmark?: string | null;
  drop?: { label: string; address: string } | null;
}) {
  return (
    <div className="tj-loc" data-testid="job-location">
      <div className="tj-stop">
        <span className="tj-dot" aria-hidden="true" />
        <div className="tj-stop-id"><p className="tj-lbl">{label}</p><p className="tj-addr">{address}</p></div>
      </div>
      {landmark ? <p className="tj-mark"><MaterialSymbol name="flag" />{landmark}</p> : null}
      {drop ? (
        <div className="tj-stop is-drop">
          <span className="tj-square" aria-hidden="true" />
          <div className="tj-stop-id"><p className="tj-lbl">{drop.label}</p><p className="tj-addr">{drop.address}</p></div>
        </div>
      ) : null}
    </div>
  );
}

export function JobVehicleRow({
  vehicleType, name, sub, plate,
}: {
  vehicleType: unknown;
  name: string;
  sub?: string | null;
  plate?: string | null;
}) {
  return (
    <div className="tj-veh-row" data-testid="job-vehicle">
      <span className="tj-thumb"><img src={vehicleImageFor(vehicleType)} alt="" draggable={false} /></span>
      <div className="tj-veh-id">
        <b>{name}</b>
        {sub || plate ? (
          <div className="tj-veh-sub">
            {sub ? <span>{sub}</span> : null}
            {plate ? <span className="tj-plate" aria-label={`Number plate ${plate}`}><i aria-hidden="true" /><span>{plate}</span></span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** What the customer answered in the request form: tags, their note, photos and voice note. */
export function JobSays({ details, className }: { details: TechnicianJobDetails; className?: string }) {
  const photos = details.attachments.filter((item) => item.type === "photo");
  const voices = details.attachments.filter((item) => item.type === "voice");
  if (!details.problem.length && !details.customerNote && !photos.length && !voices.length) return null;

  return (
    <div className={cn("tj-says", className)} data-testid="job-details">
      {details.problem.length ? (
        <>
          <p className="tj-sec">Customer says</p>
          <ul className="tj-tags" aria-label="Customer says">
            {details.problem.map((entry) => <li key={entry} className="tj-tag">{entry}</li>)}
          </ul>
        </>
      ) : null}
      {details.customerNote ? <p className="tj-note">“{details.customerNote}”</p> : null}
      {photos.length || voices.length ? (
        <div className="tj-media">
          {photos.map((item, index) => (
            <a key={item.url} href={apiUrl(item.url)} target="_blank" rel="noopener noreferrer" className="tj-photo" aria-label={`Open photo ${index + 1} from the customer`}>
              <img src={apiUrl(item.url)} alt="" loading="lazy" />
            </a>
          ))}
          {voices.map((item, index) => (
            <audio key={item.url} controls preload="none" src={apiUrl(item.url)} className="tj-voice" aria-label={`Voice note ${index + 1} from the customer`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
