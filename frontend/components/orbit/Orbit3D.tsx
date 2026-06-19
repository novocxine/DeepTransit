"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import * as THREE from "three";

interface Orbit3DProps {
  currentPhase: number;
  aRs: number;
  planetRadiusRs: number;
  orbitPath: { x: number; y: number; z: number; phase: number }[];
}

function Scene({ currentPhase, aRs, planetRadiusRs, orbitPath }: Orbit3DProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  
  // Create the line geometry points from the backend orbit path
  const points = useMemo(() => {
    return orbitPath.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [orbitPath]);

  // Animation logic: planet revolves around the path
  useFrame(({ clock }) => {
    if (!planetRef.current) return;
    
    // 8 seconds per orbit loop
    const time = clock.getElapsedTime();
    const animPhase = (time % 8) / 8;
    
    // Find position by interpolating along the path points based on phase
    const theta = 2 * Math.PI * animPhase;
    // Replicate backend math (circular orbit)
    // Actually, we can just use the same math if we know inclination,
    // or we can linearly interpolate from the `orbitPath` array.
    // For simplicity, let's recalculate based on the first few points to extract inclination,
    // or just assume a standard circular interpolation.
    // Wait, the backend already provided x,y,z in `orbitPath` !
    // Let's interpolate exactly on `orbitPath`.
    
    const idx = animPhase * (orbitPath.length - 1);
    const i = Math.floor(idx);
    const j = Math.min(i + 1, orbitPath.length - 1);
    const t = idx - i;
    
    const p1 = orbitPath[i];
    const p2 = orbitPath[j];
    
    planetRef.current.position.x = p1.x * (1 - t) + p2.x * t;
    planetRef.current.position.y = p1.y * (1 - t) + p2.y * t;
    planetRef.current.position.z = p1.z * (1 - t) + p2.z * t;
  });

  // Calculate the "Now" marker position
  const nowPos = useMemo(() => {
    const idx = currentPhase * (orbitPath.length - 1);
    const i = Math.floor(idx);
    const j = Math.min(i + 1, orbitPath.length - 1);
    const t = idx - i;
    const p1 = orbitPath[i];
    const p2 = orbitPath[j];
    return new THREE.Vector3(
      p1.x * (1 - t) + p2.x * t,
      p1.y * (1 - t) + p2.y * t,
      p1.z * (1 - t) + p2.z * t
    );
  }, [currentPhase, orbitPath]);

  // Planet scale exaggeration
  const planetVisScale = 10;
  const pRadius = Math.max(planetRadiusRs * planetVisScale, 0.5); // min size

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2.0} color="#fff4d6" />
      
      {/* Star */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial emissive="#fff4d6" emissiveIntensity={1.5} color="#fff4d6" />
      </mesh>

      {/* Orbit Path */}
      <Line points={points} color="#58a6ff" lineWidth={1} opacity={0.3} transparent dashed />

      {/* Animated Planet */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[pRadius, 16, 16]} />
        <meshStandardMaterial color="#3fb950" />
      </mesh>

      {/* "Now" Marker */}
      <mesh position={nowPos}>
        <ringGeometry args={[pRadius + 0.5, pRadius + 0.8, 32]} />
        <meshBasicMaterial color="#58a6ff" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      
      <OrbitControls makeDefault enablePan={false} maxDistance={aRs * 5} minDistance={aRs * 0.5} />
    </>
  );
}

export default function Orbit3D(props: Orbit3DProps) {
  // We place the camera back relative to the semi-major axis
  return (
    <div className="w-full aspect-video bg-[#0d1117] rounded-lg overflow-hidden border border-space-card/50 cursor-move">
      <Canvas camera={{ position: [0, props.aRs * 1.5, props.aRs * 2.5], fov: 45 }}>
        <Scene {...props} />
      </Canvas>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 text-xs text-space-muted bg-space-black/80 px-3 py-2 rounded border border-space-accent/10 backdrop-blur pointer-events-none">
        <span>Drag to rotate, scroll to zoom</span>
      </div>
    </div>
  );
}
