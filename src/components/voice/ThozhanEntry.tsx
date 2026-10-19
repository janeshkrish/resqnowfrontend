import { Link } from "react-router-dom";
import { useVoiceEnabled } from "@/hooks/useVoiceEnabled";
import Thozhan from "./Thozhan";

/** The home screen card: "ResQNow-Thozhan · Stuck? Just say what happened." */
export function ThozhanHomeCard() {
  if (!useVoiceEnabled()) return null;
  return (
    <Link to="/thozhan" className="vt-home-card rq-press" aria-label="Talk to ResQNow-Thozhan">
      <span><Thozhan size={54} mood="happy" /></span>
      <span className="vt-home-text">
        <b>ResQNow<span>-Thozhan</span></b>
        <small>Stuck? Just say what happened, in Tamil, English or Tanglish.</small>
      </span>
    </Link>
  );
}

/** In the request form: talk instead of tapping, with the service and vehicle type already known. */
export function ThozhanFormLink({ serviceId, family }: { serviceId: string; family: string }) {
  if (!useVoiceEnabled()) return null;
  return (
    <p className="rqf-note rqf-sec">
      <Link to={`/thozhan?service=${encodeURIComponent(serviceId)}&family=${encodeURIComponent(family)}`} className="vt-form-link">
        <Thozhan size={22} mood="idle" />Prefer to talk? Tell ResQNow-Thozhan
      </Link>
    </p>
  );
}
