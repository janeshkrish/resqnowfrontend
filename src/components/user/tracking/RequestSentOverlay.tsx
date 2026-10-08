import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

/** How long the scene plays before it opens into the map. */
export const REQUEST_SENT_PLAY_MS = 3400;
/** The least it shows, so an instant acceptance does not make it flash. */
export const REQUEST_SENT_MIN_MS = 1100;
/** With motion reduced there is nothing to wait for but the words. */
export const REQUEST_SENT_STILL_MS = 1500;
const GLIDE_MS = 260;
const OPEN_MS = 720;
/** The pin only moves onto the customer's marker when the marker is this close; further off, the map simply opens there. */
const GLIDE_REACH = 170;

export type RequestSentCard = { title: string; line: string; art: string; fare: string | null };

export type RequestSentOverlayProps = {
  /** "Finding a tow truck near you". */
  nextLine: string;
  /** The service's own picture, carried by the pins where the request lands; a symbol stands in when there is none. */
  art: string | null;
  glyph: string;
  /** What was asked for, once the request has loaded. */
  card: RequestSentCard | null;
  /** A technician has already accepted (or the request is no longer being searched for): open up now. */
  cutShort: boolean;
  reduceMotion: boolean;
  /** Where the customer is on the map, in screen pixels, so the scene can open from that very spot. */
  getTarget?: () => { x: number; y: number } | null;
  onDone: () => void;
};

// The scene is drawn on a 390 x 470 stage with the customer's spot at (200, 286.2): a street block seen from above
// and to one side, two units across for every one down.
const GX = 200;
const GY = 286.2;
const UNIT = 46;
const EDGE = 2.5;
const GAP = 0.15;

