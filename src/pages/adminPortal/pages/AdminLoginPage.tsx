import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { peekAdminPage } from "@/lib/adminSession";
import { Icon } from "../ui";
import "../portal.css";

// The admin sign-in. The account is the one set on the server.

const FACTS: [string, string][] = [["radar", "Every live job on one map, with its alerts"], ["engineering", "Technicians, applications, payouts and complaints"], ["history", "Every change kept in the audit log"]];

export default function AdminLoginPage() {
  const { adminUser, loginAdmin, sessionEnded } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Where to go once signed in: the page that was open when the sign-in ran out, else Today.
  const [nextPage] = useState(() => peekAdminPage());
  if (adminUser) return <Navigate to={nextPage} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) { setError("Write your work email and password."); return; }
    setBusy(true);
    setError("");
    try {
      await loginAdmin(email.trim(), password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-login">
      <div className="li">
        <section className="li-art">
          <img className="li-logo" src="/images/resqnow-wordmark.png" alt="ResQNow" />
          <div className="li-copy">
            <h1 className="pj">Run every rescue from one place.</h1>
            <p>The ResQNow admin portal for the operations, finance and support team.</p>
            <div className="li-facts">{FACTS.map(([icon, text]) => <div key={text}><Icon name={icon} />{text}</div>)}</div>
          </div>
          <img className="li-pic" src="/images/vehicles/truck.webp" alt="" />
          <span className="li-small">resqnow.org/admin · for ResQNow staff only</span>
        </section>
        <form className="li-form" onSubmit={(event) => void submit(event)} aria-label="Admin sign in" noValidate>
          <div><h2 className="pj">Admin sign in</h2></div>
          <p>Use the admin email and password set up for the ResQNow team.</p>
          {sessionEnded && !error ? (
            <div className="ap-note" role="status"><Icon name="schedule" /><span>Your sign-in ended (it lasts a day). Sign in again to carry on where you were.</span></div>
          ) : null}
          <div className="ap-field"><label htmlFor="li-email">Work email</label>
            <span className="ap-input"><Icon name="mail" /><input id="li-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></span></div>
          <div className="ap-field"><label htmlFor="li-pass">Password</label>
            <span className="ap-input"><Icon name="lock" /><input id="li-pass" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="li-eye" aria-label={show ? "Hide the password" : "Show the password"} onClick={() => setShow(!show)}><Icon name={show ? "visibility_off" : "visibility"} /></button></span></div>
          {error ? <div className="ap-note is-bad" role="alert"><Icon name="error" /><span>{error}</span></div> : null}
          <button type="submit" className="ap-btn is-lg is-dark" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <div className="li-help"><Icon name="info" /><span>Forgot the password, or need access? Ask the ResQNow office.</span></div>
        </form>
      </div>
    </div>
  );
}
