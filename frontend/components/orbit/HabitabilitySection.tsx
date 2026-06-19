"use client";

import { AlertTriangle, Thermometer } from "lucide-react";

interface HabitabilitySectionProps {
  habitability: any;
}

export default function HabitabilitySection({ habitability }: HabitabilitySectionProps) {
  if (!habitability) return null;

  const {
    stellar_teff_k,
    teff_assumed,
    equilibrium_temp_c,
    habitable_zone,
    hz_position,
    separation_au
  } = habitability;

  // Configuration for temperature gauge
  const MIN_TEMP = -150;
  const MAX_TEMP = 600;
  const clampTemp = (t: number) => Math.max(MIN_TEMP, Math.min(MAX_TEMP, t));
  const getTempPercent = (t: number) => ((clampTemp(t) - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * 100;

  // Configuration for HZ strip
  const MAX_AU = Math.max(2.5, habitable_zone.outer_edge_au * 1.5, separation_au * 1.2);
  const getAuPercent = (au: number) => Math.min((au / MAX_AU) * 100, 100);

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case "too_hot": return "#ef4444"; // red
      case "too_cold": return "#3b82f6"; // blue
      case "habitable_zone": return "#22c55e"; // green
      default: return "#8b949e";
    }
  };

  const getPositionText = (pos: string) => {
    switch (pos) {
      case "too_hot":
        return "This planet orbits closer to its star than the habitable zone — equilibrium temperature suggests a scorched world, likely too hot for liquid water.";
      case "habitable_zone":
        return "This planet's orbit falls within the conservative habitable zone — equilibrium temperature alone doesn't confirm habitability, but the orbital position is in the right range.";
      case "too_cold":
        return "This planet orbits beyond the habitable zone — equilibrium temperature suggests a frozen world.";
      default:
        return "";
    }
  };

  const posColor = getPositionColor(hz_position);

  return (
    <div className="mt-8">
      <h3 className="text-sm mono text-space-muted uppercase tracking-widest mb-4">
        Temperature & Habitable Zone
      </h3>

      {teff_assumed && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>Insufficient stellar data:</strong> The catalog is missing the star's effective temperature. 
            A Sun-like temperature (5778 K) was assumed. <strong>These estimates are highly uncertain.</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Temperature Gauge */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer size={16} className="text-space-muted" />
            <h4 className="text-sm font-medium text-[#c9d1d9]">Equilibrium Temperature</h4>
          </div>
          
          <div className="text-3xl font-mono text-white mb-6">
            {equilibrium_temp_c.toFixed(0)}°C
          </div>

          <div className="relative w-full h-3 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 rounded-full mb-8">
            {/* Markers */}
            <div className="absolute top-4 text-[10px] text-space-muted" style={{ left: `${getTempPercent(-65)}%`, transform: "translateX(-50%)" }}>Mars<br/>(-65°C)</div>
            <div className="absolute top-4 text-[10px] text-space-muted" style={{ left: `${getTempPercent(15)}%`, transform: "translateX(-50%)" }}>Earth<br/>(15°C)</div>
            <div className="absolute top-4 text-[10px] text-space-muted" style={{ left: `${getTempPercent(464)}%`, transform: "translateX(-50%)" }}>Venus<br/>(464°C)</div>
            
            {/* Ticks */}
            <div className="absolute h-4 w-px bg-space-muted top-0" style={{ left: `${getTempPercent(-65)}%` }}></div>
            <div className="absolute h-4 w-px bg-space-muted top-0" style={{ left: `${getTempPercent(15)}%` }}></div>
            <div className="absolute h-4 w-px bg-space-muted top-0" style={{ left: `${getTempPercent(464)}%` }}></div>

            {/* Current Planet Marker */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-space-bg rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10"
              style={{ left: `${getTempPercent(equilibrium_temp_c)}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-space-bg/80 px-1 rounded">
                This Planet
              </div>
            </div>
          </div>
        </div>

        {/* HZ Strip */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col justify-center">
          <h4 className="text-sm font-medium text-[#c9d1d9] mb-4">Orbital Position</h4>
          
          <div className="relative w-full h-8 bg-space-black rounded-lg border border-space-card/50 overflow-hidden mb-6 flex items-center">
            {/* Star Representation on the left */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#fff4d6] to-transparent"></div>
            
            {/* Habitable Zone Band */}
            <div 
              className="absolute top-0 bottom-0 bg-green-500/20 border-x border-green-500/40"
              style={{ 
                left: `${getAuPercent(habitable_zone.inner_edge_au)}%`, 
                width: `${getAuPercent(habitable_zone.outer_edge_au) - getAuPercent(habitable_zone.inner_edge_au)}%` 
              }}
            >
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-green-400 font-medium tracking-widest uppercase opacity-60">
                Habitable Zone
              </span>
            </div>

            {/* Earth Reference */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400 border border-space-bg"
              style={{ left: `${getAuPercent(1.0)}%` }}
            >
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] text-space-muted">Earth</div>
            </div>

            {/* Detected Planet */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white shadow-[0_0_8px_rgba(255,255,255,0.3)] z-10"
              style={{ left: `${getAuPercent(separation_au)}%`, backgroundColor: posColor }}
            >
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-space-bg/80 px-1 rounded whitespace-nowrap">
                {separation_au.toFixed(3)} AU
              </div>
            </div>
          </div>

          <p className="text-xs text-space-muted leading-relaxed">
            {getPositionText(hz_position)}
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-space-card/20 border border-space-card rounded text-xs text-space-muted">
        <strong>Important Context:</strong> Equilibrium temperature only — does not account for atmosphere or greenhouse effects. Not a habitability verdict.
      </div>
    </div>
  );
}
