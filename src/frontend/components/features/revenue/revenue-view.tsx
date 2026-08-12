"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  Banknote,
  CalendarClock,
  Coins,
  Download,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { Money, OccupancyBar, SectionCard, SplitMeter } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import {
  OccupancyChart,
  PaymentMixChart,
  RevenueChart,
  SessionsTrendChart,
} from "@/frontend/components/features/dashboard/charts";
import { ZONES, VENDORS, PAYMENTS, DASHBOARD, HOURLY_SERIES } from "@/frontend/lib/mock";
import { analyticsApi, revenueApi, settlementsApi, zonesApi, listAll } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { ROUTES } from "@/shared/constants/routes";
import { formatMoney, percent } from "@/shared/utils/common.util";
import { PAYMENT_MODE_LABELS } from "@/config/app.config";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "qtd", label: "Quarter to date" },
  { value: "fy", label: "Financial year" },
];

/** How far back each range reaches. `null` means "from the start of a period". */
const RANGE_START: Record<string, () => Date> = {
  today: () => startOfDay(new Date()),
  "7d": () => daysAgo(7),
  "30d": () => daysAgo(30),
  mtd: () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  },
  qtd: () => {
    const now = new Date();
    return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  },
  // The Indian financial year runs April to March.
  fy: () => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 3, 1);
  },
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function RevenueView() {
  const [range, setRange] = React.useState("30d");
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "Last 30 days";

  // Every figure on this screen moves with the range, so the range is part of
  // the query key rather than a filter applied to a fixed result.
  const revenue = useApiQuery(["revenue", range], () =>
    revenueApi
      .overview({ from: (RANGE_START[range] ?? RANGE_START["30d"])().toISOString() })
      .then((r) => r.data),
  );
  const settlementTotals = useApiQuery(["settlements", "summary"], () =>
    settlementsApi.summary().then((r) => r.data),
  );

  const live = revenue.data;

  const paymentMix = React.useMemo(() => {
    const palette = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "color-mix(in oklch, var(--chart-1) 55%, var(--chart-5))",
    ];
    const entries = live
      ? live.byMode.map((m) => [m.mode, m.amount] as const)
      : (() => {
          const byMode = new Map<string, number>();
          PAYMENTS.filter((p) => p.status === "CAPTURED").forEach((p) =>
            byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amount),
          );
          return [...byMode.entries()];
        })();

    return entries
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, value], i) => ({
        name: PAYMENT_MODE_LABELS[mode] ?? mode,
        value,
        fill: palette[i % palette.length],
      }));
  }, [live]);

  const zoneRevenue = live
    ? live.byZone.map((z) => ({
        id: z.id,
        name: z.name,
        wardName: z.wardName ?? "—",
        vendorName: z.vendorName ?? undefined,
        revenueMonth: z.amount,
      }))
    : [...ZONES]
        .sort((a, b) => (b.revenueMonth ?? 0) - (a.revenueMonth ?? 0))
        .map((z) => ({
          id: z.id,
          name: z.name,
          wardName: z.wardName,
          vendorName: z.vendorName,
          revenueMonth: z.revenueMonth ?? 0,
        }));
  const maxZoneRevenue = zoneRevenue[0]?.revenueMonth || 1;

  const vendorRevenue = live
    ? live.byVendor.map((v) => ({
        id: v.id,
        orgName: v.orgName,
        commissionPct: v.commissionPct,
        zoneCount: v.zoneCount,
        attendantCount: v.attendantCount,
        revenueMonth: v.amount,
      }))
    : [...VENDORS]
        .filter((v) => (v.revenueMonth ?? 0) > 0)
        .sort((a, b) => (b.revenueMonth ?? 0) - (a.revenueMonth ?? 0))
        .map((v) => ({
          id: v.id,
          orgName: v.orgName,
          commissionPct: v.commissionPct,
          zoneCount: v.zoneCount,
          attendantCount: v.attendantCount,
          revenueMonth: v.revenueMonth ?? 0,
        }));
  const totalVendorRevenue = vendorRevenue.reduce((s, v) => s + v.revenueMonth, 0);

  // What the authority keeps: gross less the vendors' commission.
  const govtShare = live
    ? live.byVendor.reduce((s, v) => s + v.governmentShare, 0)
    : vendorRevenue.reduce((s, v) => s + Math.round((v.revenueMonth * v.commissionPct) / 100), 0);

  const cashCollected =
    live?.byMode.find((m) => m.mode === "CASH")?.amount ?? DASHBOARD.cashCollection;
  const digitalCollected = live
    ? live.byMode.filter((m) => m.mode !== "CASH").reduce((s, m) => s + m.amount, 0)
    : DASHBOARD.digitalCollection;
  const upiCollected = live
    ? live.byMode
        .filter((m) => m.mode === "UPI_QR" || m.mode === "UPI_INTENT")
        .reduce((s, m) => s + m.amount, 0)
    : DASHBOARD.upiCollection;
  const awaitingPayout = settlementTotals.data?.awaitingPayout ?? DASHBOARD.pendingVendorPayments;

  // Occupancy is a zones question, not a revenue one, so it comes from the
  // zones endpoint rather than being folded into the revenue response.
  const zonesQuery = useApiQuery(["zones", "utilisation"], () =>
    listAll((page, pageSize) => zonesApi.list({ page, pageSize })),
  );
  const utilisation = (zonesQuery.data ?? ZONES).map((zone) => ({
    id: zone.id,
    name: zone.name,
    occupied: zone.occupied,
    capacity: zone.capacity,
  }));

  // The charts read their own series: the revenue overview answers "how much",
  // these answer "when".
  const dailySeries = useApiQuery(["analytics", "daily", range], () =>
    analyticsApi.daily(Math.max(1, Math.round((Date.now() - (RANGE_START[range] ?? RANGE_START["30d"])().getTime()) / 86_400_000))).then((r) => r.data),
  );
  const hourlySeries = useApiQuery(["analytics", "hourly"], () =>
    analyticsApi.hourly().then((r) => r.data),
  );

  /** The busiest hour of the day, by vehicles parked. */
  const peakHour = hourlySeries.data
    ? [...hourlySeries.data].sort((a, b) => b.occupancy - a.occupancy)[0]
    : undefined;
  const demoPeak = [...HOURLY_SERIES].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description={`Collections across the network — ${rangeLabel.toLowerCase()}. Money is stored as integer paise and only formatted here.`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <CalendarClock className="size-4" />
                  {rangeLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Period</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={range} onValueChange={setRange}>
                  {RANGES.map((r) => (
                    <DropdownMenuRadioItem key={r.value} value={r.value}>
                      {r.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {["PDF", "Excel", "CSV"].map((format) => (
                  <DropdownMenuItem
                    key={format}
                    onSelect={() =>
                      toast.success(`${format} export queued`, {
                        description: `Revenue report · ${rangeLabel}`,
                      })
                    }
                  >
                    Download as {format}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Gross collected"
            value={<Money value={live?.net ?? totalVendorRevenue} compact />}
            icon={BadgeIndianRupee}
            hint={
              live
                ? `${live.count.toLocaleString("en-IN")} payments · net of ${formatMoney(live.refunded)} refunded`
                : `across ${vendorRevenue.length} vendors`
            }
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Government share"
            value={<Money value={govtShare} compact />}
            icon={Landmark}
            accent="success"
            hint={`${percent(govtShare, totalVendorRevenue)}% of gross`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Cash collected"
            value={<Money value={cashCollected} compact />}
            icon={Banknote}
            hint={`${percent(cashCollected, cashCollected + digitalCollected)}% of collections`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Awaiting payout"
            value={<Money value={awaitingPayout} compact />}
            icon={Coins}
            accent="warning"
            hint="Approved, not yet transferred"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Revenue over time"
          description="Cash and digital, day by day"
          action={<TrendingUp className="size-4 text-muted-foreground" />}
        >
          <RevenueChart height={280} data={dailySeries.data ?? undefined} />
        </SectionCard>

        <SectionCard title="Payment mix" description="Share by collection method">
          <PaymentMixChart data={paymentMix.slice(0, 6)} />
          <div className="mt-3 space-y-1.5">
            {paymentMix.slice(0, 6).map((m) => (
              <div key={m.name} className="flex items-center gap-2 text-xs">
                <span className="size-2 shrink-0 rounded-full" style={{ background: m.fill }} />
                <span className="flex-1 truncate text-muted-foreground">{m.name}</span>
                <Money value={m.value} compact className="text-xs" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Tabs defaultValue="zone">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="zone">By zone</TabsTrigger>
          <TabsTrigger value="vendor">By vendor</TabsTrigger>
          <TabsTrigger value="hour">By hour</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="zone" className="mt-4">
          <SectionCard
            title="Zone-wise revenue"
            description="Highest earning kerb first"
            contentClassName="p-0"
          >
            <ul className="divide-y divide-border/60">
              {zoneRevenue.map((zone, i) => (
                <li key={zone.id}>
                  <Link
                    href={ROUTES.zone(zone.id)}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold tabular">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{zone.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {zone.wardName} · {zone.vendorName ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="hidden w-40 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{ width: `${((zone.revenueMonth ?? 0) / maxZoneRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <Money value={zone.revenueMonth} className="text-sm font-medium" />
                      <p className="text-[11px] text-muted-foreground">
                        {percent(zone.revenueMonth ?? 0, totalVendorRevenue)}% of total
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="vendor" className="mt-4">
          <SectionCard title="Vendor-wise revenue" description="Gross, commission and net" contentClassName="p-0">
            <ul className="divide-y divide-border/60">
              {vendorRevenue.map((vendor) => {
                const commission = Math.round(((vendor.revenueMonth ?? 0) * vendor.commissionPct) / 100);
                return (
                  <li key={vendor.id}>
                    <Link
                      href={ROUTES.vendor(vendor.id)}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{vendor.orgName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {vendor.zoneCount} zones · {vendor.attendantCount} attendants
                        </p>
                      </div>
                      <Badge variant="secondary" className="tabular">
                        {vendor.commissionPct}%
                      </Badge>
                      <div className="w-24 text-right">
                        <p className="text-[11px] text-muted-foreground">Gross</p>
                        <Money value={(vendor.revenueMonth ?? 0)} compact className="text-sm" />
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-[11px] text-muted-foreground">Municipal</p>
                        <Money value={commission} compact className="text-sm text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-[11px] text-muted-foreground">Vendor</p>
                        <Money value={(vendor.revenueMonth ?? 0) - commission} compact className="text-sm font-medium" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="hour" className="mt-4 space-y-4">
          <SectionCard
            title="Hourly pattern"
            description={
              peakHour
                ? `Busiest around ${peakHour.hour} with ${peakHour.occupancy} vehicles parked`
                : `Peak collection is around ${demoPeak.hour} at ${formatMoney(demoPeak.revenue, { compact: true })}`
            }
          >
            <OccupancyChart data={hourlySeries.data ?? undefined} />
          </SectionCard>
          <SectionCard title="Collection split" description="Cash versus digital in this period">
            <SplitMeter
              segments={[
                { label: "Cash", value: cashCollected, className: "bg-chart-3" },
                { label: "UPI", value: upiCollected, className: "bg-chart-1" },
                {
                  label: "Card & wallet",
                  value: Math.max(0, digitalCollected - upiCollected),
                  className: "bg-chart-2",
                },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-4">
          <SectionCard title="Session volume" description="Daily sessions over 30 days">
            <SessionsTrendChart data={dailySeries.data ?? undefined} />
          </SectionCard>
          <SectionCard title="Utilisation by zone" description="Occupancy against capacity" contentClassName="p-0">
            <ul className="divide-y divide-border/60">
              {utilisation.map((zone) => (
                <li key={zone.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{zone.name}</p>
                  </div>
                  <div className="w-48">
                    <OccupancyBar occupied={zone.occupied} capacity={zone.capacity} />
                  </div>
                  <span className="w-12 text-right text-sm tabular">
                    {percent(zone.occupied, zone.capacity)}%
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
