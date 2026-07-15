import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import MissionWorld3D from "./three/MissionWorld3D";
import ParticleEarth3D from "./three/ParticleEarth3D";

function CameraRig({ mode, activeAgent, focusedAgent }) {
  const controls = useRef();
  const transition = useRef(1);
  const worldPosition = useMemo(() => new THREE.Vector3(0, 0.1, 18.8), []);
  const earthPosition = useMemo(() => new THREE.Vector3(0, 0.35, 9.2), []);
  const lookTarget = useMemo(() => new THREE.Vector3(0, 0.65, 0), []);
  const desiredLook = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    transition.current = 1.2;
  }, [mode, activeAgent?.id, focusedAgent?.id]);

  useFrame(({ camera, size }, delta) => {
    const isEarth = mode === "earth";
    const aspect = size.width / size.height;
    const portrait = aspect < 0.9;
    if (!isEarth) {
      const sceneAgent = activeAgent ?? focusedAgent;
      if (sceneAgent) {
        const focusDistance = portrait ? Math.max(9.5, 6.1 / Math.max(aspect, 0.35)) : size.width <= 1050 ? 6.4 : 5.6;
        const focusX = sceneAgent.workPosition[0];
        const focusY = sceneAgent.workPosition[1] + 0.72;
        worldPosition.set(focusX, focusY + 0.08, focusDistance);
        desiredLook.set(focusX, focusY, -0.12);
      } else {
        const compactHud = size.width <= 820;
        const leftInset = compactHud ? 10 : size.width <= 1050 ? 260 : 320;
        const rightInset = compactHud ? 10 : size.width <= 1050 ? 293 : 364;
        const topInset = compactHud ? 82 : 96;
        const bottomInset = compactHud ? 148 : 110;
        const usableWidth = Math.max(260, size.width - leftInset - rightInset);
        const usableHeight = Math.max(260, size.height - topInset - bottomInset);
        const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        const distanceForWidth = (14.8 * size.height) / (2 * halfFovTangent * usableWidth);
        const distanceForHeight = (9.4 * size.height) / (2 * halfFovTangent * usableHeight);
        const fittedDistance = THREE.MathUtils.clamp(Math.max(distanceForWidth, distanceForHeight) * 1.04, 18.8, 52);
        const pixelsPerWorldUnit = size.height / (2 * fittedDistance * halfFovTangent);
        const frameOffsetX = (rightInset - leftInset) / (2 * pixelsPerWorldUnit);
        const frameOffsetY = (topInset - bottomInset) / (2 * pixelsPerWorldUnit);
        worldPosition.set(frameOffsetX, 0.1 + frameOffsetY, fittedDistance);
        desiredLook.set(frameOffsetX, 0.1 + frameOffsetY, -0.25);
      }
      camera.position.lerp(worldPosition, 1 - Math.exp(-delta * 2.25));
      lookTarget.lerp(desiredLook, 1 - Math.exp(-delta * 2.7));
    } else if (transition.current > 0) {
      earthPosition.set(0, 0.35, portrait ? 12 : 9.2);
      camera.position.lerp(earthPosition, 1 - Math.exp(-delta * 3.1));
      desiredLook.set(0, 0.2, 0);
      lookTarget.lerp(desiredLook, 1 - Math.exp(-delta * 4));
    }
    transition.current -= delta;
    if (!isEarth || transition.current > 0) camera.lookAt(lookTarget);
    if (controls.current && isEarth) {
      controls.current.target.lerp(lookTarget, 1 - Math.exp(-delta * 4));
      controls.current.update();
    }
  });

  return <OrbitControls ref={controls} enabled={mode === "earth"} enablePan={false} minDistance={7} maxDistance={12} minPolarAngle={Math.PI * 0.25} maxPolarAngle={Math.PI * 0.75} />;
}

export default function JarvisScene({ mode, agents, activeAgentId, selectedAgentId, focusedAgentId, jarvisState, onSelectAgent, onCoreActivate, onEarthMode, onHeadquartersMode }) {
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  const focusedAgent = agents.find((agent) => agent.id === focusedAgentId);
  return (
    <div className="world-canvas">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.1, 18.8], fov: 38, near: 0.1, far: 80 }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
        <color attach="background" args={["#010306"]} />
        <fog attach="fog" args={["#010306", 14, 36]} />
        <Stars radius={34} depth={18} count={1000} factor={1.6} saturation={0.25} fade speed={0.22} />
        <CameraRig mode={mode} activeAgent={activeAgent} focusedAgent={focusedAgent} />
        {mode === "world" && <MissionWorld3D visible agents={agents} activeAgentId={activeAgentId} selectedAgentId={selectedAgentId} focusedAgentId={focusedAgentId} jarvisState={jarvisState} onSelectAgent={onSelectAgent} onCoreActivate={onCoreActivate} onEarthMode={onEarthMode} />}
        {mode === "earth" && (
          <ParticleEarth3D
            visible
            jarvisState={jarvisState}
            onCoreActivate={onCoreActivate}
            onCoreDoubleActivate={onHeadquartersMode}
          />
        )}
      </Canvas>
    </div>
  );
}