type Point = [number, number];
const at = (a: number, b: number): Point => [GX + (a - b) * UNIT, GY + ((a + b) * UNIT) / 2];
const points = (list: Point[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds.toFixed(2)}s` });

const PLANE = points([at(-EDGE, -EDGE), at(EDGE, -EDGE), at(EDGE, EDGE), at(-EDGE, EDGE)]);

// The two roads through the customer's spot are wider; each road draws itself, the main two first.
const ROADS = [0, -1, 1, -2, 2].flatMap((k, order) =>
  ([[at(k, -EDGE), at(k, EDGE)], [at(-EDGE, k), at(EDGE, k)]] as Array<[Point, Point]>).map(([from, to], side) => ({
    key: `${k}-${side}`,
    from,
    to,
    width: k === 0 ? 11 : 6.5,
    main: k === 0,
    wait: 0.34 + order * 0.07,
  })),
);

// Blocks between the roads; some of them stand up as low buildings.
const HEIGHTS: Record<string, number> = {
  "-2,-2": 34, "-1,-2": 16, "0,-2": 26, "1,-2": 12, "-2,-1": 20, "-2,0": 12, "1,-1": 18, "-2,1": 9, "1,1": 8, "0,1": 6, "-1,1": 7, "1,0": 10,
};
const CELLS = [-2, -1, 0, 1]
  .flatMap((i) => [-2, -1, 0, 1].map((j) => [i, j] as const))
  .sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
const BLOCKS = CELLS.map(([i, j], order) => {
  const a = at(i + GAP, j + GAP);
  const b = at(i + 1 - GAP, j + GAP);
  const c = at(i + 1 - GAP, j + 1 - GAP);
  const d = at(i + GAP, j + 1 - GAP);
  const height = HEIGHTS[`${i},${j}`] ?? 0;
  const up = ([x, y]: Point): Point => [x, y - height];
  return {
    key: `${i},${j}`,
    wait: 0.5 + order * 0.035,
    tile: points([a, b, c, d]),
    tower: height ? { left: points([d, c, up(c), up(d)]), right: points([c, b, up(b), up(c)]), roof: points([up(a), up(b), up(c), up(d)]) } : null,
    // Buildings behind the pin are drawn before it, the ones nearer the viewer after.
    behind: i + j < -1,
  };
});

// Where the request lands: three spots on the roads around. Each gets a dotted path that appears as the request
// travels, a bright head that flies along it, and a small pin that stands up where it lands.
const HEAD: Point = [GX, GY - 50];
const FLIGHTS = ([at(-2, 0), at(2, -1), at(1, 2)] as Point[]).map(([x, y], order) => {
  const lift = order === 2 ? 40 : 84;
  return {
    key: order,
    x,
    y,
    path: `M${HEAD[0].toFixed(1)} ${HEAD[1].toFixed(1)} Q${((HEAD[0] + x) / 2).toFixed(1)} ${((HEAD[1] + y) / 2 - lift).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`,
    wait: 1.72 + order * 0.22,
  };
});

const BURST = Array.from({ length: 10 }, (_, order) => {
  const angle = ((order * 36 + 18) * Math.PI) / 180;
  return {
    key: order,
    ink: order % 2 === 1,
    x1: GX + Math.cos(angle) * 34,
    y1: GY + Math.sin(angle) * 17,
    x2: GX + Math.cos(angle) * 74,
    y2: GY + Math.sin(angle) * 37,
  };
});

const PIN = "M200 286.2C187 268 174.5 254.5 174.5 236A25.5 25.5 0 1 1 225.5 236C225.5 254.5 213 268 200 286.2Z";

const customerMarkerOnScreen = () => {
  const dot = document.querySelector('[data-tracking-place="customer"] .tracking-place-marker__dot');
  if (!dot) return null;
  const box = dot.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

function Tower({ block }: { block: (typeof BLOCKS)[number] }) {
  if (!block.tower) return null;
  return (
    <g className="rq-rs-tower" style={delay(block.wait + 0.22)}>
      <polygon points={block.tower.left} fill="#C9D0DB" />
      <polygon points={block.tower.right} fill="#B7BFCC" />
      <polygon points={block.tower.roof} fill="#FFFFFF" />
    </g>
  );
}

/**
 * The moment after the slide: the whole screen says the request went through. It opens from the slider,
 * draws the streets around the customer, drops a pin on their spot, sends the request out to technicians nearby,
 * and then opens up from the pin into the live map behind it.
 */
export function RequestSentOverlay({ nextLine, art, glyph, card, cutShort, reduceMotion, getTarget = customerMarkerOnScreen, onDone }: RequestSentOverlayProps) {
  const [opening, setOpening] = useState<{ x: number; y: number; dx: number; dy: number; glide: boolean } | null>(null);
  const startedAt = useRef(Date.now());
  const tipRef = useRef<HTMLElement | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const target = useRef(getTarget);
  target.current = getTarget;

  const open = useCallback(() => {
    setOpening((current) => {
      if (current) return current;
      const box = tipRef.current?.getBoundingClientRect();
      const tip = box ? { x: box.left, y: box.top } : { x: window.innerWidth / 2, y: window.innerHeight * 0.34 };
      const spot = target.current() ?? tip;
      const dx = spot.x - tip.x;
      const dy = spot.y - tip.y;
      const glide = Math.hypot(dx, dy) > 1 && Math.hypot(dx, dy) <= GLIDE_REACH;
      return { x: spot.x, y: spot.y, dx: glide ? dx : 0, dy: glide ? dy : 0, glide };
    });
  }, []);

  // The scene plays through once, then opens.
  useEffect(() => {
    const timer = window.setTimeout(open, reduceMotion ? REQUEST_SENT_STILL_MS : REQUEST_SENT_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, reduceMotion]);

  // Someone accepted while it was playing: no reason to keep the customer from the map.
  useEffect(() => {
    if (!cutShort) return;
    const timer = window.setTimeout(open, Math.max(0, REQUEST_SENT_MIN_MS - (Date.now() - startedAt.current)));
    return () => window.clearTimeout(timer);
  }, [cutShort, open]);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => done.current(), reduceMotion ? 220 : OPEN_MS + (opening.glide ? GLIDE_MS : 0));
    return () => window.clearTimeout(timer);
  }, [opening, reduceMotion]);

  const vars = opening
    ? ({ "--rs-x": `${opening.x}px`, "--rs-y": `${opening.y}px`, "--rs-dx": `${opening.dx}px`, "--rs-dy": `${opening.dy}px` } as CSSProperties)
    : undefined;

  return (
    <>
      {opening ? null : <span className="rq-rs-wipe" aria-hidden="true" />}
      <div
        className={cn("rq-rs", opening && "is-open", opening?.glide && "is-glide", reduceMotion && "is-still")}
        style={vars}
        data-testid="request-sent"
        data-stage={opening ? "opening" : "playing"}
      >
        <p className="sr-only" role="status">
          Request sent. {nextLine}.
        </p>
        <div className="rq-rs-move" aria-hidden="true">
          <div className="rq-rs-stage">
            <span className="rq-rs-blob is-1" />
            <span className="rq-rs-blob is-2" />

            <svg className="rq-rs-scene" width="390" height="470" viewBox="0 0 390 470">
              <defs>
                <radialGradient id="rqRsEdge" cx="200" cy="286" r="238" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 143) scale(1 .5)">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset=".62" stopColor="#fff" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <mask id="rqRsFade">
                  <rect x="0" y="0" width="390" height="470" fill="url(#rqRsEdge)" />
                </mask>
              </defs>
              <g className="rq-rs-plane">
                <g mask="url(#rqRsFade)">
                  <polygon points={PLANE} fill="#E9EDF3" />
                  {BLOCKS.map((block) => (
                    <polygon key={block.key} className="rq-rs-tile" points={block.tile} style={delay(block.wait)} />
                  ))}
                  {ROADS.map((road) => (
                    <line key={road.key} className="rq-rs-road" pathLength={100} x1={road.from[0]} y1={road.from[1]} x2={road.to[0]} y2={road.to[1]} strokeWidth={road.width} style={delay(road.wait)} />
                  ))}
                  {ROADS.filter((road) => road.main).map((road) => (
                    <line key={road.key} className="rq-rs-lane" x1={road.from[0]} y1={road.from[1]} x2={road.to[0]} y2={road.to[1]} />
                  ))}
                </g>
              </g>
            </svg>

            {/* The radar lies on the ground: everything in it is drawn round and then laid flat. */}
            <span className="rq-rs-radar">
              <i className="rq-rs-range is-1" />
              <i className="rq-rs-range is-2" />
              <i className="rq-rs-range is-3" />
              <i className="rq-rs-wave" />
              <i className="rq-rs-wave is-2" />
              <i className="rq-rs-wave is-3" />
              <i className="rq-rs-sweep" />
            </span>

            <svg className="rq-rs-scene" width="390" height="470" viewBox="0 0 390 470">
              <defs>
                <linearGradient id="rqRsPin" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#E0424E" />
                  <stop offset=".55" stopColor="#B01F2A" />
                  <stop offset="1" stopColor="#8E1620" />
                </linearGradient>
                <linearGradient id="rqRsTrail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#B01F2A" stopOpacity="0" />
                  <stop offset="1" stopColor="#B01F2A" stopOpacity=".5" />
                </linearGradient>
                <radialGradient id="rqRsPad" cx=".5" cy=".5" r=".5">
                  <stop offset="0" stopColor="#FFFFFF" />
                  <stop offset=".7" stopColor="#FFFFFF" />
                  <stop offset="1" stopColor="#FDECEE" />
                </radialGradient>
                <clipPath id="rqRsPinClip">
                  <path d={PIN} />
                </clipPath>
                {FLIGHTS.map((flight) => (
                  <mask key={flight.key} id={`rqRsArc${flight.key}`} maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="470">
                    <path className="rq-rs-arc-reveal" pathLength={100} d={flight.path} style={delay(flight.wait)} />
                  </mask>
                ))}
              </defs>
              {BLOCKS.filter((block) => block.behind).map((block) => (
                <Tower key={block.key} block={block} />
              ))}
              {BURST.map((line) => (
                <line key={line.key} className={cn("rq-rs-burst", line.ink && "is-ink")} pathLength={100} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
              {FLIGHTS.map((flight) => (
                <ellipse key={flight.key} className="rq-rs-ping" cx={flight.x} cy={flight.y} rx="34" ry="17" style={{ ...delay(flight.wait + 0.6), transformOrigin: `${flight.x}px ${flight.y}px` }} />
              ))}
              <ellipse className="rq-rs-pad" cx="200" cy="286.2" rx="31" ry="15.5" />
              <ellipse className="rq-rs-pin-shadow" cx="200" cy="287.2" rx="13" ry="5.5" />
              {FLIGHTS.map((flight) => (
                <path key={flight.key} className="rq-rs-arc" d={flight.path} mask={`url(#rqRsArc${flight.key})`} />
              ))}
              <g className="rq-rs-pin">
                <rect className="rq-rs-trail" x="196.5" y="92" width="7" height="116" rx="3.5" fill="url(#rqRsTrail)" />
                <path d={PIN} fill="url(#rqRsPin)" />
                <path d="M183.5 228a18 18 0 0 1 21-10.5" fill="none" stroke="#FFFFFF" strokeOpacity=".42" strokeWidth="4" strokeLinecap="round" />
                <g clipPath="url(#rqRsPinClip)">
                  <rect className="rq-rs-glint" x="150" y="200" width="15" height="100" fill="#FFFFFF" fillOpacity=".5" />
                </g>
                <circle cx="200" cy="236" r="13" fill="#FFFFFF" />
                <path className="rq-rs-pin-tick" pathLength={100} d="M193.4 236.5L198.3 241.3L207 231.3" />
              </g>
              {BLOCKS.filter((block) => !block.behind).map((block) => (
                <Tower key={block.key} block={block} />
              ))}
            </svg>

            {FLIGHTS.map((flight) => (
              <i key={flight.key} className="rq-rs-head" style={{ ...delay(flight.wait), offsetPath: `path('${flight.path}')` } as CSSProperties} />
            ))}
            {FLIGHTS.map((flight) => (
              <span key={flight.key} className="rq-rs-tpin" style={{ ...delay(flight.wait + 0.58), left: flight.x, top: flight.y }}>
                <span className="rq-rs-tpin-body">{art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name={glyph} />}</span>
              </span>
            ))}
            <i className="rq-rs-tip" ref={tipRef} />
          </div>

          <div className="rq-rs-words">
            <p className="rq-rs-title">
              <span className="rq-rs-word">
                <b>Request</b>
              </span>{" "}
              <span className="rq-rs-word">
                <b>sent</b>
              </span>
            </p>
            <svg className="rq-rs-swash" width="210" height="14" viewBox="0 0 210 14">
              <path pathLength={100} d="M6 9C58 3 140 3 204 8" />
            </svg>
            <p className="rq-rs-next">
              {nextLine}
              <span className="rq-rs-dots">
                <i />
                <i />
                <i />
              </span>
            </p>
          </div>

          {card ? (
            <div className="rq-rs-card" data-testid="request-sent-card">
              <span className="rq-rs-thumb">
                <img src={card.art} alt="" draggable={false} />
              </span>
              <span className="rq-rs-card-text">
                <b>{card.title}</b>
                <span>{card.line}</span>
              </span>
              {card.fare ? <span className="rq-rs-fare">{card.fare}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
