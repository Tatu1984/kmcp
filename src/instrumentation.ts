import type { Instrumentation } from "next";

/**
 * Server-side error reporting.
 *
 * `register` runs once per server instance, before the first request; the
 * runtime check is required because the Node and Edge builds of the SDK are
 * different modules and importing the wrong one fails the build. `SENTRY_DSN`
 * is a server variable and never reaches the browser — the browser is
 * initialised separately in `instrumentation-client.ts`, from
 * `NEXT_PUBLIC_SENTRY_DSN`.
 *
 * Both are no-ops with nothing configured.
 */
export async function register(): Promise<void> {
  const { initSentry } = await import("@/observability/sentry");
  initSentry(process.env.SENTRY_DSN);
}

/**
 * Errors Next.js caught on the server: a route handler that threw, a server
 * component that failed to render.
 *
 * The correlation id comes off the request headers rather than being generated
 * here, because `src/proxy.ts` has already stamped one on every request that
 * reaches this app. Reading it back means a portal-side failure and the API
 * call that provoked it carry the same id, which is the only way to line the
 * two up afterwards.
 *
 * `captureRequestError` is Sentry's own handler for this hook — it knows how to
 * unwrap a React digest back into the error that was actually thrown. Wrapping
 * it in a scope is what adds the tag.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const Sentry = await import("@sentry/nextjs");

  const header = request.headers["x-request-id"];
  const requestId = Array.isArray(header) ? header[0] : header;

  await Sentry.withScope(async (scope) => {
    if (requestId) scope.setTag("request_id", requestId);
    scope.setTag("route_type", context.routeType);
    await Sentry.captureRequestError(err, request, context);
  });
};
