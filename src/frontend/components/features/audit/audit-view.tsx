"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Eye,
  Fingerprint,
  Laptop,
  LogIn,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
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
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { AUDIT_LOG, LOGIN_LOG, DEVICE_LOG, SYNC_LOG } from "@/frontend/lib/mock";
import { formatDateTime, relativeTime } from "@/shared/utils/common.util";
import { ROLE_LABELS } from "@/shared/constants/roles";
import type { AuditEntry } from "@/shared/types/domain.types";

export function AuditView() {
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

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
              {formatDateTime(row.original.createdAt).split(",")[1]}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "actorName",
        header: "Who",
        meta: "Actor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.actorName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {ROLE_LABELS[row.original.actorRole]}
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
        accessorKey: "entityLabel",
        header: "What",
        meta: "Entity",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.entityLabel}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.entity}</p>
          </div>
        ),
      },
      {
        accessorKey: "ip",
        header: "Origin",
        meta: "Origin",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px]">{row.original.ip}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.device}</p>
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
                {
                  label: "View before / after",
                  icon: Eye,
                  onSelect: () => {
                    setSelected(row.original);
                    setSheetOpen(true);
                  },
                },
                {
                  label: "Copy entry ID",
                  icon: Fingerprint,
                  onSelect: () => {
                    void navigator.clipboard.writeText(row.original.id);
                    toast.success("Copied", { description: row.original.id });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Every mutation, sign-in, device binding and offline sync — with the actor, the before and after, the IP and the device."
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() =>
              toast.success("Audit export queued", {
                description: "A tamper-evident PDF for the selected period will be emailed to you.",
              })
            }
          >
            <Download className="size-4" /> Export trail
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Audit entries" numeric={AUDIT_LOG.length} icon={ScrollText} hint="In the last 7 days" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Failed sign-ins"
            numeric={LOGIN_LOG.filter((l) => !l.success).length}
            icon={LogIn}
            accent={LOGIN_LOG.filter((l) => !l.success).length > 4 ? "warning" : "success"}
            hint="Wrong password, expired code or unknown device"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Bound devices"
            numeric={DEVICE_LOG.filter((d) => d.isActive).length}
            icon={Smartphone}
            accent="info"
            hint={`${DEVICE_LOG.length} devices on record`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Sync conflicts"
            numeric={SYNC_LOG.reduce((s, x) => s + x.conflictCount, 0)}
            icon={RefreshCcw}
            accent={SYNC_LOG.some((s) => s.conflictCount > 0) ? "warning" : "success"}
            hint="Offline events needing a supervisor"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="changes">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="changes">Changes ({AUDIT_LOG.length})</TabsTrigger>
          <TabsTrigger value="logins">Sign-ins ({LOGIN_LOG.length})</TabsTrigger>
          <TabsTrigger value="devices">Devices ({DEVICE_LOG.length})</TabsTrigger>
          <TabsTrigger value="sync">Offline sync ({SYNC_LOG.length})</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------- changes */}
        <TabsContent value="changes" className="mt-4">
          <DataTable
            data={AUDIT_LOG}
            columns={auditColumns}
            searchKeys={["actorName", "action", "entity", "entityLabel", "ip"]}
            searchPlaceholder="Search actor, action, entity or IP…"
            facets={[
              {
                columnId: "action",
                label: "Action",
                options: [...new Set(AUDIT_LOG.map((a) => a.action))].map((a) => ({
                  value: a,
                  label: a,
                })),
              },
              {
                columnId: "actorName",
                label: "Actor",
                options: [...new Set(AUDIT_LOG.map((a) => a.actorName))].map((a) => ({
                  value: a,
                  label: a,
                })),
              },
            ]}
            onRowClick={(entry) => {
              setSelected(entry);
              setSheetOpen(true);
            }}
            onExport={(rows) => toast.success("Export queued", { description: `${rows.length} entries` })}
            emptyTitle="No audit entries"
            emptyDescription="Every change made in the portal is recorded here automatically."
          />
        </TabsContent>

        {/* --------------------------------------------------------- logins */}
        <TabsContent value="logins" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y divide-border/60">
              {LOGIN_LOG.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                      entry.success
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    <LogIn className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.identifier}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ROLE_LABELS[entry.role]} · {entry.device}
                    </p>
                  </div>
                  {entry.reason && (
                    <Badge variant="outline" className="text-red-600 dark:text-red-400">
                      {entry.reason}
                    </Badge>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground">{entry.ip}</span>
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* -------------------------------------------------------- devices */}
        <TabsContent value="devices" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y divide-border/60">
              {DEVICE_LOG.map((device) => (
                <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    {device.platform.startsWith("iOS") ? (
                      <Smartphone className="size-4 text-muted-foreground" />
                    ) : (
                      <Laptop className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{device.ownerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {device.platform} · app {device.appVersion} · {device.boundTo}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {device.fingerprint}
                  </span>
                  <StatusBadge
                    status={device.isActive ? "ACTIVE" : "INACTIVE"}
                    label={device.isActive ? "Bound" : "Unbound"}
                  />
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {relativeTime(device.lastSeenAt)}
                  </span>
                  <RowActions
                    label={device.ownerName}
                    actions={[
                      {
                        label: "Unbind device",
                        icon: Smartphone,
                        destructive: true,
                        onSelect: () =>
                          toast.success("Device unbound", {
                            description: `${device.ownerName} must register a new device at next sign-in.`,
                          }),
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* ----------------------------------------------------------- sync */}
        <TabsContent value="sync" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y divide-border/60">
              {SYNC_LOG.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    <RefreshCcw className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.attendantName}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.device}</p>
                  </div>
                  <Badge variant="secondary" className="tabular">
                    {entry.eventCount} events
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      entry.conflictCount > 0
                        ? "tabular text-amber-600 dark:text-amber-400"
                        : "tabular text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {entry.acceptedCount} accepted
                    {entry.conflictCount > 0 && ` · ${entry.conflictCount} conflict`}
                  </Badge>
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p className="text-pretty">
              Replayed events carry a client-generated <span className="font-mono">clientEventId</span>{" "}
              with a unique constraint, so a retry returns the original result instead of creating a
              duplicate session. Conflicts are surfaced to a supervisor and never silently dropped.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------- diff sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <SheetTitle className="font-mono text-base">{selected.action}</SheetTitle>
                <SheetDescription>
                  {selected.actorName} · {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <dl className="divide-y divide-border/60">
                  <Field label="Entity">{selected.entity}</Field>
                  <Field label="Target">{selected.entityLabel}</Field>
                  <Field label="Actor role">{ROLE_LABELS[selected.actorRole]}</Field>
                  <Field label="IP address">
                    <span className="font-mono text-xs">{selected.ip}</span>
                  </Field>
                  <Field label="Device">{selected.device}</Field>
                  <Field label="Entry ID">
                    <span className="font-mono text-xs">{selected.id}</span>
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
                  Audit entries are append-only. Nothing in this table can be edited or deleted from
                  the portal, including by a Super Admin.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
