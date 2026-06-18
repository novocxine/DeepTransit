"use client";

import { motion } from "framer-motion";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  subvalue?: string;
  color?: string;
  delay?: number;
  wide?: boolean;
}

export default function StatCard({
  label,
  value,
  unit,
  subvalue,
  color,
  delay = 0,
  wide = false,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={`glass-card p-4 ${wide ? "col-span-2" : ""}`}
    >
      <div className="text-xs text-space-muted mono uppercase tracking-widest mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-bold mono leading-none"
          style={{ color: color || "#c9d1d9" }}
        >
          {typeof value === "number"
            ? value.toLocaleString(undefined, { maximumFractionDigits: 6 })
            : value}
        </span>
        {unit && (
          <span className="text-sm text-space-muted mono">{unit}</span>
        )}
      </div>
      {subvalue && (
        <div className="text-xs text-space-muted mono mt-1">{subvalue}</div>
      )}
    </motion.div>
  );
}
