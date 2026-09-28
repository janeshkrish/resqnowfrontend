import type { OptionArt } from "@/config/requestQuestions";
import type { VehicleArtId } from "@/lib/vehicleClasses";

const NAVY = "#283048";
const GLASS = "#DDE2EA";
const HUB = "#E4E7EC";
const PIPE = "#98A2B3";

function Wheel({ x, r = 7.5, cy = 35 }: { x: number; r?: number; cy?: number }) {
  return (
    <>
      <circle cx={x} cy={cy} r={r} fill={NAVY} stroke="#FFFFFF" strokeWidth="2" />
      <circle cx={x} cy={cy} r={(r * 0.36).toFixed(1)} fill={HUB} />
    </>
  );
}

type Shape = { body: string; glass?: string; grey?: string; lines?: string; wheels: number[]; r?: number };

// Side views, front facing right, on a 100 × 46 box.
const SHAPES: Record<VehicleArtId, Shape> = {
  hatch: {
    body: "M14 35V22c0-3 1-5 4-6l9-8c2-2 4-3 7-3h21c3 0 5 1 7 3l8 9 13 2c4 1 6 3 6 7v9z",
    glass: "M22 17l8-8h11v8z M45 9h9c2 0 3 1 4 2l6 6H45z",
    wheels: [30, 74],
  },
  sedan: {
    body: "M5 35v-8c0-2 1-3 3-3l15-2 9-10c2-2 4-3 7-3h20c3 0 5 1 7 3l8 9 14 2c4 1 6 3 6 6v6z",
    glass: "M25 21l8-9h10v9z M47 12h10c2 0 3 1 4 2l6 7H47z",
    wheels: [24, 78],
  },
  suv: {
    body: "M9 33V15c0-4 2-6 6-6h35c3 0 5 1 7 3l8 8 16 2c4 1 6 3 6 6v5z",
    glass: "M15 18v-6h12v6z M31 12h12v6H31z M47 12h3c2 0 3 1 4 2l4 4H47z",
    wheels: [28, 76],
  },
  muv: {
    body: "M3 36V12c0-4 2-6 6-6h57c3 0 5 1 7 3l7 9 12 2c4 1 6 3 6 6v10z",
    glass: "M9 18v-7h12v7z M25 11h13v7H25z M42 11h13v7H42z M59 11h7c2 0 3 1 4 2l5 5H59z",
    wheels: [22, 80],
  },
  luxury: {
    body: "M4 35v-6c0-2 1-3 3-3l17-2 12-11c3-2 6-3 10-3h14c4 0 7 1 9 4l7 8 14 2c4 1 6 3 6 6v5z",
    glass: "M27 22l10-9h9v9z M50 13h9c3 0 4 1 6 3l5 6H50z",
    wheels: [24, 78],
  },
  scooter: {
    body: "M12 29c0-9 6-14 14-14h14c2 0 3 1 3 3v6h17l5-15h5l-5 20H12z M18 13h20c2 0 3 1 3 2v1H15c0-2 1-3 3-3z",
    glass: "M66 11h3l-1 4h-3z",
    lines: "M64 7l10-1 M66 28l12 7",
    wheels: [22, 78],
  },
  commuter: {
    body: "M22 20c0-2 1-3 3-3h22l3-4c1-1 2-2 4-2h9c3 0 5 2 6 4l1 5z M38 21h20l-2 11H42z M14 22h10v3H16c-1 0-2-1-2-2z",
    glass: "M71 15a2.5 2.5 0 1 0 0.1 0z",
    grey: "M28 30h14v3H30c-1 0-2-1-2-1.5z",
    lines: "M44 30L20 35 M68 12l12 23 M63 9l9-2",
    wheels: [20, 80],
    r: 9,
  },
  sports: {
    body: "M10 19l14-1h16l9-7h12l15 5 8 10-4 3H64l-6 5H42l-4-6H20z",
    glass: "M64 11l9 4-2 2-8-3z M78 21l5 5-3 1-4-4z",
    lines: "M42 30L20 35 M74 25l6 10",
    wheels: [20, 80],
    r: 9,
  },
  cruiser: {
    body: "M10 25c0-3 2-5 5-5h5c3 0 5 2 9 2h11l4-8c1-2 3-3 6-3h11c3 0 5 2 5 4l-2 9H10z M40 25h18l-3 9H43z",
    glass: "M69 12a3 3 0 1 0 0.1 0z",
    grey: "M22 31h26v3H24c-1 0-2-1-2-1.5z",
    lines: "M42 31L18 35 M65 7l19 28 M57 5l9 3",
    wheels: [18, 84],
    r: 9,
  },
  pickup: {
    body: "M6 34V22c0-1 1-2 2-2h44V11c0-2 1-3 3-3h14c2 0 3 1 4 2l7 9 12 2c3 1 4 3 4 5v8z",
    glass: "M56 11h10v8H56z M69 11h2c1 0 2 1 3 2l4 6h-9z",
    grey: "M9 20h40v3H9z",
    wheels: [24, 80],
  },
  van: {
    body: "M4 34V10c0-3 2-5 5-5h66c3 0 5 1 6 3l8 13 6 2c2 1 3 2 3 4v7z",
    glass: "M10 11h12v8H10z M26 11h12v8H26z M42 11h12v8H42z M58 11h12v8H58z M74 11h3c1 0 2 1 3 2l3 6h-9z",
    wheels: [22, 80],
  },
  lcv: {
    body: "M4 34V8c0-1 1-2 2-2h58v28z M66 34V16c0-2 1-3 3-3h12c2 0 3 1 4 2l7 8 4 2c2 1 2 2 2 3v6z",
    glass: "M70 16h10l6 7H70z",
    wheels: [20, 38, 82],
    r: 7,
  },
  truck: {
    body: "M2 33V6c0-1 1-2 2-2h66v29z M72 33V12c0-2 1-4 4-4h12c3 0 5 2 6 4l3 10v11z",
    glass: "M76 12h11l3 9H76z",
    wheels: [14, 30, 86],
    r: 7,
  },
};

