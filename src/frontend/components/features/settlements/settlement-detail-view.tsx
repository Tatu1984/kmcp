"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  Building2,
  Download,
  Landmark,
  Printer,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend/components/ui/table";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, Plate, SectionCard, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SETTLEMENTS, VENDORS } from "@/frontend/lib/mock";
import { settlementsApi, ApiError } from "@/frontend/api";
import { useApiQuery, emptyReason } from "@/frontend/hooks/use-api";
import { toSettlement } from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import { formatDate, formatDateTime, formatMoney } from "@/shared/utils/common.util";
import { PAYMENT_MODE_LABELS } from "@/config/app.config";
import type { Settlement } from "@/shared/types/domain.types";

export function SettlementDetailView({ settlementId }: { settlementId: string }) {
  const query = useApiQuery(["settlements", "detail", settlementId], () =>
    settlementsApi.get(settlementId).then((r) => r.data),
  );

  const [demo, setDemo] = React.useState<Settlement | undefined>(() =>
    SETTLEMENTS.find((s) => s.id === settlementId),
  );
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const settlement = isLiveApi
    ? query.data
      ? toSettlement(query.data)
      : undefined
    : demo;

  /** Runs a workflow step against the API, or edits the demo copy. */
  const step = async (
    call: () => Promise<unknown>,
    patch: Partial<Settlement>,
    message: string,
  ) => {
    if (!isLiveApi) {
      setDemo((current) => (current ? { ...current, ...patch } : current));
      toast.success(message);
      return;
    }
    setBusy(true);
    try {
      await call();
      await query.refetch();
      toast.success(message);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "That did not go through. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!settlement) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isLiveApi && query.isLoading ? "Loading settlement…" : "Settlement not found"}
          </p>
          <p className="text-xs text-muted-foreground">
            {emptyReason(query.error ?? null, query.isLoading) ??
              "It may have been removed, or the reference is wrong."}
          </p>
        </div>
      </div>
    );
  }

  const demoVendor = VENDORS.find((v) => v.id === settlement.vendorId);
  const vendorBank = isLiveApi ? query.data?.vendor?.bankAccountNo : demoVendor?.bankAccountNo;
  const commissionPct = isLiveApi
    ? Number(query.data?.vendor?.commissionPct ?? 0)
    : (demoVendor?.commissionPct ?? 0);

  /**
   * The postings, preferring the ones actually written.
   *
   * Before approval nothing has been posted, so what is shown is a preview of
   * what approval will write. Afterwards it is the real thing — a screen that
   * kept re-deriving them would agree with the ledger even if the ledger were
   * wrong, which is the one job it has.
   */
  const posted = query.data?.ledger ?? [];
  const ledger = posted.length
    ? posted.map((entry) => ({ account: entry.account, debit: entry.debit, credit: entry.credit }))
    : [
        { account: "GATEWAY_RECEIVABLE", debit: settlement.digitalCollected, credit: 0 },
        { account: "CASH_IN_HAND", debit: settlement.cashCollected, credit: 0 },
        { account: "VENDOR_PAYABLE", debit: 0, credit: settlement.vendorShare },
        { account: "GOVERNMENT_REVENUE", debit: 0, credit: settlement.governmentShare },
      ];
  const totalDebit = ledger.reduce((s, l) => s + l.debit, 0);
  const totalCredit = ledger.reduce((s, l) => s + l.credit, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: ROUTES.settlements, label: "All settlements" }}
        title={settlement.reference}
        description={`${settlement.vendorName} · ${formatDate(settlement.periodStart)} – ${formatDate(settlement.periodEnd)} · ${settlement.sessionsCount.toLocaleString("en-IN")} sessions`}
        meta={<StatusBadge status={settlement.status} pulse={settlement.status === "PENDING_APPROVAL"} />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => toast.success("Statement downloaded", { description: `${settlement.reference}.pdf` })}
            >
              <Download className="size-4" /> Statement
            </Button>
            {settlement.status === "PENDING_APPROVAL" && (
              <Button size="sm" className="h-9" disabled={busy} onClick={() => setApproveOpen(true)}>
                <BadgeCheck className="size-4" /> Approve
              </Button>
            )}
            {settlement.status === "APPROVED" && (
              <Button size="sm" className="h-9" disabled={busy} onClick={() => setPayoutOpen(true)}>
                <Landmark className="size-4" /> Instruct payout
              </Button>
            )}
            <RowActions
              label="More"
              actions={[
                { label: "Print statement", icon: Printer, onSelect: () => toast.success("Statement queued for printing") },
                { label: "Open vendor", icon: Building2, onSelect: () => window.location.assign(ROUTES.vendor(settlement.vendorId)) },
                {
                  label: "Reject settlement",
                  icon: Ban,
                  destructive: true,
                  hidden: settlement.status !== "PENDING_APPROVAL",
                  separatorBefore: true,
                  onSelect: () => setRejectOpen(true),
                },
              ]}
            />
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Gross collected" value={<Money value={settlement.grossCollected} compact />} icon={Scale} hint={`${settlement.sessionsCount.toLocaleString("en-IN")} sessions`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Commission" value={<Money value={settlement.commissionAmount} compact />} icon={Landmark} accent="info" hint={`${commissionPct}% of gross`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Vendor share" value={<Money value={settlement.vendorShare} compact />} icon={Building2} accent="success" hint="Payable to the operator" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Government share" value={<Money value={settlement.governmentShare} compact />} icon={BadgeCheck} accent="primary" hint="Municipal revenue" />
        </FadeStaggerItem>
      </FadeStagger>

      {settlement.status === "REJECTED" && settlement.rejectionReason && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Rejected</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{settlement.rejectionReason}</p>
        </div>
      )}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="lines">Lines ({settlement.lines.length})</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Settlement summary">
              <dl className="divide-y divide-border/60">
                <Field label="Reference">
                  <span className="font-mono text-xs">{settlement.reference}</span>
                </Field>
                <Field label="Vendor">
                  <Link href={ROUTES.vendor(settlement.vendorId)} className="underline-offset-2 hover:underline">
                    {settlement.vendorName}
                  </Link>
                </Field>
                <Field label="Period">
                  {formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}
                </Field>
                <Field label="Sessions">{settlement.sessionsCount.toLocaleString("en-IN")}</Field>
                <Field label="Gross collected">
                  <Money value={settlement.grossCollected} />
                </Field>
                <Field label="Cash">
                  <Money value={settlement.cashCollected} />
                </Field>
                <Field label="Digital">
                  <Money value={settlement.digitalCollected} />
                </Field>
                <Field label="Commission">
                  −<Money value={settlement.commissionAmount} />
                </Field>
              </dl>
              <Separator className="my-3" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Payable to vendor</span>
                <span className="text-xl font-semibold tabular">
                  {formatMoney(settlement.vendorShare)}
                </span>
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Collection mix">
                <SplitMeter
                  segments={[
                    { label: "Cash", value: settlement.cashCollected, className: "bg-chart-3" },
                    { label: "Digital", value: settlement.digitalCollected, className: "bg-chart-1" },
                  ]}
                />
              </SectionCard>

              <SectionCard title="Approval and payout">
                <dl className="divide-y divide-border/60">
                  <Field label="Status">
                    <StatusBadge status={settlement.status} />
                  </Field>
                  <Field label="Approved by">{settlement.approvedBy ?? "—"}</Field>
                  <Field label="Approved at">
                    {settlement.approvedAt ? formatDateTime(settlement.approvedAt) : "—"}
                  </Field>
                  <Field label="Payout reference">
                    <span className="font-mono text-xs">{settlement.payoutRef ?? "—"}</span>
                  </Field>
                  <Field label="Payout rail">Bank transfer, recorded manually</Field>
                  <Field label="Bank account">
                    <span className="font-mono text-xs">{vendorBank ?? "—"}</span>
                  </Field>
                </dl>
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- lines */}
        <TabsContent value="lines" className="mt-4">
          <SectionCard
            title="Settlement lines"
            description="One line per contributing payment"
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-muted/40 text-xs uppercase">Session</TableHead>
                    <TableHead className="bg-muted/40 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="bg-muted/40 text-xs uppercase">Method</TableHead>
                    <TableHead className="bg-muted/40 text-right text-xs uppercase">Amount</TableHead>
                    <TableHead className="bg-muted/40 text-right text-xs uppercase">Commission</TableHead>
                    <TableHead className="bg-muted/40 text-right text-xs uppercase">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlement.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">{line.sessionCode}</TableCell>
                      <TableCell>
                        <Plate value={line.plateNumber} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {PAYMENT_MODE_LABELS[line.mode]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={line.amount} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={line.commission} muted />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={line.amount - line.commission} className="font-medium" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Showing {settlement.lines.length} of{" "}
              {settlement.sessionsCount.toLocaleString("en-IN")} lines. Download the statement for
              the complete list.
            </div>
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------------- ledger */}
        <TabsContent value="ledger" className="mt-4">
          <SectionCard
            title="Double-entry ledger"
            description="Debits and credits must balance before the settlement can be committed"
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-muted/40 text-xs uppercase">Account</TableHead>
                    <TableHead className="bg-muted/40 text-right text-xs uppercase">Debit</TableHead>
                    <TableHead className="bg-muted/40 text-right text-xs uppercase">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.account}>
                      <TableCell className="font-mono text-xs">{entry.account}</TableCell>
                      <TableCell className="text-right">
                        {entry.debit ? <Money value={entry.debit} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.credit ? <Money value={entry.credit} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-medium hover:bg-transparent">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      <Money value={totalDebit} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={totalCredit} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2 border-t px-4 py-2.5">
              {totalDebit === totalCredit ? (
                <>
                  <BadgeCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs text-muted-foreground">
                    Ledger balances. <span className="font-mono">settlement.service</span> asserts
                    this before committing the transaction.
                  </p>
                </>
              ) : (
                <>
                  <Ban className="size-4 text-destructive" />
                  <p className="text-xs text-destructive">
                    Ledger does not balance — the settlement cannot be committed.
                  </p>
                </>
              )}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${settlement.reference}?`}
        confirmLabel="Approve settlement"
        description={
          <span>
            {settlement.vendorName} receives{" "}
            <span className="font-medium">{formatMoney(settlement.vendorShare)}</span> and{" "}
            <span className="font-medium">{formatMoney(settlement.governmentShare)}</span> is booked
            as municipal revenue. Approval locks the settlement.
          </span>
        }
        onConfirm={() => {
          void step(
            () => settlementsApi.approve(settlement.id),
            { status: "APPROVED", approvedAt: new Date().toISOString() },
            "Settlement approved",
          );
        }}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${settlement.reference}?`}
        destructive
        confirmLabel="Reject settlement"
        reason={{ label: "Why is this being rejected?", required: true }}
        description="The settlement returns to draft and the vendor is notified with your reason."
        onConfirm={(reason) => {
          void step(
            () => settlementsApi.reject(settlement.id, (reason ?? "").trim()),
            { status: "REJECTED", rejectionReason: reason },
            "Settlement rejected",
          );
        }}
      />

      <ConfirmDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        title="Record the payout?"
        confirmLabel="Record payout"
        typeToConfirm="PAY"
        reason={{ label: "Bank reference (UTR)", placeholder: "e.g. SBIN325019283746", required: true }}
        description={
          <span>
            Records that <span className="font-medium">{formatMoney(settlement.vendorShare)}</span>{" "}
            has been transferred to {vendorBank ?? "the registered account"}, and posts it against
            the vendor payable. It does not move money — RazorpayX credentials are not configured,
            so the transfer is made at the bank and its reference recorded here.
          </span>
        }
        onConfirm={(reference) => {
          void step(
            () => settlementsApi.payout(settlement.id, (reference ?? "").trim()),
            { status: "PAID", payoutRef: reference },
            "Payout recorded",
          );
        }}
      />
    </div>
  );
}
