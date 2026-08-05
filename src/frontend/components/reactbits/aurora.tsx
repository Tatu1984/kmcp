"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * reactbits — Aurora. Slow drifting colour fields behind a hero panel.
 * CSS-only so it costs nothing on the main thread.
 */
export function Aurora({
  className,
  intensity = 0.55,
}: {
  className?: string;
  intensity?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity: intensity }}
    >
      <div
        className="absolute -top-1/3 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle at 30% 30%, var(--chart-1), transparent 62%)",
          animation: "kmcp-aurora-a 18s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[65vh] w-[65vh] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle at 70% 70%, var(--chart-2), transparent 62%)",
          animation: "kmcp-aurora-b 22s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute top-1/4 right-1/4 h-[45vh] w-[45vh] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--chart-5), transparent 65%)",
          animation: "kmcp-aurora-c 26s ease-in-out infinite alternate",
        }}
      />
      <style>{`
        @keyframes kmcp-aurora-a { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(14%, 10%, 0) scale(1.18); } }
        @keyframes kmcp-aurora-b { from { transform: translate3d(0,0,0) scale(1.1); } to { transform: translate3d(-12%, -12%, 0) scale(0.95); } }
        @keyframes kmcp-aurora-c { from { transform: translate3d(0,0,0) scale(0.9); } to { transform: translate3d(-16%, 14%, 0) scale(1.2); } }
      `}</style>
    </div>
  );
}
