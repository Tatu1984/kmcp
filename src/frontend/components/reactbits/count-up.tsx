"use client";

import * as React from "react";
import { animate, useInView, useMotionValue, useTransform, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: boolean;
  className?: string;
};

/** reactbits — CountUp. Numbers animate in once when they scroll into view. */
export function CountUp({
  to,
  from = 0,
  duration = 1.1,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = true,
  className,
}: Props) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const value = useMotionValue(from);
  const text = useTransform(value, (v) => {
    const fixed = v.toFixed(decimals);
    if (!separator) return `${prefix}${fixed}${suffix}`;
    const [int, dec] = fixed.split(".");
    const grouped = Number(int).toLocaleString("en-IN");
    return `${prefix}${dec ? `${grouped}.${dec}` : grouped}${suffix}`;
  });

  React.useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, to, duration, value]);

  return (
    <motion.span ref={ref} className={cn("tabular", className)}>
      {text}
    </motion.span>
  );
}
