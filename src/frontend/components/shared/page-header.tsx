"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/frontend/components/reactbits";

export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <FadeIn>
      <div className={cn("flex flex-col gap-4 pb-1 md:flex-row md:items-start md:justify-between", className)}>
        <div className="min-w-0 space-y-1.5">
          {back && (
            <Link
              href={back.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span aria-hidden>←</span> {back.label}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </FadeIn>
  );
}
