// utility to install global error handlers for unhandled promises and errors

export function setupGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    // could report to analytics backend here
  });

  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error || event.message, "at", event.filename, event.lineno, event.colno);
    // swallow to avoid crash
  });
}
