"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import { Separator } from "@/frontend/components/ui/separator";
import { authApi, ApiError } from "@/frontend/api";
import { startSession, toSessionUser } from "@/frontend/lib/session";
import { isLiveApi } from "@/config/env";
import { ROUTES, landingFor } from "@/shared/constants/routes";

/**
 * The three operators `prisma/data/vendors.json` seeds, with the password the
 * backend's seed gives every demonstration account. Keep this list in step with
 * that file, as the KMC screen's list is kept in step with the staff seed.
 *
 * Worth all three rather than one: they are not interchangeable. Metro Kerb
 * runs four zones and has a settlement in every state, Orbit is a smaller
 * operation, and Civic Mobility is still awaiting KMC's approval — which is the
 * one an operator signing in for the first time will actually recognise, and
 * the only way to see what this portal looks like on day one.
 */
const DEMO_PASSWORD = "kmcp-demo-2026";

const DEMO_OPERATORS = [
  {
    org: "Metro Kerb Management",
    email: "ops@metrokerb.in",
    hint: "Four zones, settlements in every state",
  },
  {
    org: "Orbit Parking Services",
    email: "ops@orbitparking.in",
    hint: "Three zones, a smaller operation",
  },
  {
    org: "Civic Mobility Contractors",
    email: "ops@civicmobility.in",
    hint: "Approval still pending — nothing to show yet",
  },
];

/**
 * Sign-in for an operator, at a link of their own.
 *
 * A vendor is sent parking.<host>/vendor and never has cause to see the
 * authority's console. The KMC screen asks for "the work email address issued
 * to you by the authority" and lists KMC's own demo accounts underneath, which
 * is the right greeting for a zone officer and the wrong one for a contractor
 * — it reads like a door they have walked through by mistake.
 *
 * Nothing about the authentication differs. Same endpoint, same tokens, same
 * two-factor challenge if the account carries one. Only the wording, and where
 * they land afterwards.
 */
export function VendorLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = React.useState(DEMO_OPERATORS[0].email);
  const [password, setPassword] = React.useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Enter the email address your organisation was registered with.");
      return;
    }
    if (password.length < 6) {
      setError("Your password is at least 6 characters. Check and try again.");
      return;
    }

    setBusy(true);

    if (!isLiveApi) {
      await new Promise((r) => setTimeout(r, 500));
      setBusy(false);
      setError(
        "This build has no API to sign in against. It is the demonstration portal, which " +
          "carries KMC's sample data and no operator accounts.",
      );
      return;
    }

    try {
      const result = await authApi.login(email, password);

      // An operator account can carry two-factor like any other. The challenge
      // screen is shared; `next` carries them back here afterwards.
      if (result.status === "two_factor_required" && result.challengeId) {
        toast.success("Password accepted", {
          description: "Enter the 6-digit code from your authenticator.",
        });
        router.push(
          `${ROUTES.twoFactor}?next=${encodeURIComponent(next ?? ROUTES.vendorPortal)}` +
            `&email=${encodeURIComponent(email)}` +
            `&challenge=${encodeURIComponent(result.challengeId)}`,
        );
        return;
      }

      if (result.user) {
        const user = toSessionUser(result.user);
        startSession(user, remember);

        /**
         * A KMC account signing in here is not an error — the credentials are
         * valid and the API accepted them. They are simply not an operator, so
         * they go where they belong rather than into a portal that would show
         * them nothing but a polite refusal.
         */
        router.push(next || landingFor(user.role));
        return;
      }

      setError("Signed in, but the server sent no account details. Try again.");
      setBusy(false);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not reach the sign-in service. Check your connection and try again.",
      );
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Building2 className="size-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-widest">KMCP</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Operator sign-in</h1>
        <p className="text-sm text-muted-foreground">
          For companies contracted by the Kolkata Municipal Corporation to run parking. Your
          zones, your staff and your settlements.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcompany.in"
            disabled={busy}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              disabled={busy}
            />
            Keep me signed in
          </label>
          <Link
            href={ROUTES.forgotPassword}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgotten password
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            <>
              <LogIn className="size-4" aria-hidden />
              Sign in
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Demo operators
          </span>
          <Separator className="flex-1" />
        </div>
        {/* One per row rather than the two-column grid the KMC screen uses:
            an organisation's name is a good deal longer than "Zone Officer",
            and this column is narrower. */}
        <div className="space-y-2">
          {DEMO_OPERATORS.map((operator) => (
            <button
              key={operator.email}
              type="button"
              disabled={busy}
              onClick={() => {
                setEmail(operator.email);
                setPassword(DEMO_PASSWORD);
                setError(null);
                toast.info(`Filled ${operator.org}`, { description: operator.email });
              }}
              className="w-full rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
            >
              <p className="text-xs font-medium">{operator.org}</p>
              <p className="truncate text-[11px] text-muted-foreground">{operator.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Accounts are issued by KMC when an operator is approved. If you cannot sign in, your
        organisation&rsquo;s approval may still be pending — contact the parking office rather
        than registering again.
      </p>
    </div>
  );
}
