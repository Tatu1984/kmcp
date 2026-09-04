import * as Sentry from "@sentry/nextjs";
import { clientEnv } from "@/config/env";
import { initSentry } from "@/observability/sentry";

/**
 * Browser-side error reporting, started before React hydrates so a crash during
 * the first render is still caught.
 *
 * This file runs on every page load whether or not a DSN is configured;
 * `initSentry` returns immediately when there is none, which is what keeps the
 * demo build — no backend, no Sentry account — working unchanged.
 */
initSentry(clientEnv.NEXT_PUBLIC_SENTRY_DSN);

/**
 * Leaves a breadcrumb for each client-side navigation, so a report says which
 * screen the officer was on when it happened.
 *
 * `onRouterTransitionStart` is the App Router's only hook for this — the SDK
 * cannot observe a soft navigation on its own, and without it every report from
 * a session after the first page load looks like it happened on the landing
 * page. Sentry's own `captureRouterTransitionStart` is not used because it
 * opens a navigation *span*, and tracing is deliberately off.
 *
 * The URL is passed through unmodified: `beforeBreadcrumb` runs `scrubBreadcrumb`
 * over it, which redacts `data.to` — a portal URL routinely carries a search
 * term, and a search term here is routinely a registration number.
 */
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  Sentry.addBreadcrumb({
    category: "navigation",
    type: "navigation",
    level: "info",
    data: { to: url, navigationType },
  });
}
