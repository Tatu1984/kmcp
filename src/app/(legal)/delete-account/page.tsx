import * as React from "react";
import type { Metadata } from "next";

import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: { absolute: "Delete your account · Smart Parking" },
  description:
    "Delete your Smart Parking account and the personal data linked to it, without installing the app.",
};

const CONTACT = "infinititechpartners@gmail.com";

/**
 * Account deletion on the web — the link the Play Console's Data safety form
 * asks for, so somebody who has already uninstalled the app can still leave.
 *
 * It does the same thing as Account → Delete my account in the app: proves the
 * person owns the address with an emailed code, then calls the same
 * `DELETE /privacy/account`. One erase path, so the web and the app cannot
 * disagree about what deleting means.
 */
export default function DeleteAccountPage() {
  return (
    <article className="space-y-8 text-[15px] leading-7 text-foreground/90">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-sm font-medium tracking-wide text-primary">Smart Parking</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Delete your account
        </h1>
        <p>
          Enter the email address you sign in to Smart Parking with. We email you a six-digit code
          to confirm it is yours, and then delete the account straight away. You can also do this
          in the app, under <strong>Account → Delete my account</strong>.
        </p>
      </header>

      <DeleteAccountForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">What is deleted, and what is kept</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Deleted:</strong> your email address, name, vehicles and number plates, sign-in
            history and devices. You are signed out on every phone.
          </li>
          <li>
            <strong>Kept, without your identity:</strong> past parking sessions and payments. The
            law requires us to keep financial records, so we keep them with everything that
            identifies you removed.
          </li>
          <li>
            Photographs and location data are deleted on the schedule in our{" "}
            <a className="text-primary underline underline-offset-4" href="/privacy#retention">
              privacy policy
            </a>
            , if they have not been already.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          SP Vendor attendants, or anyone who cannot receive email at their address: write to{" "}
          <a className="text-primary underline underline-offset-4" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          with the subject &ldquo;Delete my account&rdquo; and we will delete it within 30 days.
        </p>
      </section>
    </article>
  );
}