/** Side-view silhouette for a vehicle class tile, with a bolt for electric ones. */
export function VehicleArt({ art, electric = false, width = 44, height = 20 }: { art: VehicleArtId; electric?: boolean; width?: number; height?: number }) {
  const shape = SHAPES[art];
  return (
    <svg width={width} height={height} viewBox="0 0 100 46" aria-hidden="true">
      <path d={shape.body} fill={NAVY} />
      {shape.grey ? <path d={shape.grey} fill={PIPE} /> : null}
      {shape.lines ? <path d={shape.lines} fill="none" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" /> : null}
      {shape.glass ? <path d={shape.glass} fill={GLASS} /> : null}
      {shape.wheels.map((x) => <Wheel key={x} x={x} r={shape.r} />)}
      {electric ? (
        <>
          <circle cx="90" cy="9" r="9" fill="#12B76A" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M91.5 2.5l-6 8h4.5l-1.5 6 6-8h-4.5z" fill="#FFFFFF" />
        </>
      ) : null}
    </svg>
  );
}

const SOCKET = "#283048";
const HOLE = "#EEF1F5";

/** Pictures inside the tyre-type and charging-socket choices. */
export function OptionArtwork({ art }: { art: OptionArt }) {
  switch (art) {
    case "tubeless":
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="12" fill="none" stroke={NAVY} strokeWidth="5" />
          <circle cx="15" cy="15" r="5.2" fill={PIPE} />
          <circle cx="15" cy="15" r="1.6" fill={HOLE} />
        </svg>
      );
    case "tube":
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="12" fill="none" stroke={NAVY} strokeWidth="5" />
          <circle cx="15" cy="15" r="7.4" fill="none" stroke="#B01F2A" strokeWidth="2.4" />
          <circle cx="15" cy="15" r="4.2" fill={PIPE} />
          <circle cx="15" cy="15" r="1.4" fill={HOLE} />
        </svg>
      );
    case "type2":
      // Flat-topped round socket: 2 small and 5 large holes.
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M13.2 16H50.8A26 26 0 1 1 13.2 16Z" fill={SOCKET} />
          <g fill={HOLE}>
            <circle cx="25" cy="23" r="3" /><circle cx="39" cy="23" r="3" />
            <circle cx="18.5" cy="35" r="4.4" /><circle cx="32" cy="36.5" r="4.4" /><circle cx="45.5" cy="35" r="4.4" />
            <circle cx="24.5" cy="48.5" r="4.4" /><circle cx="39.5" cy="48.5" r="4.4" />
          </g>
        </svg>
      );
    case "ccs2":
      // The Type 2 shape on top, with a separate part holding 2 big DC holes below.
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M20 6H44A17 17 0 1 1 20 6Z" fill={SOCKET} />
          <g fill={HOLE}>
            <circle cx="27" cy="11" r="2" /><circle cx="37" cy="11" r="2" />
            <circle cx="22.5" cy="19" r="2.8" /><circle cx="32" cy="20" r="2.8" /><circle cx="41.5" cy="19" r="2.8" />
            <circle cx="27" cy="28" r="2.8" /><circle cx="37" cy="28" r="2.8" />
          </g>
          <rect x="14" y="41" width="36" height="21" rx="10.5" fill={SOCKET} />
          <g fill={HOLE}><circle cx="24" cy="51.5" r="5.8" /><circle cx="40" cy="51.5" r="5.8" /></g>
        </svg>
      );
    case "home3pin":
      // Indian 3-pin wall socket: bigger earth hole on top.
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="6" y="6" width="52" height="52" rx="12" fill="#FFFFFF" stroke="#C3C8D2" strokeWidth="2" />
          <circle cx="32" cy="32" r="19" fill="#F2F4F7" />
          <g fill={NAVY}><circle cx="32" cy="23" r="4.6" /><circle cx="23.5" cy="38" r="3.4" /><circle cx="40.5" cy="38" r="3.4" /></g>
        </svg>
      );
    case "brand":
      // A scooter maker's own plug: generic, clearly not a wall socket.
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="10" y="14" width="44" height="36" rx="12" fill={SOCKET} />
          <g fill={HOLE}>
            <rect x="19" y="24" width="7" height="16" rx="3.5" /><rect x="38" y="24" width="7" height="16" rx="3.5" /><circle cx="32" cy="32" r="3" />
          </g>
          <path d="M28 4h8v10h-8z" fill={PIPE} />
        </svg>
      );
    default:
      return null;
  }
}

