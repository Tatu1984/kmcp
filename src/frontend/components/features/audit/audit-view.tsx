"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Eye,
  Fingerprint,
  LogIn,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/frontend/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { Field, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import {
  auditApi,
  activityApi,
  documentsApi,
  type AuditEntry,
  type AuthEvent,
  type LiveSession,
} from "@/frontend/api";
import { useApiQuery, emptyReason } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { isLiveApi } from "@/config/env";
import { formatDateTime, relativeTime } from "@/shared/utils/common.util";
import { ROLE_LABELS } from "@/shared/constants/roles";

const RISK_TONE = (score?: number | null) =>
  !score ? "neutral" : score >= 60 ? "danger" : score >= 35 ? "warning" : "info";

/** What an auditor actually asks for, in the order they ask for it. */
const EXPORT_PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
] as const;

export function AuditView() {
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<AuthEvent | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<LiveSession | null>(null);
  const [exportDays, setExportDays] = React.useState("30");
  const documents = useDocument();

  /**
   * Reading this page is `audit.read`; acting on what it shows is not.
   *
   * Ending someone's session and vouching for a flagged sign-in both sit on
   * `user.manage` in `activity.controller.ts` — they change how an account
   * behaves, and an auditor who may read everything deliberately may not do
   * either. That distinction is the whole point of an audit role.
   */
  const { can } = usePermissions();
  const canManageAccounts = can("user.manage");

  const summary = useApiQuery(["audit", "summary"], () => auditApi.summary().then((r) => r.data));
  const overview = useApiQuery(["activity", "overview"], () => activityApi.overview().then((r) => r.data));
  const logs = useApiQuery(["audit", "logs"], () => auditApi.logs({ pageSize: 100 }).then((r) => r.data));
  const events = useApiQuery(["activity", "events"], () => activityApi.events({ pageSize: 100 }).then((r) => r.data));
  const sessions = useApiQuery(["activity", "sessions"], () => activityApi.sessions().then((r) => r.data));

  const blocked = emptyReason(logs.error ?? null, logs.isLoading);

  const auditColumns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        meta: "When",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-xs">{relativeTime(row.original.createdAt)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateTime(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        id: "actor",
        accessorFn: (r) => r.actor?.name ?? "System",
        header: "Who",
        meta: "Actor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.actor?.name ?? "System"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.actor ? ROLE_LABELS[row.original.actor.role] : "automated"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        meta: "Action",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-[10px] whitespace-nowrap">
            {row.original.action}
          </Badge>
        ),
      },
      {
        accessorKey: "entity",
        header: "What",
        meta: "Entity",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.entity}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.entityId}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "ip",
        header: "Origin",
        meta: "Origin",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px]">{row.original.ip ?? "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.userAgent?.slice(0, 40) ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              label="Entry"
              actions={[
                { label: "View before / after", icon: Eye, onSelect: () => setSelected(row.original) },
                {
                  label: "Copy request id",
                  icon: Fingerprint,
                  disabled: !row.original.requestId,
                  onSelect: () => {
                    void navigator.clipboard.writeText(row.original.requestId ?? "");
                    toast.success("Copied", { description: row.original.requestId });
                  },
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const eventColumns = React.useMemo<ColumnDef<AuthEvent, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        meta: "When",
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: "who",
        accessorFn: (e) => e.userName ?? e.identifierTried ?? "unknown",
        header: "Who",
        meta: "Who",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.userName ?? row.original.identifierTried ?? "unknown"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.userRole ? ROLE_LABELS[row.original.userRole] : "no such account"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "eventType",
        header: "Result",
        meta: "Result",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge
              status={row.original.eventType === "LOGIN_SUCCESS" ? "ACTIVE" : "FAILED"}
              label={row.original.eventType.replace(/_/g, " ").toLowerCase()}
            />
            {row.original.failureReason && (
              <p className="max-w-36 truncate text-[11px] text-muted-foreground">
                {row.original.failureReason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "where",
        accessorFn: (e) => [e.city, e.country].filter(Boolean).join(", "),
        header: "Where",
        meta: "Where",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">
              {[row.original.district, row.original.city, row.original.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.ipAddress ?? "—"}
              {row.original.isp ? ` · ${row.original.isp}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "device",
        accessorFn: (e) => `${e.browserName ?? ""} ${e.osName ?? ""}`,
        header: "Device",
        meta: "Device",
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {[row.original.browserName, row.original.osName].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "riskScore",
        header: "Risk",
        meta: "Risk",
        cell: ({ row }) => {
          const score = row.original.riskScore ?? 0;
          if (!score) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1.5">
              <StatusBadge
                status={String(score)}
                label={String(score)}
                tone={RISK_TONE(score) as never}
              />
              {row.original.isTrusted && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <ShieldCheck className="size-3" /> trusted
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              label="Sign-in"
              actions={[
                { label: "View detail", icon: Eye, onSelect: () => setSelectedEvent(row.original) },
                {
                  label: "Mark as legitimate",
                  icon: ShieldCheck,
                  permission: "user.manage",
                  hidden: !row.original.riskScore || row.original.isTrusted,
                  onSelect: async () => {
                    await activityApi.approve(row.original.id);
                    toast.success("Location trusted", {
                      description: "This account and address will stop being flagged.",
                    });
                    void events.refetch();
                  },
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [events],
  );

  if (blocked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Audit trail"
          description="Every change, sign-in, device and offline sync recorded by the API."
        />
        <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
          <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>No audit data to show</AlertTitle>
          <AlertDescription>{blocked}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Every change, sign-in, device and offline sync — recorded by the API, append-only, and never editable from this screen."
        actions={
          /*
            GET /documents/audit-trail — documents.controller.ts, on audit.read
            like every other route on this screen.

            The document is not signed and no longer says it is. This platform
            holds no signing key, and telling an auditor a PDF with a logo on it
            is cryptographically signed would be worse than the old disabled
            button. What it does carry is a SHA-256 of the entries it lists,
            printed on every page and written into the audit trail itself as an
            AUDIT_EXPORT entry at the moment of generation. An altered line
            disagrees with the fingerprint beside it; an altered fingerprint
            disagrees with the append-only record of what was exported. That is
            checkable, which the old promise was not.

            The period is explicit because the fingerprint is only worth
            comparing if two people can agree on exactly what was asked for.
          */
          <div className="flex items-center gap-2">
            <Select value={exportDays} onValueChange={setExportDays}>
              <SelectTrigger size="sm" className="h-9 w-36" aria-label="Export period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_PERIODS.map((period) => (
                  <SelectItem key={period.days} value={String(period.days)}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9"
              // Still disabled in the demo build, exactly as before: the
              // document is rendered by the API, and there is no API here. An
              // enabled button that toasted about it would be the same empty
              // promise the old one was taken out for.
              disabled={!isLiveApi || !can("audit.read") || documents.isBusy}
              title={
                !isLiveApi
                  ? "The trail is rendered by the API, which the demo build does not have."
                  : can("audit.read")
                    ? undefined
                    : NOT_PERMITTED
              }
              onClick={() => {
                const to = new Date();
                const from = new Date(to.getTime() - Number(exportDays) * 24 * 60 * 60 * 1000);
                void documents.run(
                  "audit-trail",
                  () =>
                    documentsApi.auditTrail({
                      from: from.toISOString(),
                      to: to.toISOString(),
                    }),
                  {
                    // Unreachable: the button is disabled without an API.
                    demo: () => undefined,
                    success: "Audit trail exported",
                    description:
                      "The fingerprint printed on it was recorded in the trail as it was generated.",
                  },
                );
              }}
            >
              <Download className="size-4" /> Export trail
            </Button>
          </div>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Recorded changes"
            value={summary.isLoading ? <Skeleton className="h-7 w-14" /> : (summary.data?.total ?? 0)}
            icon={ScrollText}
            hint={`${summary.data?.thisWeek ?? 0} in the last 7 days`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Sign-ins today"
            value={overview.isLoading ? <Skeleton className="h-7 w-14" /> : (overview.data?.signInsToday ?? 0)}
            icon={LogIn}
            accent="info"
            hint={`${overview.data?.failuresToday ?? 0} failed`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Flagged this week"
            value={overview.isLoading ? <Skeleton className="h-7 w-14" /> : (overview.data?.flaggedThisWeek ?? 0)}
            icon={ShieldAlert}
            accent={(overview.data?.flaggedThisWeek ?? 0) > 0 ? "warning" : "success"}
            hint="Sign-ins the anomaly engine scored"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Live sessions"
            value={overview.isLoading ? <Skeleton className="h-7 w-14" /> : (overview.data?.liveSessions ?? 0)}
            icon={Smartphone}
            hint={`from ${overview.data?.distinctIpsThisWeek ?? 0} addresses this week`}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="changes">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="signins">Sign-ins</TabsTrigger>
          <TabsTrigger value="sessions">Live sessions</TabsTrigger>
          <TabsTrigger value="places">Places</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="mt-4">
          {logs.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <DataTable
              data={logs.data ?? []}
              columns={auditColumns}
              searchKeys={["action", "entity", "entityId"]}
              searchPlaceholder="Search action, entity or id…"
              onRowClick={setSelected}
              emptyTitle="No changes recorded yet"
              emptyDescription="Entries appear here the moment anyone changes a zone, tariff, vendor or settlement."
            />
          )}
        </TabsContent>

        <TabsContent value="signins" className="mt-4">
          {events.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <DataTable
              data={events.data ?? []}
              columns={eventColumns}
              searchKeys={["userName", "identifierTried", "ipAddress", "city", "isp"]}
              searchPlaceholder="Search account, IP, city or ISP…"
              onRowClick={setSelectedEvent}
              emptyTitle="No sign-in activity"
              emptyDescription="Every attempt is recorded here, including ones against accounts that do not exist."
            />
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <SectionCard
            title="Live sessions"
            description="More than one session for the same account is the shape account-sharing takes"
            contentClassName="p-0"
          >
            {sessions.isLoading ? (
              <Skeleton className="m-4 h-64" />
            ) : (sessions.data ?? []).length === 0 ? (
              <EmptyState title="No live sessions" description="Nobody is currently signed in." />
            ) : (
              <ul className="divide-y divide-border/60">
                {(sessions.data ?? []).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.userName ?? s.userId}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[s.city, s.country].filter(Boolean).join(", ") || "unknown place"} ·{" "}
                        <span className="font-mono">{s.ipAddress}</span>
                        {s.isp ? ` · ${s.isp}` : ""}
                      </p>
                    </div>
                    {s.concurrentForUser > 1 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1",
                          s.concurrentForUser > 2
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        <TriangleAlert className="size-3" />
                        {s.concurrentForUser} concurrent
                      </Badge>
                    )}
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {relativeTime(s.lastSeenAt)}
                    </span>
                    <RowActions
                      label="Session"
                      actions={[
                        {
                          label: "Force sign-out",
                          icon: ShieldAlert,
                          permission: "user.manage",
                          destructive: true,
                          onSelect: () => setRevokeTarget(s),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="places" className="mt-4">
          <SectionCard
            title="Where people sign in from"
            description="Last 7 days, by city"
            contentClassName="p-0"
          >
            {(overview.data?.topCities ?? []).length === 0 ? (
              <EmptyState title="No location data yet" description="Sign-ins will be mapped here." />
            ) : (
              <ul className="divide-y divide-border/60">
                {(overview.data?.topCities ?? []).map((c) => (
                  <li key={c.city ?? "unknown"} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{c.city ?? "Unknown"}</span>
                    <Badge variant="secondary" className="tabular">
                      {c.count} sign-ins
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------ change detail */}
      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <SheetTitle className="font-mono text-base">{selected.action}</SheetTitle>
                <SheetDescription>
                  {selected.actor?.name ?? "System"} · {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <dl className="divide-y divide-border/60">
                  <Field label="Entity">{selected.entity}</Field>
                  <Field label="Record">
                    <span className="font-mono text-xs">{selected.entityId}</span>
                  </Field>
                  <Field label="Actor role">
                    {selected.actor ? ROLE_LABELS[selected.actor.role] : "automated"}
                  </Field>
                  <Field label="IP address">
                    <span className="font-mono text-xs">{selected.ip ?? "—"}</span>
                  </Field>
                  <Field label="Request id">
                    <span className="font-mono text-xs">{selected.requestId ?? "—"}</span>
                  </Field>
                </dl>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Before</p>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px]">
                      {JSON.stringify(selected.before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">After</p>
                    <pre className="overflow-x-auto rounded-lg border border-primary/25 bg-primary/[0.04] p-3 font-mono text-[11px]">
                      {JSON.stringify(selected.after ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-pretty">
                  Audit entries are append-only. Nothing here can be edited or deleted from the
                  portal, including by a Super Admin.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------ sign-in detail */}
      <Sheet open={Boolean(selectedEvent)} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selectedEvent && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>
                    {selectedEvent.userName ?? selectedEvent.identifierTried ?? "Unknown account"}
                  </SheetTitle>
                  <StatusBadge
                    status={selectedEvent.eventType === "LOGIN_SUCCESS" ? "ACTIVE" : "FAILED"}
                    label={selectedEvent.eventType.replace(/_/g, " ").toLowerCase()}
                  />
                  {(selectedEvent.riskScore ?? 0) > 0 && (
                    <StatusBadge
                      status="risk"
                      label={`risk ${selectedEvent.riskScore}`}
                      tone={RISK_TONE(selectedEvent.riskScore) as never}
                    />
                  )}
                </div>
                <SheetDescription>{formatDateTime(selectedEvent.createdAt)}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                {(selectedEvent.anomalies ?? []).length > 0 && (
                  <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
                    <p className="text-sm font-medium">What was flagged</p>
                    {(selectedEvent.anomalies ?? []).map((a) => (
                      <div key={a.code} className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            a.severity === "high" && "text-red-600 dark:text-red-400",
                            a.severity === "medium" && "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {a.severity}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-mono text-[11px]">{a.code}</p>
                          <p className="text-xs text-muted-foreground text-pretty">{a.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <dl className="divide-y divide-border/60">
                  <Field label="IP address">
                    <span className="font-mono text-xs">{selectedEvent.ipAddress ?? "—"}</span>
                  </Field>
                  <Field label="Place">
                    {[selectedEvent.district, selectedEvent.city, selectedEvent.region, selectedEvent.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </Field>
                  <Field label="PIN code">{selectedEvent.postal ?? "—"}</Field>
                  <Field label="Coordinates">
                    {selectedEvent.latitude != null
                      ? `${selectedEvent.latitude}, ${selectedEvent.longitude}`
                      : "—"}
                  </Field>
                  <Field label="Network">{selectedEvent.isp ?? "—"}</Field>
                  <Field label="ASN">
                    <span className="font-mono text-xs">{selectedEvent.asn ?? "—"}</span>
                  </Field>
                  <Field label="VPN or proxy">
                    {selectedEvent.isVpnOrProxy == null ? "unknown" : selectedEvent.isVpnOrProxy ? "yes" : "no"}
                  </Field>
                  <Field label="Network timezone">{selectedEvent.ipTimezone ?? "—"}</Field>
                  <Field label="Device timezone">{selectedEvent.clientTimezone ?? "—"}</Field>
                  <Field label="Browser">{selectedEvent.browserName ?? "—"}</Field>
                  <Field label="Operating system">{selectedEvent.osName ?? "—"}</Field>
                  <Field label="Device type">{selectedEvent.deviceType ?? "—"}</Field>
                  <Field label="Fingerprint">
                    <span className="font-mono text-[11px]">
                      {selectedEvent.deviceFingerprint ?? "—"}
                    </span>
                  </Field>
                  <Field label="Geo source">{selectedEvent.geoSource ?? "—"}</Field>
                </dl>

                {(selectedEvent.riskScore ?? 0) > 0 && !selectedEvent.isTrusted && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={!canManageAccounts}
                    title={canManageAccounts ? undefined : NOT_PERMITTED}
                    onClick={async () => {
                      await activityApi.approve(selectedEvent.id);
                      toast.success("Location trusted");
                      setSelectedEvent(null);
                      void events.refetch();
                    }}
                  >
                    <ShieldCheck className="size-4" /> Mark this place as legitimate
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={`Force ${revokeTarget?.userName ?? "this account"} to sign out?`}
        destructive
        confirmLabel="End session"
        reason={{ label: "Why?", placeholder: "Suspected shared login / handset lost…", required: true }}
        description="The session ends immediately. They will need to sign in again, and the reason is recorded against your name."
        onConfirm={async (reason) => {
          if (!revokeTarget) return;
          await activityApi.revokeSession(revokeTarget.sessionId, reason ?? "Revoked by administrator");
          toast.success("Session ended");
          void sessions.refetch();
        }}
      />

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
        <RefreshCcw className="mt-0.5 size-4 shrink-0" />
        <p className="text-pretty">
          Everything on this page comes from the API. There is no seeded or sample data here — if a
          tab is empty, nothing of that kind has happened yet.
        </p>
      </div>
    </div>
  );
}
