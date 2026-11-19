import * as React from "react";

/**
 * Public legal pages — the privacy policy the app stores link to.
 *
 * Outside both the dashboard and the sign-in layout on purpose: a store
 * reviewer, or anyone deciding whether to install the app, has no account and
 * must be able to read these from any browser. The proxy lists them as public.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">{children}</main>
  );
}
