"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/frontend/components/ui/card";
import { CountUp, SpotlightCard } from "@/frontend/components/reactbits";
import type { Trend } from "@/shared/types/common.types";

export function StatCard({
  label,
  value,
  numeric,
  prefix,
  suffix,
  decimals = 0,
  icon: Icon,
  trend,
  trendValue,
  hint,
  href,
  accent = "primary",
  className,
}: {
  label: string;
  value?: React.ReactNode;
  numeric?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: LucideIcon;
  trend?: Trend;
  trendValue?: string;
  hint?: React.ReactNode;
  href?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const accentRing: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    warning: "text-amber-600 bg-amber-500/12 dark:text-amber-400",
    danger: "text-red-600 bg-red-500/10 dark:text-red-400",
    info: "text-sky-600 bg-sky-500/10 dark:text-sky-400",
  };

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  const trendClass =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  const body = (
    <SpotlightCard className="rounded-xl">
      <Card
        className={cn(
          "gap-0 rounded-xl border-border/70 p-4 shadow-xs transition-all duration-200",
          href && "group-hover:border-primary/40 group-hover:shadow-sm",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {Icon && (
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", accentRing[accent])}>
              <Icon className="size-4" />
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl leading-none font-semibold tracking-tight tabular">
            {numeric !== undefined ? (
              <CountUp to={numeric} prefix={prefix} suffix={suffix} decimals={decimals} />
            ) : (
              value
            )}
          </span>
          {trendValue && (
            <span className={cn("mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium", trendClass)}>
              <TrendIcon className="size-3.5" />
              {trendValue}
            </span>
          )}
        </div>

        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </SpotlightCard>
  );

  return href ? (
    <Link href={href} className="group block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
