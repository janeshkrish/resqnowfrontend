import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import MaterialSymbol from "./MaterialSymbol";
import msmeLogo from "../../../assets/msme-logo.png";

type PublicStats = {
  technicians: number;
  incidents: number;
  completedServices: number;
  generatedAt: string;
};

const REFRESH_MS = 30_000;
const COUNT_UP_MS = 1200;

async function fetchPublicStats(signal?: AbortSignal): Promise<PublicStats> {
  const response = await apiFetch("/api/public/stats", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
  const data = await response.json();
  const count = (value: unknown) => Math.max(0, Math.trunc(Number(value) || 0));
  return {
    technicians: count(data.technicians),
    incidents: count(data.incidents ?? data.completedServices),
    completedServices: count(data.completedServices ?? data.incidents),
    generatedAt: String(data.generatedAt || ""),
  };
}

/** Counts up from 0 the first time a value arrives, then shows later values directly. */
function useCountUp(target: number | undefined) {
  const [shown, setShown] = useState(target ?? 0);
  const animated = useRef(false);

  useEffect(() => {
    if (target == null) return undefined;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (animated.current || reduced) {
      setShown(target);
      return undefined;
    }
    animated.current = true;
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / COUNT_UP_MS);
      setShown(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

function StatTile({ icon, value, label }: { icon: string; value: number | undefined; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className="rq-h-stat">
      <span className="rq-h-stat-ic">
        <MaterialSymbol name={icon} />
      </span>
      <div className="rq-h-stat-copy">
        <strong>{value == null ? "—" : shown.toLocaleString("en-IN")}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function LiveNetwork() {
  const { data, isError } = useQuery({
    queryKey: ["home", "public-stats"],
    queryFn: ({ signal }) => fetchPublicStats(signal),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  return (
    <section className="rq-h-section" aria-labelledby="rq-h-network-title">
      <div className="rq-h-head">
        <div>
          <h2 id="rq-h-network-title" className="rq-h-title">ResQNow right now</h2>
          <span className="rq-h-sub">Live numbers from our network</span>
        </div>
        {data && !isError ? (
          <span className="rq-h-live">
            <span aria-hidden="true" className="rq-h-live-dot" />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="rq-h-stats">
        <StatTile icon="task_alt" value={data?.completedServices} label="Services completed" />
        <StatTile icon="engineering" value={data?.technicians} label="Verified partners" />
        <StatTile icon="support_agent" value={data?.incidents} label="Requests handled" />
      </div>
      <div className="rq-h-msme">
        <span className="rq-h-msme-logo">
          <img src={msmeLogo} alt="MSME" />
        </span>
        <span className="rq-h-msme-copy">
          <span className="rq-h-msme-title">MSME certified startup</span>
          <span className="rq-h-msme-text">Recognised by the Government of India</span>
        </span>
        <MaterialSymbol name="verified" className="rq-h-msme-check" />
      </div>
    </section>
  );
}
