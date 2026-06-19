"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

interface DistanceInfoPanelProps {
  distances: any;
}

export default function DistanceInfoPanel({ distances }: DistanceInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!distances) return null;

  const starPlanetSep = distances.star_planet_separation;
  const earthDist = distances.earth_distances;

  const formatLarge = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + " million";
    return val.toLocaleString();
  };

  return (
    <div className="mt-4 border border-space-card rounded-lg overflow-hidden bg-[#0d1117]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm text-space-muted hover:bg-space-card/40 hover:text-space-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info size={16} className="text-space-accent" />
          <span className="font-medium">About these distances</span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="p-4 pt-0 text-sm text-space-muted space-y-4 leading-relaxed border-t border-space-card/50">
          <div>
            <div className="text-[#c9d1d9] font-medium mb-1">
              Star ↔ Planet: {starPlanetSep.separation_au.toFixed(3)} AU ({formatLarge(starPlanetSep.separation_km)} km)
            </div>
            <p className="text-xs">
              Derived from the transit fit (a/R★) combined with the star's measured radius 
              {starPlanetSep.assumption_flag ? " (assumed 1.0 R☉ as catalog data was missing)" : ` (${distances.stellar_radius_rsun.toFixed(2)} R☉) from the TESS Input Catalog`}.
            </p>
          </div>

          <div>
            <div className="text-[#c9d1d9] font-medium mb-1">
              Earth ↔ Star: {distances.data_available ? `${earthDist.earth_to_star_ly.toFixed(0)} ± ${earthDist.earth_to_star_err_ly ? earthDist.earth_to_star_err_ly.toFixed(0) : 0} light-years (${earthDist.earth_to_star_pc.toFixed(0)} pc)` : "Unavailable"}
            </div>
            <p className="text-xs">
              {distances.data_available 
                ? "Sourced from Gaia DR3 parallax via the TESS Input Catalog — this is an independent measurement, not derived from the transit data."
                : "No parallax data available in the catalog for this target."}
            </p>
          </div>

          <div>
            <div className="text-[#c9d1d9] font-medium mb-1">
              Earth ↔ Planet: effectively the same as Earth ↔ Star
            </div>
            <p className="text-xs">
              The planet's orbit (a fraction of an AU) is negligible compared to the star's distance from Earth (hundreds of light-years) — like the difference between a doorknob and a doorframe, viewed from another city.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
