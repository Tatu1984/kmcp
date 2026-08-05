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
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SETTLEMENTS, VENDORS } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { formatDate, formatMoney } from "@/shared/utils/common.util";
import { SETTLEMENT_CYCLES } from "@/config/app.config";
import type { Settlement } from "@/shared/types/domain.types";

export function SettlementsView() {
  const router = useRouter();
  const params = useSearchParams();
  const vendorFilter = params.get("vendor");

  const [settlements, setSettlements] = React.useState<Settlement[]>(SETTLEMENTS);
  const [selected, setSelected] = React.useState<Settlement | null>(null);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [runOpen, setRunOpen] = React.useState(false);

  const data = React.useMemo(
    () => (vendorFilter ? settlements.filter((s) => s.vendorId === vendorFilter) : settlements),
    [settlements, vendorFilter],
  );

  const setStatus = (id: string, status: Settlement["status"], message: string, extra?: Partial<Settlement>) => {
    setSettlements((list) => list.map((s) => (s.id === id ? { ...s, status, ...extra } : s)));
    toast.success(message);
  };

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
                    onSelect: () => router.push(ROUTES.settlement(settlement.id)),
                  },
                  {
                    label: "Download statement",
                    icon: Download,
                    children: [
                      { label: "PDF statement", onSelect: () => toast.success("PDF statement downloaded") },
                      { label: "Excel workbook", onSelect: () => toast.success("Excel workbook downloaded") },
                    ],
                  },
                  {
                    label: "Approve",
                    icon: BadgeCheck,
                    hidden: settlement.status !== "PENDING_APPROVAL",
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(settlement);
                      setApproveOpen(true);
                    },
                  },
                  {
                    label: "Instruct payout",
                    icon: Landmark,
                    hidden: settlement.status !== "APPROVED",
                    onSelect: () => {
                      setSelected(settlement);
                      setPayoutOpen(true);
                    },
                  },
                  {
                    label: "Retry payout",
                    icon: RefreshCw,
                    hidden: settlement.status !== "FAILED",
                    onSelect: () =>
                      setStatus(settlement.id, "PAID", "Payout retried", {
                        payoutRef: `pout_R${Math.floor(Math.random() * 1e8)}`,
                      }),
                  },
                  {
                    label: "Reject",
                    icon: Ban,
                    destructive: true,
                    hidden: settlement.status !== "PENDING_APPROVAL",
                    separatorBefore: true,
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
    [router],
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
            <Badge variant="secondary">
              {VENDORS.find((v) => v.id === vendorFilter)?.orgName}
            </Badge>
          ) : undefined
        }
        actions={
          <Button size="sm" className="h-9" onClick={() => setRunOpen(true)}>
            <Play className="size-4" /> Run settlement
          </Button>
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
            options: VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
        ]}
        onRowClick={(settlement) => router.push(ROUTES.settlement(settlement.id))}
        onExport={(rows) => toast.success("Export queued", { description: `${rows.length} settlements` })}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                const eligible = rows.filter((r) => r.status === "PENDING_APPROVAL");
                setSettlements((list) =>
                  list.map((s) =>
                    eligible.some((r) => r.id === s.id)
                      ? { ...s, status: "APPROVED", approvedBy: "Sudipta Banerjee", approvedAt: new Date().toISOString() }
                      : s,
                  ),
                );
                toast.success(`${eligible.length} settlements approved`, {
                  description:
                    eligible.length < rows.length
                      ? `${rows.length - eligible.length} were skipped — only pending settlements can be approved.`
                      : undefined,
                });
                clear();
              }}
            >
              <BadgeCheck className="size-3.5" /> Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`Statements emailed for ${rows.length} settlements`);
                clear();
              }}
            >
              <Download className="size-3.5" /> Email statements
            </Button>
          </>
        )}
        emptyTitle="No settlements"
        emptyDescription="Settlements are generated on the configured cycle from verified shifts and captured payments."
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
              <Select defaultValue="WEEKLY">
                <SelectTrigger id="run-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-vendor">Vendor</Label>
              <Select defaultValue="__all">
                <SelectTrigger id="run-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All approved vendors</SelectItem>
                  {VENDORS.filter((v) => v.status === "APPROVED").map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.orgName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <p className="text-xs text-muted-foreground text-pretty">
                Shifts with an unresolved cash variance are excluded from the run and carried to the
                next cycle. Resolve them first if they should be included.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setRunOpen(false);
                toast.success("Settlement run queued", {
                  description: "Drafts will appear here in a few moments, ready for approval.",
                });
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
          if (selected)
            setStatus(selected.id, "APPROVED", "Settlement approved", {
              approvedBy: "Sudipta Banerjee (Deputy Commissioner)",
              approvedAt: new Date().toISOString(),
            });
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
          if (selected) setStatus(selected.id, "REJECTED", "Settlement rejected", { rejectionReason: reason });
        }}
      />

      <ConfirmDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        title="Instruct the payout?"
        confirmLabel="Send to RazorpayX"
        typeToConfirm="PAY"
        description={
          <div className="space-y-2">
            <p>
              <span className="font-medium">{formatMoney(selected?.vendorShare)}</span> will be
              transferred to {selected?.vendorName}&apos;s registered bank account.
            </p>
            <p className="text-muted-foreground">
              Payouts cannot be recalled once the bank accepts them. The status here updates from the
              RazorpayX webhook, not from this screen.
            </p>
          </div>
        }
        onConfirm={() => {
          if (selected)
            setStatus(selected.id, "PAID", "Payout instructed", {
              payoutRef: `pout_R${Math.floor(Math.random() * 1e8)}`,
            });
        }}
      />
    </div>
  );
}
