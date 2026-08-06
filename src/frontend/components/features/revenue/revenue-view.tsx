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

export function RevenueView() {
  const [range, setRange] = React.useState("30d");
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "Last 30 days";

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
      .map(([mode, value], i) => ({
        name: PAYMENT_MODE_LABELS[mode] ?? mode,
        value,
        fill: palette[i % palette.length],
      }));
  }, []);

  const zoneRevenue = [...ZONES].sort((a, b) => (b.revenueMonth ?? 0) - (a.revenueMonth ?? 0));
  const maxZoneRevenue = zoneRevenue[0]?.revenueMonth ?? 1;
  const vendorRevenue = [...VENDORS]
    .filter((v) => v.revenueMonth > 0)
    .sort((a, b) => b.revenueMonth - a.revenueMonth);
  const totalVendorRevenue = vendorRevenue.reduce((s, v) => s + v.revenueMonth, 0);
  const govtShare = vendorRevenue.reduce(
    (s, v) => s + Math.round((v.revenueMonth * v.commissionPct) / 100),
    0,
  );

  const peakHour = [...HOURLY_SERIES].sort((a, b) => b.revenue - a.revenue)[0];

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
            value={<Money value={totalVendorRevenue} compact />}
            icon={BadgeIndianRupee}
            trend="up"
            trendValue="7.4%"
            hint={`across ${vendorRevenue.length} vendors`}
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
            value={<Money value={DASHBOARD.cashCollection} compact />}
            icon={Banknote}
            hint={`${percent(DASHBOARD.cashCollection, DASHBOARD.cashCollection + DASHBOARD.digitalCollection)}% of collections`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Outstanding"
            value={<Money value={DASHBOARD.pendingVendorPayments} compact />}
            icon={Coins}
            accent="warning"
            hint="Awaiting settlement approval"
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
          <RevenueChart height={280} />
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
                const commission = Math.round((vendor.revenueMonth * vendor.commissionPct) / 100);
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
                        <Money value={vendor.revenueMonth} compact className="text-sm" />
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-[11px] text-muted-foreground">Municipal</p>
                        <Money value={commission} compact className="text-sm text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-[11px] text-muted-foreground">Vendor</p>
                        <Money value={vendor.revenueMonth - commission} compact className="text-sm font-medium" />
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
            description={`Peak collection is around ${peakHour.hour} at ${formatMoney(peakHour.revenue, { compact: true })}`}
          >
            <OccupancyChart />
          </SectionCard>
          <SectionCard title="Collection split" description="Cash versus digital in this period">
            <SplitMeter
              segments={[
                { label: "Cash", value: DASHBOARD.cashCollection, className: "bg-chart-3" },
                { label: "UPI", value: DASHBOARD.upiCollection, className: "bg-chart-1" },
                {
                  label: "Card & wallet",
                  value: Math.max(0, DASHBOARD.digitalCollection - DASHBOARD.upiCollection),
                  className: "bg-chart-2",
                },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-4">
          <SectionCard title="Session volume" description="Daily sessions over 30 days">
            <SessionsTrendChart />
          </SectionCard>
          <SectionCard title="Utilisation by zone" description="Occupancy against capacity" contentClassName="p-0">
            <ul className="divide-y divide-border/60">
              {ZONES.map((zone) => (
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
