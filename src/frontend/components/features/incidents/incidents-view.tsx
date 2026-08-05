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
import { Field, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { INCIDENTS, ZONES } from "@/frontend/lib/mock";
import { formatDateTime, relativeTime, titleCase } from "@/shared/utils/common.util";
import type { Incident, IncidentStatus } from "@/shared/types/domain.types";

const ASSIGNEES = [
  "Zone Officer — Park Street",
  "Zone Officer — Ballygunge",
  "Zone Officer — Alipore",
  "Enforcement Desk",
  "Vendor Supervisor",
];

export function IncidentsView() {
  const [incidents, setIncidents] = React.useState<Incident[]>(INCIDENTS);
  const [selected, setSelected] = React.useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const open = (incident: Incident) => {
    setSelected(incident);
    setNote(incident.resolutionNote ?? "");
    setSheetOpen(true);
  };

  const setStatus = (incident: Incident, status: IncidentStatus, message: string, resolution?: string) => {
    setIncidents((list) =>
      list.map((i) =>
        i.id === incident.id
          ? { ...i, status, resolutionNote: resolution ?? i.resolutionNote, resolvedAt: status === "RESOLVED" || status === "REJECTED" ? new Date().toISOString() : undefined }
          : i,
      ),
    );
    toast.success(message, { description: incident.reference });
  };

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
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.zoneName}
              {row.original.plateNumber && ` · ${row.original.plateNumber}`}
            </p>
          </div>
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
                  { label: "Open incident", icon: Eye, shortcut: "↵", onSelect: () => open(incident) },
                  {
                    label: "Assign to",
                    icon: UserCheck,
                    hidden: closed,
                    separatorBefore: true,
                    children: ASSIGNEES.map((assignee) => ({
                      label: assignee,
                      onSelect: () => {
                        setIncidents((list) =>
                          list.map((i) =>
                            i.id === incident.id ? { ...i, assignedTo: assignee, status: "IN_PROGRESS" } : i,
                          ),
                        );
                        toast.success("Incident assigned", { description: assignee });
                      },
                    })),
                  },
                  {
                    label: "Mark in progress",
                    icon: Clock3,
                    hidden: closed || incident.status === "IN_PROGRESS",
                    onSelect: () => setStatus(incident, "IN_PROGRESS", "Incident moved to in progress"),
                  },
                  {
                    label: "Resolve",
                    icon: CheckCircle2,
                    hidden: closed,
                    separatorBefore: true,
                    onSelect: () => open(incident),
                  },
                  {
                    label: "Reject as invalid",
                    icon: CircleSlash,
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
    [],
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
            options: ZONES.map((z) => ({ value: z.name, label: z.name })),
          },
        ]}
        onRowClick={open}
        onExport={(rows) => toast.success("Export queued", { description: `${rows.length} incidents` })}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                setIncidents((list) =>
                  list.map((i) => (rows.some((r) => r.id === i.id) ? { ...i, status: "IN_PROGRESS" } : i)),
                );
                toast.success(`${rows.length} incidents moved to in progress`);
                clear();
              }}
            >
              Mark in progress
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.info("Assign to an officer", { description: `${rows.length} incidents selected` });
              }}
            >
              Assign
            </Button>
          </>
        )}
        emptyTitle="No incidents"
        emptyDescription="Nothing has been reported. Attendants and citizens can both raise incidents from their apps."
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
                    value={selected.assignedTo ?? "__none"}
                    onValueChange={(v) =>
                      setSelected({ ...selected, assignedTo: v === "__none" ? undefined : v })
                    }
                  >
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Unassigned</SelectItem>
                      {ASSIGNEES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    setSheetOpen(false);
                    setRejectOpen(true);
                  }}
                >
                  <CircleSlash className="size-4" /> Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={note.trim().length < 4}
                  onClick={() => {
                    setStatus(selected, "RESOLVED", "Incident resolved", note.trim());
                    setSheetOpen(false);
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
          if (selected) setStatus(selected, "REJECTED", "Incident rejected", reason);
        }}
      />
    </div>
  );
}
