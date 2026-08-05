"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

type Spark = { id: number; x: number; y: number };

/**
 * reactbits — ClickSpark. Radial spokes fire from the click point.
 * Wrapped around confirm-style buttons to make a committed action feel committed.
 */
export function ClickSpark({
  children,
  color = "var(--primary)",
  count = 8,
  size = 12,
}: {
  children: React.ReactNode;
  color?: string;
  count?: number;
  size?: number;
}) {
  const [sparks, setSparks] = React.useState<Spark[]>([]);
  const idRef = React.useRef(0);

  const onClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spark = { id: idRef.current++, x: e.clientX - rect.left, y: e.clientY - rect.top };
    setSparks((s) => [...s, spark]);
    window.setTimeout(() => setSparks((s) => s.filter((k) => k.id !== spark.id)), 600);
  };

  return (
    <span className="relative inline-flex" onClick={onClick}>
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
        <AnimatePresence>
          {sparks.map((spark) =>
            Array.from({ length: count }).map((_, i) => {
              const angle = (i / count) * Math.PI * 2;
              return (
                <motion.span
                  key={`${spark.id}-${i}`}
                  className="absolute block rounded-full"
                  style={{ left: spark.x, top: spark.y, width: 2, height: size, background: color }}
                  initial={{ opacity: 0.9, scaleY: 0.4, x: 0, y: 0, rotate: (angle * 180) / Math.PI }}
                  animate={{
                    opacity: 0,
                    scaleY: 1,
                    x: Math.cos(angle) * 22,
                    y: Math.sin(angle) * 22,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            }),
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
