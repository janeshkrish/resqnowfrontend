import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import { useVoiceEnabled } from "@/hooks/useVoiceEnabled";
import { listenForWakeWord, listensHere, onWakeWordChange, stopSpotter, wakeWordOn } from "@/lib/voice/wake";
import "./hey.css";

const visibleNow = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * "Hey ResQNow" anywhere in the customer's app opens ResQNow-Thozhan. It listens only while the app
 * is on screen, on the customer's pages, once they've turned it on; a small badge shows whenever it
 * is listening, and tapping it leads to the switch.
 */
export default function HeyResQNow() {
  const voiceOn = useVoiceEnabled();
  const [on, setOn] = useState(wakeWordOn);
  const [visible, setVisible] = useState(visibleNow);
  const [state, setState] = useState<"starting" | "listening" | "blocked">("starting");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = voiceOn && on && visible && listensHere(pathname);

  useEffect(() => onWakeWordChange((next) => { setOn(next); if (!next) stopSpotter(); }), []);
  useEffect(() => {
    const seen = () => setVisible(visibleNow());
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, []);

  useEffect(() => {
    if (!active) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    setState("starting");
    listenForWakeWord(() => navigate("/thozhan?wake=1"))
      .then((listening) => {
        if (cancelled) listening.stop();
        else { stop = listening.stop; setState("listening"); }
      })
      .catch((error: { name?: string }) => {
        if (!cancelled) setState(error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "blocked" : "starting");
      });
    // Leaving the page, hiding the app or opening Thozhan lets go of the microphone at once.
    return () => { cancelled = true; stop?.(); };
  }, [active, navigate]);

  if (!active || state === "starting") return null;
  const blocked = state === "blocked";
  return (
    <Link to="/settings?tab=voice" className={blocked ? "hey-badge is-blocked" : "hey-badge"} aria-label={blocked ? "Hey ResQNow needs the microphone" : "Listening for Hey ResQNow"}>
      <MaterialSymbol name={blocked ? "mic_off" : "mic"} />
      <span>{blocked ? "Allow mic" : "Hey ResQNow"}</span>
    </Link>
  );
}
