"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** reactbits — BlurText. Words resolve out of a blur, one after another. */
export function BlurText({
  text,
  className,
  delay = 0.05,
  by = "word",
}: {
  text: string;
  className?: string;
  delay?: number;
  by?: "word" | "char";
}) {
  const parts = by === "word" ? text.split(" ") : text.split("");
  return (
    <span className={cn("inline-flex flex-wrap", className)}>
      {parts.map((part, i) => (
        <motion.span
          key={`${part}-${i}`}
          initial={{ filter: "blur(8px)", opacity: 0, y: 6 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * delay, ease: [0.16, 1, 0.3, 1] }}
          className={by === "word" ? "mr-[0.28em]" : undefined}
        >
          {part === " " ? " " : part}
        </motion.span>
      ))}
    </span>
  );
}
