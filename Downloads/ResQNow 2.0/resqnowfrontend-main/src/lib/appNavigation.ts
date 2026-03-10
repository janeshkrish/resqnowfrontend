export const APP_NAVIGATE_EVENT = "resqnow:navigate";

type AppNavigateDetail = {
  path: string;
  replace?: boolean;
  state?: unknown;
};

export const navigateWithinApp = (
  path: string,
  options: { replace?: boolean; state?: unknown } = {}
) => {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath || typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<AppNavigateDetail>(APP_NAVIGATE_EVENT, {
      detail: {
        path: normalizedPath,
        replace: options.replace,
        state: options.state,
      },
    })
  );
};
