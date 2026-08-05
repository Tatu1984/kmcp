"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** reactbits — StarBorder. A light travels around the border of the element. */
export function StarBorder({
  children,
  className,
  color = "var(--primary)",
  speed = 4,
  thickness = 1,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  speed?: number;
  thickness?: number;
}) {
  return (
    <div className={cn("relative rounded-[inherit]", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          padding: thickness,
          background: `conic-gradient(from var(--star-angle, 0deg), transparent 0deg, ${color} 40deg, transparent 110deg)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: `kmcp-star-spin ${speed}s linear infinite`,
        }}
      />
      {children}
      <style>{`
        @property --star-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes kmcp-star-spin { to { --star-angle: 360deg; } }
      `}</style>
    </div>
  );
}
