"use client";

import * as React from "react";
import { CircleCheck, CircleX, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/frontend/components/ui/alert";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { Field, SectionCard } from "@/frontend/components/shared/bits";
import { api, apiBaseUrl, ApiError } from "@/frontend/api";
import { clientEnv, isLiveApi } from "@/config/env";

type Check = {
  name: string;
  path: string;
  anonymous?: boolean;
  hint: string;
};

const CHECKS: Check[] = [
  { name: "Reachable", path: "/health", anonymous: true, hint: "The API responds at all." },
  {
    name: "Database",
    path: "/health/ready",
    anonymous: true,
    hint: "The API can reach Neon. Fails if DATABASE_URL is missing on the backend.",
  },
  {
    name: "Version",
    path: "/version",
    anonymous: true,
    hint: "Build version and the minimum supported client.",
  },
  {
    name: "CORS + auth",
    path: "/auth/me",
    hint: "A browser call with credentials. 401 here is fine — it proves CORS passed.",
  },
];

type Result = { status: "idle" | "running" | "pass" | "fail"; detail?: string; code?: string };

export function ConnectionCheck() {
  const [results, setResults] = React.useState<Record<string, Result>>({});
  const [running, setRunning] = React.useState(false);

  const run = React.useCallback(async () => {
    setRunning(true);
    setResults(Object.fromEntries(CHECKS.map((c) => [c.name, { status: "running" as const }])));

    for (const check of CHECKS) {
      try {
        const { data } = await api.get<Record<string, unknown>>(check.path, {
          anonymous: check.anonymous,
        });
        setResults((r) => ({
          ...r,
          [check.name]: { status: "pass", detail: JSON.stringify(data) },
        }));
      } catch (error) {
        const isApi = error instanceof ApiError;
        // A 401 on /auth/me still proves the request crossed CORS and reached Nest.
        const reachedServer = isApi && error.status > 0 && error.status !== 408;
        const passed = check.path === "/auth/me" && reachedServer;
        setResults((r) => ({
          ...r,
          [check.name]: {
            status: passed ? "pass" : "fail",
            code: isApi ? error.code : "NETWORK_ERROR",
            detail: isApi ? error.message : String(error),
          },
        }));
      }
    }
    setRunning(false);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="API connection"
        description="Checks that this portal can reach the KMCP API, that the API can reach its database, and that CORS is configured for this origin."
        actions={
          <Button size="sm" className="h-9" onClick={run} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Run checks
          </Button>
        }
      />

      {!isLiveApi && (
        <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
          <PlugZap className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Running on mock data</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> is not set, so every
            screen renders from the bundled demo dataset. Set it to the API base URL — including the{" "}
            <code className="font-mono text-xs">/api/v1</code> suffix — and redeploy.
          </AlertDescription>
        </Alert>
      )}

      <SectionCard title="Configuration" description="What this build was compiled with">
        <dl className="divide-y divide-border/60">
          <Field label="API base URL">
            <span className="font-mono text-xs break-all">{apiBaseUrl()}</span>
          </Field>
          <Field label="Mode">
            <Badge variant={isLiveApi ? "default" : "secondary"}>
              {isLiveApi ? "Live API" : "Mock data"}
            </Badge>
          </Field>
          <Field label="Maps key">
            {clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ? "configured" : "not set"}
          </Field>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground text-pretty">
          <code className="font-mono">NEXT_PUBLIC_*</code> values are inlined at build time, so a
          change needs a redeploy, not just a restart.
        </p>
      </SectionCard>

      <SectionCard title="Checks" contentClassName="p-0">
        <ul className="divide-y divide-border/60">
          {CHECKS.map((check) => {
            const result = results[check.name] ?? { status: "idle" as const };
            return (
              <li key={check.name} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                    result.status === "pass" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    result.status === "fail" && "bg-red-500/10 text-red-600 dark:text-red-400",
                    (result.status === "idle" || result.status === "running") && "bg-muted text-muted-foreground",
                  )}
                >
                  {result.status === "running" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : result.status === "pass" ? (
                    <CircleCheck className="size-3.5" />
                  ) : result.status === "fail" ? (
                    <CircleX className="size-3.5" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{check.name}</p>
                    <code className="font-mono text-[11px] text-muted-foreground">{check.path}</code>
                    {result.code && (
                      <Badge variant="outline" className="text-[10px]">
                        {result.code}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{check.hint}</p>
                  {result.detail && (
                    <pre className="mt-1.5 overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
                      {result.detail}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="If a check fails" contentClassName="p-4">
        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="font-medium">NETWORK_ERROR on every row</dt>
            <dd className="text-muted-foreground text-pretty">
              Either the URL is wrong, or the API is not allowing this origin. Set{" "}
              <code className="font-mono text-xs">CORS_ORIGINS</code> on the backend to this
              portal&apos;s domain and redeploy the backend.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Database fails, everything else passes</dt>
            <dd className="text-muted-foreground text-pretty">
              The API is up but cannot reach Neon. Check{" "}
              <code className="font-mono text-xs">DATABASE_URL</code> on the backend project.
            </dd>
          </div>
          <div>
            <dt className="font-medium">404 on every path</dt>
            <dd className="text-muted-foreground text-pretty">
              The base URL is probably missing the{" "}
              <code className="font-mono text-xs">/api/v1</code> suffix.
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