/** A car from above; the flat tyres turn red. */
export function CarTopView({ flat }: { flat: string[] }) {
  const fill = (id: string) => (flat.includes(id) ? "#B01F2A" : NAVY);
  return (
    <svg className="rqf-cartop" viewBox="0 0 96 150" aria-hidden="true">
      <text x="48" y="9" textAnchor="middle" fontFamily="Manrope, system-ui, sans-serif" fontSize="8.5" fontWeight="800" letterSpacing="1.2" fill={PIPE}>FRONT</text>
      <rect x="4" y="30" width="12" height="30" rx="5" fill={fill("fl")} />
      <rect x="80" y="30" width="12" height="30" rx="5" fill={fill("fr")} />
      <rect x="4" y="100" width="12" height="30" rx="5" fill={fill("rl")} />
      <rect x="80" y="100" width="12" height="30" rx="5" fill={fill("rr")} />
      <rect x="13" y="14" width="70" height="132" rx="26" fill="#FFFFFF" stroke="#C3C8D2" strokeWidth="2" />
      <rect x="21" y="40" width="54" height="22" rx="8" fill={GLASS} />
      <rect x="23" y="66" width="50" height="38" rx="7" fill="#F2F4F7" />
      <rect x="25" y="108" width="46" height="16" rx="6" fill={GLASS} />
    </svg>
  );
}
