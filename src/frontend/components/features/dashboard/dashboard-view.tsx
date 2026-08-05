"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeIndianRupee,
  Building2,
  CalendarClock,
  CircleParking,
  Coins,
  Download,
  Layers,
  RefreshCw,
  ShieldAlert,
  SquareParking,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/frontend/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import {
  Money,
  OccupancyBar,
  SectionCard,
  SplitMeter,
} from "@/frontend/components/shared/bits";
import { AvailabilityBadge, StatusBadge } from "@/frontend/components/shared/status-badge";
import { FadeStagger, FadeStaggerItem, Ticker } from "@/frontend/components/reactbits";
import { OccupancyChart, PaymentMixChart, RevenueChart } from "./charts";
import { LiveActivityFeed } from "./live-feed";
import { OccupancyHeatMap } from "./heat-map";
import { DASHBOARD, TOP_ZONES, LOW_OCCUPANCY_ZONES, PAYMENTS } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { formatMoney, percent } from "@/shared/utils/common.util";
import { PAYMENT_MODE_LABELS } from "@/config/app.config";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "Month to date" },
  { value: "fy", label: "Financial year" },
];

export function DashboardView() {
  const [range, setRange] = React.useState("today");
  const [refreshing, setRefreshing] = React.useState(false);

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "Today";

  const paymentMix = React.useMemo(() => {
    const captured = PAYMENTS.filter((p) => p.status === "CAPTURED");
    const byMode = new Map<string, number>();
    captured.forEach((p) => byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amount));
    const palette = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "color-mix(in oklch, var(--chart-1) 55%, var(--chart-5))",
    ];
    return [...byMode.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([mode, value], i) => ({
        name: PAYMENT_MODE_LABELS[mode] ?? mode,
        value,
        fill: palette[i % palette.length],
      }));
  }, []);

  async function refresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
    toast.success("Dashboard refreshed", { description: "Live counters re-read from the cache." });
  }

  const revenueDelta = percent(
    DASHBOARD.revenueToday - DASHBOARD.revenueYesterday,
    DASHBOARD.revenueYesterday,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description={`Live picture of the kerbside network — ${rangeLabel.toLowerCase()}.`}
        meta={
          <Badge variant="outline" className="gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-500" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </Badge>
        }
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
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Reporting period
                </DropdownMenuLabel>
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

            <Button variant="outline" size="sm" className="h-9" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>

            <Button size="sm" className="h-9" asChild>
              <Link href={ROUTES.reports}>
                <Download className="size-4" /> Export
              </Link>
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------- attention banner */}
      {(DASHBOARD.varianceShifts > 0 || DASHBOARD.pendingSettlements > 0) && (
        <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Needs your attention</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {DASHBOARD.varianceShifts} shift{DASHBOARD.varianceShifts === 1 ? "" : "s"} closed with
              a cash variance, and {DASHBOARD.pendingSettlements} settlement
              {DASHBOARD.pendingSettlements === 1 ? "" : "s"} are waiting on approval.
            </span>
            <span className="flex gap-2">
              <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 dark:text-amber-300" asChild>
                <Link href={ROUTES.shifts}>Review shifts</Link>
              </Button>
              <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 dark:text-amber-300" asChild>
                <Link href={ROUTES.settlements}>Review settlements</Link>
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* ---------------------------------------------------------- ticker */}
      <div className="rounded-lg border bg-card/60 px-3 py-2">
        <Ticker
          speed={46}
          items={[
            `${DASHBOARD.activeVehicles} vehicles parked right now`,
            `${DASHBOARD.availableSlots} bays free across ${DASHBOARD.zonesOpen} open zones`,
            `${formatMoney(DASHBOARD.revenueToday)} collected today`,
            `${DASHBOARD.attendantsOnShift} attendants on shift`,
            `${DASHBOARD.overstayCount} vehicles past expected duration`,
            `${DASHBOARD.openIncidents} incidents open`,
            `${formatMoney(DASHBOARD.pendingVendorPayments, { compact: true })} pending vendor payout`,
          ].map((text, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              <span className="mr-2 inline-block size-1 rounded-full bg-primary align-middle" />
              {text}
            </span>
          ))}
        />
      </div>

      {/* ------------------------------------------------------- stat tiles */}
      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Revenue today"
            value={formatMoney(DASHBOARD.revenueToday)}
            icon={BadgeIndianRupee}
            trend={revenueDelta >= 0 ? "up" : "down"}
            trendValue={`${Math.abs(revenueDelta)}%`}
            hint={`vs ${formatMoney(DASHBOARD.revenueYesterday, { compact: true })} yesterday`}
            href={ROUTES.revenue}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Vehicles parked"
            numeric={DASHBOARD.activeVehicles}
            icon={CircleParking}
            accent="info"
            hint={`${DASHBOARD.availableSlots} bays free of ${DASHBOARD.totalCapacity}`}
            href={ROUTES.sessions}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Network occupancy"
            numeric={DASHBOARD.occupancyPct}
            suffix="%"
            icon={SquareParking}
            accent={DASHBOARD.occupancyPct > 85 ? "warning" : "success"}
            hint={`${DASHBOARD.totalOccupied} of ${DASHBOARD.totalCapacity} bays`}
            href={ROUTES.zones}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Pending vendor payout"
            value={formatMoney(DASHBOARD.pendingVendorPayments, { compact: true })}
            icon={Coins}
            accent="warning"
            hint={`${DASHBOARD.pendingSettlements} settlements awaiting approval`}
            href={ROUTES.settlements}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Sessions today"
            numeric={DASHBOARD.sessionsToday}
            icon={Activity}
            hint={`${DASHBOARD.overstayCount} past expected duration`}
            href={ROUTES.sessions}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Attendants on shift"
            numeric={DASHBOARD.attendantsOnShift}
            icon={Users}
            accent="info"
            hint={`of ${DASHBOARD.totalAttendants} registered`}
            href={ROUTES.attendants}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Active vendors"
            numeric={DASHBOARD.activeVendors}
            icon={Building2}
            hint={`${DASHBOARD.pendingVendorApprovals} application awaiting approval`}
            href={ROUTES.vendors}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Open incidents"
            numeric={DASHBOARD.openIncidents}
            icon={ShieldAlert}
            accent={DASHBOARD.openIncidents > 10 ? "danger" : "warning"}
            hint="Illegal parking, disputes and damage"
            href={ROUTES.incidents}
          />
        </FadeStaggerItem>
      </FadeStagger>

      {/* ------------------------------------------------------ main charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Network activity"
          description="Occupancy and sessions across the last 24 hours"
          action={
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href={ROUTES.revenue}>
                Details <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <Tabs defaultValue="occupancy">
            <TabsList className="mb-3">
              <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
            </TabsList>
            <TabsContent value="occupancy" className="mt-0">
              <OccupancyChart />
            </TabsContent>
            <TabsContent value="revenue" className="mt-0">
              <RevenueChart height={240} />
            </TabsContent>
          </Tabs>
        </SectionCard>

        <SectionCard
          title="Live activity"
          description="Events as they happen at the kerb"
          contentClassName="p-3"
        >
          <LiveActivityFeed />
        </SectionCard>
      </div>

      {/* ------------------------------------------------- collection split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Cash vs digital" description="Where today's money came from">
          <SplitMeter
            segments={[
              { label: "Cash", value: DASHBOARD.cashCollection, className: "bg-chart-3" },
              { label: "Digital", value: DASHBOARD.digitalCollection, className: "bg-chart-1" },
            ]}
          />
          <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">UPI collection</dt>
              <dd>
                <Money value={DASHBOARD.upiCollection} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Vendor collection (month)</dt>
              <dd>
                <Money value={DASHBOARD.vendorCollection} compact />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Government share (month)</dt>
              <dd>
                <Money value={Math.round(DASHBOARD.vendorCollection * 0.19)} compact />
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Payment mix" description="Collections by method">
          <PaymentMixChart data={paymentMix} />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {paymentMix.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5 text-xs">
                <span className="size-2 shrink-0 rounded-full" style={{ background: m.fill }} />
                <span className="truncate text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="30-day revenue"
          description="Cash and digital, day by day"
          action={<TrendingUp className="size-4 text-muted-foreground" />}
        >
          <RevenueChart height={230} />
        </SectionCard>
      </div>

      {/* ---------------------------------------------------------- heatmap */}
      <SectionCard
        title="Parking heat map"
        description="Tile size is capacity, colour is utilisation — the big red tiles are where to look first"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link href={ROUTES.zones}>
              All zones <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        <OccupancyHeatMap />
      </SectionCard>

      {/* -------------------------------------------------- zone leaderboard */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Top performing zones"
          description="Highest revenue today"
          action={<Layers className="size-4 text-muted-foreground" />}
          contentClassName="p-0"
        >
          <ul className="divide-y divide-border/60">
            {TOP_ZONES.map((zone, i) => (
              <li key={zone.id}>
                <Link
                  href={ROUTES.zone(zone.id)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold tabular">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{zone.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {zone.wardName} · {zone.code}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <OccupancyBar occupied={zone.occupied} capacity={zone.capacity} showLabel={false} />
                  </div>
                  <Money value={zone.revenueToday} className="w-20 shrink-0 text-right text-sm font-medium" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Low occupancy zones"
          description="Under-used kerb — candidates for tariff or signage review"
          contentClassName="p-0"
        >
          <ul className="divide-y divide-border/60">
            {LOW_OCCUPANCY_ZONES.map((zone) => (
              <li key={zone.id}>
                <Link
                  href={ROUTES.zone(zone.id)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{zone.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {zone.streetName} · open {zone.openTime}–{zone.closeTime}
                    </p>
                  </div>
                  <AvailabilityBadge occupied={zone.occupied} capacity={zone.capacity} />
                  <span className="w-14 shrink-0 text-right text-sm font-medium tabular">
                    {percent(zone.occupied, zone.capacity)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Network status" description="Zones by operating state" contentClassName="p-4">
        <div className="flex flex-wrap gap-2">
          {(["OPEN", "MAINTENANCE", "EVENT_CLOSURE", "CLOSED"] as const).map((status) => {
            const count = TOP_ZONES.concat(LOW_OCCUPANCY_ZONES).length;
            return (
              <Link
                key={status}
                href={`${ROUTES.zones}?status=${status}`}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors hover:bg-accent/40"
              >
                <StatusBadge status={status} />
                <span className="text-xs text-muted-foreground">
                  {status === "OPEN" ? DASHBOARD.zonesOpen : Math.max(1, Math.round(count / 8))} zones
                </span>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
