"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** reactbits — AnimatedList. New rows slide in from the top and push the rest down. */
export function AnimatedList({
  children,
  className,
  stagger = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger } } }}
    >
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </motion.div>
  );
}

export function AnimatedListItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, y: -8, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
