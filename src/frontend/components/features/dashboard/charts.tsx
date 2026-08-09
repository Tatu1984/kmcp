"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/frontend/components/ui/chart";
import { HOURLY_SERIES, DAILY_SERIES } from "@/frontend/lib/mock";
import { formatMoney } from "@/shared/utils/common.util";

const occupancyConfig = {
  occupancy: { label: "Vehicles parked", color: "var(--chart-1)" },
  sessions: { label: "Sessions started", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Series come in as props so a chart can be fed real data or the demo set.
 *
 * Each defaults to the bundled series, which is what keeps the offline
 * walkthrough working on a screen that has not been wired yet.
 */
export interface HourlyPoint {
  hour: string;
  occupancy: number;
  sessions: number;
}

export interface DailyPoint {
  label: string;
  cash: number;
  digital: number;
  sessions: number;
}

export function OccupancyChart({ data = HOURLY_SERIES }: { data?: HourlyPoint[] }) {
  return (
    <ChartContainer config={occupancyConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillOccupancy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-occupancy)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-occupancy)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={26}
          fontSize={11}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="occupancy"
          type="monotone"
          stroke="var(--color-occupancy)"
          fill="url(#fillOccupancy)"
          strokeWidth={2}
        />
        <Area
          dataKey="sessions"
          type="monotone"
          stroke="var(--color-sessions)"
          fill="url(#fillSessions)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const revenueConfig = {
  cash: { label: "Cash", color: "var(--chart-3)" },
  digital: { label: "Digital", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RevenueChart({
  height = 260,
  data = DAILY_SERIES,
}: {
  height?: number;
  data?: DailyPoint[];
}) {
  return (
    <ChartContainer config={revenueConfig} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: -6, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={22} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={54}
          tickFormatter={(v: number) => formatMoney(v, { compact: true })}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground capitalize">{String(name)}</span>
                  <span className="font-medium tabular">{formatMoney(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="cash" stackId="a" fill="var(--color-cash)" radius={[0, 0, 3, 3]} />
        <Bar dataKey="digital" stackId="a" fill="var(--color-digital)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const modeConfig = {
  value: { label: "Collected" },
} satisfies ChartConfig;

export function PaymentMixChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  return (
    <ChartContainer config={modeConfig} className="mx-auto h-[210px] w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">{String(name)}</span>
                  <span className="font-medium tabular">{formatMoney(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

const trendConfig = {
  sessions: { label: "Sessions", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function SessionsTrendChart({ data = DAILY_SERIES }: { data?: DailyPoint[] }) {
  return (
    <ChartContainer config={trendConfig} className="h-[200px] w-full">
      <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={26} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Line
          dataKey="sessions"
          type="monotone"
          stroke="var(--color-sessions)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
