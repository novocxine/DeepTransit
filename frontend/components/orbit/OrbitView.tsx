"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Orbit, AlertCircle } from "lucide-react";
import Orbit2D from "./Orbit2D";
import OrbitStatsStrip from "./OrbitStatsStrip";
import DistanceInfoPanel from "./DistanceInfoPanel";
import HabitabilitySection from "./HabitabilitySection";
import ComparativeContext from "./ComparativeContext";

// Lazy-load Three.js components — keeps them out of the initial bundle
const Orbit3D = dynamic(() => import("./Orbit3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full aspect-video bg-[#0d1117] rounded-lg border border-space-card/50 text-space-muted mono text-sm animate-pulse">
      Loading 3D renderer…
    </div>
  ),
});

interface OrbitViewProps {
  ticId: string;
  classificationDesc?: string;
}

// ── Orbit loading skeleton ─────────────────────────────────────────────────────
function OrbitLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[280px] gap-5">
      <div className="relative w-28 h-28">
        {[1, 0.68, 0.42].map((scale, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-space-accent/20"
            style={{
              transform: `scale(${scale})`,
              top: `${(1 - scale) * 50}%`,
              left: `${(1 - scale) * 50}%`,
              width: `${scale * 100}%`,
              height: `${scale * 100}%`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3 + i * 2, repeat: Infinity, ease: "linear" }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-3 h-3 rounded-full bg-space-accent"
            style={{ boxShadow: "0 0 16px #58a6ff" }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
      <p className="text-sm mono text-space-muted">Calculating orbital geometry…</p>
    </div>
  );
}

// ── Orbit error state ──────────────────────────────────────────────────────────
function OrbitError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 text-center">
      <AlertCircle size={28} className="text-[#f85149]/60" />
      <p className="text-sm font-semibold text-[#f85149]">Orbit data unavailable</p>
      <p className="text-xs text-space-muted max-w-xs">{message}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OrbitView({ ticId, classificationDesc }: OrbitViewProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_BASE}/api/orbit/${ticId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || "Failed to load orbit data");
        }
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticId]);

  if (loading) return <OrbitLoader />;
  if (error || !data) return <OrbitError message={error || "No data returned"} />;

  const { current_position, orbit_path, a_rs, planet_radius_rs, period_days, next_transit_in_hours, distances } = data;

  return (
    <div className="flex flex-col">
      {/* View mode header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm mono text-space-muted uppercase tracking-widest flex items-center gap-2">
          <Orbit size={13} /> Orbital Position
        </h3>
        <div className="flex items-center bg-space-card/50 rounded-lg p-1 border border-space-card">
          {(["2D", "3D"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${
                viewMode === mode
                  ? "bg-space-accent text-space-bg font-bold"
                  : "text-space-muted hover:text-space-text"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile notice for 3D views */}
      {viewMode === "3D" && (
        <div className="three-canvas-mobile-notice">
          💡 3D view best experienced on a larger screen
        </div>
      )}

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
            earthRelativeCoordinates={data.earth_relative_coordinates}
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
            The <strong>"NOW"</strong> marker shows the planet's calculated current position in real-time, derived by propagating the time
            of the last known transit forward using the fitted orbital period. In the 2D view, the planet and star are shown from a
            top-down perspective, with the planet's size exaggerated for visibility. The 3D view is fully interactive and models the
            inclination of the orbital plane relative to our line of sight. The Galactic Frame view places all three bodies
            (Earth, star, planet) in a single Earth-centred ICRS Cartesian coordinate system — demonstrating the negligible scale
            of the orbital separation compared to the stellar distance.
          </p>
        </div>
      </div>
    </div>
  );
}

