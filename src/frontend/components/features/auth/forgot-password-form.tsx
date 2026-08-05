"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import { Logo } from "@/frontend/components/brand/logo";
import { FadeIn } from "@/frontend/components/reactbits";
import { ROUTES } from "@/shared/constants/routes";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Enter the work email address issued to you by the authority.");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <FadeIn className="space-y-6">
        <Logo className="lg:hidden" subtitle="Municipal Parking Authority" />
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
          <MailCheck className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            If <span className="font-medium text-foreground">{email}</span> belongs to an active
            account, a single-use reset link is on its way. The link expires in 30 minutes.
          </p>
        </div>
        <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Not received it? Check spam, then contact the IT helpdesk on 1800 000 0000. For security we
          do not confirm whether an address is registered.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <Button asChild className="flex-1">
            <Link href={ROUTES.login}>Back to sign in</Link>
          </Button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="space-y-7">
      <div className="space-y-5">
        <Logo className="lg:hidden" subtitle="Municipal Parking Authority" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            We will email a single-use link to the address on your account.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@kmc.gov.in"
            autoFocus
            required
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link
        href={ROUTES.login}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to sign in
      </Link>
    </FadeIn>
  );
}
