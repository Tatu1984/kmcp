"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** reactbits — ShinyText. A slow specular sweep across the glyphs. */
export function ShinyText({
  children,
  className,
  speed = 5,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  disabled?: boolean;
}) {
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage:
          "linear-gradient(110deg, color-mix(in oklch, currentColor 55%, transparent) 35%, currentColor 50%, color-mix(in oklch, currentColor 55%, transparent) 65%)",
        backgroundSize: "200% auto",
        animation: `kmcp-shine ${speed}s linear infinite`,
      }}
    >
      {children}
    </span>
  );
}
