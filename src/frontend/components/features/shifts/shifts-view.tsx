"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Banknote,
  CalendarClock,
  Clock,
  Eye,
  MapPin,
  Printer,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SHIFTS } from "@/frontend/lib/mock";
import { shiftsApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toShift } from "@/frontend/lib/adapters";
import { formatDateTime, formatMoney, relativeTime } from "@/shared/utils/common.util";
import type { Shift } from "@/shared/types/domain.types";

export function ShiftsView() {
  const {
    items: shifts,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Shift>(
    ["shifts", "list"],
    () => listAll((page, pageSize) => shiftsApi.list({ page, pageSize })).then((r) => r.map(toShift)),
    SHIFTS,
  );
  const [selected, setSelected] = React.useState<Shift | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [escalateOpen, setEscalateOpen] = React.useState(false);

  const open = (shift: Shift) => {
    setSelected(shift);
    setSheetOpen(true);
  };

  const columns = React.useMemo<ColumnDef<Shift, unknown>[]>(
    () => [
      {
        accessorKey: "attendantName",
        header: "Attendant",
        meta: "Attendant",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.attendantName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.vendorName} · {row.original.zoneName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "startAt",
        header: "Shift",
        meta: "Shift window",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-sm tabular">{formatDateTime(row.original.startAt).split(",")[1]}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.endAt ? `ended ${relativeTime(row.original.endAt)}` : "still open"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "sessionsCount",
        header: "Sessions",
        meta: "Sessions",
        cell: ({ row }) => <span className="text-sm tabular">{row.original.sessionsCount}</span>,
      },
      {
        accessorKey: "cashExpected",
        header: "Cash expected",
        meta: "Cash expected",
        cell: ({ row }) => <Money value={row.original.cashExpected} />,
      },
      {
        accessorKey: "cashDeposited",
        header: "Deposited",
        meta: "Cash deposited",
        cell: ({ row }) =>
          row.original.cashDeposited === undefined ? (
            <span className="text-xs text-muted-foreground">Pending</span>
          ) : (
            <Money value={row.original.cashDeposited} />
          ),
      },
      {
        accessorKey: "varianceAmount",
        header: "Variance",
        meta: "Variance",
        cell: ({ row }) => {
          const v = row.original.varianceAmount;
          if (v === undefined) return <span className="text-xs text-muted-foreground">—</span>;
          if (v === 0)
            return (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="size-3.5" /> Balanced
              </span>
            );
          return (
            <span className="text-sm font-medium tabular text-red-600 dark:text-red-400">
              {v > 0 ? "+" : ""}
              {formatMoney(v)}
            </span>
          );
        },
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
          const shift = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={shift.attendantName}
                actions={[
                  { label: "Open shift", icon: Eye, shortcut: "↵", onSelect: () => open(shift) },
                  {
                    label: "View GPS check-in",
                    icon: MapPin,
                    onSelect: () => toast.info("GPS check-in", { description: `${shift.zoneName} · ${formatDateTime(shift.startAt)}` }),
                  },
                  {
                    label: "Print shift slip",
                    icon: Printer,
                    onSelect: () => toast.success("Shift slip queued for printing"),
                  },
                  {
                    label: "Verify deposit",
                    icon: BadgeCheck,
                    hidden: shift.status === "OPEN" || shift.status === "VERIFIED",
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(shift);
                      setVerifyOpen(true);
                    },
                  },
                  {
                    label: "Escalate variance",
                    icon: TriangleAlert,
                    destructive: true,
                    hidden: shift.status !== "VARIANCE_FLAGGED",
                    onSelect: () => {
                      setSelected(shift);
                      setEscalateOpen(true);
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

  const openShifts = shifts.filter((s) => s.status === "OPEN").length;
  const flagged = shifts.filter((s) => s.status === "VARIANCE_FLAGGED").length;
  const awaiting = shifts.filter((s) => s.status === "CLOSED").length;
  const varianceTotal = shifts.reduce((s, x) => s + Math.abs(x.varianceAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts and reconciliation"
        description="Attendant attendance with GPS check-in and check-out, and the cash tally that has to balance before a settlement can run."
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Open shifts" numeric={openShifts} icon={Clock} accent="info" hint="Attendants currently working" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Awaiting verification" numeric={awaiting} icon={CalendarClock} accent="warning" hint="Cash deposited, not yet checked" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Variance flagged" numeric={flagged} icon={TriangleAlert} accent={flagged > 0 ? "danger" : "success"} hint="Deposit did not match expectation" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Total variance" value={<Money value={varianceTotal} />} icon={Banknote} accent={varianceTotal > 0 ? "warning" : "success"} hint="Absolute, across all shifts" />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={shifts}
        columns={columns}
        enableSelection
        searchKeys={["attendantName", "vendorName", "zoneName"]}
        searchPlaceholder="Search attendant, vendor or zone…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "OPEN", label: "Open" },
              { value: "CLOSED", label: "Closed" },
              { value: "VERIFIED", label: "Verified" },
              { value: "VARIANCE_FLAGGED", label: "Variance flagged" },
            ],
          },
          {
            columnId: "vendorName",
            label: "Vendor",
            options: Array.from(new Set(shifts.map((s) => s.vendorName).filter((v) => v && v !== "—")))
              .sort()
              .map((value) => ({ value, label: value })),
          },
        ]}
        onRowClick={open}
        onExport={(rows) => toast.success("Export queued", { description: `${rows.length} shifts` })}
        bulkActions={(rows, clear) => {
          const verifiable = rows.filter((r) => r.status === "CLOSED" || r.status === "VARIANCE_FLAGGED");
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={verifiable.length === 0}
              onClick={() => {
                void apply(
                  // Sequential, not concurrent: each verification is a separate
                  // audited act against a named officer, and a half-applied
                  // batch is easier to reason about than an interleaved one.
                  async () => {
                    for (const shift of verifiable) await shiftsApi.verify(shift.id);
                  },
                  (list) =>
                    list.map((s) =>
                      verifiable.some((r) => r.id === s.id) ? { ...s, status: "VERIFIED" as const } : s,
                    ),
                  { success: `${verifiable.length} shifts verified` },
                )
                  .then(clear)
                  .catch(() => {});
              }}
            >
              <BadgeCheck className="size-3.5" /> Verify deposits
            </Button>
          );
        }}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No shifts recorded"}
        emptyDescription={
          emptyReason ?? "Shifts appear when an attendant checks in from the vendor app."
        }
      />

      {/* ------------------------------------------------------ detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.attendantName}</SheetTitle>
                  <StatusBadge status={selected.status} pulse={selected.status === "OPEN"} />
                </div>
                <SheetDescription>
                  {selected.vendorName} · {selected.zoneName}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="rounded-xl border bg-muted/25 p-4">
                  <p className="text-xs text-muted-foreground">Total collected this shift</p>
                  <p className="mt-1 text-2xl font-semibold tabular">
                    {formatMoney(selected.cashExpected + selected.digitalTotal)}
                  </p>
                  <div className="mt-3">
                    <SplitMeter
                      segments={[
                        { label: "Cash", value: selected.cashExpected, className: "bg-chart-3" },
                        { label: "Digital", value: selected.digitalTotal, className: "bg-chart-1" },
                      ]}
                    />
                  </div>
                </div>

                <dl className="divide-y divide-border/60">
                  <Field label="Checked in">{formatDateTime(selected.startAt)}</Field>
                  <Field label="Checked out">
                    {selected.endAt ? formatDateTime(selected.endAt) : "Still on shift"}
                  </Field>
                  <Field label="Sessions handled">{selected.sessionsCount}</Field>
                  <Field label="Cash expected">
                    <Money value={selected.cashExpected} />
                  </Field>
                  <Field label="Cash deposited">
                    {selected.cashDeposited === undefined ? (
                      <span className="text-muted-foreground">Not yet deposited</span>
                    ) : (
                      <Money value={selected.cashDeposited} />
                    )}
                  </Field>
                  <Field label="Digital collected">
                    <Money value={selected.digitalTotal} />
                  </Field>
                  <Field label="Variance">
                    {selected.varianceAmount === undefined ? (
                      "—"
                    ) : selected.varianceAmount === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Balanced</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        {formatMoney(selected.varianceAmount)}
                      </span>
                    )}
                  </Field>
                </dl>

                {selected.status === "VARIANCE_FLAGGED" && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Deposit does not match the cash expected
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground text-pretty">
                      The shortfall is held against the vendor and deducted at settlement unless it is
                      resolved. Escalate if it repeats — a pattern across shifts is what a fraud
                      review looks for.
                    </p>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">GPS trail</p>
                  <div className="relative grid h-32 place-items-center overflow-hidden rounded-lg border bg-muted/30">
                    <div className="absolute inset-0 kmcp-grid-bg opacity-40" />
                    <div className="relative text-center">
                      <MapPin className="mx-auto size-5 text-primary" />
                      <p className="mt-1 text-xs">Check-in and check-out inside {selected.zoneName}</p>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => toast.success("Shift slip printed")}>
                  <Printer className="size-4" /> Print slip
                </Button>
                <Button
                  className="flex-1"
                  disabled={selected.status === "OPEN" || selected.status === "VERIFIED"}
                  onClick={() => {
                    setSheetOpen(false);
                    setVerifyOpen(true);
                  }}
                >
                  <BadgeCheck className="size-4" /> Verify deposit
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        title="Confirm the cash deposit?"
        confirmLabel="Verify deposit"
        description={
          <span>
            Verifying records that{" "}
            <span className="font-medium">{formatMoney(selected?.cashDeposited)}</span> was physically
            received against an expectation of{" "}
            <span className="font-medium">{formatMoney(selected?.cashExpected)}</span>. This releases
            the shift into the next settlement run.
          </span>
        }
        onConfirm={() => {
          const shift = selected;
          if (!shift) return;
          void apply(
            () => shiftsApi.verify(shift.id),
            (list) => list.map((s) => (s.id === shift.id ? { ...s, status: "VERIFIED" as const } : s)),
            { success: "Deposit verified", description: shift.attendantName },
          ).catch(() => {});
        }}
      />

      <ConfirmDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        title="Escalate this variance?"
        destructive
        confirmLabel="Escalate"
        reason={{ label: "What did you find?", placeholder: "Third shortfall this month for the same attendant…", required: true }}
        description="An escalation opens a case against the vendor, notifies their contact, and holds the amount back from the next settlement."
        onConfirm={(reason) => {
          toast.success("Variance escalated", {
            description: `${selected?.attendantName} · ${reason}`,
          });
        }}
      />
    </div>
  );
}
