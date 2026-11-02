const LINK_PATH = /^(?:\/technician)?\/(?:reset-password|verify-recovery-email)\/?$/;
let captured: { path: string; token: string } | null = null;

// Called before React/telemetry starts; secrets never enter persistent storage.
export function captureRecoveryLink() {
  if (!LINK_PATH.test(window.location.pathname) || !window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('token') || '';
  captured = { path: window.location.pathname, token: /^[a-f0-9]{64}$/.test(token) ? token : '' };
  window.history.replaceState(window.history.state, '', window.location.pathname);
}

export function getRecoveryToken() {
  captureRecoveryLink();
  return captured?.path === window.location.pathname ? captured.token : '';
}

export function clearRecoveryToken() { captured = null; }
