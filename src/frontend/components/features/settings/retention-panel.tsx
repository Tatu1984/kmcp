"use client";

import * as React from "react";
import { AlertTriangle, Eye, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Separator } from "@/frontend/components/ui/separator";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { SectionCard } from "@/frontend/components/shared/bits";
import { NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { ApiError, privacyApi, settingsApi, type RetentionPreview } from "@/frontend/api";
import { isLiveApi } from "@/config/env";
import { formatDateTime } from "@/shared/utils/common.util";

/**
 * The retention schedule and the citizen-rights position, as the platform is
 * actually running them.
 *
 * A panel with fake numbers stood here: four `defaultValue` inputs claiming
 * evidence was kept for 180 days and four switches claiming consent was
 * captured, none of them wired to anything. That was worse than an empty
 * screen. An officer reading it would have told the authority — and the
 * authority would have told a citizen — that the platform enforced a schedule
 * nothing enforced, and the published privacy notice already promised ninety
 * days rather than a hundred and eighty.
 *
 * Every figure below is read from `GET /privacy/retention`, which resolves each
 * period exactly as the purge resolves it, fallbacks included. If the screen
 * showed the seeded proposal while the sweep used something else, this would be
 * back where it started.
 *
 * Lives in its own file so that adding it touched `settings-view.tsx` in one
 * place: other people are working in that file.
 */
export function RetentionPanel() {
  const { can } = usePermissions();
  const canWriteConfig = can("config.write");

  const policy = useApiQuery(["privacy", "retention"], () =>
    privacyApi.retention().then((r) => r.data),
  );
  const consent = useApiQuery(["privacy", "consents", "summary"], () =>
    privacyApi.consentSummary().then((r) => r.data),
  );

  /**
   * Edited periods, held until saved and seeded from the server.
   *
   * Re-seeded whenever the server answers again — the state-during-render
   * pattern the roles matrix on this screen already uses — so a change made
   * elsewhere is not silently overwritten by a stale draft sitting here.
   */
  const [draft, setDraft] = React.useState<Record<string, number>>({});
  const [serverKey, setServerKey] = React.useState<string | null>(null);
  const currentKey = policy.data
    ? JSON.stringify([
        policy.data.classes.map((c) => [c.configKey, c.days]),
        policy.data.dryRun,
        policy.data.legalHold,
      ])
    : null;
  if (currentKey && currentKey !== serverKey) {
    setServerKey(currentKey);
    setDraft(Object.fromEntries(policy.data!.classes.map((c) => [c.configKey, c.days])));
  }

  const [saving, setSaving] = React.useState(false);
  const [preview, setPreview] = React.useState<RetentionPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);

  const classes = policy.data?.classes ?? [];
  const dirty = classes.some((c) => draft[c.configKey] !== undefined && draft[c.configKey] !== c.days);

  const savePeriods = async () => {
    if (!isLiveApi) {
      toast.info("Changing retention needs the API", {
        description: "Set NEXT_PUBLIC_API_URL to change what the purge actually enforces.",
      });
      return;
    }
    setSaving(true);
    try {
      await settingsApi.setConfigBulk(
        classes
          .filter((c) => draft[c.configKey] !== c.days)
          .map((c) => ({ key: c.configKey, value: draft[c.configKey] })),
        "Retention periods changed from portal settings",
      );
      await policy.refetch();
      setPreview(null);
      toast.success("Retention periods saved", {
        description: "The change is recorded in the audit trail and applies from the next purge.",
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Those periods did not save.");
    } finally {
      setSaving(false);
    }
  };

  /** One boolean brake, saved on the flick rather than batched with the periods. */
  const setBrake = async (key: string, value: boolean, label: string) => {
    if (!isLiveApi) {
      toast.info("Changing this needs the API");
      return;
    }
    try {
      await settingsApi.setConfig(key, value, `${label} changed from portal settings`);
      await policy.refetch();
      setPreview(null);
      toast.success(`${label} ${value ? "on" : "off"}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "That did not save.");
    }
  };

  const runPreview = async () => {
    if (!isLiveApi) {
      toast.info("Previewing a purge needs the API");
      return;
    }
    setPreviewing(true);
    try {
      const { data } = await privacyApi.previewPurge();
      setPreview(data);
      toast.success("Counted, deleted nothing", {
        description: `${data.classes.reduce((s, c) => s + c.pastCutoff, 0)} record(s) are past their period.`,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "That preview did not run.");
    } finally {
      setPreviewing(false);
    }
  };

  const outcomeFor = (code: string) => preview?.classes.find((c) => c.code === code);

  if (!isLiveApi) {
    return (
      <SectionCard
        title="Retention & data rights"
        description="What the platform keeps, for how long, and the DPDP rights it honours"
      >
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground text-pretty">
          This panel reads the retention schedule the API is actually enforcing. Set{" "}
          <span className="font-mono">NEXT_PUBLIC_API_URL</span> to see it. Showing invented
          periods here would tell the authority the platform enforces a schedule it does not.
        </p>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard
        title="Retention schedule"
        description="What the platform destroys, when, and on whose authority"
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!dirty || saving || !canWriteConfig}
            title={canWriteConfig ? undefined : NOT_PERMITTED}
            onClick={() => void savePeriods()}
          >
            {saving ? "Saving…" : "Save periods"}
          </Button>
        }
      >
        {policy.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : policy.error ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            {policy.error.code === "FORBIDDEN"
              ? "Viewing the retention schedule needs the config.write permission."
              : policy.error.message}
          </p>
        ) : (
          <>
            {/*
              The two brakes, first and unmissable. Everything below is a
              number; these decide whether the numbers do anything at all.
            */}
            <div className="space-y-3 rounded-lg border bg-muted/25 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="retention-dry-run" className="flex items-center gap-1.5 text-sm">
                    <Eye className="size-3.5" /> Report only
                  </Label>
                  <p className="text-xs text-muted-foreground text-pretty">
                    The purge counts what has expired and destroys nothing. On until the authority
                    has confirmed the periods below — a fresh deployment must not start deleting on
                    numbers nobody has signed off.
                  </p>
                </div>
                <Switch
                  id="retention-dry-run"
                  checked={policy.data!.dryRun}
                  disabled={!canWriteConfig}
                  onCheckedChange={(v) => void setBrake("retention.dryRun", v, "Report-only mode")}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="retention-hold" className="flex items-center gap-1.5 text-sm">
                    <Lock className="size-3.5" /> Legal hold
                  </Label>
                  <p className="text-xs text-muted-foreground text-pretty">
                    Suspends the whole sweep. Turn this on the moment a breach, an investigation or
                    a court order is in prospect, and before anyone starts looking — it is the
                    first line of the breach runbook.
                  </p>
                </div>
                <Switch
                  id="retention-hold"
                  checked={policy.data!.legalHold}
                  disabled={!canWriteConfig}
                  onCheckedChange={(v) => void setBrake("retention.legalHold", v, "Legal hold")}
                />
              </div>
            </div>

            {policy.data!.dryRun && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-pretty">
                  Nothing is being destroyed. The published privacy notice commits to destroying
                  evidence after ninety days, and that commitment is not being kept while this is
                  on. Confirm the periods, then turn it off.
                </span>
              </p>
            )}

            <Separator className="my-4" />

            <ul className="divide-y divide-border/60">
              {classes.map((klass) => {
                const outcome = outcomeFor(klass.code);
                return (
                  <li key={klass.code} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`retain-${klass.code}`} className="flex-1 text-sm">
                        {klass.label}
                      </Label>
                      {!klass.configured && (
                        /* The difference between a decision and a default the
                           authority has never looked at. */
                        <Badge variant="secondary" className="text-[10px]">
                          seeded default
                        </Badge>
                      )}
                      {!klass.destroys && (
                        <Badge variant="outline" className="text-[10px]">
                          redacted, not deleted
                        </Badge>
                      )}
                      <Input
                        id={`retain-${klass.code}`}
                        type="number"
                        min={1}
                        className="h-8 w-24 tabular"
                        value={draft[klass.configKey] ?? klass.days}
                        disabled={!canWriteConfig}
                        title={canWriteConfig ? undefined : NOT_PERMITTED}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [klass.configKey]: Number(e.target.value) }))
                        }
                      />
                      <span className="w-10 text-xs text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-pretty">{klass.covers}</p>
                    <p className="text-xs text-muted-foreground/80 text-pretty italic">
                      {klass.basis}
                    </p>
                    {outcome && (
                      <p className="text-xs tabular">
                        <span className="font-medium">{outcome.pastCutoff}</span> past the cutoff of{" "}
                        {formatDateTime(outcome.cutoff)}
                        {outcome.heldBack > 0 && (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" "}
                            · {outcome.heldBack} held back by a dispute or open incident
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={previewing || !canWriteConfig}
                title={canWriteConfig ? undefined : NOT_PERMITTED}
                onClick={() => void runPreview()}
              >
                <Trash2 className="size-4" />
                {previewing ? "Counting…" : "Preview the next purge"}
              </Button>
              <p className="text-xs text-muted-foreground text-pretty">
                Counts only, whatever the settings above say. Nothing is deleted by this button —
                the purge itself runs on a schedule, at most {policy.data!.batchLimit} records per
                class per run.
              </p>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Citizen rights"
        description="How the platform answers a DPDP request"
      >
        <dl className="divide-y divide-border/60">
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Access</dt>
            <dd className="text-right text-xs text-pretty">
              Citizens → open a citizen → <span className="font-medium">Export data</span>. Every
              disclosure is audited against the officer who ran it.
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Correction</dt>
            <dd className="text-right text-xs text-pretty">
              Name, mobile and email, through{" "}
              <span className="font-mono">PATCH /privacy/citizens/:id</span>, with both sides
              recorded.
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Erasure</dt>
            <dd className="max-w-md text-right text-xs text-pretty">
              Anonymisation, not deletion. The identifiers are destroyed and the sessions,
              payments, receipts and ledger entries are kept — they are tax records the authority
              is obliged to hold, and they come to refer to an account that names nobody. Refused
              while a session, a dispute, an uncaptured payment or a live pass is still open.
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Consent"
        description="What has been asked, what was answered, and against which notice"
      >
        {consent.isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : consent.error ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            {consent.error.message}
          </p>
        ) : (
          <>
            {consent.data?.warning && (
              /* A notice nobody can read is not notice, and it makes every
                 record below worthless. Said out loud rather than left to be
                 discovered by a regulator. */
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-pretty">{consent.data.warning}</span>
              </p>
            )}

            <ul className="divide-y divide-border/60">
              {(consent.data?.purposes ?? []).map((purpose) => (
                <li key={purpose.purpose} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="flex-1 text-sm">
                    {purpose.purpose
                      .toLowerCase()
                      .replace(/_/g, " ")
                      .replace(/^./, (c) => c.toUpperCase())}
                  </span>
                  <Badge variant="secondary" className="tabular text-[11px]">
                    {purpose.granted} granted
                  </Badge>
                  <Badge variant="outline" className="tabular text-[11px]">
                    {purpose.withdrawn} withdrawn
                  </Badge>
                  <Badge variant="outline" className="tabular text-[11px]">
                    {purpose.denied} denied
                  </Badge>
                </li>
              ))}
            </ul>

            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground text-pretty">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Every decision is appended to a ledger that nothing updates or deletes, stamped with
              the version of the privacy notice in force at that moment. That stamp is what makes
              consent demonstrable: agreeing to a document nobody can produce proves nothing.
            </p>
          </>
        )}
      </SectionCard>
    </>
  );
}
