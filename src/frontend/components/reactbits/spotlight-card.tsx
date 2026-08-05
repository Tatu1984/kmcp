"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** reactbits — SpotlightCard. A soft highlight follows the pointer across the card. */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "color-mix(in oklch, var(--primary) 22%, transparent)",
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn("relative overflow-hidden", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(360px circle at var(--sx, 50%) var(--sy, 50%), ${spotlightColor}, transparent 62%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
