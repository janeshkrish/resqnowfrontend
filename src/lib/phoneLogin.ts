// Customer log in with a mobile number: the plain parts that do not need Firebase.

export const PHONE_CODE_LENGTH = 6;
export const RESEND_AFTER_SECONDS = 30;
export const NAME_MAX_LENGTH = 80;

/** The ten digits of an Indian mobile number from whatever was typed or pasted. */
export function parseIndianMobile(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Indian mobile numbers are ten digits and start with 6, 7, 8 or 9. */
export function isIndianMobile(digits: string) {
  return /^[6-9]\d{9}$/.test(digits);
}

/** "98765 43210", as people read it out. */
export function formatIndianMobile(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function toE164(digits: string) {
  return `+91${digits}`;
}

/**
 * The digits after an edit of the formatted field. Deleting the space between the two
 * halves removes the digit before it, so backspace never seems to do nothing.
 */
export function nextMobileDigits(previous: string, raw: string) {
  const digits = parseIndianMobile(raw);
  if (digits === previous && raw.length < formatIndianMobile(previous).length) {
    return previous.slice(0, -1);
  }
  return digits;
}

export function codeDigits(raw: string) {
  return String(raw || "").replace(/\D/g, "").slice(0, PHONE_CODE_LENGTH);
}

/** "0:24" */
export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function cleanName(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export type PhoneLoginStage = "send" | "confirm";

/** What to tell the customer when Firebase says no, in plain words. */
export function phoneLoginMessage(error: unknown, stage: PhoneLoginStage) {
  const code = String((error as { code?: unknown })?.code || "");
  switch (code) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return "Check the mobile number and try again.";
    case "auth/too-many-requests":
    case "auth/quota-exceeded":
      return "Too many tries for now. Please wait a few minutes and try again.";
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
      return "That code is not right. Check the SMS and try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "That code has expired. Ask for a new one below.";
    case "auth/network-request-failed":
    case "auth/timeout":
      return "No internet connection. Check it and try again.";
    case "auth/captcha-check-failed":
    case "auth/invalid-app-credential":
    case "auth/missing-app-credential":
      return "We could not check this device. Please try again.";
    case "phone-login/not-configured":
    case "auth/operation-not-allowed":
    case "auth/billing-not-enabled":
    case "auth/unauthorized-domain":
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    case "auth/configuration-not-found":
      return "Mobile number login is not available right now. Please use Google or email.";
    default:
      return stage === "send"
        ? "We could not send the code. Please try again."
        : "We could not check the code. Please try again.";
  }
}

/** True when the code itself was wrong, so the six boxes turn red. */
export function isWrongCode(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  return code === "auth/invalid-verification-code" || code === "auth/missing-verification-code";
}
