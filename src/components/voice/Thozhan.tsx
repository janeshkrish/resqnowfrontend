import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./thozhan.css";

export type Mood = "idle" | "listen" | "think" | "curious" | "concern" | "happy";

const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * ResQNow-Thozhan himself: a white ceramic pebble with a navy glass visor and a crimson voice
 * light. The mood changes the eyes, the visor glow and the light; `full` adds the listening
 * ripples, the burst when a request is sent, and the shadow underneath.
 */
export default function Thozhan({ size, mood = "idle", talking = false, burst = false, full = false, className }: {
  size: number; mood?: Mood; talking?: boolean; burst?: boolean; full?: boolean; className?: string;
}) {
  return (
    <span className={cn("thz", `thz-${mood}`, talking && "is-talking", burst && "is-burst", className)} style={{ "--thz": `${size}px` } as CSSProperties} aria-hidden="true">
      <span className="thz-float">
        <span className="thz-aura" />
        {full ? <><span className="thz-ring" /><span className="thz-ring r2" /><span className="thz-ring r3" /></> : null}
        <span className="thz-tilt">
          <span className="thz-body">
            <span className="thz-visor">
              <span className="thz-scan" />
              <span className="thz-face"><i className="thz-brow l" /><i className="thz-brow r" /><i className="thz-eye l" /><i className="thz-eye r" /></span>
              <span className="thz-glare" />
            </span>
            <span className="thz-light" />
            <span className="thz-sheen" />
          </span>
        </span>
        {full ? (
          <span className="thz-burst">
            <i className="thz-wave" /><i className="thz-wave w2" />
            {SPARKS.map((r) => <i key={r} className="thz-spark" style={{ "--r": `${r}deg` } as CSSProperties} />)}
          </span>
        ) : null}
      </span>
      {full ? <span className="thz-shadow" /> : null}
    </span>
  );
}
