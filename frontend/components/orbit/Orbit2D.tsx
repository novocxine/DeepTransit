"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

interface Orbit2DProps {
  currentPhase: number;
  aRs: number;
  planetRadiusRs: number;
  periodDays: number;
  isTransiting: boolean;
  isOcculted: boolean;
}

export default function Orbit2D({
  currentPhase,
  aRs,
  planetRadiusRs,
  periodDays,
  isTransiting,
  isOcculted,
}: Orbit2DProps) {
  // SVG coordinate space: center is (0,0), radius is relative to aRs.
  // We'll scale everything so the orbit radius (aRs) fits in a viewBox of [-150, -150, 300, 300].
  const viewBoxSize = 300;
  const orbitRadiusSvg = 100; // Orbit drawn at r=100 in SVG space
  const scale = orbitRadiusSvg / Math.max(aRs, 1);

  const starRadiusSvg = 1.0 * scale;
  
  // Exaggerate planet size for visibility (~10x as requested)
  const planetVisScale = 10;
  const planetRadiusSvg = Math.max(planetRadiusRs * scale * planetVisScale, 3); // min 3px radius

  // Animation state for the continuous orbit loop
  const [animPhase, setAnimPhase] = useState(0);

  useEffect(() => {
    let startTime = performance.now();
    let animationFrameId: number;
    const ANIM_DURATION = 8000; // 8 seconds per loop

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = (elapsed % ANIM_DURATION) / ANIM_DURATION;
      setAnimPhase(progress);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Calculate coordinates for the animated planet
  const getCoords = (phase: number) => {
    const theta = 2 * Math.PI * phase;
    // We draw from a top-down view where transit is at bottom (y > 0)
    // Convention: transit (phase 0) is between us and star.
    const x = orbitRadiusSvg * Math.sin(theta);
    const y = orbitRadiusSvg * Math.cos(theta); // z axis in physical terms, down is towards us
    return { x, y };
  };

  const animCoords = getCoords(animPhase);
  const nowCoords = getCoords(currentPhase);

  // Z-index logic for occlusion (when planet is behind the star in 2D top-down, y < 0)
  const animIsBehind = animCoords.y < 0;

  return (
    <div className="relative w-full aspect-video bg-[#0d1117] rounded-lg overflow-hidden border border-space-card/50 flex flex-col items-center justify-center">
      
      {/* Disclaimer tooltip */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 text-xs text-space-muted bg-space-black/80 px-3 py-2 rounded border border-space-accent/10 backdrop-blur">
        <Info size={14} />
        <span>Planet size exaggerated 10×. Orbit assumed circular.</span>
      </div>

      <svg viewBox={`-${viewBoxSize/2} -${viewBoxSize/2} ${viewBoxSize} ${viewBoxSize}`} className="w-full h-full max-h-[500px]">
        {/* Orbit Path */}
        <circle
          cx="0" cy="0" r={orbitRadiusSvg}
          fill="none"
          stroke="#21262d"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Animated Planet (Behind Star) */}
        {animIsBehind && (
          <circle
            cx={animCoords.x} cy={animCoords.y} r={planetRadiusSvg}
            fill="#3fb950"
            opacity={0.4}
          />
        )}

        {/* The Star */}
        <g>
          {/* Star Glow */}
          <circle cx="0" cy="0" r={starRadiusSvg * 2} fill="#fff4d6" opacity={0.1} filter="blur(4px)" />
          {/* Star Body */}
          <circle cx="0" cy="0" r={starRadiusSvg} fill="#fff4d6" />
          {/* Transit Flash */}
          {isTransiting && (
            <circle cx="0" cy="0" r={starRadiusSvg * 1.5} fill="#58a6ff" opacity={0.3}>
              <animate attributeName="opacity" values="0.1;0.4;0.1" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </g>

        {/* Animated Planet (Front of Star) */}
        {!animIsBehind && (
          <circle
            cx={animCoords.x} cy={animCoords.y} r={planetRadiusSvg}
            fill="#3fb950"
            opacity={0.9}
          />
        )}

        {/* "NOW" Marker */}
        <g transform={`translate(${nowCoords.x}, ${nowCoords.y})`}>
          <circle cx="0" cy="0" r={planetRadiusSvg + 4} fill="none" stroke="#58a6ff" strokeWidth="1.5">
            <animate attributeName="r" values={`${planetRadiusSvg + 2};${planetRadiusSvg + 8};${planetRadiusSvg + 2}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x="12" y="4" fill="#58a6ff" fontSize="10" fontFamily="monospace" className="select-none">NOW</text>
        </g>
      </svg>

      {/* Animation Speed Label */}
      <div className="absolute bottom-4 right-4 text-xs text-space-muted mono bg-space-black/50 px-2 py-1 rounded">
        Anim: 1 loop = 8s
      </div>

      {isTransiting && (
        <div className="absolute top-4 right-4 text-xs font-bold text-space-accent bg-space-accent/10 px-3 py-1.5 rounded animate-pulse border border-space-accent/30">
          TRANSITING NOW
        </div>
      )}
      {isOcculted && (
        <div className="absolute top-4 right-4 text-xs text-space-muted bg-space-card/80 px-3 py-1.5 rounded border border-space-muted/30">
          Secondary Eclipse (Behind Star)
        </div>
      )}
    </div>
  );
}
