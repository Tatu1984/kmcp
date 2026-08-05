"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** reactbits — GradientText. Animated multi-stop gradient fill. */
export function GradientText({
  children,
  className,
  colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-1)"],
  speed = 8,
}: {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}) {
  return (
    <span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
        backgroundSize: "300% 100%",
        animation: `kmcp-shine ${speed}s linear infinite`,
      }}
    >
      {children}
    </span>
  );
}
