type ErrorReporterOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type ErrorReporter = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ErrorReporterOptions,
  ) => void;
};

declare global {
  interface Window {
    // Optional host-app hook (e.g. an error-monitoring SDK). When absent, errors
    // are only logged to the console via the error boundary.
    __errorReporter?: ErrorReporter;
  }
}

/**
 * Forwards a caught error to an optional monitoring hook installed on
 * `window.__errorReporter`. Safe to call in SSR (no-op) and when no reporter is
 * present (no-op).
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__errorReporter?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
