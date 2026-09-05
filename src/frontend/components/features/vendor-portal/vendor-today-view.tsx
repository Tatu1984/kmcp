"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CarFront, Coins, ReceiptIndianRupee, Users } from "lucide-react";

import { ROUTES } from "@/shared/constants/routes";
import { vendorsApi, type ApiVendorDashboard } from "@/frontend/api";
import { useApiQuery, describeApiError } from "@/frontend/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { RequiresApi } from "./requires-api";
import { formatMoney } from "@/shared/utils/common.util";

/**
 * A vendor's own day.
 *
 * `GET /vendors/dashboard` has existed on the API since before this screen did
 * and had never been called by anything. It answers for the caller's own vendor
 * and refuses an account that is not one, so there is no id to pass and no way
 * to ask about somebody else's operation.
 *
 * Money arrives in paise, as everywhere else on this API.
 */
function VendorTodayViewInner() {
  const query = useApiQuery(["vendor", "dashboard"], () =>
    vendorsApi.dashboard().then((r) => r.data),
  );

  if (query.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load your figures"
        description={describeApiError(query.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const d: ApiVendorDashboard = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={CarFront}
          label="Parked now"
          value={String(d.activeParking)}
          sub={`${d.sessionsToday} session${d.sessionsToday === 1 ? "" : "s"} started today`}
        />
        <Tile
          icon={Users}
          label="Shifts open"
          value={String(d.openShifts)}
          sub={
            d.openShifts === 0
              ? "Nobody is on the kerb"
              : "Attendants currently signed on"
          }
          /* The only tile that ever needs acting on: an open shift at the end of
             a day is money not yet counted, and it stays open until somebody
             closes it. */
          tone={d.openShifts === 0 ? "default" : "notice"}
        />
        <Tile
          icon={Coins}
          label="Collected today"
          value={formatMoney(d.collectedToday)}
          sub={`cash ${formatMoney(d.cashToday)} · digital ${formatMoney(d.digitalToday)}`}
        />
        <Tile
          icon={ReceiptIndianRupee}
          label="Settlement due"
          value={formatMoney(d.settlementDue)}
          sub="Approved or awaiting approval"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&rsquo;s takings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Two figures against one total, so the split reads as a
                proportion rather than as two unrelated numbers. */}
            <Split cash={d.cashToday} digital={d.digitalToday} />
            <p className="text-sm text-muted-foreground">
              Cash is counted against an attendant&rsquo;s shift when they close it. Digital
              payments reconcile themselves and never pass through anyone&rsquo;s pocket.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What you pay your attendants is recorded here and visible to you alone — not to
              KMC, not to an auditor, and not to the attendant.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={ROUTES.vendorStaff}>Staff &amp; pay</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "notice";
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </div>
        <div
          className={
            tone === "notice"
              ? "text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-500"
              : "text-3xl font-bold tabular-nums"
          }
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>
      </CardContent>
    </Card>
  );
}

/** Cash against digital as one bar. Each segment is labelled, never colour alone. */
function Split({ cash, digital }: { cash: number; digital: number }) {
  const total = cash + digital;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Nothing collected yet today.</p>;
  }
  const cashPct = Math.round((cash / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        <div className="bg-primary" style={{ width: `${cashPct}%` }} />
        <div className="flex-1 bg-emerald-600" />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          Cash <strong className="tabular-nums">{formatMoney(cash)}</strong>
          <span className="text-muted-foreground tabular-nums">({cashPct}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-600" aria-hidden />
          Digital <strong className="tabular-nums">{formatMoney(digital)}</strong>
          <span className="text-muted-foreground tabular-nums">({100 - cashPct}%)</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Nothing here renders without a backend. See `RequiresApi` for why this screen
 * does not fall back to the demo dataset the rest of the portal uses.
 */
export function VendorTodayView() {
  return (
    <RequiresApi>
      <VendorTodayViewInner />
    </RequiresApi>
  );
}
