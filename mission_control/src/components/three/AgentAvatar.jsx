import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function EnergyMaterial({ color, opacity = 0.82 }) {
  return <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />;
}

function LightningBolt({ color }) {
  return (
    <group rotation={[0, 0, -0.18]}>
      <mesh position={[0.04, 0.12, 0]} rotation={[0, 0, -0.55]}><boxGeometry args={[0.09, 0.34, 0.07]} /><EnergyMaterial color={color} /></mesh>
      <mesh position={[-0.06, -0.08, 0]} rotation={[0, 0, 0.48]}><boxGeometry args={[0.09, 0.32, 0.07]} /><EnergyMaterial color={color} /></mesh>
      <mesh position={[0.02, -0.29, 0]} rotation={[0, 0, -0.38]}><coneGeometry args={[0.09, 0.28, 4]} /><EnergyMaterial color={color} /></mesh>
    </group>
  );
}

function CharacterFocusAura({ agent }) {
  const rings = useRef();
  const scan = useRef();

  useFrame(({ clock }, delta) => {
    if (rings.current) rings.current.rotation.y += delta * 0.7;
    if (scan.current) scan.current.position.y = 0.2 + ((clock.elapsedTime * 0.75) % 1.85);
  });

  return (
    <group>
      <group ref={rings}>
        {[0.24, 0.86, 1.48].map((y, index) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, index * 0.7]}>
            <torusGeometry args={[0.68 - index * 0.08, 0.012, 6, 64]} />
            <EnergyMaterial color={agent.color} opacity={0.52 - index * 0.08} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 1.08, -0.22]}>
        <cylinderGeometry args={[0.72, 0.82, 2.2, 18, 1, true]} />
        <meshBasicMaterial color={agent.color} wireframe transparent opacity={0.055} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 0.2, 0.38]}>
        <ringGeometry args={[0.28, 0.72, 48]} />
        <EnergyMaterial color={agent.color} opacity={0.24} />
      </mesh>
    </group>
  );
}

