"use client";

import * as React from "react";

import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { clientEnv } from "@/config/env";

type Step = "email" | "code" | "confirm" | "done";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

class RequestFailed extends Error {}

/**
 * Talks to the API directly rather than through the portal's client: that
 * client carries the staff session, and this page belongs to somebody who has
 * none. The token it gets lives only in this component's state — never stored —
 * and is used for exactly one request.
 */
async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const base = clientEnv.NEXT_PUBLIC_API_URL;
  if (!base) throw new RequestFailed("Account deletion is not available on this server.");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
    });
  } catch {
    throw new RequestFailed("Could not reach the server. Check your connection and try again.");
  }

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body?.success) {
    throw new RequestFailed(body?.error?.message ?? "Something went wrong. Try again.");
  }
  return body.data as T;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DeleteAccountForm() {
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  // The server refuses a second code inside thirty seconds; count it down
  // rather than let a button fail for reasons nothing on screen explains.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const normalised = email.trim().toLowerCase();

  const sendCode = () =>
    run(async () => {
      await call("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: normalised }),
      });
      setCode("");
      setCooldown(30);
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      const result = await call<{ tokens?: { accessToken: string } }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: normalised, code }),
      });
      if (!result.tokens?.accessToken) throw new RequestFailed("That code did not work. Try again.");
      setToken(result.tokens.accessToken);
      setStep("confirm");
    });

  const erase = () =>
    run(async () => {
      if (!token) throw new RequestFailed("Your confirmation expired. Start again.");
      await call("/privacy/account", { method: "DELETE", token });
      setToken(null);
      setStep("done");
    });

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (EMAIL.test(normalised) && !busy) void sendCode();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Email address</span>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              disabled={busy}
              required
            />
          </label>
          <Button type="submit" disabled={busy || !EMAIL.test(normalised)}>
            {busy ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (/^\d{6}$/.test(code) && !busy) void verify();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Six-digit code</span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={busy}
              className="max-w-48 text-center text-lg tracking-[0.4em]"
              autoFocus
            />
            <span className="block text-sm text-muted-foreground">
              Sent to {normalised}. Check your spam folder if it is not in your inbox.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !/^\d{6}$/.test(code)}>
              {busy ? "Checking…" : "Continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || cooldown > 0}
              onClick={() => void sendCode()}
            >
              {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the code again"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setError(null);
              }}
            >
              Different email
            </Button>
          </div>
        </form>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-4">
          <p className="font-medium text-foreground">
            Delete the Smart Parking account for {normalised}?
          </p>
          <p className="text-sm text-muted-foreground">
            This cannot be undone. Your personal data is deleted and you are signed out on every
            phone. Past parking sessions and payments are kept as tax records, without anything that
            identifies you.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void erase()}>
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setToken(null);
                setStep("email");
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Your account has been deleted.</p>
          <p className="text-sm text-muted-foreground">
            Your personal data has been removed. If you use Smart Parking again, signing in creates a
            new, empty account.
          </p>
        </div>
      ) : null}
    </section>
  );
}
