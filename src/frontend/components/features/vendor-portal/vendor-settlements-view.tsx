"use client";

import * as React from "react";
import { AlertTriangle, Landmark, RefreshCw } from "lucide-react";

import { settlementsApi, type ApiSettlement } from "@/frontend/api";
import { useApiQuery, describeApiError } from "@/frontend/hooks/use-api";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { RequiresApi } from "./requires-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend/components/ui/table";
import { formatDate, formatMoney } from "@/shared/utils/common.util";

/**
 * What KMC owes this vendor, and what it has already paid.
 *
 * Read-only on purpose. Generating a settlement, approving it and instructing
 * the payout are the authority's decisions and live on their side of the
 * portal; a vendor watching their own money move must be able to see every
 * step without being able to move it. The list is scoped by the API to the
 * caller's own vendor, so there is no filter here and no id to pass.
 */

const STATUS_TONE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Being prepared", variant: "outline" },
  PENDING_APPROVAL: { label: "With KMC for approval", variant: "secondary" },
  APPROVED: { label: "Approved, awaiting payout", variant: "default" },
  PAID: { label: "Paid", variant: "default" },
  REJECTED: { label: "Sent back", variant: "outline" },
};

/**
 * Where a settlement has got to, in the words a vendor would use to chase it.
 *
 * The status badge says what state the paperwork is in; this says what that
 * means for the money and quotes the evidence. A transfer the authority has
 * recorded is the single fact this whole screen exists to deliver, so it is
 * spelled out with its bank reference rather than left as a green pill — that
 * reference is what an operator quotes to their own bank when the credit has
 * not appeared.
 */
function Progress({ settlement }: { settlement: ApiSettlement }) {
  if (settlement.status === "PAID") {
    return (
      <div className="space-y-0.5">
        <div className="text-sm">Transferred by KMC</div>
        {settlement.payoutRef ? (
          <div className="font-mono text-xs text-muted-foreground">{settlement.payoutRef}</div>
        ) : null}
      </div>
    );
  }

  if (settlement.status === "APPROVED") {
    return (
      <div className="space-y-0.5">
        <div className="text-sm">Cleared for payment</div>
        <div className="text-xs text-muted-foreground">
          {settlement.approvedAt
            ? `Approved ${formatDate(settlement.approvedAt)}`
            : "Approved; the transfer has not been made yet"}
        </div>
      </div>
    );
  }

  if (settlement.status === "REJECTED") {
    return (
      <div className="space-y-0.5">
        <div className="text-sm">Being looked at again</div>
        {settlement.rejectionReason ? (
          <div className="text-xs text-muted-foreground">{settlement.rejectionReason}</div>
        ) : null}
      </div>
    );
  }

  return <span className="text-sm text-muted-foreground">—</span>;
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function VendorSettlementsViewInner() {
  const query = useApiQuery(["vendor", "settlements"], () =>
    settlementsApi.list({ pageSize: 50 }).then((r) => r.data),
  );
  /**
   * The same figures the authority reads on its own settlements screen, scoped
   * by the API to this vendor. Worth a second request: "how much is approved
   * and not yet in my account" is the question this screen is opened with, and
   * summing the visible page would answer a different one the moment there are
   * more than fifty settlements.
   */
  const summary = useApiQuery(["vendor", "settlements", "summary"], () =>
    settlementsApi.summary().then((r) => r.data),
  );

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (query.isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load your settlements"
        description={describeApiError(query.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const rows = query.data ?? [];

  function refresh() {
    void query.refetch();
    void summary.refetch();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No settlements yet"
        description={
          "A settlement is generated by KMC for a period of trading once that period closes. " +
          "Nothing is missing — there simply has not been one yet."
        }
      />
    );
  }

  const totals = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {totals ? (
          <div className="flex flex-wrap gap-8">
            <Figure
              label="Awaiting payout"
              value={formatMoney(totals.awaitingPayout)}
              sub={
                totals.counts.approved === 0
                  ? "Nothing approved and unpaid"
                  : `${totals.counts.approved} settlement${totals.counts.approved === 1 ? "" : "s"} approved`
              }
            />
            <Figure
              label="With KMC"
              value={String(totals.counts.pendingApproval)}
              sub="Submitted, not yet decided"
            />
            <Figure
              label="Paid to date"
              value={String(totals.counts.paid)}
              sub={`${totals.counts.paid === 1 ? "settlement" : "settlements"} transferred`}
            />
          </div>
        ) : (
          <div />
        )}

        {/* A vendor refreshing this page is usually checking whether KMC has
            acted since they last looked, and the answer is a request away. */}
        <Button variant="outline" size="sm" onClick={refresh} disabled={query.isFetching}>
          <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your settlements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">KMC share</TableHead>
                  <TableHead className="text-right">Your share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const tone = STATUS_TONE[s.status] ?? { label: s.status, variant: "outline" as const };
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(s.periodStart).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {" – "}
                        {new Date(s.periodEnd).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                      </TableCell>
                      <TableCell className="min-w-44">
                        <Progress settlement={s} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(s.grossCollected)}
                      </TableCell>
                      {/*
                        The authority's cut, which is what is actually taken off
                        the takings. This column read `commissionAmount` and was
                        labelled "KMC commission", and both halves were wrong:
                        the commission is the *vendor's* fee — `vendorShare` is
                        that same number — so the row showed ₹64.90 collected,
                        less ₹11.68, leaving ₹11.68. A vendor reading their own
                        money is entitled to a sum that adds up.
                      */}
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        − {formatMoney(s.governmentShare)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatMoney(s.vendorShare)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Nothing here renders without a backend. See `RequiresApi` for why this screen
 * does not fall back to the demo dataset the rest of the portal uses.
 */
export function VendorSettlementsView() {
  return (
    <RequiresApi>
      <VendorSettlementsViewInner />
    </RequiresApi>
  );
}