function MythicEffects({ agent, active, selected }) {
  const orbit = useRef();
  const leftWing = useRef();
  const rightWing = useRef();
  const prop = useRef();
  const pulse = useRef();

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime + agent.id.length;
    if (orbit.current) {
      orbit.current.rotation.y += delta * (active ? 2.1 : 0.55);
      orbit.current.rotation.z = Math.sin(time * 0.75) * 0.14;
    }
    if (leftWing.current) leftWing.current.rotation.z = 0.36 + Math.sin(time * (active ? 6 : 2.3)) * (active ? 0.24 : 0.08);
    if (rightWing.current) rightWing.current.rotation.z = -0.36 - Math.sin(time * (active ? 6 : 2.3)) * (active ? 0.24 : 0.08);
    if (prop.current) {
      prop.current.rotation.z = Math.sin(time * (active ? 4.6 : 1.4)) * (active ? 0.16 : 0.035);
      prop.current.position.y = Math.sin(time * 1.8) * 0.035;
    }
    if (pulse.current) {
      const amount = 1 + Math.sin(time * (active ? 7 : 2)) * (active ? 0.16 : 0.04);
      pulse.current.scale.setScalar(amount);
      pulse.current.rotation.y += delta * 0.7;
    }
  });

  const auraOpacity = active ? 0.95 : selected ? 0.68 : 0.38;

  return (
    <group>
      <group ref={pulse} position={[0, 0.95, -0.08]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.56, 0.014, 6, 48]} /><EnergyMaterial color={agent.color} opacity={auraOpacity} /></mesh>
      </group>

      {agent.mythicAspect === "atlas" && (
        <group ref={orbit} position={[0, 1.72, -0.28]}>
          <mesh><sphereGeometry args={[0.36, 20, 20]} /><meshStandardMaterial color="#102d3d" emissive={agent.color} emissiveIntensity={active ? 1.1 : 0.42} wireframe transparent opacity={0.72} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.47, 0.025, 8, 48]} /><EnergyMaterial color={agent.color} /></mesh>
          <mesh rotation={[0.2, Math.PI / 2, 0.4]}><torusGeometry args={[0.42, 0.018, 8, 48]} /><EnergyMaterial color="#d6bd7b" opacity={0.7} /></mesh>
        </group>
      )}

      {agent.mythicAspect === "athena" && (
        <>
          <group ref={prop} position={[0.52, 1.0, 0]}>
            <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.025, 0.025, 1.45, 8]} /><meshStandardMaterial color={agent.metalColor} metalness={0.92} roughness={0.18} /></mesh>
            <mesh position={[0, 0.82, 0]}><coneGeometry args={[0.1, 0.28, 4]} /><EnergyMaterial color={agent.color} /></mesh>
          </group>
          <group position={[-0.48, 0.92, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh><cylinderGeometry args={[0.31, 0.31, 0.07, 12]} /><meshStandardMaterial color="#173b3b" emissive={agent.color} emissiveIntensity={active ? 0.9 : 0.3} metalness={0.88} roughness={0.2} /></mesh>
            {[0, 1, 2, 3].map((bar) => <mesh key={bar} position={[(bar - 1.5) * 0.1, 0.06, 0.04]}><boxGeometry args={[0.045, 0.05, 0.12 + bar * 0.06]} /><EnergyMaterial color={agent.color} /></mesh>)}
          </group>
        </>
      )}

      {agent.mythicAspect === "oracle" && (
        <group ref={orbit} position={[0, 1.05, 0.12]}>
          {Array.from({ length: 6 }, (_, index) => {
            const angle = (index / 6) * Math.PI * 2;
            return <mesh key={angle} position={[Math.cos(angle) * 0.62, Math.sin(angle * 2) * 0.16, Math.sin(angle) * 0.38]}><octahedronGeometry args={[0.075]} /><EnergyMaterial color={index % 2 ? agent.color : "#f0d6ff"} /></mesh>;
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.55, 0.018, 8, 48]} /><EnergyMaterial color={agent.color} opacity={0.62} /></mesh>
        </group>
      )}

      {agent.mythicAspect === "zeus" && (
        <>
          <group ref={prop} position={[0.52, 1.02, 0]}>
            <mesh><cylinderGeometry args={[0.035, 0.045, 1.45, 8]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.28} metalness={0.95} roughness={0.12} /></mesh>
            <group position={[0, 0.84, 0]} scale={0.7}><LightningBolt color={agent.color} /></group>
          </group>
          <group ref={orbit} position={[0, 1.0, 0]}>
            {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * 0.58, index % 2 ? 0.18 : -0.1, Math.sin(index * Math.PI / 2) * 0.36]}><sphereGeometry args={[active ? 0.065 : 0.035, 10, 10]} /><EnergyMaterial color={index % 2 ? "#ffffff" : agent.color} /></mesh>)}
          </group>
        </>
      )}

      {agent.mythicAspect === "plutus" && (
        <>
          <group ref={orbit} position={[0, 1.08, 0.12]}>
            {[0, 1, 2, 3, 4].map((index) => {
              const angle = (index / 5) * Math.PI * 2;
              return <mesh key={index} position={[Math.cos(angle) * 0.58, Math.sin(angle * 1.4) * 0.14, Math.sin(angle) * 0.35]} rotation={[Math.PI / 2, angle, 0]}><cylinderGeometry args={[0.09, 0.09, 0.025, 16]} /><meshStandardMaterial color="#f2c75f" emissive="#d8a627" emissiveIntensity={0.45} metalness={0.95} roughness={0.16} /></mesh>;
            })}
          </group>
          <group ref={prop} position={[0.48, 1.05, 0]}>
            <mesh><cylinderGeometry args={[0.018, 0.018, 0.82, 8]} /><meshStandardMaterial color={agent.metalColor} metalness={0.9} roughness={0.2} /></mesh>
            <mesh position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.62, 8]} /><meshStandardMaterial color={agent.metalColor} metalness={0.9} roughness={0.2} /></mesh>
            {[-0.28, 0.28].map((x) => <mesh key={x} position={[x, 0.12, 0]}><cylinderGeometry args={[0.12, 0.08, 0.025, 16]} /><EnergyMaterial color={agent.color} /></mesh>)}
          </group>
        </>
      )}

      {agent.mythicAspect === "muse" && (
        <>
          <group ref={leftWing} position={[-0.36, 1.18, -0.12]} rotation={[0.18, 0.18, 0.36]}><mesh><coneGeometry args={[0.18, 0.82, 4]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.55} transparent opacity={0.72} side={THREE.DoubleSide} /></mesh></group>
          <group ref={rightWing} position={[0.36, 1.18, -0.12]} rotation={[0.18, -0.18, -0.36]}><mesh><coneGeometry args={[0.18, 0.82, 4]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.55} transparent opacity={0.72} side={THREE.DoubleSide} /></mesh></group>
          <group ref={orbit} position={[0, 1.05, 0.2]}>{[-0.52, 0, 0.52].map((x, index) => <mesh key={x} position={[x, index === 1 ? 0.26 : 0.02, 0]}><planeGeometry args={[0.22, 0.32]} /><meshBasicMaterial color={index === 1 ? "#ffffff" : agent.color} transparent opacity={0.62} side={THREE.DoubleSide} toneMapped={false} /></mesh>)}</group>
        </>
      )}

      {agent.mythicAspect === "aegis" && (
        <>
          <group ref={prop} position={[-0.48, 0.95, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh><cylinderGeometry args={[0.34, 0.28, 0.09, 8]} /><meshStandardMaterial color="#351218" emissive={agent.color} emissiveIntensity={active ? 0.85 : 0.25} metalness={0.9} roughness={0.18} /></mesh>
            <mesh position={[0, 0.06, 0]}><torusGeometry args={[0.22, 0.022, 6, 32]} /><EnergyMaterial color={agent.color} /></mesh>
          </group>
          <group position={[0.5, 1.05, 0]}><mesh><cylinderGeometry args={[0.024, 0.024, 1.5, 8]} /><meshStandardMaterial color={agent.metalColor} metalness={0.92} roughness={0.18} /></mesh><mesh position={[0, 0.85, 0]}><coneGeometry args={[0.09, 0.28, 4]} /><meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={0.6} metalness={0.82} roughness={0.16} /></mesh></group>
        </>
      )}

      {agent.mythicAspect === "hermes" && (
        <>
          <group ref={leftWing} position={[-0.26, 1.68, -0.04]} rotation={[0, 0.2, 0.36]}><mesh><coneGeometry args={[0.1, 0.45, 4]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.28} transparent opacity={0.86} /></mesh></group>
          <group ref={rightWing} position={[0.26, 1.68, -0.04]} rotation={[0, -0.2, -0.36]}><mesh><coneGeometry args={[0.1, 0.45, 4]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.28} transparent opacity={0.86} /></mesh></group>
          <group ref={prop} position={[0.48, 1.0, 0]}><mesh><cylinderGeometry args={[0.025, 0.025, 1.35, 8]} /><meshStandardMaterial color={agent.metalColor} metalness={0.9} roughness={0.18} /></mesh><mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.14, 0.025, 8, 24]} /><EnergyMaterial color={agent.color} /></mesh></group>
          <group ref={orbit} position={[0, 0.28, 0]}>{[-0.2, 0.2].map((x) => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, x > 0 ? -0.7 : 0.7]}><coneGeometry args={[0.07, 0.28, 4]} /><EnergyMaterial color={agent.color} opacity={0.68} /></mesh>)}</group>
        </>
      )}
    </group>
  );
}

