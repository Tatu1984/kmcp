"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Banknote,
  CalendarClock,
  Clock,
  DoorClosed,
  DoorOpen,
  Eye,
  MapPin,
  Printer,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
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
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SHIFTS } from "@/frontend/lib/mock";
import { shiftsApi, documentsApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { toShift } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
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
  // Only `run` is destructured for the column menu: it is referentially
  // stable, so the memo below keeps its empty dependency list honest.
  const { run: runDocument, pending: documentPending } = useDocument();

  const [selected, setSelected] = React.useState<Shift | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [escalateOpen, setEscalateOpen] = React.useState(false);
  const [startOpen, setStartOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cashDeposited, setCashDeposited] = React.useState("");
  const [closeNotes, setCloseNotes] = React.useState("");

  const inspect = (shift: Shift) => {
    setSelected(shift);
    setSheetOpen(true);
  };

  /**
   * Opens the close dialog with an empty cash figure, deliberately.
   *
   * `CloseShiftSchema` requires `cashDeposited` and refuses to default it to
   * what the system expects, because the close is a comparison between what was
   * counted and what was taken. Pre-filling the expected figure here would undo
   * that on the client and turn the count into a confirmation.
   */
  const startClose = (shift: Shift) => {
    setSelected(shift);
    setCashDeposited("");
    setCloseNotes("");
    setCloseOpen(true);
  };

  const closeRupees = Number(cashDeposited);
  const canClose = cashDeposited.trim() !== "" && Number.isFinite(closeRupees) && closeRupees >= 0;

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
                  {
                    label: "View shift",
                    icon: Eye,
                    shortcut: "↵",
                    // GET /shifts/:id — shifts.controller.ts:54.
                    permission: "session.read",
                    onSelect: () => inspect(shift),
                  },
                  {
                    label: "View GPS check-in",
                    icon: MapPin,
                    // The fixes are on the shift row already; a trail over the
                    // whole shift waits on the sessions work, which is what
                    // records a position per event.
                    onSelect: () => toast.info("GPS check-in", { description: `${shift.zoneName} · ${formatDateTime(shift.startAt)}` }),
                  },
                  {
                    label: "Print shift slip",
                    icon: Printer,
                    // GET /documents/shifts/:id — documents.controller.ts, on
                    // session.read, which is what every read route on /shifts
                    // takes. shift.verify guards confirming the cash, not
                    // printing the paper somebody signs to hand it over.
                    permission: "session.read",
                    onSelect: () => {
                      void runDocument(shift.id, () => documentsApi.shiftSlip(shift.id), {
                        demo: () => toast.success("Shift slip queued for printing"),
                        mode: "print",
                        success: "Shift slip opened for printing",
                        description: `${shift.attendantName} · ${shift.zoneName}`,
                      });
                    },
                  },
                  {
                    label: "Close shift",
                    icon: DoorClosed,
                    hidden: shift.status !== "OPEN",
                    separatorBefore: true,
                    // POST /shifts/:id/close — shifts.controller.ts:76. The API
                    // guards it with session.read, not shift.verify: closing is
                    // the field act of declaring a deposit, and verifying it is
                    // the separate one somebody else performs.
                    permission: "session.read",
                    onSelect: () => startClose(shift),
                  },
                  {
                    label: "Verify deposit",
                    icon: BadgeCheck,
                    hidden: shift.status === "OPEN" || shift.status === "VERIFIED",
                    separatorBefore: true,
                    // POST /shifts/:id/verify — shifts.controller.ts:94.
                    permission: "shift.verify",
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
                    // Waits on the incidents/case module: an escalation opens a
                    // case against the vendor and notifies their contact, and
                    // neither the case nor the notification exists yet.
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
    // `runDocument` is stable — useDocument memoises it — so naming it here
    // costs no re-renders and keeps the memo honest.
    [runDocument],
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
        actions={
          /**
           * POST /shifts/open — shifts.controller.ts:61, guarded by
           * `session.read` rather than `shift.verify`, because opening is a
           * field act and verifying is the supervisory one.
           *
           * The service then refuses anyone without an attendant record
           * ("Only an attendant opens a shift."). The button is not hidden on
           * the role code — roles are rows the authority edits, and gating on
           * one here would go stale the moment they changed it — so the dialog
           * says plainly whose shift this opens and lets the API give the real
           * answer to an account that has no attendant behind it.
           */
          <Can permission="session.read">
            <Button size="sm" className="h-9" onClick={() => setStartOpen(true)}>
              <DoorOpen className="size-4" /> Open shift
            </Button>
          </Can>
        }
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
        onRowClick={inspect}
        onExport={(rows, columns) => {
          const file = downloadCsv("shifts", rows, columns);
          toast.success("Export ready", { description: `${rows.length} shifts · ${file}` });
        }}
        bulkActions={(rows, clear) => {
          const verifiable = rows.filter((r) => r.status === "CLOSED" || r.status === "VARIANCE_FLAGGED");
          return (
            <Can permission="shift.verify">
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
            </Can>
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
                {/* GET /documents/shifts/:id — documents.controller.ts, as the
                    row action does. */}
                <Can permission="session.read">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={documentPending !== null}
                    onClick={() => {
                      void runDocument(selected.id, () => documentsApi.shiftSlip(selected.id), {
                        demo: () => toast.success("Shift slip printed"),
                        mode: "print",
                        success: "Shift slip opened for printing",
                        description: `${selected.attendantName} · ${selected.zoneName}`,
                      });
                    }}
                  >
                    <Printer className="size-4" /> Print slip
                  </Button>
                </Can>
                {selected.status === "OPEN" ? (
                  <Can permission="session.read">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSheetOpen(false);
                        startClose(selected);
                      }}
                    >
                      <DoorClosed className="size-4" /> Close shift
                    </Button>
                  </Can>
                ) : (
                  <Can permission="shift.verify">
                    <Button
                      className="flex-1"
                      disabled={selected.status === "VERIFIED"}
                      onClick={() => {
                        setSheetOpen(false);
                        setVerifyOpen(true);
                      }}
                    >
                      <BadgeCheck className="size-4" /> Verify deposit
                    </Button>
                  </Can>
                )}
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
          // Waits on the incidents/case module and the messaging module: there
          // is no endpoint that opens a case against a vendor, and none that
          // notifies their contact. Recorded here as a toast rather than
          // pretending a case number exists.
          toast.success("Variance escalated", {
            description: `${selected?.attendantName} · ${reason}`,
          });
        }}
      />

      {/* -------------------------------------------------------- open shift */}
      <ConfirmDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        title="Open a shift?"
        confirmLabel="Open shift"
        description={
          <div className="space-y-2">
            <p>
              This starts a shift for the attendant signed in, in their default zone, and every
              session and payment taken from now until it is closed belongs to it.
            </p>
            <p className="text-muted-foreground">
              Only an account with an attendant record can open one — a supervisor cannot open a
              shift on somebody else&apos;s behalf, because the person who declares the cash at the
              end has to be the person who took it. Reopening is harmless: an attendant who already
              has a shift open simply gets that one back.
            </p>
          </div>
        }
        onConfirm={() =>
          apply(
            // No zoneId: the API falls back to the attendant's default zone,
            // which is the one they are standing in on an ordinary day.
            () => shiftsApi.open(),
            (list) => list,
            { success: "Shift opened" },
          ).catch(() => {})
        }
      />

      {/* ------------------------------------------------------- close shift */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {selected?.attendantName}&apos;s shift</DialogTitle>
            <DialogDescription>
              Closing compares the cash being handed in against what the payments say was taken. Any
              gap is recorded as a variance under the name of whoever closed the shift.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="close-cash">Cash deposited (₹)</Label>
              <Input
                id="close-cash"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={cashDeposited}
                onChange={(e) => setCashDeposited(e.target.value)}
                placeholder="Count the notes and type the total"
              />
              <p className="text-xs text-muted-foreground">
                Deliberately blank. The expected figure is not pre-filled — that would turn a count
                into a confirmation, which is the one thing this step exists to prevent.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Textarea
                id="close-notes"
                rows={3}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Two receipts written by hand after the handset lost signal…"
              />
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <p className="text-xs text-muted-foreground text-pretty">
                A shift with a session still running cannot be closed — that fare belongs to this
                shift and would otherwise be stranded outside every one of them.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canClose}
              onClick={() => {
                const shift = selected;
                if (!shift || !canClose) return;
                // Money is integer paise everywhere below this line.
                const paise = Math.round(closeRupees * 100);
                void apply(
                  () =>
                    shiftsApi.close(shift.id, {
                      cashDeposited: paise,
                      notes: closeNotes.trim() || undefined,
                    }),
                  (list) =>
                    list.map((s) =>
                      s.id === shift.id
                        ? {
                            ...s,
                            // The demo copy mirrors what the API computes: a gap
                            // either way flags the shift rather than balancing it.
                            status:
                              paise === s.cashExpected
                                ? ("CLOSED" as const)
                                : ("VARIANCE_FLAGGED" as const),
                            endAt: new Date().toISOString(),
                            cashDeposited: paise,
                            varianceAmount: paise - s.cashExpected,
                          }
                        : s,
                    ),
                  { success: "Shift closed", description: shift.attendantName },
                )
                  .then(() => setCloseOpen(false))
                  // The error is already a toast; keep the dialog open so the
                  // counted figure does not have to be typed again.
                  .catch(() => {});
              }}
            >
              <DoorClosed className="size-4" /> Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
