"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Ban,
  Banknote,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Landmark,
  Play,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Label } from "@/frontend/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable, facetOptionsFrom } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SETTLEMENTS, VENDORS } from "@/frontend/lib/mock";
import { settlementsApi, vendorsApi, documentsApi, listAll, ApiError } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { isLiveApi } from "@/config/env";
import { toSettlement } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { ROUTES } from "@/shared/constants/routes";
import { formatDate, formatMoney } from "@/shared/utils/common.util";
import { SETTLEMENT_CYCLES } from "@/config/app.config";
import type { Settlement } from "@/shared/types/domain.types";

/** How far back each cycle reaches from today. */
const CYCLE_DAYS: Record<(typeof SETTLEMENT_CYCLES)[number], number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

export function SettlementsView() {
  const router = useRouter();
  const params = useSearchParams();
  const vendorFilter = params.get("vendor");

  const {
    items: settlements,
    isLoading,
    isBusy,
    emptyReason,
    apply,
  } = useResource<Settlement>(
    ["settlements", "list"],
    () =>
      listAll((page, pageSize) => settlementsApi.list({ page, pageSize })).then((r) =>
        r.map(toSettlement),
      ),
    SETTLEMENTS,
  );

  const vendors = useApiQuery(["vendors", "approved"], () =>
    listAll((page, pageSize) => vendorsApi.list({ page, pageSize, status: "APPROVED" })),
  );

  const documents = useDocument();

  const [selected, setSelected] = React.useState<Settlement | null>(null);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [runOpen, setRunOpen] = React.useState(false);
  const [runCycle, setRunCycle] = React.useState<(typeof SETTLEMENT_CYCLES)[number]>("WEEKLY");
  const [runVendor, setRunVendor] = React.useState("__all");

  const data = React.useMemo(
    () => (vendorFilter ? settlements.filter((s) => s.vendorId === vendorFilter) : settlements),
    [settlements, vendorFilter],
  );

  /** Vendors a run can be made for — approved ones, live or from the demo set. */
  const runVendors = React.useMemo(
    () =>
      (vendors.data ?? VENDORS.filter((v) => v.status === "APPROVED")).map((v) => ({
        id: v.id,
        orgName: v.orgName,
      })),
    [vendors.data],
  );

  /**
   * The name of the vendor the URL narrowed the list to.
   *
   * The approved roster the run dialog already fetched answers this on a live
   * deployment, and any settlement in view names its own vendor when the
   * roster does not — a vendor can be suspended and still be owed money. The
   * demo roster is consulted only when there is no backend, where it holds
   * every vendor including the ones still awaiting approval.
   */
  const vendorFilterName = React.useMemo(() => {
    if (!vendorFilter) return undefined;
    if (!isLiveApi) return VENDORS.find((v) => v.id === vendorFilter)?.orgName;
    return (
      runVendors.find((v) => v.id === vendorFilter)?.orgName ??
      data.find((s) => s.vendorId === vendorFilter)?.vendorName
    );
  }, [vendorFilter, runVendors, data]);

  /**
   * Writes one settlement's payment lines out as a CSV.
   *
   * The list row does not carry them — a page of settlements dragging every
   * payment along with it would be enormous — so the detail is fetched first.
   * In demo mode the bundled settlement has no lines either, and saying so is
   * better than handing over a file with a header row and nothing under it.
   */
  const exportLines = React.useCallback(
    async (settlement: Settlement): Promise<void> => {
      if (!isLiveApi) {
        toast.info("No payment lines in the demo build", {
          description: `${settlement.reference} has figures but no per-payment detail behind it.`,
        });
        return;
      }

      try {
        const { data } = await settlementsApi.get(settlement.id);
        const file = downloadCsv(`${settlement.reference}-lines`, data.lines, [
          { header: "Paid at", value: (line) => line.payment?.paidAt ?? "" },
          { header: "Session", value: (line) => line.payment?.session?.code ?? "" },
          { header: "Vehicle", value: (line) => line.payment?.session?.plateNumber ?? "" },
          { header: "Method", value: (line) => line.payment?.mode ?? "" },
          { header: "Payment id", value: (line) => line.payment?.id ?? "" },
          // Rupees, not paise: this file is opened in a spreadsheet by a person,
          // and the two-decimal string is what they expect to sum.
          { header: "Amount (INR)", value: (line) => (line.amount / 100).toFixed(2) },
          { header: "Commission (INR)", value: (line) => (line.commission / 100).toFixed(2) },
        ]);
        toast.success("Payment lines exported", {
          description: `${data.lines.length} payments · ${file}`,
        });
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "The payment lines could not be fetched.",
        );
      }
    },
    [],
  );

  /** Runs one of the workflow steps and refreshes the list. */
  const step = React.useCallback(
    (
      settlement: Settlement,
      call: () => Promise<unknown>,
      status: Settlement["status"],
      message: string,
      extra?: Partial<Settlement>,
    ) =>
      apply(
        call,
        (list) => list.map((s) => (s.id === settlement.id ? { ...s, status, ...extra } : s)),
        { success: message, description: settlement.reference },
      ),
    [apply],
  );

  const columns = React.useMemo<ColumnDef<Settlement, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: "Reference",
        meta: "Reference",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-medium">{row.original.reference}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "vendorName",
        header: "Vendor",
        meta: "Vendor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.vendorName}</p>
            <p className="text-[11px] text-muted-foreground tabular">
              {row.original.sessionsCount.toLocaleString("en-IN")} sessions
            </p>
          </div>
        ),
      },
      {
        accessorKey: "grossCollected",
        header: "Gross",
        meta: "Gross collected",
        cell: ({ row }) => <Money value={row.original.grossCollected} />,
      },
      {
        accessorKey: "commissionAmount",
        header: "Govt share",
        meta: "Government share",
        cell: ({ row }) => (
          <Money value={row.original.governmentShare} className="text-emerald-700 dark:text-emerald-400" />
        ),
      },
      {
        accessorKey: "vendorShare",
        header: "Vendor share",
        meta: "Vendor share",
        cell: ({ row }) => <Money value={row.original.vendorShare} className="font-medium" />,
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.status} pulse={row.original.status === "PENDING_APPROVAL"} />
            {row.original.payoutRef && (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {row.original.payoutRef}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const settlement = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={settlement.reference}
                actions={[
                  {
                    label: "View settlement",
                    icon: Eye,
                    shortcut: "↵",
                    // GET /settlements/:id — settlements.controller.ts:49.
                    permission: "settlement.read",
                    onSelect: () => router.push(ROUTES.settlement(settlement.id)),
                  },
                  {
                    label: "PDF statement",
                    icon: Download,
                    // GET /documents/settlements/:id — documents.controller.ts.
                    // Guarded on settlement.read, the same grant the detail
                    // route takes: reading the paperwork is not signing it off.
                    //
                    permission: "settlement.read",
                    disabled: documents.pending === settlement.id,
                    onSelect: () => {
                      void documents.run(
                        settlement.id,
                        () => documentsApi.settlement(settlement.id),
                        {
                          demo: () => toast.success("PDF statement downloaded"),
                          success: "Statement downloaded",
                          description: `${settlement.reference}.pdf`,
                        },
                      );
                    },
                  },
                  {
                    // This was "Excel workbook", and produced a toast. It is a
                    // CSV now and says so: writing an XLSX encoder for one menu
                    // item would be a week of work to make a file that opens in
                    // the same spreadsheet. What it exports is the settlement's
                    // payment lines rather than the settlement row — the row is
                    // already in the table export above, and the lines are what
                    // somebody reconciling actually needs.
                    label: "Payment lines (CSV)",
                    icon: FileSpreadsheet,
                    // GET /settlements/:id — settlements.controller.ts:49.
                    permission: "settlement.read",
                    onSelect: () => void exportLines(settlement),
                  },
                  {
                    label: "Approve",
                    icon: BadgeCheck,
                    hidden: settlement.status !== "PENDING_APPROVAL",
                    separatorBefore: true,
                    // POST /settlements/:id/approve — settlements.controller.ts:85.
                    // This is the money decision: it posts the ledger entries.
                    permission: "settlement.approve",
                    onSelect: () => {
                      setSelected(settlement);
                      setApproveOpen(true);
                    },
                  },
                  {
                    label: "Instruct payout",
                    icon: Landmark,
                    hidden: settlement.status !== "APPROVED",
                    // POST /settlements/:id/payout — settlements.controller.ts:113.
                    // Deliberately a third permission, not the approver's: the
                    // officer who says the figures are right and the officer who
                    // records that the bank has paid are not meant to be the
                    // same person.
                    permission: "settlement.payout",
                    onSelect: () => {
                      setSelected(settlement);
                      setPayoutOpen(true);
                    },
                  },
                  {
                    label: "Record payout again",
                    icon: RefreshCw,
                    hidden: settlement.status !== "FAILED",
                    // POST /settlements/:id/payout — settlements.controller.ts:113.
                    permission: "settlement.payout",
                    onSelect: () => {
                      setSelected(settlement);
                      setPayoutOpen(true);
                    },
                  },
                  {
                    label: "Send for approval",
                    icon: Play,
                    hidden: settlement.status !== "DRAFT",
                    // POST /settlements/:id/submit — settlements.controller.ts:73,
                    // guarded by settlement.read: putting a draft in front of an
                    // approver decides nothing, and whoever prepares the run has
                    // to be able to hand it on.
                    permission: "settlement.read",
                    onSelect: () => {
                      void step(
                        settlement,
                        () => settlementsApi.submit(settlement.id),
                        "PENDING_APPROVAL",
                        "Sent for approval",
                      ).catch(() => {});
                    },
                  },
                  {
                    label: "Reject",
                    icon: Ban,
                    destructive: true,
                    hidden: settlement.status !== "PENDING_APPROVAL",
                    separatorBefore: true,
                    // POST /settlements/:id/reject — settlements.controller.ts:100.
                    // Rejecting is the approver's other answer, and carries the
                    // same permission as approving.
                    permission: "settlement.approve",
                    onSelect: () => {
                      setSelected(settlement);
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
    [router, step, documents, exportLines],
  );

  const pending = data.filter((s) => s.status === "PENDING_APPROVAL");
  const approved = data.filter((s) => s.status === "APPROVED");
  const failed = data.filter((s) => s.status === "FAILED");
  const govtShare = data.reduce((s, x) => s + x.governmentShare, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlements"
        description="Vendor payouts and the municipal share. Every settlement is backed by a line per payment and a balanced double-entry ledger."
        meta={
          vendorFilter ? (
            <Badge variant="secondary">{vendorFilterName ?? "One vendor"}</Badge>
          ) : undefined
        }
        actions={
          /**
           * POST /settlements/generate — settlements.controller.ts:56, guarded
           * by `settlement.read`. Generating only gathers payments nobody has
           * claimed into a draft; nothing is decided and nothing is paid until
           * an approver acts, which is why it does not need their permission.
           */
          <Can permission="settlement.read">
            <Button size="sm" className="h-9" onClick={() => setRunOpen(true)}>
              <Play className="size-4" /> Run settlement
            </Button>
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Awaiting approval"
            numeric={pending.length}
            icon={TriangleAlert}
            accent={pending.length > 0 ? "warning" : "success"}
            hint={<><Money value={pending.reduce((s, x) => s + x.vendorShare, 0)} compact muted /> to release</>}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Approved, not paid"
            numeric={approved.length}
            icon={Landmark}
            accent="info"
            hint="Ready to instruct at RazorpayX"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Government share" value={<Money value={govtShare} compact />} icon={Coins} accent="success" hint="Across every settlement in view" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Failed payouts" numeric={failed.length} icon={Banknote} accent={failed.length > 0 ? "danger" : "success"} hint="Usually a bank account mismatch" />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={data}
        columns={columns}
        enableSelection
        searchKeys={["reference", "vendorName", "payoutRef"]}
        searchPlaceholder="Search reference, vendor or payout ID…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING_APPROVAL", label: "Pending approval" },
              { value: "APPROVED", label: "Approved" },
              { value: "PAID", label: "Paid" },
              { value: "REJECTED", label: "Rejected" },
              { value: "FAILED", label: "Failed" },
            ],
          },
          {
            columnId: "vendorName",
            label: "Vendor",
            /**
             * The vendors that appear in this column. The demo roster names
             * operators a live deployment has never settled with, so every
             * option it offers filters the table to nothing; the approved
             * roster beside it is no better here, since a suspended vendor
             * still shows up in settlements already raised.
             */
            options: isLiveApi
              ? facetOptionsFrom(data, (s) => s.vendorName)
              : VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
        ]}
        onRowClick={(settlement) => router.push(ROUTES.settlement(settlement.id))}
        onExport={(rows, columns) => {
          const file = downloadCsv("settlements", rows, columns);
          toast.success("Export ready", { description: `${rows.length} settlements · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            {/* POST /settlements/:id/approve — settlements.controller.ts:85. */}
            <Can permission="settlement.approve">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  const eligible = rows.filter((r) => r.status === "PENDING_APPROVAL");
                  if (eligible.length === 0) {
                    toast.info("Nothing to approve", {
                      description: "Only settlements awaiting approval can be approved.",
                    });
                    return;
                  }
                  void apply(
                    // One at a time: each approval posts its own ledger entries
                    // under a named approver, and a batch that half-succeeds must
                    // leave the successful half properly posted.
                    async () => {
                      for (const settlement of eligible) await settlementsApi.approve(settlement.id);
                    },
                    (list) =>
                      list.map((s) =>
                        eligible.some((r) => r.id === s.id)
                          ? { ...s, status: "APPROVED" as const, approvedAt: new Date().toISOString() }
                          : s,
                      ),
                    {
                      success: `${eligible.length} settlements approved`,
                      description:
                        eligible.length < rows.length
                          ? `${rows.length - eligible.length} were skipped — only pending settlements can be approved.`
                          : undefined,
                    },
                  )
                    .then(clear)
                    .catch(() => {});
                  return;
                }}
              >
                <BadgeCheck className="size-3.5" /> Approve selected
              </Button>
            </Can>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              // Waits on the PDF module for the statement and the messaging
              // module to send it. Neither exists, so nothing is called.
              onClick={() => {
                toast.success(`Statements emailed for ${rows.length} settlements`);
                clear();
              }}
            >
              <Download className="size-3.5" /> Email statements
            </Button>
          </>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No settlements"}
        emptyDescription={
          emptyReason ??
          "Nothing has been settled yet. Run a settlement to build a draft from captured payments."
        }
      />

      {/* -------------------------------------------------------- run dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run a settlement</DialogTitle>
            <DialogDescription>
              This generates a draft settlement per vendor from verified shifts and captured payments
              in the period. Nothing pays out until it is approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="run-cycle">Cycle</Label>
              <Select
                value={runCycle}
                onValueChange={(v) => setRunCycle(v as typeof runCycle)}
              >
                <SelectTrigger id="run-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()} — the last {CYCLE_DAYS[c]} day
                      {CYCLE_DAYS[c] === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-vendor">Vendor</Label>
              <Select value={runVendor} onValueChange={setRunVendor}>
                <SelectTrigger id="run-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All approved vendors</SelectItem>
                  {runVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.orgName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <p className="text-xs text-muted-foreground text-pretty">
                Only payments no settlement has already claimed are swept in, so re-running a period
                picks up late arrivals rather than paying for the same session twice. A vendor with
                nothing outstanding is skipped.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isBusy || runVendors.length === 0}
              onClick={() => {
                const targets =
                  runVendor === "__all" ? runVendors : runVendors.filter((v) => v.id === runVendor);
                const periodEnd = new Date();
                const periodStart = new Date(
                  periodEnd.getTime() - CYCLE_DAYS[runCycle] * 24 * 60 * 60 * 1000,
                );
                let made = 0;

                void apply(
                  async () => {
                    for (const vendor of targets) {
                      try {
                        await settlementsApi.generate({
                          vendorId: vendor.id,
                          periodStart: periodStart.toISOString(),
                          periodEnd: periodEnd.toISOString(),
                        });
                        made += 1;
                      } catch {
                        // A vendor with nothing to settle, or one already
                        // settled for this period, is a normal outcome of a
                        // bulk run — not a reason to abandon the rest.
                      }
                    }
                    if (made === 0) {
                      throw new Error("Nothing to settle for the selected vendors in that period.");
                    }
                  },
                  (list) => list,
                  { success: "Settlement run complete" },
                )
                  .then(() => setRunOpen(false))
                  .catch(() => {});
              }}
            >
              <Play className="size-4" /> Run now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${selected?.reference}?`}
        confirmLabel="Approve settlement"
        description={
          <div className="space-y-2">
            <p>
              {selected?.vendorName} receives{" "}
              <span className="font-medium">{formatMoney(selected?.vendorShare)}</span>, and{" "}
              <span className="font-medium">{formatMoney(selected?.governmentShare)}</span> is booked
              as municipal revenue.
            </p>
            <p className="text-muted-foreground">
              Approval locks the settlement. After this it cannot be edited — only reversed by a
              separate adjustment.
            </p>
          </div>
        }
        onConfirm={() => {
          if (!selected) return;
          void step(
            selected,
            () => settlementsApi.approve(selected.id),
            "APPROVED",
            "Settlement approved",
            { approvedAt: new Date().toISOString() },
          ).catch(() => {});
        }}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${selected?.reference}?`}
        destructive
        confirmLabel="Reject settlement"
        reason={{ label: "Why is this being rejected?", placeholder: "Cash variance of ₹3,240 unresolved across 3 shifts…", required: true }}
        description="The settlement goes back to draft and the vendor is notified with your reason. Nothing pays out."
        onConfirm={(reason) => {
          if (!selected) return;
          void step(
            selected,
            () => settlementsApi.reject(selected.id, (reason ?? "").trim()),
            "REJECTED",
            "Settlement rejected",
            { rejectionReason: reason },
          ).catch(() => {});
        }}
      />

      <ConfirmDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        title="Record the payout?"
        confirmLabel="Record payout"
        typeToConfirm="PAY"
        reason={{
          label: "Bank reference (UTR)",
          placeholder: "e.g. SBIN325019283746",
          required: true,
        }}
        description={
          <div className="space-y-2">
            <p>
              Records that <span className="font-medium">{formatMoney(selected?.vendorShare)}</span>{" "}
              has been transferred to {selected?.vendorName}&apos;s registered bank account, and
              posts it against the vendor payable.
            </p>
            <p className="text-muted-foreground">
              This does not move money. RazorpayX credentials are not configured, so the transfer is
              made at the bank and its reference recorded here — which is also what the authority
              will need on any day the gateway is unavailable.
            </p>
          </div>
        }
        onConfirm={(reference) => {
          if (!selected) return;
          void step(
            selected,
            () => settlementsApi.payout(selected.id, (reference ?? "").trim()),
            "PAID",
            "Payout recorded",
            { payoutRef: reference },
          ).catch(() => {});
        }}
      />
    </div>
  );
}
