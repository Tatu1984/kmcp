"use client";

import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-xl" />
        <span className="grid size-11 place-items-center rounded-xl border bg-muted/50 text-muted-foreground">
          <Icon className="size-5" />
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
