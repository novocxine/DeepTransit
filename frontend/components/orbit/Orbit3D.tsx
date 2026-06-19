"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Text } from "@react-three/drei";
import * as THREE from "three";

interface Orbit3DProps {
  currentPhase: number;
  aRs: number;
  planetRadiusRs: number;
  orbitPath: { x: number; y: number; z: number; phase: number }[];
  distances?: any;
}

function Scene({ currentPhase, aRs, planetRadiusRs, orbitPath, distances, cameraMode }: Orbit3DProps & { cameraMode: "local" | "earth" }) {
  const planetRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Create the line geometry points from the backend orbit path
  const points = useMemo(() => {
    return orbitPath.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [orbitPath]);

  // Target camera positions
  const targetPos = useMemo(() => {
    if (cameraMode === "earth") {
      return new THREE.Vector3(aRs * 8, aRs * 6, aRs * 15);
    } else {
      return new THREE.Vector3(0, aRs * 1.5, aRs * 2.5);
    }
  }, [cameraMode, aRs]);

  // Animation logic: planet revolves around the path
  useFrame(({ clock }) => {
    if (!planetRef.current) return;
    
    // 8 seconds per orbit loop
    const time = clock.getElapsedTime();
    const animPhase = (time % 8) / 8;
    
    const idx = animPhase * (orbitPath.length - 1);
    const i = Math.floor(idx);
    const j = Math.min(i + 1, orbitPath.length - 1);
    const t = idx - i;
    
    const p1 = orbitPath[i];
    const p2 = orbitPath[j];
    
    planetRef.current.position.x = p1.x * (1 - t) + p2.x * t;
    planetRef.current.position.y = p1.y * (1 - t) + p2.y * t;
    planetRef.current.position.z = p1.z * (1 - t) + p2.z * t;

    // Smoothly interpolate camera position
    camera.position.lerp(targetPos, 0.05);
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

  // Earth distance and visual placement (compressed for viz)
  const earthPos = new THREE.Vector3(0, 0, aRs * 12);
  const showEarth = distances?.data_available;

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

      {/* Earth Context Elements */}
      {showEarth && cameraMode === "earth" && (
        <>
          {/* Earth */}
          <mesh position={earthPos}>
            <sphereGeometry args={[pRadius, 16, 16]} />
            <meshStandardMaterial color="#58a6ff" />
          </mesh>
          <Text
            position={[earthPos.x, earthPos.y + pRadius + 1, earthPos.z]}
            fontSize={aRs * 0.2}
            color="#58a6ff"
            anchorX="center"
            anchorY="bottom"
          >
            🌍 Earth
          </Text>
          
          {/* Dashed line to Earth */}
          <Line 
            points={[new THREE.Vector3(0, 0, 0), earthPos]} 
            color="#58a6ff" 
            lineWidth={1} 
            opacity={0.5} 
            transparent 
            dashed 
            dashSize={1}
            gapSize={1}
          />
          <Text
            position={[earthPos.x, earthPos.y + 0.5, earthPos.z / 2]}
            fontSize={aRs * 0.15}
            color="#58a6ff"
            anchorX="left"
            anchorY="middle"
          >
            {` ${distances.earth_distances.earth_to_star_ly.toFixed(0)} ly `}
          </Text>
        </>
      )}

      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      
      <OrbitControls makeDefault enablePan={false} maxDistance={aRs * 20} minDistance={aRs * 0.5} />
    </>
  );
}

export default function Orbit3D(props: Orbit3DProps) {
  const [cameraMode, setCameraMode] = useState<"local" | "earth">("local");

  return (
    <div className="relative w-full aspect-video bg-[#0d1117] rounded-lg overflow-hidden border border-space-card/50">
      <Canvas camera={{ position: [0, props.aRs * 1.5, props.aRs * 2.5], fov: 45 }}>
        <Scene {...props} cameraMode={cameraMode} />
      </Canvas>
      
      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 text-xs text-space-muted bg-space-black/80 px-3 py-2 rounded border border-space-accent/10 backdrop-blur pointer-events-auto">
          <span>Drag to rotate, scroll to zoom</span>
        </div>
        
        {props.distances?.data_available && (
          <div className="flex bg-space-black/80 rounded border border-space-accent/20 backdrop-blur p-1 pointer-events-auto">
            <button
              onClick={() => setCameraMode("local")}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                cameraMode === "local" 
                  ? "bg-space-accent text-space-black font-medium" 
                  : "text-space-muted hover:text-space-accent hover:bg-space-card"
              }`}
            >
              Local Orbit
            </button>
            <button
              onClick={() => setCameraMode("earth")}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                cameraMode === "earth" 
                  ? "bg-space-accent text-space-black font-medium" 
                  : "text-space-muted hover:text-space-accent hover:bg-space-card"
              }`}
            >
              Earth Context
            </button>
          </div>
        )}
      </div>

      {cameraMode === "earth" && (
        <div className="absolute bottom-4 right-4 text-xs font-mono text-[#58a6ff] bg-space-black/80 px-3 py-2 rounded border border-[#58a6ff]/30 backdrop-blur pointer-events-none">
          ⚠️ Not to scale — distance compressed for visualization
        </div>
      )}
    </div>
  );
}
