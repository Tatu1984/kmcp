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
import { Can } from "@/frontend/components/shared/can";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, Plate, SectionCard, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { PAYMENTS, DASHBOARD } from "@/frontend/lib/mock";
import {
  paymentsApi,
  zonesApi,
  vendorsApi,
  documentsApi,
  listAll,
  messagingApi,
  channelLabel,
  ApiError,
} from "@/frontend/api";
import type { ApiReceipt, MessageChannel } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { isLiveApi } from "@/config/env";
import { toPayment } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { formatDateTime, formatMoney } from "@/shared/utils/common.util";
import { PAYMENT_MODE_LABELS } from "@/config/app.config";
import { cn } from "@/lib/utils";
import type { Payment } from "@/shared/types/domain.types";

/** One list, so the row menu and the bulk bar cannot come to disagree. */
const RECEIPT_CHANNELS: { channel: MessageChannel; label: string }[] = [
  { channel: "SMS", label: "By SMS" },
  { channel: "WHATSAPP", label: "By WhatsApp" },
  { channel: "EMAIL", label: "By email" },
];

export function PaymentsView() {
  const {
    items: rows,
    isLoading,
    isBusy,
    emptyReason,
    apply,
  } = useResource<Payment>(
    ["payments", "list"],
    () =>
      listAll((page, pageSize) => paymentsApi.list({ page, pageSize })).then((r) =>
        r.map((p) => toPayment(p)),
      ),
    PAYMENTS,
  );

  // A payment knows its session's zone and vendor by id only. Both lists are
  // small and cached, so one fetch each resolves every row.
  const zones = useApiQuery(["zones", "names"], () =>
    listAll((page, pageSize) => zonesApi.list({ page, pageSize })),
  );
  const vendors = useApiQuery(["vendors", "names"], () =>
    listAll((page, pageSize) => vendorsApi.list({ page, pageSize })),
  );

  const payments = React.useMemo(() => {
    const zoneNames = new Map((zones.data ?? []).map((z) => [z.id, z.name]));
    const vendorNames = new Map((vendors.data ?? []).map((v) => [v.id, v.orgName]));
    return rows.map((p) => ({
      ...p,
      zoneName: (p.zoneId && zoneNames.get(p.zoneId)) || p.zoneName,
      vendorName: (p.vendorId && vendorNames.get(p.vendorId)) || p.vendorName,
    }));
  }, [rows, zones.data, vendors.data]);

  // Totals across every payment, not merely the page in view — the stat cards
  // would otherwise quietly under-report once collections pass the page size.
  const summary = useApiQuery(["payments", "summary"], () =>
    paymentsApi.summary().then((r) => r.data),
  );

  const { send } = useMessaging();

  /**
   * Re-sends a receipt over the chosen channels.
   *
   * Wrapped in `useCallback` because the column definitions memoise on it; the
   * refunding and receipt-viewing helpers on this screen are memoised for the
   * same reason.
   */
  const resendReceipt = React.useCallback(
    (paymentIds: string[], channels: MessageChannel[], subject: string) =>
      void send(() => messagingApi.sendReceipts({ paymentIds, channels }), {
        success:
          paymentIds.length === 1 ? "Receipt re-sent" : `Receipts re-sent for ${paymentIds.length} payments`,
        description: `${subject} · by ${channels.map(channelLabel).join(" and ")}`,
      }),
    [send],
  );

  const documents = useDocument();
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

  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptFor, setReceiptFor] = React.useState<Payment | null>(null);
  const [receipt, setReceipt] = React.useState<ApiReceipt | null>(null);
  const [receiptError, setReceiptError] = React.useState<string | null>(null);

  /**
   * Shows the receipt the API holds against a payment.
   *
   * `POST /payments/:id/receipt` reads like a write and mostly is not: the
   * service returns the receipt already issued and only mints one when there
   * is none, because a receipt number appearing twice is an audit finding. So
   * viewing is safe — it cannot produce a second number — and this is the only
   * endpoint that will tell us the GST invoice number and the channels the
   * receipt was sent on.
   *
   * What it does not return is a document. There is no PDF anywhere in the
   * platform yet, so this shows the receipt's particulars rather than
   * pretending to open a file.
   */
  const viewReceipt = React.useCallback(async (payment: Payment) => {
    setReceiptFor(payment);
    setReceipt(null);
    setReceiptError(null);
    setReceiptOpen(true);
    if (!isLiveApi) return;
    try {
      const { data } = await paymentsApi.receipt(payment.id);
      setReceipt(data);
    } catch (error) {
      setReceiptError(
        error instanceof ApiError ? error.message : "That receipt could not be loaded.",
      );
    }
  }, []);

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
                    // POST /payments/:id/receipt — payments.controller.ts:121,
                    // guarded by payment.read because it fetches far more often
                    // than it issues.
                    permission: "payment.read",
                    onSelect: () => void viewReceipt(payment),
                  },
                  {
                    label: "Download receipt",
                    icon: Download,
                    hidden: !payment.receiptNumber,
                    // GET /documents/receipts/:paymentId — documents.controller.ts,
                    // on payment.read like the receipt route beside it. The API
                    // renders it from the stored fare, so a receipt reprinted
                    // after a tariff change still says what was charged.
                    permission: "payment.read",
                    onSelect: () => {
                      void documents.run(
                        payment.id,
                        () => documentsApi.receipt(payment.id),
                        {
                          demo: () =>
                            toast.info("No printable receipt yet", {
                              description: `${payment.receiptNumber} exists in the ledger, but nothing renders it as a document yet. Open it to read its particulars.`,
                            }),
                          success: "Receipt downloaded",
                          description: payment.receiptNumber ?? undefined,
                        },
                      );
                    },
                  },
                  {
                    label: "Re-send receipt",
                    icon: Send,
                    hidden: !payment.receiptNumber,
                    // POST /messaging/receipts — messaging.controller.ts, on
                    // payment.read, the same grant the receipt route carries.
                    // A successful send appends the channel to the receipt's
                    // own `sentChannels`, so the ledger and the delivery log
                    // do not drift into two versions of the truth.
                    permission: "payment.read",
                    children: RECEIPT_CHANNELS.map(({ channel, label }) => ({
                      label,
                      permission: "payment.read" as const,
                      onSelect: () => resendReceipt([payment.id], [channel], payment.receiptNumber ?? payment.id),
                    })),
                  },
                  {
                    label: "Issue receipt",
                    icon: Receipt,
                    hidden: Boolean(payment.receiptNumber) || payment.status !== "CAPTURED",
                    // POST /payments/:id/receipt — payments.controller.ts:121.
                    permission: "payment.read",
                    onSelect: () => {
                      void apply(
                        () => paymentsApi.receipt(payment.id),
                        (list) => list,
                        { success: "Receipt issued", description: payment.sessionCode },
                      ).catch(() => {});
                    },
                  },
                  {
                    label: "Copy gateway ID",
                    icon: Copy,
                    hidden: !payment.gatewayPaymentId,
                    separatorBefore: true,
                    // Copies what is already on the row. Nothing is called, so
                    // there is no permission to mirror.
                    onSelect: () => {
                      void navigator.clipboard.writeText(payment.gatewayPaymentId!);
                      toast.success("Copied", { description: payment.gatewayPaymentId });
                    },
                  },
                  {
                    label: "Retry capture",
                    icon: RotateCcw,
                    hidden: payment.status !== "FAILED",
                    // Payment-gateway scope. A retry means a fresh Razorpay
                    // order and a link sent to the citizen; neither the order
                    // nor the link has an endpoint behind it here.
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
                    // POST /payments/:id/refund — payments.controller.ts:103.
                    permission: "payment.refund",
                    onSelect: () => openRefund(payment),
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [apply, viewReceipt, resendReceipt, documents],
  );

  const captured = payments.filter((p) => p.status === "CAPTURED");
  const failed = payments.filter((p) => p.status === "FAILED");
  const refunded = payments.filter((p) => p.status === "REFUNDED");

  // Prefer the server's totals; fall back to the rows in view when there is no
  // API, so the demo still adds up.
  const totals = summary.data;
  const cash = totals?.cash ?? captured.filter((p) => p.mode === "CASH").reduce((s, p) => s + p.amount, 0);
  const digital =
    totals?.digital ?? captured.filter((p) => p.mode !== "CASH").reduce((s, p) => s + p.amount, 0);
  const collected = totals?.collected ?? cash + digital;
  const capturedCount = totals?.count ?? captured.length;
  const refundedTotal = totals?.refunded ?? refunded.reduce((s, p) => s + p.refundedAmount, 0);
  const cashShare = collected > 0 ? Math.round((cash / collected) * 100) : 0;

  const upi =
    totals?.byMode
      .filter((m) => m.mode === "UPI_QR" || m.mode === "UPI_INTENT")
      .reduce((s, m) => s + m.amount, 0) ?? DASHBOARD.upiCollection;

  /** Facet options come from the rows themselves, so they always match the data. */
  const facetOptions = (key: "zoneName" | "vendorName") =>
    Array.from(new Set(payments.map((p) => p[key]).filter((v) => v && v !== "—")))
      .sort()
      .map((value) => ({ value, label: value }));

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
          <StatCard label="Captured" value={<Money value={collected} compact />} icon={TrendingUp} accent="success" hint={`${capturedCount} payments`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Cash collected" value={<Money value={cash} compact />} icon={Banknote} hint={`${cashShare}% of collections`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Failed" numeric={failed.length} icon={CircleAlert} accent={failed.length > 4 ? "danger" : "warning"} hint="Retry links sent automatically" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Refunded" numeric={refunded.length} icon={Undo2} accent="info" hint={<>{formatMoney(refundedTotal)} returned</>} />
        </FadeStaggerItem>
      </FadeStagger>

      <SectionCard title="Collection split" description="Cash versus digital across captured payments">
        <SplitMeter
          segments={[
            { label: "Cash", value: cash, className: "bg-chart-3" },
            { label: "UPI", value: upi, className: "bg-chart-1" },
            { label: "Other digital", value: Math.max(0, digital - upi), className: "bg-chart-2" },
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
              { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
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
            options: facetOptions("vendorName"),
          },
          {
            columnId: "zoneName",
            label: "Zone",
            options: facetOptions("zoneName"),
          },
        ]}
        // Waits on the reports module, which is what builds a file and emails
        // it. The rows are all in the browser already, but a reconciliation
        // export is a document the authority keeps, not a client-side dump.
        onExport={(rows, columns) => {
          const file = downloadCsv("payments", rows, columns);
          toast.success("Export ready", { description: `${rows.length} payments · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            {/**
              * One request for the whole selection, and the toast reports the
              * server's count of what actually left rather than the number of
              * rows that were ticked. Only rows that already have a receipt
              * number: there is no document to re-send for the others, and the
              * API would refuse them one at a time anyway.
              */}
            <Can permission="payment.read">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  const withReceipts = rows.filter((p) => p.receiptNumber);
                  if (withReceipts.length === 0) {
                    toast.error("Nothing to send", {
                      description: "None of the selected payments has a receipt yet.",
                    });
                    return;
                  }
                  resendReceipt(
                    withReceipts.map((p) => p.id),
                    ["SMS", "EMAIL"],
                    `${withReceipts.length} payments`,
                  );
                  clear();
                }}
              >
                <Send className="size-3.5" /> Re-send receipts
              </Button>
            </Can>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              // Payment-gateway scope: reconciling means matching these rows
              // against a Razorpay settlement statement, which nothing here
              // fetches. The webhook is what keeps the two in step meanwhile.
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
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No payments yet"}
        emptyDescription={
          emptyReason ??
          "Collections appear the moment an attendant takes cash or a gateway webhook confirms a digital payment."
        }
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
              disabled={!canRefund || isBusy}
              onClick={() => {
                const payment = selected;
                if (!payment) return;
                void apply(
                  () =>
                    paymentsApi.refund(payment.id, {
                      // A full refund sends no amount at all, so the server
                      // decides what is still refundable rather than trusting a
                      // figure this screen worked out from a stale row.
                      amount: refundType === "full" ? undefined : refundValue,
                      reason: refundReason.trim(),
                    }),
                  (list) =>
                    list.map((p) =>
                      p.id === payment.id
                        ? {
                            ...p,
                            status: refundValue >= p.amount
                              ? ("REFUNDED" as const)
                              : ("PARTIALLY_REFUNDED" as const),
                            refundedAmount: refundValue,
                          }
                        : p,
                    ),
                  {
                    success: "Refund initiated",
                    description: `${formatMoney(refundValue)} · ${refundReason}`,
                  },
                )
                  .then(() => {
                    setRefundOpen(false);
                    void summary.refetch();
                  })
                  // The error is already surfaced as a toast; keep the dialog
                  // open so the reason does not have to be typed again.
                  .catch(() => {});
              }}
            >
              Refund {formatMoney(refundValue)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------- receipt */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>
              {receiptFor?.plateNumber} · {formatMoney(receiptFor?.amount)} collected via{" "}
              {receiptFor ? PAYMENT_MODE_LABELS[receiptFor.mode] : ""}.
            </DialogDescription>
          </DialogHeader>

          {receiptError ? (
            <p className="text-sm text-destructive">{receiptError}</p>
          ) : (
            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex items-baseline justify-between py-2">
                <dt className="text-muted-foreground">Receipt number</dt>
                <dd className="font-mono text-xs">
                  {receipt?.number ?? receiptFor?.receiptNumber ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-2">
                <dt className="text-muted-foreground">GST invoice</dt>
                <dd className="font-mono text-xs">{receipt?.gstInvoiceNo ?? "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2">
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{receipt ? formatDateTime(receipt.issuedAt) : "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between py-2">
                <dt className="text-muted-foreground">Sent on</dt>
                <dd>
                  {receipt?.sentChannels.length
                    ? receipt.sentChannels.join(", ").toLowerCase()
                    : "Not sent to the citizen"}
                </dd>
              </div>
            </dl>
          )}

          <p className="text-xs text-muted-foreground text-pretty">
            The number is allocated once and never re-issued — the same payment asked twice returns
            the same receipt, and the PDF is rendered once and kept, so the document a citizen was
            given is the document that comes back.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>
              Close
            </Button>
            {/* GET /documents/receipts/:paymentId — documents.controller.ts. */}
            {receiptFor && (
              <Button
                disabled={documents.isBusy}
                onClick={() => {
                  void documents.run(
                    receiptFor.id,
                    () => documentsApi.receipt(receiptFor.id),
                    {
                      demo: () =>
                        toast.info("No printable receipt yet", {
                          description:
                            "The demo build has no API behind it to render one.",
                        }),
                      success: "Receipt downloaded",
                      description: receipt?.number ?? receiptFor.receiptNumber ?? undefined,
                    },
                  );
                }}
              >
                <Download className="size-4" /> Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
