import TransitCountdown from "./TransitCountdown";

interface OrbitStatsProps {
  periodDays: number;
  aRs: number;
  phase: number;
  nextTransitInHours: number;
}

export default function OrbitStatsStrip({ periodDays, aRs, phase, nextTransitInHours }: OrbitStatsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mt-6 p-4 rounded-lg bg-space-card/40 border border-space-card">
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-space-muted mb-1">Orbital Period</span>
          <span className="font-mono text-sm text-[#c9d1d9]">{periodDays.toFixed(2)} days</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-space-muted mb-1">Semi-major axis</span>
          <span className="font-mono text-sm text-[#c9d1d9]">{aRs.toFixed(1)} R★</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-space-muted mb-1">Current phase</span>
          <span className="font-mono text-sm text-[#c9d1d9]">{phase.toFixed(3)}</span>
        </div>
      </div>
      
      <TransitCountdown initialHours={nextTransitInHours} />
    </div>
  );
}
