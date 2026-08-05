"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Progress } from "@/frontend/components/ui/progress";
import { Avatar, AvatarFallback } from "@/frontend/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/frontend/components/ui/tooltip";
import { formatMoney, formatPlate, initials, percent } from "@/shared/utils/common.util";
import type { Paise } from "@/shared/types/common.types";

/** Money, right-aligned and tabular so columns line up down the page. */
export function Money({
  value,
  className,
  compact,
  muted,
}: {
  value?: Paise | null;
  className?: string;
  compact?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {formatMoney(value, { compact })}
    </span>
  );
}

/** A registration number, rendered the way it appears on the plate. */
export function Plate({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide",
        className,
      )}
    >
      {formatPlate(value)}
    </span>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied to clipboard", { description: value });
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Person cell: initials avatar + name + secondary line. */
export function PersonCell({
  name,
  secondary,
  className,
}: {
  name: string;
  secondary?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
}

/** Occupancy bar with a green/amber/red fill, used in zone tables and cards. */
export function OccupancyBar({
  occupied,
  capacity,
  showLabel = true,
  className,
}: {
  occupied: number;
  capacity: number;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = percent(occupied, capacity);
  const tone = pct >= 95 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {showLabel && (
        <span className="w-16 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground tabular">
          {occupied}/{capacity}
        </span>
      )}
    </div>
  );
}

/** A titled section card — the standard container for detail pages. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden rounded-xl border-border/70 py-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b bg-muted/25 px-4 py-3">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("p-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** Label/value row for detail panels. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** Horizontal meter used on dashboards for split figures (cash vs digital etc). */
export function SplitMeter({
  segments,
  className,
}: {
  segments: { label: string; value: number; className: string }[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn("h-full transition-all", s.className)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn("size-2 rounded-full", s.className)} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular">{formatMoney(s.value, { compact: true })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { Progress };
