"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Classification } from "@/lib/api";
import { CLASSIFICATION_META } from "@/lib/api";

interface Props {
  confidence: number;
  classification: Classification;
  size?: number;
}

export default function ConfidenceGauge({ confidence, classification, size = 160 }: Props) {
  const meta = CLASSIFICATION_META[classification];
  const strokeWidth = size * 0.09;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = Math.PI * radius; // half circle

  // We draw a semicircle arc (180°) from 180° to 360°
  const dashLength = circumference;
  const fillLength = dashLength * confidence;
  const gapLength = dashLength - fillLength;

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: size, height: size / 2 + strokeWidth / 2 }} className="relative">
        <svg
          width={size}
          height={size / 2 + strokeWidth}
          viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`}
          style={{ overflow: "visible" }}
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
            fill="none"
            stroke="#21262d"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Animated fill arc */}
          <motion.path
            d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
            fill="none"
            stroke={meta.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${dashLength}`}
            initial={{ strokeDashoffset: dashLength }}
            animate={{ strokeDashoffset: gapLength }}
            transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1], delay: 0.2 }}
            style={{
              filter: `drop-shadow(0 0 6px ${meta.color}80)`,
            }}
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const angle = Math.PI + (Math.PI * pct) / 100;
            const tx = center + (radius + strokeWidth * 0.8) * Math.cos(angle);
            const ty = center + (radius + strokeWidth * 0.8) * Math.sin(angle);
            return (
              <text
                key={pct}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size * 0.06}
                fill="#8b949e"
                fontFamily="JetBrains Mono, monospace"
              >
                {pct}
              </text>
            );
          })}
        </svg>

        {/* Center value */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center"
          style={{ marginBottom: -strokeWidth / 4 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="font-bold mono"
            style={{ fontSize: size * 0.17, color: meta.color, lineHeight: 1 }}
          >
            {Math.round(confidence * 100)}%
          </motion.div>
          <div className="text-xs text-space-muted mt-0.5 mono">confidence</div>
        </div>
      </div>
    </div>
  );
}
