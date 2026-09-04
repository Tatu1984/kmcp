"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  CircleSlash,
  Clock3,
  Eye,
  Image as ImageIcon,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can, NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { Field, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { IncidentFormSheet, type IncidentDraft } from "./incident-form-sheet";
import { INCIDENTS, ZONES } from "@/frontend/lib/mock";
import { incidentsApi, usersApi, listAll } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { toIncident } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { isLiveApi } from "@/config/env";
import { formatDateTime, relativeTime, titleCase } from "@/shared/utils/common.util";
import type { Incident, IncidentStatus } from "@/shared/types/domain.types";

export function IncidentsView() {
  const {
    items: incidents,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Incident>(
    ["incidents", "list"],
    () =>
      listAll((page, pageSize) => incidentsApi.list({ page, pageSize })).then((r) =>
        r.map(toIncident),
      ),
    INCIDENTS,
  );

  // Who an incident can be handed to. Real accounts, not a fixed list — the
  // authority creates its own roles and officers.
  const assignees = useApiQuery(["users", "assignable"], () =>
    listAll((page, pageSize) => usersApi.list({ page, pageSize, status: "ACTIVE" })),
  );

  const { can } = usePermissions();
  /**
   * Everything after an incident is raised — assigning it, picking it up,
   * closing it — sits behind `incident.manage` on the API. Raising one does
   * not: see the report button below.
   */
  const canManage = can("incident.manage");

  const [selected, setSelected] = React.useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const open = (incident: Incident) => {
    setSelected(incident);
    setNote(incident.resolutionNote ?? "");
    setSheetOpen(true);
  };

  /** Applies a status change through the API, or to the demo copy without one. */
  const close = (
    incident: Incident,
    status: Extract<IncidentStatus, "RESOLVED" | "REJECTED">,
    text: string,
  ) =>
    apply(
      () =>
        status === "RESOLVED"
          ? incidentsApi.resolve(incident.id, { resolutionNote: text })
          : incidentsApi.reject(incident.id, { reason: text }),
      (list) =>
        list.map((i) =>
          i.id === incident.id
            ? { ...i, status, resolutionNote: text, resolvedAt: new Date().toISOString() }
            : i,
        ),
      {
        success: status === "RESOLVED" ? "Incident resolved" : "Incident rejected",
        description: incident.reference,
      },
    );

  /**
   * Raises a new incident. The demo branch invents the row the server would
   * have written back, so the walkthrough shows the report landing at the top
   * of the queue rather than a toast over an unchanged table.
   */
  const report = (draft: IncidentDraft) =>
    apply(
      () => incidentsApi.create(draft),
      (list) => [
        {
          id: `inc_new_${list.length + 1}`,
          reference: `INC-${String(list.length + 1).padStart(5, "0")}`,
          type: draft.type,
          zoneName: ZONES.find((z) => z.id === draft.zoneId)?.name ?? "—",
          description: draft.description,
          reportedBy: "You",
          reporterRole: "ZONE_OFFICER",
          photoCount: 0,
          status: "OPEN",
          createdAt: new Date().toISOString(),
        } satisfies Incident,
        ...list,
      ],
      { success: "Incident reported", description: "It is now in the open queue." },
    );

  const columns = React.useMemo<ColumnDef<Incident, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: "Reference",
        meta: "Reference",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-medium">{row.original.reference}</p>
            <p className="text-[11px] text-muted-foreground">
              {relativeTime(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        meta: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-normal whitespace-nowrap">
            {titleCase(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: "What happened",
        meta: "Description",
        cell: ({ row }) => (
          <div className="max-w-md min-w-0">
            <p className="truncate text-sm">{row.original.description}</p>
            {row.original.plateNumber && (
              <p className="truncate text-[11px] text-muted-foreground">
                {row.original.plateNumber}
              </p>
            )}
          </div>
        ),
      },
      {
        // A real column, not just the caption it used to be under
        // "description" — the Zone facet below filters on this id, and
        // `table.getColumn("zoneName")` throws when no column answers to it.
        accessorKey: "zoneName",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) => (
          <span className="truncate text-sm text-muted-foreground">{row.original.zoneName}</span>
        ),
      },
      {
        accessorKey: "reportedBy",
        header: "Reported by",
        meta: "Reported by",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.reportedBy}</p>
            <p className="text-[11px] text-muted-foreground">
              {titleCase(row.original.reporterRole)}
            </p>
          </div>
        ),
      },
      {
        id: "photos",
        accessorFn: (i) => i.photoCount,
        header: "Photos",
        meta: "Photos",
        cell: ({ row }) =>
          row.original.photoCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="size-3.5" /> {row.original.photoCount}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} pulse={row.original.status === "OPEN"} />
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const incident = row.original;
          const closed = incident.status === "RESOLVED" || incident.status === "REJECTED";
          return (
            <div className="flex justify-end">
              <RowActions
                label={incident.reference}
                actions={[
                  // Opening the sheet reads nothing the table does not already
                  // hold, so it needs no permission of its own — the list
                  // behind it is what `session.read` already gated.
                  { label: "Open incident", icon: Eye, shortcut: "↵", onSelect: () => open(incident) },
                  {
                    label: "Assign to",
                    icon: UserCheck,
                    // POST /incidents/:id/assign — incidents.controller.ts:70
                    permission: "incident.manage",
                    hidden: closed,
                    separatorBefore: true,
                    children: (assignees.data ?? []).slice(0, 12).map((assignee) => ({
                      label: `${assignee.name} — ${titleCase(assignee.role)}`,
                      onSelect: () => {
                        void apply(
                          () => incidentsApi.assign(incident.id, { assignedTo: assignee.id }),
                          (list) =>
                            list.map((i) =>
                              i.id === incident.id
                                ? {
                                    ...i,
                                    assignedTo: assignee.name,
                                    assignedToId: assignee.id,
                                    status: "IN_PROGRESS" as const,
                                  }
                                : i,
                            ),
                          { success: "Incident assigned", description: assignee.name },
                        ).catch(() => {});
                      },
                    })),
                  },
                  {
                    label: "Mark in progress",
                    icon: Clock3,
                    // POST /incidents/:id/start — incidents.controller.ts:83
                    permission: "incident.manage",
                    hidden: closed || incident.status === "IN_PROGRESS",
                    onSelect: () => {
                      void apply(
                        () => incidentsApi.start(incident.id),
                        (list) =>
                          list.map((i) =>
                            i.id === incident.id ? { ...i, status: "IN_PROGRESS" as const } : i,
                          ),
                        { success: "Incident moved to in progress", description: incident.reference },
                      ).catch(() => {});
                    },
                  },
                  {
                    label: "Resolve",
                    icon: CheckCircle2,
                    // POST /incidents/:id/resolve — incidents.controller.ts:98
                    permission: "incident.manage",
                    hidden: closed,
                    separatorBefore: true,
                    onSelect: () => open(incident),
                  },
                  {
                    label: "Reject as invalid",
                    icon: CircleSlash,
                    // POST /incidents/:id/reject — incidents.controller.ts:114
                    permission: "incident.manage",
                    destructive: true,
                    hidden: closed,
                    onSelect: () => {
                      setSelected(incident);
                      setRejectOpen(true);
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [apply, assignees.data],
  );

  const counts = {
    open: incidents.filter((i) => i.status === "OPEN").length,
    inProgress: incidents.filter((i) => i.status === "IN_PROGRESS").length,
    resolved: incidents.filter((i) => i.status === "RESOLVED").length,
    disputes: incidents.filter((i) => i.type === "PARKING_DISPUTE").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Illegal parking, accidents, vehicle damage and disputes reported from the kerb and from the citizen app."
        actions={
          /**
           * `session.read`, not `incident.manage` — POST /incidents is guarded
           * on the former (incidents.controller.ts:55, with the reason spelled
           * out beside it: an attendant reports what they see, and they are not
           * an incident manager). Gating this on `incident.manage` would hide
           * the button from most of the accounts the API would happily accept a
           * report from.
           */
          <Can permission="session.read">
            <Button size="sm" className="h-9" onClick={() => setReportOpen(true)}>
              <ShieldAlert className="size-4" /> Report an incident
            </Button>
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Open" numeric={counts.open} icon={ShieldAlert} accent={counts.open > 8 ? "danger" : "warning"} hint="Not yet picked up" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="In progress" numeric={counts.inProgress} icon={Clock3} accent="info" hint="Assigned to an officer" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Resolved" numeric={counts.resolved} icon={CheckCircle2} accent="success" hint="Closed with a resolution note" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Payment disputes" numeric={counts.disputes} icon={CircleSlash} hint="Charge or duration contested" />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={incidents}
        columns={columns}
        enableSelection
        searchKeys={["reference", "description", "zoneName", "reportedBy", "plateNumber"]}
        searchPlaceholder="Search reference, description, zone or plate…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "OPEN", label: "Open" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "REJECTED", label: "Rejected" },
            ],
          },
          {
            columnId: "type",
            label: "Type",
            options: [
              { value: "ILLEGAL_PARKING", label: "Illegal parking" },
              { value: "ACCIDENT", label: "Accident" },
              { value: "VEHICLE_DAMAGE", label: "Vehicle damage" },
              { value: "PARKING_DISPUTE", label: "Parking dispute" },
              { value: "WRONG_VEHICLE", label: "Wrong vehicle" },
              { value: "OTHER", label: "Other" },
            ],
          },
          {
            columnId: "zoneName",
            label: "Zone",
            options: Array.from(new Set(incidents.map((i) => i.zoneName).filter((z) => z && z !== "—")))
              .sort()
              .map((value) => ({ value, label: value })),
          },
        ]}
        onRefresh={() => {
          if (!isLiveApi) {
            toast.info("Demo data", {
              description: "This screen reads from the bundled demo dataset — there is nothing new to fetch.",
            });
            return;
          }
          void refresh();
        }}
        isRefreshing={isRefreshing}
        onRowClick={open}
        onExport={(rows, columns) => {
          const file = downloadCsv("incidents", rows, columns);
          toast.success("Export ready", { description: `${rows.length} incidents · ${file}` });
        }}
        bulkActions={(rows, clear) => {
          const startable = rows.filter((r) => r.status === "OPEN");
          return (
            <Can permission="incident.manage">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={startable.length === 0}
                onClick={() => {
                  void apply(
                    async () => {
                      for (const incident of startable) await incidentsApi.start(incident.id);
                    },
                    (list) =>
                      list.map((i) =>
                        startable.some((r) => r.id === i.id) ? { ...i, status: "IN_PROGRESS" as const } : i,
                      ),
                    { success: `${startable.length} incidents moved to in progress` },
                  )
                    .then(clear)
                    .catch(() => {});
                }}
              >
                Mark in progress
              </Button>
            </Can>
          );
        }}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No incidents"}
        emptyDescription={
          emptyReason ??
          "Nothing has been reported. Attendants and citizens can both raise incidents from their apps."
        }
      />

      {/* ------------------------------------------------------ detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.reference}</SheetTitle>
                  <StatusBadge status={selected.status} pulse={selected.status === "OPEN"} />
                  <Badge variant="secondary">{titleCase(selected.type)}</Badge>
                </div>
                <SheetDescription>
                  Reported by {selected.reportedBy} · {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="rounded-lg border bg-muted/25 p-3">
                  <p className="text-sm leading-relaxed text-pretty">{selected.description}</p>
                </div>

                <dl className="divide-y divide-border/60">
                  <Field label="Zone">{selected.zoneName}</Field>
                  {selected.plateNumber && (
                    <Field label="Vehicle">
                      <Plate value={selected.plateNumber} />
                    </Field>
                  )}
                  {selected.sessionCode && (
                    <Field label="Session">
                      <span className="font-mono text-xs">{selected.sessionCode}</span>
                    </Field>
                  )}
                  <Field label="Reporter role">{titleCase(selected.reporterRole)}</Field>
                  <Field label="Assigned to">{selected.assignedTo ?? "Unassigned"}</Field>
                  <Field label="Photographs">{selected.photoCount}</Field>
                  {selected.resolvedAt && (
                    <Field label="Closed">{formatDateTime(selected.resolvedAt)}</Field>
                  )}
                </dl>

                {selected.photoCount > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: selected.photoCount }).map((_, i) => (
                      <div
                        key={i}
                        className="grid aspect-square place-items-center rounded-lg border bg-muted/40"
                      >
                        <ImageIcon className="size-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="assignee">Assign to</Label>
                  <Select
                    value={selected.assignedToId ?? "__none"}
                    disabled={
                      !canManage ||
                      selected.status === "RESOLVED" ||
                      selected.status === "REJECTED"
                    }
                    onValueChange={(v) => {
                      if (v === "__none") return;
                      const assignee = (assignees.data ?? []).find((a) => a.id === v);
                      if (!assignee) return;
                      setSelected({
                        ...selected,
                        assignedTo: assignee.name,
                        assignedToId: assignee.id,
                        status: "IN_PROGRESS",
                      });
                      void apply(
                        () => incidentsApi.assign(selected.id, { assignedTo: assignee.id }),
                        (list) =>
                          list.map((i) =>
                            i.id === selected.id
                              ? {
                                  ...i,
                                  assignedTo: assignee.name,
                                  assignedToId: assignee.id,
                                  status: "IN_PROGRESS" as const,
                                }
                              : i,
                          ),
                        { success: "Incident assigned", description: assignee.name },
                      ).catch(() => {});
                    }}
                  >
                    <SelectTrigger id="assignee" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Unassigned</SelectItem>
                      {(assignees.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {titleCase(a.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canManage && <p className="text-xs text-muted-foreground">{NOT_PERMITTED}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="resolution">Resolution note</Label>
                  <Textarea
                    id="resolution"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Evidence reviewed. Charge upheld and explained to the citizen on the phone…"
                  />
                  <p className="text-xs text-muted-foreground">
                    The note is visible to the citizen who raised the report.
                  </p>
                </div>
              </div>

              <SheetFooter className="sm:flex-row">
                {/* Closing an incident either way is `incident.manage`
                    (incidents.controller.ts:98 and :114). Disabled rather than
                    removed, so an officer can see the sheet is complete and
                    that closing it is simply someone else's call. */}
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={!canManage}
                  title={canManage ? undefined : NOT_PERMITTED}
                  onClick={() => {
                    setSheetOpen(false);
                    setRejectOpen(true);
                  }}
                >
                  <CircleSlash className="size-4" /> Reject
                </Button>
                <Button
                  className="flex-1"
                  title={canManage ? undefined : NOT_PERMITTED}
                  // The API requires ten characters, so the button agrees rather
                  // than letting the request bounce back as a validation error.
                  disabled={!canManage || note.trim().length < 10}
                  onClick={() => {
                    void close(selected, "RESOLVED", note.trim())
                      .then(() => setSheetOpen(false))
                      .catch(() => {});
                  }}
                >
                  <CheckCircle2 className="size-4" /> Resolve
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this incident?"
        destructive
        confirmLabel="Reject incident"
        reason={{ label: "Why is this being rejected?", placeholder: "Duplicate report / no evidence / outside our jurisdiction…", required: true }}
        description="The reporter is told the report was reviewed and closed without action. The reason is recorded against your name."
        onConfirm={(reason) => {
          if (selected) void close(selected, "REJECTED", (reason ?? "").trim()).catch(() => {});
        }}
      />

      <IncidentFormSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmit={(draft) => report(draft)}
      />
    </div>
  );
}
