"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Text, Grid } from "@react-three/drei";
import * as THREE from "three";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatSci(n: number, sig = 2): string {
  if (n === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / Math.pow(10, exp);
  return `${mantissa.toFixed(sig)} × 10^${exp}`;
}

function fmtLy(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

// ── 3D Scene ─────────────────────────────────────────────────────────────────

interface GalacticSceneProps {
  erc: any; // earth_relative_coordinates API block
}

function GalacticScene({ erc }: GalacticSceneProps) {
  const starRef = useRef<THREE.Mesh>(null);

  const starPos = useMemo(
    () => new THREE.Vector3(erc.star.x_ly, erc.star.z_ly, -erc.star.y_ly), // remap to Three.js Y-up
    [erc]
  );

  // Grid interval: pick a round number close to 20% of the star's distance
  const dist_ly = Math.sqrt(
    erc.star.x_ly ** 2 + erc.star.y_ly ** 2 + erc.star.z_ly ** 2
  );
  const gridInterval = useMemo(() => {
    const raw = dist_ly * 0.2;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.round(raw / mag) * mag;
  }, [dist_ly]);

  const gridSize = Math.ceil((dist_ly * 1.5) / gridInterval) * gridInterval;

  // Subtle pulse on star
  useFrame(({ clock }) => {
    if (!starRef.current) return;
    const s = 1 + 0.08 * Math.sin(clock.getElapsedTime() * 2);
    starRef.current.scale.setScalar(s);
  });

  const starSphereRadius = Math.max(dist_ly * 0.015, 2);
  const earthSphereRadius = starSphereRadius * 0.6;

  // Planet sits essentially on top of the star at this scale — that's intentional
  const planetPos = new THREE.Vector3(
    erc.planet.x_ly,
    erc.planet.z_ly,
    -erc.planet.y_ly
  );
  // Tiny visible offset for the planet label (the sphere itself overlaps the star)
  const labelOffset = new THREE.Vector3(starSphereRadius * 2, starSphereRadius * 2, 0);
  const planetLabelPos = starPos.clone().add(labelOffset);

  return (
    <>
      <ambientLight intensity={0.15} />

      {/* Earth at origin */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[earthSphereRadius, 24, 24]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} />
      </mesh>
      <Text
        position={[0, earthSphereRadius * 1.8, 0]}
        fontSize={starSphereRadius * 0.9}
        color="#60a5fa"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#0d1117"
      >
        🌍 Earth (origin)
      </Text>

      {/* Star */}
      <mesh ref={starRef} position={starPos}>
        <sphereGeometry args={[starSphereRadius, 24, 24]} />
        <meshStandardMaterial
          color="#fff4d6"
          emissive="#ffd700"
          emissiveIntensity={1.2}
        />
      </mesh>
      <pointLight position={starPos} intensity={1.5} color="#fff4d6" distance={dist_ly * 4} />
      <Text
        position={[starPos.x, starPos.y + starSphereRadius * 1.8, starPos.z]}
        fontSize={starSphereRadius * 0.9}
        color="#fff4d6"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#0d1117"
      >
        ⭐ Host Star
      </Text>

      {/* Planet marker — intentionally overlaps star to make the scale point */}
      <mesh position={planetPos}>
        <sphereGeometry args={[starSphereRadius * 0.35, 16, 16]} />
        <meshStandardMaterial color="#3fb950" emissive="#22c55e" emissiveIntensity={0.8} />
      </mesh>
      {/* Label line from planet toward offset position */}
      <Line
        points={[planetPos, planetLabelPos]}
        color="#3fb950"
        lineWidth={1}
        opacity={0.6}
        transparent
      />
      <Text
        position={[planetLabelPos.x, planetLabelPos.y, planetLabelPos.z]}
        fontSize={starSphereRadius * 0.75}
        color="#3fb950"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#0d1117"
        maxWidth={dist_ly * 0.6}
      >
        {`🪐 Planet\nOffset: ${formatSci(erc.planet.orbital_offset_magnitude_pc * 3.26156)} ly (${formatSci(erc.planet.orbital_offset_magnitude_pc * 206265)} AU)\n— invisible at this scale`}
      </Text>

      {/* Line from Earth to Star */}
      <Line
        points={[new THREE.Vector3(0, 0, 0), starPos]}
        color="#58a6ff"
        lineWidth={1.5}
        opacity={0.25}
        transparent
        dashed
        dashSize={gridInterval * 0.3}
        gapSize={gridInterval * 0.15}
      />
      {/* Distance label midpoint */}
      <Text
        position={[starPos.x * 0.5, starPos.y * 0.5 + starSphereRadius, starPos.z * 0.5]}
        fontSize={starSphereRadius * 0.75}
        color="#58a6ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#0d1117"
      >
        {`${dist_ly.toFixed(0)} ly`}
      </Text>

      {/* Grid floor */}
      <Grid
        args={[gridSize * 2, gridSize * 2]}
        cellSize={gridInterval}
        cellThickness={0.4}
        cellColor="#21262d"
        sectionSize={gridInterval * 5}
        sectionThickness={0.8}
        sectionColor="#30363d"
        fadeDistance={dist_ly * 3}
        fadeStrength={1}
        position={[0, -dist_ly * 0.3, 0]}
      />

      {/* Axis labels */}
      <Text position={[gridSize, -dist_ly * 0.3, 0]} fontSize={starSphereRadius} color="#484f58" anchorX="left">
        {`X (ly) →`}
      </Text>
      <Text position={[0, -dist_ly * 0.3, gridSize]} fontSize={starSphereRadius} color="#484f58" anchorX="left">
        {`Y (ly) →`}
      </Text>

      <Stars radius={dist_ly * 5} depth={dist_ly * 2} count={3000} factor={6} saturation={0} fade speed={0.5} />

      <OrbitControls
        makeDefault
        enablePan={true}
        maxDistance={dist_ly * 6}
        minDistance={dist_ly * 0.05}
      />
    </>
  );
}

// ── Coordinate Table ──────────────────────────────────────────────────────────

function CoordTable({ erc }: { erc: any }) {
  const [noteOpen, setNoteOpen] = useState(false);

  const rows = [
    {
      label: "Earth",
      x: 0,
      y: 0,
      z: 0,
      note: null,
    },
    {
      label: "Host Star",
      x: erc.star.x_ly,
      y: erc.star.y_ly,
      z: erc.star.z_ly,
      note: null,
    },
    {
      label: "Planet",
      x: erc.planet.x_ly,
      y: erc.planet.y_ly,
      z: erc.planet.z_ly,
      note: `offset: ${formatSci(erc.planet.orbital_offset_magnitude_pc * 3.26156)} ly (${formatSci(erc.planet.orbital_offset_magnitude_pc * 206265)} AU)`,
    },
  ];

  return (
    <div className="mt-4 rounded-lg border border-space-card overflow-hidden bg-[#0d1117]">
      <div className="px-4 py-2 border-b border-space-card bg-space-card/30 flex items-center justify-between">
        <span className="text-xs font-mono text-space-muted uppercase tracking-widest">
          Earth-Centred Coordinates (ICRS, light-years)
        </span>
        <span className="text-[10px] text-space-muted/60">
          Frame: {erc.frame}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-space-card/50">
              <th className="text-left px-4 py-2 text-space-muted text-xs uppercase tracking-wider">Body</th>
              <th className="text-right px-4 py-2 text-space-muted text-xs uppercase tracking-wider">X (ly)</th>
              <th className="text-right px-4 py-2 text-space-muted text-xs uppercase tracking-wider">Y (ly)</th>
              <th className="text-right px-4 py-2 text-space-muted text-xs uppercase tracking-wider">Z (ly)</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-space-card/30 ${i === 0 ? "text-[#60a5fa]" : i === 1 ? "text-[#fff4d6]" : "text-[#3fb950]"}`}
              >
                <td className="px-4 py-2.5 font-semibold">{row.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtLy(row.x)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtLy(row.y)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtLy(row.z)}</td>
                <td className="px-4 py-2.5 text-[10px] text-space-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expandable note */}
      <button
        onClick={() => setNoteOpen(!noteOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-space-muted hover:text-space-foreground hover:bg-space-card/20 transition-colors border-t border-space-card/30"
      >
        <Info size={12} />
        <span>About these coordinates & the planet's offset</span>
        {noteOpen ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>

      {noteOpen && (
        <div className="px-4 pb-4 pt-2 text-xs text-space-muted leading-relaxed space-y-2 border-t border-space-card/20">
          <p>{erc.planet.note}</p>
          <p>
            <strong className="text-[#c9d1d9]">Orbital offset fraction:</strong>{" "}
            {formatSci(erc.planet.orbital_offset_fraction_of_total_distance)} — the ratio of the planet's orbital displacement to the total Earth–star distance.
            At this level of precision, the planet and star are indistinguishable in this view, which is exactly the point.
          </p>
          {erc.caveats?.map((c: string, i: number) => (
            <p key={i}><strong className="text-[#c9d1d9]">Note {i + 1}:</strong> {c}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

interface GalacticFrameViewProps {
  erc: any; // earth_relative_coordinates from API
}

export default function GalacticFrameView({ erc }: GalacticFrameViewProps) {
  if (!erc) return null;

  if (!erc.data_available) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg bg-[#0d1117] border border-space-card text-space-muted text-sm text-center p-6 flex-col gap-2">
        <Info size={20} className="text-space-muted/50" />
        <p>Sky coordinates unavailable for this target — cannot compute Earth-relative position.</p>
        <p className="text-xs text-space-muted/60">RA/Dec or parallax distance not found in the TESS Input Catalog for this TIC ID.</p>
      </div>
    );
  }

  const dist_ly = Math.sqrt(
    erc.star.x_ly ** 2 + erc.star.y_ly ** 2 + erc.star.z_ly ** 2
  ).toFixed(0);

  return (
    <div className="flex flex-col gap-0">
      {/* 3D Canvas */}
      <div className="relative w-full aspect-video bg-[#0d1117] rounded-lg overflow-hidden border border-space-card/50">
        <Canvas
          camera={{
            position: [
              erc.star.x_ly * 0.4,
              Math.abs(erc.star.y_ly) * 0.8 + Number(dist_ly) * 0.3,
              erc.star.z_ly * 0.4 + Number(dist_ly) * 0.8,
            ],
            fov: 50,
            near: 0.01,
            far: Number(dist_ly) * 20,
          }}
        >
          <GalacticScene erc={erc} />
        </Canvas>

        {/* Overlay badges */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-space-muted bg-space-black/80 px-3 py-2 rounded border border-space-accent/10 backdrop-blur">
            <span>Galactic Frame — drag to rotate, scroll to zoom</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-space-black/80 px-3 py-2 rounded border border-[#3fb950]/20 backdrop-blur">
            <span className="text-[#3fb950] font-mono">⬤</span>
            <span className="text-space-muted">
              Planet overlaps star at this scale —{" "}
              <span className="text-[#3fb950]">intentional</span>
            </span>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
          <div className="text-xs font-mono text-space-muted bg-space-black/80 px-3 py-1.5 rounded border border-space-card/30 backdrop-blur">
            RA {erc.star.ra_deg?.toFixed(2)}° / Dec {erc.star.dec_deg?.toFixed(2)}° / {Number(dist_ly)} ly
          </div>
        </div>
      </div>

      {/* Coordinate Readout Table */}
      <CoordTable erc={erc} />
    </div>
  );
}
