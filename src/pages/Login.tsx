import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import type { ConfirmationResult, User } from "firebase/auth";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { GoogleMark } from "@/components/auth/ClientAuthShell";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { apiUrl } from "@/lib/api";
import {
  NAME_MAX_LENGTH,
  PHONE_CODE_LENGTH,
  RESEND_AFTER_SECONDS,
  cleanName,
  codeDigits,
  formatCountdown,
  formatIndianMobile,
  isIndianMobile,
  isWrongCode,
  nextMobileDigits,
  phoneLoginMessage,
  toE164,
} from "@/lib/phoneLogin";

type PhoneAuthModule = typeof import("@/lib/firebasePhoneAuth");
type Step = "phone" | "code" | "name";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isFirebaseError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  return code.startsWith("auth/") || code.startsWith("phone-login/");
}

function errorText(error: unknown, fallback: string) {
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/** One way in for customers: the mobile number and an SMS code, with Google and email kept. */
const Login = () => {
  const { login, loginWithPhone } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMounted = useRef(true);

  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<Step>("phone");
  const [banner, setBanner] = useState<string | null>(null);

  // The number
  const [digits, setDigits] = useState("");
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // The code
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [wrongCode, setWrongCode] = useState(false);
  const [serverFailed, setServerFailed] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);

  // The name, the first time only
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Email and password, for accounts made that way
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const loginController = useRef<AbortController | null>(null);

  const [googleBusy, setGoogleBusy] = useState(false);

  const phoneAuthRef = useRef<Promise<PhoneAuthModule> | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const firebaseUserRef = useRef<User | null>(null);
  const captchaBoxRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const loadPhoneAuth = useCallback(() => {
    if (!phoneAuthRef.current) {
      phoneAuthRef.current = import("@/lib/firebasePhoneAuth").catch((error) => {
        phoneAuthRef.current = null;
        throw error;
      });
    }
    return phoneAuthRef.current;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    // Fetch the Firebase part early, so Get code answers at once.
    void loadPhoneAuth().catch(() => undefined);
    return () => {
      isMounted.current = false;
      loginController.current?.abort();
      phoneAuthRef.current?.then((phoneAuth) => phoneAuth.resetPhoneVerifier()).catch(() => undefined);
    };
  }, [loadPhoneAuth]);

  // Google's old callback, email confirmation links and Google errors arrive in the address.
  useEffect(() => {
    const confirmed = searchParams.get("confirmed");
    const err = searchParams.get("error");
    const token = searchParams.get("token");
    const userDataStr = searchParams.get("user");

    if (token && userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        localStorage.setItem("resqnow_user_token", token);
        localStorage.setItem("resqnow_user_profile", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");

        toast.success("Logged in with Google successfully!");

        const returnUrl = sessionStorage.getItem("returnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("returnUrl");
          window.location.href = returnUrl;
        } else {
          window.location.href = "/";
        }
        return;
      } catch (parseError) {
        console.error("Failed to parse user data from url", parseError);
        toast.error("Login failed: Invalid data");
      }
    }

    if (confirmed === "1") {
      toast.success("Email confirmed. You can log in now.");
      setSearchParams({}, { replace: true });
    } else if (confirmed === "already") {
      toast.success("Email was already confirmed. You can log in.");
      setSearchParams({}, { replace: true });
    } else if (err === "invalid_token") {
      setBanner("Invalid or expired confirmation link. Please request a new one or try logging in.");
      setSearchParams({}, { replace: true });
    } else if (err === "confirm_failed") {
      setBanner("Confirmation failed. Please try again or contact support.");
      setSearchParams({}, { replace: true });
    } else if (
      err === "google_auth_failed" ||
      err === "google_token_error" ||
      err === "google_callback_exception"
    ) {
      setBanner("Google login did not work. Please try again.");
      setSearchParams({}, { replace: true });
    } else if (err === "server_config") {
      setBanner("Server configuration error. Please contact admin.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // The resend countdown runs only while the code is on screen.
  useEffect(() => {
    if (step !== "code") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  // Each step puts the cursor where the customer types next.
  useEffect(() => {
    const target = mode === "email" ? emailInputRef : step === "code" ? codeInputRef : step === "name" ? nameInputRef : null;
    target?.current?.focus();
  }, [mode, step]);

  const finish = () => {
    const isProfileLogin = searchParams.get("from") === "profile";
    const returnUrl = sessionStorage.getItem("returnUrl");
    sessionStorage.removeItem("returnUrl");
    navigate(!isProfileLogin && returnUrl ? returnUrl : "/");
  };

  const sendCode = async (again = false) => {
    if (!isIndianMobile(digits) || sending) return;
    const box = captchaBoxRef.current;
    if (!box) return;
    setSending(true);
    setPhoneError(null);
    setCodeError(null);
    setWrongCode(false);
    setServerFailed(false);
    setResent(false);
    try {
      const phoneAuth = await loadPhoneAuth();
      confirmationRef.current = await phoneAuth.sendPhoneCode(toE164(digits), box);
      firebaseUserRef.current = null;
      if (!isMounted.current) return;
      setCode("");
      setStep("code");
      setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
      setNow(Date.now());
      setResent(again);
      if (again) codeInputRef.current?.focus();
    } catch (error) {
      console.error("[Phone login] Could not send the code:", error);
      if (!isMounted.current) return;
      const message = phoneLoginMessage(error, "send");
      if (again) setCodeError(message);
      else setPhoneError(message);
    } finally {
      if (isMounted.current) setSending(false);
    }
  };

  const checkCode = async (value: string) => {
    const confirmation = confirmationRef.current;
    if (!confirmation || checking || value.length !== PHONE_CODE_LENGTH) return;
    setChecking(true);
    setCodeError(null);
    setWrongCode(false);
    setServerFailed(false);
    setResent(false);
    try {
      const phoneAuth = await loadPhoneAuth();
      if (!firebaseUserRef.current) {
        firebaseUserRef.current = await phoneAuth.confirmPhoneCode(confirmation, value);
      }
      const idToken = await firebaseUserRef.current.getIdToken();
      const outcome = await loginWithPhone(idToken);
      if (!isMounted.current) return;
      if (outcome.needsName) {
        setStep("name");
        return;
      }
      await phoneAuth.endFirebasePhoneSession();
      toast.success("Login successful!");
      finish();
    } catch (error) {
      console.error("[Phone login] Could not check the code:", error);
      if (!isMounted.current) return;
      if (isFirebaseError(error)) {
        setCodeError(phoneLoginMessage(error, "confirm"));
        setWrongCode(isWrongCode(error));
      } else {
        // Firebase accepted the code; our server did not answer. Trying again needs no new code.
        setCodeError(errorText(error, "Login failed. Please try again."));
        setServerFailed(true);
      }
    } finally {
      if (isMounted.current) setChecking(false);
    }
  };

  const changeNumber = () => {
    confirmationRef.current = null;
    firebaseUserRef.current = null;
    setStep("phone");
    setCode("");
    setCodeError(null);
    setWrongCode(false);
    setServerFailed(false);
    setResent(false);
    window.setTimeout(() => phoneInputRef.current?.focus(), 0);
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) {
      setNameError("Please type your name.");
      nameInputRef.current?.focus();
      return;
    }
    const firebaseUser = firebaseUserRef.current;
    if (!firebaseUser) {
      changeNumber();
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      await loginWithPhone(idToken, clean);
      const phoneAuth = await loadPhoneAuth();
      await phoneAuth.endFirebasePhoneSession();
      toast.success(`Welcome to ResQNow, ${clean.split(" ")[0]}!`);
      finish();
    } catch (error) {
      console.error("[Phone login] Could not save the name:", error);
      if (isMounted.current) setNameError(errorText(error, "Could not save your name. Please try again."));
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const emailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (emailBusy) return;
    const cleanEmail = email.trim();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setEmailError("Password must be at least 6 characters.");
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    const controller = new AbortController();
    loginController.current = controller;
    try {
      const result = await login(cleanEmail, password, { signal: controller.signal });
      if (result.user) {
        const role = String(result?.role || result?.user?.role || "").trim().toLowerCase();
        if (role === "admin") {
          toast.success("Admin login successful!");
          navigate("/admin/dashboard");
          return;
        }
        toast.success("Login successful!");
        finish();
      }
    } catch (submitError) {
      if ((submitError as { name?: unknown })?.name === "AbortError") return;
      console.error("Login error:", submitError);
      if (!isMounted.current) return;
      const message = errorText(submitError, "Invalid email or password");
      if (
        message.includes("Email not confirmed") ||
        message.includes("email_not_confirmed") ||
        message.includes("confirm your email")
      ) {
        setEmailError("Please confirm your email before logging in. Check your inbox for the confirmation link.");
      } else {
        setEmailError(message);
      }
    } finally {
      loginController.current = null;
      if (isMounted.current) setEmailBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!isMounted.current) return;
      setGoogleBusy(true);

      const isNative = Capacitor.isNativePlatform();
      const endpoint = isNative ? "/api/auth/google/url?platform=capacitor" : "/api/auth/google/url";

      const response = await fetch(apiUrl(endpoint));
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to initialize Google Login");
      }
    } catch (googleError) {
      console.error("Google Login Error:", googleError);
      if (isMounted.current) {
        toast.error("Something went wrong with Google Login");
      }
    } finally {
      if (isMounted.current) {
        setGoogleBusy(false);
      }
    }
  };

  const numberReady = isIndianMobile(digits);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const shortArt = mode === "email" || step !== "phone";
  const showPhone = mode === "phone" && step === "phone";
  const showCode = mode === "phone" && step === "code";
  const showName = mode === "phone" && step === "name";

  return (
    <div className="lg" data-testid="customer-login">
      <div className={`lg-art${shortArt ? " is-short" : ""}`}>
        <div className="lg-art-in">
          <Link to="/" className="lg-logo" aria-label="ResQNow home">
            <img src="/images/resqnow-wordmark.png" alt="ResQNow" draggable={false} />
          </Link>
          <div className="lg-hello">
            <h1>Roadside help,<br />wherever you are.</h1>
            <p>Towing, tyres, batteries, fuel and more.</p>
          </div>
          <img className="lg-pic" src="/images/login/customer.webp" alt="" draggable={false} />
        </div>
      </div>

      <main className="lg-panel">
        <div className="lg-panel-in">
          {banner ? (
            <p className="lg-banner" role="alert">
              <MaterialSymbol name="error" />
              <span>{banner}</span>
            </p>
          ) : null}

          {showPhone ? (
            <form
              className="lg-step"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
            >
              <h2 className="lg-rule">Log in or sign up</h2>
              <label className={`lg-field lg-phone${digits ? " has-value" : ""}${phoneError ? " is-bad" : ""}`}>
                <span className="lg-cc">+91</span>
                <span className="lg-fill">
                  <span className="lg-label">Mobile number</span>
                  <input
                    ref={phoneInputRef}
                    aria-label="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={formatIndianMobile(digits)}
                    onChange={(event) => {
                      setDigits((previous) => nextMobileDigits(previous, event.target.value));
                      setPhoneError(null);
                    }}
                    aria-invalid={phoneError ? true : undefined}
                    disabled={sending}
                  />
                </span>
              </label>
              {phoneError ? (
                <p className="lg-note" role="alert">
                  <MaterialSymbol name="error" />
                  {phoneError}
                </p>
              ) : null}
              <button
                type="submit"
                className={`lg-go${numberReady ? "" : " is-off"}${sending ? " is-busy" : ""}`}
                disabled={!numberReady || sending}
              >
                {sending ? (
                  <>
                    <i aria-hidden="true" />
                    Sending code…
                  </>
                ) : (
                  "Get code"
                )}
              </button>
              <div className="lg-or">or</div>
              <button type="button" className="lg-google" onClick={handleGoogleLogin} disabled={googleBusy}>
                <GoogleMark />
                Continue with Google
              </button>
              <p className="lg-alt">
                <button
                  type="button"
                  className="lg-quiet"
                  onClick={() => {
                    setMode("email");
                    setBanner(null);
                  }}
                >
                  Use email and password
                </button>
              </p>
              <p className="lg-legal">
                By continuing, you agree to our <Link to="/terms-of-service">Terms of Service</Link> and{" "}
                <Link to="/privacy-policy">Privacy Policy</Link>.
              </p>
            </form>
          ) : null}

          {showCode ? (
            <div className="lg-step">
              <div className="lg-sent">
                <div>
                  <h2>Enter the 6-digit code</h2>
                  <span>Sent by SMS to +91 {formatIndianMobile(digits)}</span>
                </div>
                <button type="button" className="lg-chip" onClick={changeNumber} disabled={checking}>
                  <MaterialSymbol name="edit" />
                  Change
                </button>
              </div>
              <div className={`lg-code${wrongCode ? " is-bad" : ""}`}>
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={PHONE_CODE_LENGTH}
                  value={code}
                  readOnly={checking}
                  aria-label="6-digit code"
                  aria-invalid={wrongCode ? true : undefined}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  onChange={(event) => {
                    const next = codeDigits(event.target.value);
                    setCode(next);
                    setWrongCode(false);
                    setCodeError(null);
                    setServerFailed(false);
                    if (next.length === PHONE_CODE_LENGTH) void checkCode(next);
                  }}
                />
                <div className="lg-boxes" aria-hidden="true">
                  {Array.from({ length: PHONE_CODE_LENGTH }, (_, index) => (
                    <span
                      key={index}
                      className={codeFocused && !checking && !wrongCode && index === code.length ? "is-now" : undefined}
                    >
                      {code[index] || ""}
                    </span>
                  ))}
                </div>
              </div>
              {codeError ? (
                <p className="lg-note" role="alert">
                  <MaterialSymbol name="error" />
                  <span>
                    {codeError}
                    {serverFailed ? (
                      <>
                        {" "}
                        <button type="button" className="lg-inline" onClick={() => void checkCode(code)}>
                          Try again
                        </button>
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}
              {checking ? (
                <p className="lg-wait" role="status">
                  <i aria-hidden="true" />
                  Checking the code…
                </p>
              ) : null}
              {resent && !codeError && !checking ? (
                <p className="lg-sentok" role="status">
                  <MaterialSymbol name="check_circle" />
                  New code sent
                </p>
              ) : null}
              {sending ? (
                <p className="lg-resend" role="status">Sending a new code…</p>
              ) : secondsLeft > 0 ? (
                <p className="lg-resend">
                  Resend code in <b>{formatCountdown(secondsLeft)}</b>
                </p>
              ) : (
                <p className="lg-resend">
                  Didn’t get it?{" "}
                  <button type="button" className="lg-inline" onClick={() => void sendCode(true)} disabled={checking}>
                    Resend code
                  </button>
                </p>
              )}
            </div>
          ) : null}

          {showName ? (
            <form className="lg-step" noValidate onSubmit={saveName}>
              <div className="lg-sent">
                <div>
                  <h2>What should we call you?</h2>
                  <span>Your technician sees this name. Asked only once.</span>
                </div>
                <span className="lg-done">
                  <MaterialSymbol name="check_circle" />
                  Verified
                </span>
              </div>
              <label className={`lg-field${name ? " has-value" : ""}${nameError ? " is-bad" : ""}`}>
                <span className="lg-fill">
                  <span className="lg-label">Your name</span>
                  <input
                    ref={nameInputRef}
                    aria-label="Your name"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    maxLength={NAME_MAX_LENGTH}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setNameError(null);
                    }}
                    aria-invalid={nameError ? true : undefined}
                    disabled={saving}
                  />
                </span>
              </label>
              {nameError ? (
                <p className="lg-note" role="alert">
                  <MaterialSymbol name="error" />
                  {nameError}
                </p>
              ) : null}
              <button type="submit" className={`lg-go${saving ? " is-busy" : ""}`} disabled={saving}>
                {saving ? (
                  <>
                    <i aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          ) : null}

          {mode === "email" ? (
            <form className="lg-step" noValidate onSubmit={emailLogin}>
              <div className="lg-sent">
                <div>
                  <h2>Log in with email</h2>
                  <span>For accounts made with an email and password.</span>
                </div>
                <button
                  type="button"
                  className="lg-chip"
                  onClick={() => {
                    setMode("phone");
                    setEmailError(null);
                  }}
                >
                  <MaterialSymbol name="phone_iphone" />
                  Use mobile
                </button>
              </div>
              <label className={`lg-field${email ? " has-value" : ""}${emailError ? " is-bad" : ""}`}>
                <span className="lg-fill">
                  <span className="lg-label">Email address</span>
                  <input
                    ref={emailInputRef}
                    aria-label="Email address"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError(null);
                    }}
                    disabled={emailBusy}
                  />
                </span>
              </label>
              <label className={`lg-field${password ? " has-value" : ""}${emailError ? " is-bad" : ""}`}>
                <span className="lg-fill">
                  <span className="lg-label">Password</span>
                  <input
                    aria-label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setEmailError(null);
                    }}
                    disabled={emailBusy}
                  />
                </span>
                <button
                  type="button"
                  className="lg-show"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </label>
              {emailError ? (
                <p className="lg-note" role="alert">
                  <MaterialSymbol name="error" />
                  {emailError}
                </p>
              ) : null}
              <button type="submit" className={`lg-go${emailBusy ? " is-busy" : ""}`} disabled={emailBusy}>
                {emailBusy ? (
                  <>
                    <i aria-hidden="true" />
                    Logging in…
                  </>
                ) : (
                  "Log in"
                )}
              </button>
              <p className="lg-alt">
                <Link to="/forgot-password" className="lg-link">
                  Forgot password?
                </Link>
              </p>
              <p className="lg-alt is-small">
                New to ResQNow?{" "}
                <button type="button" className="lg-link" onClick={() => setMode("phone")}>
                  Sign up with your mobile number
                </button>
              </p>
            </form>
          ) : null}

          {/* Google's invisible check before an SMS is sent. Its floating badge is hidden, so it is named here. */}
          <div ref={captchaBoxRef} className="lg-captcha" />
          {mode === "phone" && step !== "name" ? (
            <p className="lg-legal is-small">
              Protected by reCAPTCHA. Google’s{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms</a> apply.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Login;
