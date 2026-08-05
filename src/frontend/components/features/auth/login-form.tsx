"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import { Separator } from "@/frontend/components/ui/separator";
import { Logo } from "@/frontend/components/brand/logo";
import { FadeIn, ShinyText, StarBorder } from "@/frontend/components/reactbits";
import { ROUTES } from "@/shared/constants/routes";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "sudipta.banerjee@kmc.gov.in", role: "Full access" },
  { label: "Administrator", email: "rina.dasgupta@kmc.gov.in", role: "Operations" },
  { label: "Zone Officer", email: "prabir.c@kmc.gov.in", role: "Assigned zones" },
  { label: "Auditor", email: "audit@kmc.gov.in", role: "Read-only" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? ROUTES.dashboard;

  const [email, setEmail] = React.useState("sudipta.banerjee@kmc.gov.in");
  const [password, setPassword] = React.useState("kmcp-demo");
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Enter the work email address issued to you by the authority.");
      return;
    }
    if (password.length < 6) {
      setError("Your password is at least 6 characters. Check and try again.");
      return;
    }

    setBusy(true);
    await new Promise((r) => setTimeout(r, 650));

    // Admin accounts carry mandatory 2FA — the flow continues on the next screen.
    toast.success("Password accepted", { description: "Enter the 6-digit code from your authenticator." });
    router.push(
      `${ROUTES.twoFactor}?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`,
    );
  }

  return (
    <FadeIn className="space-y-7">
      <div className="space-y-5">
        <Logo className="lg:hidden" subtitle="Municipal Parking Authority" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            <ShinyText speed={7}>Sign in to the portal</ShinyText>
          </h1>
          <p className="text-sm text-muted-foreground">
            Authorised municipal staff and parking vendors only. Every sign-in is logged.
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
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@kmc.gov.in"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href={ROUTES.forgotPassword}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
          <span className="text-muted-foreground">Keep me signed in on this device</span>
        </label>

        <StarBorder className="rounded-md" speed={5}>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Verifying…" : "Continue"}
          </Button>
        </StarBorder>
      </form>

      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Two-factor authentication is mandatory for administrator accounts.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Demo accounts
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword("kmcp-demo");
                toast.info(`Filled ${account.label}`, { description: account.email });
              }}
              className="rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <p className="text-xs font-medium">{account.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{account.role}</p>
            </button>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}
