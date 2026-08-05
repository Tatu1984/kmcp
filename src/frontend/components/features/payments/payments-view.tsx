"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Banknote,
  CircleAlert,
  Copy,
  Download,
  Eye,
  Landmark,
  Receipt,
  RotateCcw,
  Send,
  Smartphone,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/frontend/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, Plate, SectionCard, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { PAYMENTS, VENDORS, ZONES, DASHBOARD } from "@/frontend/lib/mock";
import { formatDateTime, formatMoney } from "@/shared/utils/common.util";
import { PAYMENT_MODE_LABELS } from "@/config/app.config";
import { cn } from "@/lib/utils";
import type { Payment } from "@/shared/types/domain.types";

export function PaymentsView() {
  const [payments, setPayments] = React.useState<Payment[]>(PAYMENTS);
  const [selected, setSelected] = React.useState<Payment | null>(null);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundType, setRefundType] = React.useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");

  const openRefund = (payment: Payment) => {
    setSelected(payment);
    setRefundType("full");
    setRefundAmount(String(payment.amount / 100));
    setRefundReason("");
    setRefundOpen(true);
  };

  const columns = React.useMemo<ColumnDef<Payment, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Payment",
        meta: "Payment",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-medium">{row.original.id}</p>
            {row.original.gatewayPaymentId && (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {row.original.gatewayPaymentId}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "plateNumber",
        header: "Vehicle",
        meta: "Vehicle",
        cell: ({ row }) =>
          row.original.plateNumber ? <Plate value={row.original.plateNumber} /> : <span>—</span>,
      },
      {
        accessorKey: "mode",
        header: "Method",
        meta: "Method",
        cell: ({ row }) => (
          <Badge variant="secondary" className="gap-1 font-normal whitespace-nowrap">
            {row.original.mode === "CASH" ? (
              <Banknote className="size-3" />
            ) : row.original.mode === "NETBANKING" ? (
              <Landmark className="size-3" />
            ) : (
              <Smartphone className="size-3" />
            )}
            {PAYMENT_MODE_LABELS[row.original.mode]}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        meta: "Amount",
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.amount} className="text-sm font-medium" />
            {row.original.refundedAmount > 0 && (
              <p className="text-[11px] text-violet-600 dark:text-violet-400">
                −{formatMoney(row.original.refundedAmount)} refunded
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.status} />
            {row.original.failureReason && (
              <p className="max-w-36 truncate text-[11px] text-muted-foreground">
                {row.original.failureReason}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "zoneName",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.zoneName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.vendorName}</p>
          </div>
        ),
      },
      {
        accessorKey: "paidAt",
        header: "When",
        meta: "Paid at",
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.paidAt)}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const payment = row.original;
          const refundable = payment.status === "CAPTURED";
          return (
            <div className="flex justify-end">
              <RowActions
                label={payment.id}
                actions={[
                  {
                    label: "View receipt",
                    icon: Eye,
                    hidden: !payment.receiptNumber,
                    onSelect: () =>
                      toast.info("Opening receipt", { description: payment.receiptNumber }),
                  },
                  {
                    label: "Download receipt",
                    icon: Download,
                    hidden: !payment.receiptNumber,
                    onSelect: () =>
                      toast.success("Receipt downloaded", { description: `${payment.receiptNumber}.pdf` }),
                  },
                  {
                    label: "Re-send receipt",
                    icon: Send,
                    hidden: !payment.receiptNumber,
                    children: [
                      { label: "By SMS", onSelect: () => toast.success("Receipt sent by SMS") },
                      { label: "By WhatsApp", onSelect: () => toast.success("Receipt sent on WhatsApp") },
                      { label: "By email", onSelect: () => toast.success("Receipt emailed") },
                    ],
                  },
                  {
                    label: "Copy gateway ID",
                    icon: Copy,
                    hidden: !payment.gatewayPaymentId,
                    separatorBefore: true,
                    onSelect: () => {
                      void navigator.clipboard.writeText(payment.gatewayPaymentId!);
                      toast.success("Copied", { description: payment.gatewayPaymentId });
                    },
                  },
                  {
                    label: "Retry capture",
                    icon: RotateCcw,
                    hidden: payment.status !== "FAILED",
                    onSelect: () =>
                      toast.info("Retry requested", {
                        description: "A fresh payment link has been sent to the citizen.",
                      }),
                  },
                  {
                    label: "Issue refund",
                    icon: Undo2,
                    destructive: true,
                    hidden: !refundable,
                    separatorBefore: true,
                    onSelect: () => openRefund(payment),
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

  const captured = payments.filter((p) => p.status === "CAPTURED");
  const failed = payments.filter((p) => p.status === "FAILED");
  const refunded = payments.filter((p) => p.status === "REFUNDED");
  const cash = captured.filter((p) => p.mode === "CASH").reduce((s, p) => s + p.amount, 0);
  const digital = captured.filter((p) => p.mode !== "CASH").reduce((s, p) => s + p.amount, 0);

  const refundValue = refundType === "full" ? selected?.amount ?? 0 : Number(refundAmount) * 100;
  const canRefund = refundReason.trim().length > 3 && refundValue > 0 && refundValue <= (selected?.amount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every collection on the network. Gateway payments are confirmed by signed webhook — a client reporting success is advisory only."
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Captured" value={<Money value={cash + digital} compact />} icon={TrendingUp} accent="success" hint={`${captured.length} payments`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Cash collected" value={<Money value={cash} compact />} icon={Banknote} hint={`${Math.round((cash / (cash + digital)) * 100)}% of collections`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Failed" numeric={failed.length} icon={CircleAlert} accent={failed.length > 4 ? "danger" : "warning"} hint="Retry links sent automatically" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Refunded" numeric={refunded.length} icon={Undo2} accent="info" hint={<>{formatMoney(refunded.reduce((s, p) => s + p.refundedAmount, 0))} returned</>} />
        </FadeStaggerItem>
      </FadeStagger>

      <SectionCard title="Collection split" description="Cash versus digital across captured payments">
        <SplitMeter
          segments={[
            { label: "Cash", value: cash, className: "bg-chart-3" },
            { label: "UPI", value: DASHBOARD.upiCollection, className: "bg-chart-1" },
            { label: "Other digital", value: Math.max(0, digital - DASHBOARD.upiCollection), className: "bg-chart-2" },
          ]}
        />
      </SectionCard>

      <DataTable
        data={payments}
        columns={columns}
        enableSelection
        searchKeys={["id", "plateNumber", "gatewayPaymentId", "receiptNumber", "zoneName", "vendorName"]}
        searchPlaceholder="Search payment, plate, gateway ID or receipt…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "CAPTURED", label: "Captured" },
              { value: "FAILED", label: "Failed" },
              { value: "REFUNDED", label: "Refunded" },
              { value: "PENDING", label: "Pending" },
            ],
          },
          {
            columnId: "mode",
            label: "Method",
            options: Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            columnId: "vendorName",
            label: "Vendor",
            options: VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
          {
            columnId: "zoneName",
            label: "Zone",
            options: ZONES.map((z) => ({ value: z.name, label: z.name })),
          },
        ]}
        onExport={(rows) =>
          toast.success("Export queued", {
            description: `${rows.length} payments · reconciliation file will be emailed.`,
          })
        }
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`Receipts re-sent for ${rows.length} payments`);
                clear();
              }}
            >
              <Send className="size-3.5" /> Re-send receipts
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success("Reconciliation file generated", {
                  description: `${rows.length} payments matched against the gateway statement.`,
                });
                clear();
              }}
            >
              <Receipt className="size-3.5" /> Reconcile
            </Button>
          </>
        )}
        emptyTitle="No payments yet"
        emptyDescription="Collections appear the moment an attendant takes cash or a gateway webhook confirms a digital payment."
      />

      {/* ------------------------------------------------------------ refund */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue a refund</DialogTitle>
            <DialogDescription>
              {selected?.plateNumber} · {formatMoney(selected?.amount)} collected via{" "}
              {selected ? PAYMENT_MODE_LABELS[selected.mode] : ""}.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={refundType}
            onValueChange={(v) => {
              setRefundType(v as "full" | "partial");
              if (v === "full") setRefundAmount(String((selected?.amount ?? 0) / 100));
            }}
            className="gap-2"
          >
            {[
              { value: "full", label: "Full refund", hint: `Return the whole ${formatMoney(selected?.amount)}` },
              { value: "partial", label: "Partial refund", hint: "Return part of the amount" },
            ].map((option) => (
              <label
                key={option.value}
                htmlFor={`refund-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  refundType === option.value ? "border-primary bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <RadioGroupItem value={option.value} id={`refund-${option.value}`} className="mt-0.5" />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {refundType === "partial" && (
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">Refund amount (₹)</Label>
              <Input
                id="refund-amount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                max={(selected?.amount ?? 0) / 100}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="refund-reason"
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Charged for a session the vehicle never had / duplicate payment / goodwill…"
            />
            <p className="text-xs text-muted-foreground">
              {selected?.mode === "CASH"
                ? "Cash refunds are recorded here and settled against the vendor at the next cycle."
                : "Card and UPI refunds take 3–5 working days to reach the citizen's account."}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canRefund}
              onClick={() => {
                setPayments((list) =>
                  list.map((p) =>
                    p.id === selected?.id
                      ? {
                          ...p,
                          status: refundValue >= p.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
                          refundedAmount: refundValue,
                        }
                      : p,
                  ),
                );
                setRefundOpen(false);
                toast.success("Refund initiated", {
                  description: `${formatMoney(refundValue)} · ${refundReason}`,
                });
              }}
            >
              Refund {formatMoney(refundValue)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
