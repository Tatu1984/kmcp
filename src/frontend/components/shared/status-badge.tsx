"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/shared/utils/common.util";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  warning: "bg-amber-500/14 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  danger: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
  info: "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  violet: "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300",
};

const STATUS_TONES: Record<string, Tone> = {
  // generic
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "warning",
  BLACKLISTED: "danger",
  BLOCKED: "danger",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  // zone
  OPEN: "success",
  CLOSED: "danger",
  MAINTENANCE: "warning",
  EVENT_CLOSURE: "violet",
  // slot
  AVAILABLE: "success",
  OCCUPIED: "info",
  RESERVED: "violet",
  OUT_OF_SERVICE: "danger",
  // session
  COMPLETED: "neutral",
  CANCELLED: "danger",
  OVERSTAY: "warning",
  DISPUTED: "violet",
  // payment
  CAPTURED: "success",
  FAILED: "danger",
  REFUNDED: "violet",
  PARTIALLY_REFUNDED: "violet",
  // shift
  VERIFIED: "success",
  VARIANCE_FLAGGED: "danger",
  // settlement
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  PAID: "success",
  // pass
  EXPIRED: "neutral",
  PENDING_PAYMENT: "warning",
  // incident
  IN_PROGRESS: "info",
  RESOLVED: "success",
  // report
  QUEUED: "neutral",
  RUNNING: "info",
};

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  violet: "bg-violet-500",
};

export function StatusBadge({
  status,
  label,
  tone,
  pulse,
  className,
}: {
  status: string;
  label?: string;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  const resolved = tone ?? STATUS_TONES[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONE_CLASSES[resolved],
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span className={cn("absolute inline-flex size-full rounded-full animate-pulse-ring", DOT_TONES[resolved])} />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", DOT_TONES[resolved])} />
      </span>
      {label ?? titleCase(status)}
    </span>
  );
}

/** Green / yellow / red availability chip used across zone views. */
export function AvailabilityBadge({ occupied, capacity }: { occupied: number; capacity: number }) {
  const pct = capacity ? occupied / capacity : 0;
  const [tone, label]: [Tone, string] =
    pct >= 0.95 ? ["danger", "Full"] : pct >= 0.7 ? ["warning", "Limited"] : ["success", "Available"];
  return <StatusBadge status={label} label={label} tone={tone} />;
}
