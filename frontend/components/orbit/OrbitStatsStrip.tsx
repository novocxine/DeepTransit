import TransitCountdown from "./TransitCountdown";
import { Info } from "lucide-react";

interface OrbitStatsProps {
  periodDays: number;
  aRs: number;
  phase: number;
  nextTransitInHours: number;
  distances?: any;
}

export default function OrbitStatsStrip({ periodDays, aRs, phase, nextTransitInHours, distances }: OrbitStatsProps) {
  const formatSep = (val: number) => {
    if (val < 0.1) return val.toFixed(3);
    if (val < 1) return val.toFixed(2);
    return val.toFixed(1);
  };

  return (
    <div className="flex flex-col gap-4 mt-6 p-4 rounded-lg bg-space-card/40 border border-space-card">
      {/* Row 1: Relative / Orbital Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

      {/* Row 2: Physical Distances */}
      {distances && (
        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-space-card/50">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-space-muted mb-1">Star–Planet distance</span>
            <span className="font-mono text-sm text-[#c9d1d9] flex items-center gap-1 group relative cursor-help">
              {formatSep(distances.star_planet_separation.separation_au)} AU
              {distances.star_planet_separation.assumption_flag && (
                <>
                  <span className="text-space-accent">*</span>
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-2 text-xs bg-space-black border border-space-card rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-sans">
                    Assumes Sun-like stellar radius (1.0 R☉) — not measured for this star.
                  </div>
                </>
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-space-muted mb-1">Distance from Earth</span>
            <span className="font-mono text-sm text-[#c9d1d9] group relative">
              {distances.data_available ? (
                `${distances.earth_distances.earth_to_star_ly.toFixed(0)} ly (${distances.earth_distances.earth_to_star_pc.toFixed(0)} pc)`
              ) : (
                <span className="text-space-muted cursor-help">
                  unavailable for this target
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-2 text-xs bg-space-black border border-space-card rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-sans text-space-foreground">
                    Gaia parallax data not found in catalog for this star.
                  </div>
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
