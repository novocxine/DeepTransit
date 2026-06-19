"use client";

interface ComparativeContextProps {
  comparison: any;
  starRadiusRs: number;
}

export default function ComparativeContext({ comparison, starRadiusRs }: ComparativeContextProps) {
  if (!comparison) return null;

  const {
    planet_radius_rearth,
    orbital_distance_au,
    classification,
    nearest_known_exoplanets
  } = comparison;

  // Log scale for solar system distances (Mercury: 0.387 to Jupiter: 5.203)
  const MIN_LOG = Math.log10(0.1);
  const MAX_LOG = Math.log10(10.0);
  const getLogPercent = (au: number) => {
    const p = ((Math.log10(Math.max(au, 0.1)) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * 100;
    return Math.max(0, Math.min(100, p));
  };

  const SOLAR_SYSTEM = [
    { name: "Mercury", au: 0.387 },
    { name: "Venus", au: 0.723 },
    { name: "Earth", au: 1.0 },
    { name: "Mars", au: 1.524 },
    { name: "Jupiter", au: 5.203 }
  ];

  const hasExtrapolated = nearest_known_exoplanets.some((p: any) => p.extrapolated);

  return (
    <div className="mt-8">
      <h3 className="text-sm mono text-space-muted uppercase tracking-widest mb-4">
        How does this compare?
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Solar System Scale Bar */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col justify-center">
          <h4 className="text-sm font-medium text-[#c9d1d9] mb-6">Orbit vs Solar System</h4>
          
          <div className="relative w-full h-8 mb-6 mt-2">
            <div className="absolute top-1/2 w-full h-1 bg-space-card -translate-y-1/2 rounded-full"></div>
            
            {/* Solar system planets */}
            {SOLAR_SYSTEM.map((p) => (
              <div 
                key={p.name}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-space-muted"
                style={{ left: `${getLogPercent(p.au)}%` }}
              >
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[9px] text-space-muted uppercase tracking-widest">
                  {p.name}
                </div>
              </div>
            ))}

            {/* This Planet */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-space-accent border-2 border-space-bg shadow-[0_0_8px_rgba(88,166,255,0.5)] z-10"
              style={{ left: `${getLogPercent(orbital_distance_au)}%` }}
            >
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-space-accent bg-space-bg/80 px-1 rounded whitespace-nowrap">
                {classification.informal_label}
              </div>
            </div>
          </div>
          
          <p className="text-xs text-space-muted">
            This planet orbits at {orbital_distance_au.toFixed(3)} AU. For context, Mercury orbits at ~0.39 AU.
          </p>
        </div>

        {/* Card 2: Planet Type Badge */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-2">
            {classification.temperature_class === "Hot" || classification.temperature_class === "Ultra-hot" ? "🔥" : 
             classification.temperature_class === "Cold" ? "❄️" : "🌡️"}
          </div>
          <div className="text-xl font-bold text-[#c9d1d9] mb-1">
            {classification.informal_label}
          </div>
          <div className="text-sm font-mono text-space-accent mb-3">
            ≈ {planet_radius_rearth.toFixed(1)}× Earth's radius
          </div>
          <p className="text-[10px] text-space-muted uppercase tracking-wider max-w-[80%]">
            Informal classification based on radius and equilibrium temperature
          </p>
        </div>

        {/* Card 3: Known Exoplanet Neighbors */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col">
          <h4 className="text-sm font-medium text-[#c9d1d9] mb-3">Nearest Known Analogs</h4>
          <p className="text-xs text-space-muted mb-4">
            Most similar confirmed exoplanets in the population (by size and orbital period):
          </p>
          
          <div className="space-y-3 flex-1">
            {nearest_known_exoplanets.map((p: any) => (
              <div key={p.name} className="flex items-center justify-between bg-space-bg p-2 rounded border border-space-card/50">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#58a6ff]">{p.name}</span>
                  <span className="text-[10px] text-space-muted uppercase">Discovered {p.discovery_year}</span>
                </div>
                <div className="flex flex-col items-end text-xs font-mono text-[#c9d1d9]">
                  <span>{p.radius_rearth.toFixed(1)} R⊕</span>
                  <span>{p.period_days.toFixed(1)} days</span>
                </div>
              </div>
            ))}
          </div>

          {hasExtrapolated && (
            <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-400 text-[10px]">
              <strong>Note:</strong> No close analogs in reference sample — this would be an unusual member of the known population.
            </div>
          )}
        </div>

        {/* Card 4: Scale Illustration */}
        <div className="p-4 bg-space-card/40 border border-space-card rounded-lg flex flex-col items-center justify-center">
          <h4 className="text-sm font-medium text-[#c9d1d9] mb-6 w-full text-left">Size Scale</h4>
          
          <div className="flex items-end justify-center gap-8 mb-6 h-32 w-full overflow-hidden">
            {/* Earth */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-blue-400"></div>
              <span className="text-xs text-space-muted">Earth</span>
            </div>

            {/* This Planet */}
            <div className="flex flex-col items-center gap-2">
              <div 
                className="rounded-full bg-[#3fb950] border border-[#2ea043] transition-all duration-1000 ease-out"
                style={{ 
                  width: `${Math.max(4, Math.min(100, 4 * planet_radius_rearth))}px`, 
                  height: `${Math.max(4, Math.min(100, 4 * planet_radius_rearth))}px` 
                }}
              ></div>
              <span className="text-xs text-space-accent font-bold">This Planet</span>
            </div>

            {/* Star Representation */}
            <div className="flex flex-col items-center gap-2 opacity-50 relative">
              <div className="w-32 h-32 rounded-full bg-[#fff4d6] border border-yellow-200 translate-y-16"></div>
              <span className="absolute bottom-0 text-[10px] text-space-muted text-center w-32 whitespace-nowrap -translate-y-4 bg-space-bg/80 px-1 rounded">
                Host Star<br/>(not to scale)
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
