import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import { useWakeEnabled } from "@/hooks/useVoiceEnabled";
import { listenForWakeWord, listensHere, onWakeWordChange, stopSpotter, wakeWordOn } from "@/lib/voice/wake";
import "./hey.css";

const visibleNow = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * "Hey ResQNow" anywhere in the customer's app opens ResQNow-Thozhan. It listens only while the app
 * is on screen, on the customer's pages, once they've turned it on; a small badge shows whenever it
 * is listening, and tapping it leads to the switch.
 */
export default function HeyResQNow() {
  const voiceOn = useWakeEnabled();
  const [on, setOn] = useState(wakeWordOn);
  const [state, setState] = useState<"starting" | "listening" | "blocked" | "unavailable">("starting");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = voiceOn && on && listensHere(pathname);

  useEffect(() => onWakeWordChange((next) => { setOn(next); if (!next) stopSpotter(); }), []);
  useEffect(() => {
    setState("starting");
    if (!active) return;
    let session: AbortController | undefined;
    const pause = () => {
      session?.abort();
      session = undefined;
      setState("starting");
    };
    const syncVisibility = () => {
      if (!visibleNow()) { pause(); return; }
      if (session) return;
      const controller = session = new AbortController();
      const failed = (error: Error) => {
        if (controller.signal.aborted) return;
        setState(error.name === "NotAllowedError" || error.name === "SecurityError" ? "blocked" : "unavailable");
      };
      void listenForWakeWord(() => {
        controller.abort();
        navigate("/thozhan?wake=1");
      }, {
        signal: controller.signal,
        onListening: () => setState("listening"),
        onError: failed,
      }).catch(failed);
    };
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", syncVisibility);
    syncVisibility();
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", syncVisibility);
      session?.abort();
    };
  }, [active, navigate]);

  if (!active || state === "starting") return null;
  if (state === "unavailable") return (
    <div className="hey-status">
      <Link to="/thozhan" className="hey-badge is-blocked" aria-label="Wake listening paused. Open Thozhan">
        <MaterialSymbol name="mic_off" /><span>Wake paused · Open Thozhan</span>
      </Link>
    </div>
  );
  const blocked = state === "blocked";
  return (
    <div className="hey-status">
      <Link to="/settings?tab=voice" className={blocked ? "hey-badge is-blocked" : "hey-badge"} aria-label={blocked ? "Hey ResQNow needs the microphone" : "Listening for Hey ResQNow"}>
        <MaterialSymbol name={blocked ? "mic_off" : "mic"} />
        <span>{blocked ? "Allow mic" : "Hey ResQNow"}</span>
      </Link>
      {blocked && <Link to="/thozhan" className="hey-manual">Open Thozhan</Link>}
    </div>
  );
}
