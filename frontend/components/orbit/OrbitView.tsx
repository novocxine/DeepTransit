"use client";

import { useEffect, useState } from "react";
import Orbit2D from "./Orbit2D";
import Orbit3D from "./Orbit3D";
import OrbitStatsStrip from "./OrbitStatsStrip";

import DistanceInfoPanel from "./DistanceInfoPanel";
import HabitabilitySection from "./HabitabilitySection";
import ComparativeContext from "./ComparativeContext";

interface OrbitViewProps {
  ticId: string;
  classificationDesc?: string;
}

export default function OrbitView({ ticId, classificationDesc }: OrbitViewProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");

  useEffect(() => {
    async function fetchOrbit() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/orbit/${ticId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to load orbit data");
        }
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchOrbit();
  }, [ticId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-space-muted mono animate-pulse">
        Calculating orbital geometry...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-space-muted mono">
        <span className="text-red-400 mb-2">Unavailable</span>
        <span>{error}</span>
      </div>
    );
  }

  const {
    current_position,
    orbit_path,
    a_rs,
    planet_radius_rs,
    period_days,
    next_transit_in_hours,
    distances,
  } = data;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest">
          Orbital Position
        </h3>
        <div className="flex items-center bg-space-card/50 rounded-lg p-1 border border-space-card">
          <button
            onClick={() => setViewMode("2D")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === "2D" ? "bg-space-accent text-space-bg font-bold" : "text-space-muted hover:text-space-text"
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode("3D")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === "3D" ? "bg-space-accent text-space-bg font-bold" : "text-space-muted hover:text-space-text"
            }`}
          >
            3D
          </button>
        </div>
      </div>

      <div className="relative">
        {viewMode === "2D" ? (
          <Orbit2D
            currentPhase={current_position.phase}
            aRs={a_rs}
            planetRadiusRs={planet_radius_rs}
            periodDays={period_days}
            isTransiting={current_position.is_transiting}
            isOcculted={current_position.is_occulted}
            distances={distances}
          />
        ) : (
          <Orbit3D
            currentPhase={current_position.phase}
            aRs={a_rs}
            planetRadiusRs={planet_radius_rs}
            orbitPath={orbit_path}
            distances={distances}
          />
        )}
      </div>

      <OrbitStatsStrip
        periodDays={period_days}
        aRs={a_rs}
        phase={current_position.phase}
        nextTransitInHours={next_transit_in_hours}
        distances={distances}
      />

      <DistanceInfoPanel distances={distances} />

      <HabitabilitySection habitability={data.habitability} />

      <ComparativeContext comparison={data.comparison} starRadiusRs={data.star_radius_rs} />

      <div className="mt-6 p-5 rounded-lg bg-space-card/20 border border-space-card text-sm text-space-muted leading-relaxed space-y-5">
        {classificationDesc && (
          <div>
            <h4 className="text-space-accent font-bold mb-2 tracking-widest uppercase text-xs">Analysis Report</h4>
            <p className="text-[#c9d1d9]">{classificationDesc}</p>
          </div>
        )}
        <div>
          <h4 className="text-space-accent font-bold mb-2 tracking-widest uppercase text-xs">About this Visualization</h4>
          <p className="text-[#8b949e]">
            The animation models the planet's trajectory assuming a circular orbit (e=0), which is standard for initial transit fits. 
            The <strong>"NOW"</strong> marker shows the planet's calculated current position in real-time, derived by propagating the time of the last known transit forward using the fitted orbital period. 
            In the 2D view, the planet and star are shown from a top-down perspective, with the planet's size exaggerated for visibility. The 3D view is fully interactive and models the inclination of the orbital plane relative to our line of sight.
          </p>
        </div>
      </div>
    </div>
  );
}
