"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** reactbits — DotGrid. Dots brighten near the cursor. Pure CSS mask, no canvas. */
export function DotGrid({
  className,
  gap = 22,
  dotSize = 1.6,
  radius = 180,
}: {
  className?: string;
  gap?: number;
  dotSize?: number;
  radius?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      onMouseMove={onMove}
      className={cn("absolute inset-0", className)}
      style={{
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        backgroundImage: `radial-gradient(currentColor ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        maskImage: `radial-gradient(${radius}px circle at var(--mx) var(--my), black 0%, transparent 100%)`,
        WebkitMaskImage: `radial-gradient(${radius}px circle at var(--mx) var(--my), black 0%, transparent 100%)`,
      }}
    />
  );
}