function MythicRegalia({ agent, headRef, eyesRef, mouthRef }) {
  const isHelmeted = ["athena", "aegis", "hermes"].includes(agent.mythicAspect);
  const hasBeard = ["atlas", "zeus"].includes(agent.mythicAspect);
  const face = agent.face;
  return (
    <group>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.26, 0.44, 0.82, 8]} /><meshStandardMaterial color={agent.robeColor} emissive={agent.color} emissiveIntensity={0.11} metalness={0.52} roughness={0.36} /></mesh>
      <mesh position={[0, 1.08, 0.02]}><boxGeometry args={[0.56, 0.42, 0.32]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.1} metalness={0.86} roughness={0.22} /></mesh>
      {[-0.36, 0.36].map((x) => <mesh key={x} position={[x, 1.2, 0]}><sphereGeometry args={[0.16, 14, 14]} /><meshStandardMaterial color={agent.metalColor} metalness={0.88} roughness={0.18} /></mesh>)}
      <group ref={headRef}>
        <mesh position={[0, 1.73, 0]} scale={agent.mythicAspect === "aegis" ? [1.04, 1.08, 1] : [1, 1, 1]}><sphereGeometry args={[0.29, 24, 24]} /><meshStandardMaterial color={face.skin} emissive={agent.color} emissiveIntensity={0.045} metalness={0.1} roughness={0.62} /></mesh>
        {[-0.29, 0.29].map((x) => <mesh key={x} position={[x, 1.73, 0]}><sphereGeometry args={[0.055, 12, 12]} /><meshStandardMaterial color={face.skin} roughness={0.65} /></mesh>)}

        {!isHelmeted && agent.mythicAspect !== "oracle" && (
          <mesh position={[0, 1.84, -0.025]}><sphereGeometry args={[0.305, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.49]} /><meshStandardMaterial color={face.hair} emissive={agent.mythicAspect === "zeus" ? "#fff5d6" : agent.color} emissiveIntensity={agent.mythicAspect === "zeus" ? 0.08 : 0.018} roughness={0.72} /></mesh>
        )}
        {isHelmeted && <><mesh position={[0, 1.78, -0.02]}><sphereGeometry args={[0.32, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.12} metalness={0.92} roughness={0.16} /></mesh><mesh position={[0, 2.08, -0.04]}><boxGeometry args={[0.08, 0.38, 0.34]} /><meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={0.34} metalness={0.72} roughness={0.2} /></mesh></>}
        {agent.mythicAspect === "zeus" && <><mesh position={[0, 2.04, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.25, 0.025, 6, 32, Math.PI * 1.6]} /><meshStandardMaterial color={agent.metalColor} emissive="#fff2b5" emissiveIntensity={0.35} metalness={0.95} roughness={0.12} /></mesh><mesh position={[0.22, 1.94, 0.21]} rotation={[0, 0, -0.45]}><coneGeometry args={[0.045, 0.22, 4]} /><meshBasicMaterial color={agent.color} toneMapped={false} /></mesh></>}
        {agent.mythicAspect === "oracle" && <mesh position={[0, 1.78, -0.18]} rotation={[0.18, 0, 0]}><coneGeometry args={[0.38, 0.9, 8]} /><meshStandardMaterial color={agent.robeColor} emissive={agent.color} emissiveIntensity={0.12} transparent opacity={0.72} side={THREE.DoubleSide} /></mesh>}
        {agent.mythicAspect === "plutus" && <group position={[0, 2.02, 0]}>{[-0.16, 0, 0.16].map((x, index) => <mesh key={x} position={[x, index === 1 ? 0.08 : 0]}><coneGeometry args={[0.06, 0.23, 4]} /><meshStandardMaterial color={agent.metalColor} emissive={agent.color} emissiveIntensity={0.2} metalness={0.95} roughness={0.14} /></mesh>)}</group>}
        {agent.mythicAspect === "muse" && <>{[-0.27, 0.27].map((x) => <mesh key={x} position={[x, 1.67, -0.08]} rotation={[0, 0, x > 0 ? -0.18 : 0.18]}><capsuleGeometry args={[0.075, 0.52, 6, 10]} /><meshStandardMaterial color={face.hair} emissive={agent.color} emissiveIntensity={0.08} roughness={0.66} /></mesh>)}</>}

        <group ref={eyesRef}>
          {[-0.11, 0.11].map((x) => <group key={x} position={[x, 1.76, 0.258]}><mesh scale={[1.45, 0.72, 0.5]}><sphereGeometry args={[0.039, 12, 12]} /><meshStandardMaterial color="#e7f7f4" emissive="#b8fff1" emissiveIntensity={0.1} roughness={0.3} /></mesh><mesh position={[0, 0, 0.035]}><sphereGeometry args={[0.019, 10, 10]} /><meshBasicMaterial color={face.iris} toneMapped={false} /></mesh></group>)}
        </group>
        {[-0.11, 0.11].map((x) => <mesh key={x} position={[x, 1.825, 0.258]} rotation={[0, 0, x > 0 ? -0.08 : 0.08]}><boxGeometry args={[0.13, 0.018, 0.018]} /><meshStandardMaterial color={face.hair} roughness={0.72} /></mesh>)}
        <mesh position={[0, 1.68, 0.292]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.035, 0.105, 8]} /><meshStandardMaterial color={face.shadow} roughness={0.68} /></mesh>
        <group ref={mouthRef} position={[0, 1.59, 0.282]}><mesh><boxGeometry args={[agent.face.expression === "stern" ? 0.13 : 0.1, 0.018, 0.018]} /><meshStandardMaterial color={face.lip} roughness={0.62} /></mesh></group>
        {hasBeard && <mesh position={[0, 1.55, 0.08]} rotation={[0, 0, Math.PI]}><coneGeometry args={[agent.mythicAspect === "zeus" ? 0.25 : 0.21, agent.mythicAspect === "zeus" ? 0.48 : 0.32, 12]} /><meshStandardMaterial color={face.hair} emissive={agent.mythicAspect === "zeus" ? "#fff4cf" : agent.color} emissiveIntensity={0.025} roughness={0.78} /></mesh>}
      </group>
      {agent.mythicAspect === "atlas" && <mesh position={[0, 1.58, -0.23]}><boxGeometry args={[0.72, 0.08, 0.34]} /><meshStandardMaterial color={agent.metalColor} metalness={0.92} roughness={0.18} /></mesh>}
    </group>
  );
}

