"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import GalacticFrameView from "./GalacticFrameView";

interface Orbit3DProps {
  currentPhase: number;
  aRs: number;
  planetRadiusRs: number;
  orbitPath: { x: number; y: number; z: number; phase: number }[];
  distances?: any;
  earthRelativeCoordinates?: any;
}

// ── Local/Earth Scene (unchanged from previous) ───────────────────────────────

function Scene({
  currentPhase, aRs, planetRadiusRs, orbitPath, distances, cameraMode,
}: Orbit3DProps & { cameraMode: "local" | "earth" }) {
  const planetRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const points = useMemo(() =>
    orbitPath.map(p => new THREE.Vector3(p.x, p.y, p.z)), [orbitPath]);

  const targetPos = useMemo(() => {
    if (cameraMode === "earth") return new THREE.Vector3(aRs * 8, aRs * 6, aRs * 15);
    return new THREE.Vector3(0, aRs * 1.5, aRs * 2.5);
  }, [cameraMode, aRs]);

  useFrame(({ clock }) => {
    if (!planetRef.current) return;
    const animPhase = (clock.getElapsedTime() % 8) / 8;
    const idx = animPhase * (orbitPath.length - 1);
    const i = Math.floor(idx);
    const j = Math.min(i + 1, orbitPath.length - 1);
    const t = idx - i;
    const p1 = orbitPath[i], p2 = orbitPath[j];
    planetRef.current.position.set(
      p1.x * (1 - t) + p2.x * t,
      p1.y * (1 - t) + p2.y * t,
      p1.z * (1 - t) + p2.z * t,
    );
    camera.position.lerp(targetPos, 0.05);
  });

  const nowPos = useMemo(() => {
    const idx = currentPhase * (orbitPath.length - 1);
    const i = Math.floor(idx);
    const j = Math.min(i + 1, orbitPath.length - 1);
    const t = idx - i;
    const p1 = orbitPath[i], p2 = orbitPath[j];
    return new THREE.Vector3(
      p1.x * (1 - t) + p2.x * t,
      p1.y * (1 - t) + p2.y * t,
      p1.z * (1 - t) + p2.z * t,
    );
  }, [currentPhase, orbitPath]);

  // Planet scale exaggeration (removed excessive 10x multiplier)
  const pRadius = Math.max(planetRadiusRs, 0.08); // ensure it's at least visible

  // Earth distance and visual placement (compressed for viz)
  const earthPos = new THREE.Vector3(0, 0, aRs * 12);
  const showEarth = distances?.data_available;
  const earthRadius = 0.2; // Fixed visual size for Earth

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2.0} color="#fff4d6" />

      {/* Star */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial emissive="#fff4d6" emissiveIntensity={1.5} color="#fff4d6" />
      </mesh>

      <Line points={points} color="#58a6ff" lineWidth={1} opacity={0.3} transparent dashed />

      {/* Animated Planet */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[pRadius, 16, 16]} />
        <meshStandardMaterial color="#3fb950" />
      </mesh>

      {/* NOW ring */}
      <mesh position={nowPos}>
        <ringGeometry args={[pRadius + 0.05, pRadius + 0.1, 32]} />
        <meshBasicMaterial color="#58a6ff" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      {/* Earth Context */}
      {showEarth && cameraMode === "earth" && (
        <>
          <mesh position={earthPos}>
            <sphereGeometry args={[earthRadius, 16, 16]} />
            <meshStandardMaterial color="#58a6ff" />
          </mesh>
          <Text position={[earthPos.x, earthPos.y + earthRadius + 0.8, earthPos.z]}
            fontSize={aRs * 0.2} color="#58a6ff" anchorX="center" anchorY="bottom">
            🌍 Earth
          </Text>
          <Line points={[new THREE.Vector3(0, 0, 0), earthPos]}
            color="#58a6ff" lineWidth={1} opacity={0.5} transparent dashed dashSize={1} gapSize={1} />
          <Text position={[earthPos.x, earthPos.y + 0.5, earthPos.z / 2]}
            fontSize={aRs * 0.15} color="#58a6ff" anchorX="left" anchorY="middle">
            {` ${distances.earth_distances.earth_to_star_ly.toFixed(0)} ly `}
          </Text>
        </>
      )}

      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      <OrbitControls makeDefault enablePan={false} maxDistance={aRs * 20} minDistance={aRs * 0.5} />
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

type CameraMode = "local" | "earth" | "galactic";

export default function Orbit3D(props: Orbit3DProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>("local");
  const { distances, earthRelativeCoordinates } = props;

  // Show galactic option only if we have distance data (RA/Dec) at all
  const hasDistanceData = distances?.data_available;
  const hasGalacticData = earthRelativeCoordinates?.data_available;

  const tabs: { id: CameraMode; label: string }[] = [
    { id: "local", label: "Local Orbit" },
    ...(hasDistanceData ? [{ id: "earth" as CameraMode, label: "Earth Context" }] : []),
    { id: "galactic", label: "Galactic Frame" },
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Mode Toggle — always visible, Galactic Frame is always a tab */}
      <div className="flex items-center gap-1 mb-3 bg-space-black/60 rounded-lg border border-space-accent/20 p-1 self-start backdrop-blur">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setCameraMode(tab.id)}
            className={`px-3 py-1.5 text-xs rounded-md transition-all duration-150 ${
              cameraMode === tab.id
                ? "bg-space-accent text-space-black font-semibold"
                : "text-space-muted hover:text-space-foreground hover:bg-space-card"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Galactic Frame — delegates to its own component */}
      {cameraMode === "galactic" ? (
        <GalacticFrameView erc={earthRelativeCoordinates} />
      ) : (
        <div className="relative w-full aspect-video bg-[#0d1117] rounded-lg overflow-hidden border border-space-card/50">
          <Canvas camera={{ position: [0, props.aRs * 1.5, props.aRs * 2.5], fov: 45 }}>
            <Scene {...props} cameraMode={cameraMode as "local" | "earth"} />
          </Canvas>

          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="flex items-center gap-2 text-xs text-space-muted bg-space-black/80 px-3 py-2 rounded border border-space-accent/10 backdrop-blur">
              <span>Drag to rotate, scroll to zoom</span>
            </div>
          </div>

          {cameraMode === "earth" && (
            <div className="absolute bottom-4 right-4 text-xs font-mono text-[#58a6ff] bg-space-black/80 px-3 py-2 rounded border border-[#58a6ff]/30 backdrop-blur pointer-events-none">
              ⚠️ Not to scale — distance compressed for visualization
            </div>
          )}
        </div>
      )}
    </div>
  );
}

