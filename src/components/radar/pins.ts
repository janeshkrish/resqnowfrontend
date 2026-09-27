// Map pins are HTML strings rendered by Mappls, so every value is escaped.
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

type LogoInput = { logo?: string | null; photo?: string | null; initials: string };

function logoHtml({ logo, photo, initials }: LogoInput, className: string) {
  if (logo) return `<span class="${className} rqr-logo--brand"><img src="${escapeHtml(logo)}" alt="" draggable="false"></span>`;
  if (photo) return `<span class="${className} rqr-logo--photo"><img src="${escapeHtml(photo)}" alt="" draggable="false"></span>`;
  return `<span class="${className}">${escapeHtml(initials)}</span>`;
}

/** A technician: their photo or initials in a pin whose tip marks the spot. */
export function technicianPinHtml(input: LogoInput & { name: string; selected: boolean }) {
  return `<div class="rqr-pin${input.selected ? " is-sel" : ""}" role="img" aria-label="${escapeHtml(input.name)}">${logoHtml(input, "rqr-logo rqr-logo--pin")}</div>`;
}

/** A charger or fuel pump: its brand logo, with power or price when known. */
export function placePinHtml(input: LogoInput & { name: string; label: string; selected: boolean }) {
  const classes = ["rqr-ppin", input.selected ? "is-sel" : "", input.label ? "" : "rqr-ppin--icon"].filter(Boolean).join(" ");
  const label = input.label ? `<span>${escapeHtml(input.label)}</span>` : "";
  return `<div class="${classes}" role="img" aria-label="${escapeHtml(input.name)}">${logoHtml(input, "rqr-logo rqr-logo--xs")}${label}</div>`;
}

export const technicianPinSize = (selected: boolean) => (selected ? { width: 56, height: 62 } : { width: 44, height: 50 });
export const placePinSize = (label: string, selected: boolean) => (label
  ? { width: Math.round(40 + label.length * (selected ? 8 : 7)), height: selected ? 38 : 32 }
  : { width: selected ? 38 : 32, height: selected ? 38 : 32 });
