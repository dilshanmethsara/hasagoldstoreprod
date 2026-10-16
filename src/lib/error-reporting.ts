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

const MAX_SERIALIZED_LENGTH = 2000;

// Loaders and server fns throw raw Responses and plain objects (e.g.
// `{ message, code, details }`), which String() reduces to "[object ...]".
export function describeThrown(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const { message } = (error ?? {}) as { message?: unknown };
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(error)?.slice(0, MAX_SERIALIZED_LENGTH) ?? String(error);
  } catch {
    return String(error);
  }
}
