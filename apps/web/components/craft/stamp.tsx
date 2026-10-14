"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type StampProps = {
  children: ReactNode;
  tone?: "amber" | "red" | "ink";
  rotate?: number;
  /** Change this to replay the stamp, e.g. the revision letter. */
  stampKey?: string | number;
  className?: string;
};

/** Rubber stamp for success moments: lands at 1.15x, settles to 1x with a slight twist. */
export function Stamp({ children, tone = "amber", rotate = -6, stampKey, className = "" }: StampProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.span
      key={stampKey}
      role="status"
      className={`craft-stamp craft-stamp--${tone} ${className}`}
      initial={reducedMotion ? false : { scale: 1.15, rotate: rotate - 5, opacity: 0 }}
      animate={{ scale: 1, rotate, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.6 }}
    >
      {children}
    </motion.span>
  );
}
