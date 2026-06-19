"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TransitCountdownProps {
  initialHours: number;
}

export default function TransitCountdown({ initialHours }: TransitCountdownProps) {
  // We'll track remaining milliseconds locally to count down smoothly
  const [timeLeftMs, setTimeLeftMs] = useState(initialHours * 3600 * 1000);

  useEffect(() => {
    // Reset timer if initialHours changes from backend poll
    setTimeLeftMs(initialHours * 3600 * 1000);
  }, [initialHours]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalHours = timeLeftMs / (3600 * 1000);
  const h = Math.floor(totalHours);
  const m = Math.floor((totalHours - h) * 60);
  const s = Math.floor(((totalHours - h) * 60 - m) * 60);

  let display = "";
  if (h > 0) {
    display = `${h}h ${m}m`;
  } else if (m > 0) {
    display = `${m}m ${s}s`;
  } else {
    display = `${s}s`;
  }

  if (timeLeftMs === 0) {
    display = "Transiting now!";
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-space-card/80 border border-space-accent/20">
      <Clock size={14} className="text-space-accent" />
      <span className="text-sm mono text-space-muted">Next transit:</span>
      <span className="text-sm font-bold text-space-accent mono">{display}</span>
    </div>
  );
}
