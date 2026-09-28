import { useEffect, useRef, useState } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

/**
 * Slide the knob to the end to send, so a request never goes out from a stray tap.
 * Keyboard users press Enter or Space on the knob instead.
 */
export default function SlideToSend({
  text, onSend, busy = false, urgent = false,
}: {
  text: string;
  /** Return false when the request can't go yet; the knob slides back. */
  onSend: () => boolean | void;
  busy?: boolean;
  urgent?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<{ x: number; offset: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const maxOffset = () => {
    const track = trackRef.current;
    const knob = knobRef.current;
    if (!track || !knob) return 0;
    return Math.max(0, track.clientWidth - knob.offsetWidth - knob.offsetLeft * 2);
  };

  useEffect(() => {
    if (!busy) setOffset(0);
  }, [busy]);

  const finish = () => {
    setOffset(maxOffset());
    if (onSend() === false) window.setTimeout(() => setOffset(0), 250);
  };

  return (
    <div ref={trackRef} className={cn("rqf-slide", urgent && "sos", busy && "is-busy")}>
      <span className="rqf-slide-t" aria-hidden="true">{busy ? "Sending…" : text}</span>
      <span className="rqf-slide-fill" aria-hidden="true" style={{ width: offset ? offset + 48 : 0 }} />
      <button
        ref={knobRef}
        type="button"
        className={cn("rqf-knob", dragging && "is-dragging")}
        style={{ transform: `translateX(${offset}px)` }}
        aria-label={text}
        disabled={busy}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!busy) finish();
          }
        }}
        onClick={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          startRef.current = { x: event.clientX, offset };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!startRef.current) return;
          const next = Math.min(maxOffset(), Math.max(0, startRef.current.offset + event.clientX - startRef.current.x));
          setOffset(next);
        }}
        onPointerUp={() => {
          if (!startRef.current) return;
          startRef.current = null;
          setDragging(false);
          if (offset >= maxOffset() * 0.85 && maxOffset() > 0) finish();
          else setOffset(0);
        }}
        onPointerCancel={() => {
          startRef.current = null;
          setDragging(false);
          setOffset(0);
        }}
      >
        <MaterialSymbol name={busy ? "progress_activity" : "keyboard_double_arrow_right"} className={busy ? "rqf-spin" : undefined} />
      </button>
    </div>
  );
}
