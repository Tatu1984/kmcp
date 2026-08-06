"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Label } from "@/frontend/components/ui/label";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/frontend/components/ui/input-otp";
import { Logo } from "@/frontend/components/brand/logo";
import { FadeIn } from "@/frontend/components/reactbits";
import { authApi, ApiError } from "@/frontend/api";
import { startSession, toSessionUser } from "@/frontend/lib/session";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";

export function TwoFactorForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? ROUTES.dashboard;

  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const email = params.get("email") ?? "your account";
  const challengeId = params.get("challenge");

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const submit = React.useCallback(
    async (value: string) => {
      setError(null);
      if (value.length !== 6) {
        setError("Enter all six digits from your authenticator app.");
        return;
      }
      setBusy(true);

      if (!isLiveApi) {
        await new Promise((r) => setTimeout(r, 700));
        if (value === "000000") {
          setBusy(false);
          setCode("");
          setError("That code has expired. Codes are valid for 30 seconds — try the current one.");
          return;
        }
        document.cookie = "kmcp_session=demo; path=/; samesite=lax; max-age=86400";
        toast.success("Signed in", { description: "Welcome back to the KMCP portal." });
        router.push(next);
        return;
      }

      if (!challengeId) {
        setBusy(false);
        setCode("");
        setError("This challenge is no longer valid. Start again from the sign-in screen.");
        return;
      }

      try {
        const result = await authApi.verifyTwoFactor(challengeId, value);
        if (!result.user) {
          setBusy(false);
          setError("Verified, but the server sent no account details. Sign in again.");
          return;
        }
        startSession(toSessionUser(result.user));
        toast.success("Signed in", { description: "Welcome back to the KMCP portal." });
        router.push(next);
      } catch (cause) {
        setBusy(false);
        setCode("");
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not reach the sign-in service. Check your connection and try again.",
        );
      }
    },
    [challengeId, next, router],
  );

  return (
    <FadeIn className="space-y-7">
      <div className="space-y-5">
        <Logo className="lg:hidden" subtitle="Municipal Parking Authority" />
        <div className="space-y-1.5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from the authenticator app registered to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="otp">Authentication code</Label>
          <InputOTP
            id="otp"
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) void submit(v);
            }}
            containerClassName="justify-start"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <p className="text-xs text-muted-foreground">
            {isLiveApi ? (
              "Codes rotate every 30 seconds. If it is rejected, wait for the next one."
            ) : (
              <>
                Any six digits work in this demo. Enter <span className="font-mono">000000</span> to
                see the expired-code path.
              </>
            )}
          </p>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={busy || code.length !== 6}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {busy ? "Verifying…" : "Verify and sign in"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cooldown > 0}
          onClick={() => {
            setCooldown(30);
            toast.info("Recovery code sent", {
              description: "Check the registered email for a single-use recovery code.",
            });
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Use a recovery code"}
        </Button>
        <Link href={ROUTES.login} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </FadeIn>
  );
}