export default function AgentAvatar({ agent, active, selected, focused = false, onSelect }) {
  const mover = useRef();
  const rig = useRef();
  const torso = useRef();
  const head = useRef();
  const eyes = useRef();
  const mouth = useRef();
  const cape = useRef();
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();
  const destination = useMemo(() => new THREE.Vector3(), []);
  const engaged = active || focused;
  const displayScale = (agent.avatarScale ?? 0.58) * (focused && !active ? 1.35 : 1);

  useFrame(({ clock }, delta) => {
    const target = engaged ? agent.workPosition : agent.homePosition;
    destination.set(target[0], target[1], target[2] + (focused && !active ? 0.62 : 0));
    const distance = mover.current.position.distanceTo(destination);
    mover.current.position.lerp(destination, 1 - Math.exp(-delta * 2.15));
    const targetRotation = active ? agent.facing : 0;
    mover.current.rotation.y = THREE.MathUtils.lerp(mover.current.rotation.y, targetRotation, 1 - Math.exp(-delta * 2.6));

    const time = clock.elapsedTime + agent.id.length;
    const moving = distance > 0.06;
    const walk = Math.sin(time * 8.5);
    const breath = Math.sin(time * 1.8);
    rig.current.position.y = moving ? Math.abs(walk) * 0.045 : breath * 0.022;
    rig.current.rotation.x = moving ? -0.07 : 0;
    torso.current.scale.y = 1 + breath * 0.012;
    head.current.rotation.y = engaged ? Math.sin(time * 0.8) * 0.05 : Math.sin(time * 0.55) * 0.2;
    head.current.rotation.x = engaged ? -0.08 + Math.sin(time * 3.2) * 0.035 : Math.sin(time * 0.8) * 0.025;
    const blinkPhase = (time + agent.name.charCodeAt(0) * 0.07) % 5.4;
    eyes.current.scale.y = blinkPhase < 0.12 ? 0.08 : 1;
    mouth.current.scale.y = active ? 1 + Math.abs(Math.sin(time * 5.4)) * 1.3 : 1;
    cape.current.rotation.x = -0.14 + Math.sin(time * (moving ? 5.2 : 1.7)) * (moving ? 0.13 : 0.045);
    const armMotion = moving ? walk * 0.58 : engaged ? Math.sin(time * 3.4) * 0.2 - 0.36 : Math.sin(time * 1.1) * 0.035;
    leftArm.current.rotation.x = armMotion;
    rightArm.current.rotation.x = -armMotion;
    leftLeg.current.rotation.x = moving ? -walk * 0.45 : 0;
    rightLeg.current.rotation.x = moving ? walk * 0.45 : 0;
  });

  return (
    <group ref={mover} position={agent.homePosition} scale={displayScale} onClick={(event) => { event.stopPropagation(); onSelect(agent); }}>
      <group ref={rig} scale={agent.bodyScale ?? [1, 1, 1]}>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.43, 0.5, 0.07, 32]} /><meshStandardMaterial color="#07111a" emissive={agent.color} emissiveIntensity={selected || active ? 1.25 : 0.34} metalness={0.86} roughness={0.18} /></mesh>
        <group ref={torso}><MythicRegalia agent={agent} headRef={head} eyesRef={eyes} mouthRef={mouth} /></group>
        <mesh ref={cape} position={[0, 1.04, -0.22]} rotation={[-0.14, 0, 0]}><planeGeometry args={[0.7, 1.18]} /><meshStandardMaterial color={agent.robeColor} emissive={agent.color} emissiveIntensity={0.08} transparent opacity={0.82} side={THREE.DoubleSide} /></mesh>
        <group ref={leftArm} position={[-0.4, 1.12, 0]}><mesh position={[0, -0.3, 0]}><capsuleGeometry args={[0.085, 0.42, 6, 10]} /><meshStandardMaterial color={agent.metalColor} metalness={0.78} roughness={0.24} /></mesh></group>
        <group ref={rightArm} position={[0.4, 1.12, 0]}><mesh position={[0, -0.3, 0]}><capsuleGeometry args={[0.085, 0.42, 6, 10]} /><meshStandardMaterial color={agent.metalColor} metalness={0.78} roughness={0.24} /></mesh></group>
        <group ref={leftLeg} position={[-0.16, 0.34, 0]}><mesh><capsuleGeometry args={[0.1, 0.45, 6, 10]} /><meshStandardMaterial color="#111b24" metalness={0.72} roughness={0.28} /></mesh></group>
        <group ref={rightLeg} position={[0.16, 0.34, 0]}><mesh><capsuleGeometry args={[0.1, 0.45, 6, 10]} /><meshStandardMaterial color="#111b24" metalness={0.72} roughness={0.28} /></mesh></group>
        <MythicEffects agent={agent} active={engaged} selected={selected || focused} />
        {focused && <CharacterFocusAura agent={agent} />}
        {active && <pointLight position={[0, 1.2, 0.55]} color={agent.color} intensity={1.8} distance={2.6} />}
      </group>
      <Html center position={[0, 2.4, 0]} distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div className={`agent-nameplate ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`} style={{ "--agent-color": agent.color }}>
          <strong>{agent.name}</strong>
          <span>{active ? agent.task : agent.mythTitle}</span>
        </div>
      </Html>
    </group>
  );
}
