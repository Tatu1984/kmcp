"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** reactbits — Marquee. Used for the live kerbside ticker along the header. */
export function Ticker({
  items,
  className,
  speed = 42,
  gap = 40,
}: {
  items: React.ReactNode[];
  className?: string;
  speed?: number;
  gap?: number;
}) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <motion.div
        className="flex w-max items-center"
        style={{ gap }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {doubled.map((item, i) => (
          <div key={i} className="shrink-0">
            {item}
          </div>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
