import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import AgentAvatar from "./AgentAvatar";
import AgentWorkstation from "./AgentWorkstation";
import JarvisCore3D from "./JarvisCore3D";

const CORE_POSITION = [0, 0.35, 0.48];
const LINK_ORIGIN = new THREE.Vector3(0, 0.4, 0.25);

const roomLayout = {
  atlas: { center: [-5.35, 3.275], size: [3.2, 1.85] },
  vega: { center: [5.35, 3.275], size: [3.2, 1.85] },
  echo: { center: [-5.35, 1.15], size: [3.2, 1.8] },
  zeus: { center: [5.35, 1.15], size: [3.2, 1.8] },
  nova: { center: [-5.35, -0.95], size: [3.2, 1.8] },
  aura: { center: [5.35, -0.95], size: [3.2, 1.8] },
  sentinel: { center: [-3.55, -3.175], size: [6.8, 2.05] },
  hermes: { center: [3.55, -3.175], size: [6.8, 2.05] },
};

function AmbientDataField() {
  const points = useRef();
  const positions = useMemo(() => {
    const data = new Float32Array(900 * 3);
    let seed = 19;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let index = 0; index < 900; index += 1) {
      const radius = 5 + random() * 11;
      const angle = random() * Math.PI * 2;
      data[index * 3] = Math.cos(angle) * radius;
      data[index * 3 + 1] = -4.5 + random() * 10;
      data[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += delta * 0.018;
  });

  return (
    <points ref={points}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#4ccce9" size={0.018} transparent opacity={0.44} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function EnergyLink({ agent }) {
  const packet = useRef();
  const start = useMemo(() => LINK_ORIGIN.clone(), []);
  const end = useMemo(() => new THREE.Vector3(...agent.workPosition).add(new THREE.Vector3(0, 0.58, 0)), [agent]);

  useFrame(({ clock }) => {
    if (!packet.current) return;
    const progress = (clock.elapsedTime * 0.42) % 1;
    packet.current.position.lerpVectors(start, end, progress);
  });

  return (
    <group>
      <Line points={[start, end]} color={agent.color} lineWidth={1.15} transparent opacity={0.56} dashed dashSize={0.12} gapSize={0.08} />
      <mesh ref={packet}><sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color={agent.color} toneMapped={false} /></mesh>
    </group>
  );
}

function Plant({ position }) {
  return (
    <group position={position} scale={0.72}>
      <mesh><cylinderGeometry args={[0.18, 0.14, 0.3, 12]} /><meshStandardMaterial color="#26353b" metalness={0.62} roughness={0.34} /></mesh>
      {[-0.18, 0, 0.18].map((x, index) => (
        <mesh key={x} position={[x, 0.31 + index * 0.06, 0.02]} rotation={[0, 0, x * 1.7]}>
          <coneGeometry args={[0.15, 0.5, 8]} />
          <meshStandardMaterial color={index === 1 ? "#3bcf9a" : "#268d72"} emissive="#1d8f73" emissiveIntensity={0.16} roughness={0.56} />
        </mesh>
      ))}
    </group>
  );
}

function ServerRack({ position, color = "#63e7ff" }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.72, 1.25, 0.26]} /><meshStandardMaterial color="#101b24" metalness={0.9} roughness={0.2} /></mesh>
      {[-0.4, -0.16, 0.08, 0.32].map((y, index) => (
        <group key={y} position={[0, y, 0.15]}>
          <mesh><boxGeometry args={[0.59, 0.12, 0.025]} /><meshStandardMaterial color="#071118" emissive={color} emissiveIntensity={0.08 + index * 0.025} metalness={0.86} roughness={0.2} /></mesh>
          <mesh position={[0.22, 0, 0.025]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color={index % 2 ? "#59f0a7" : color} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

function RoomShell({ center, size, color, active = false, label, kicker, children }) {
  const scan = useRef();
  const backdrop = useRef();
  const [width, height] = size;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime + center[0] * 0.31 + center[1] * 0.17;
    if (scan.current) {
      scan.current.position.y = -height / 2 + 0.17 + ((time * (active ? 0.55 : 0.13)) % Math.max(0.4, height - 0.34));
      scan.current.material.opacity = active ? 0.62 : 0.12;
    }
    if (backdrop.current) {
      backdrop.current.material.emissiveIntensity = (active ? 0.15 : 0.035) + Math.sin(time * (active ? 3.5 : 1.1)) * (active ? 0.04 : 0.01);
    }
  });

  return (
    <group position={[center[0], center[1], -0.98]}>
      <mesh ref={backdrop}>
        <boxGeometry args={[width, height, 0.12]} />
        <meshStandardMaterial color="#050b12" emissive={color} emissiveIntensity={0.05} metalness={0.66} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.085]}><planeGeometry args={[width * 0.95, height * 0.89]} /><meshBasicMaterial color={color} transparent opacity={active ? 0.05 : 0.018} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, -height / 2 + 0.04, 0.62]}><boxGeometry args={[width - 0.04, 0.08, 1.28]} /><meshStandardMaterial color="#111d27" emissive={color} emissiveIntensity={active ? 0.18 : 0.06} metalness={0.9} roughness={0.2} /></mesh>
      <mesh position={[0, height / 2 - 0.035, 0.18]}><boxGeometry args={[width - 0.04, 0.055, 0.14]} /><meshBasicMaterial color={color} transparent opacity={active ? 0.86 : 0.38} toneMapped={false} /></mesh>
      {[-width / 2 + 0.035, width / 2 - 0.035].map((x) => (
        <mesh key={x} position={[x, 0, 0.58]}><boxGeometry args={[0.07, height, 1.2]} /><meshStandardMaterial color="#17242e" emissive={color} emissiveIntensity={0.045} metalness={0.92} roughness={0.18} /></mesh>
      ))}
      <mesh ref={scan} position={[0, -height / 2 + 0.17, 0.18]}><planeGeometry args={[width - 0.18, 0.018]} /><meshBasicMaterial color={color} transparent opacity={0.12} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      <mesh position={[width / 2 - 0.19, height / 2 - 0.2, 0.25]}><sphereGeometry args={[0.035, 10, 10]} /><meshBasicMaterial color={active ? "#ffffff" : color} toneMapped={false} /></mesh>
      {label && (
        <Html center position={[0, height / 2 - 0.2, 0.28]} distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className={`hq-room-label ${active ? "is-active" : ""}`} style={{ "--room-color": color }}>
            <span>{kicker}</span><strong>{label}</strong><i />
          </div>
        </Html>
      )}
      <pointLight position={[0, 0.15, 0.72]} color={color} intensity={active ? 0.58 : 0.18} distance={Math.max(width, height) * 0.8} />
      {children}
    </group>
  );
}

function ConferenceRoom() {
  const hologram = useRef();
  useFrame((_, delta) => {
    if (hologram.current) hologram.current.rotation.y += delta * 0.36;
  });

  const chairs = [
    [-2.15, -0.48], [-1.2, -0.62], [0, -0.66], [1.2, -0.62], [2.15, -0.48],
  ];

  return (
    <RoomShell center={[0, 3.275]} size={[6.9, 1.85]} color="#63e7ff" label="CONFERENCE ROOM" kicker="SHARED COMMAND // STRATEGY">
      <mesh position={[0, -0.1, 0.55]} rotation={[Math.PI / 2, 0, 0]} scale={[2.4, 0.7, 1]}>
        <cylinderGeometry args={[0.54, 0.54, 0.12, 32]} />
        <meshStandardMaterial color="#172630" emissive="#63e7ff" emissiveIntensity={0.17} metalness={0.88} roughness={0.22} />
      </mesh>
      {chairs.map(([x, y]) => <mesh key={`${x}-${y}`} position={[x, y, 0.62]}><boxGeometry args={[0.38, 0.34, 0.42]} /><meshStandardMaterial color="#1a2730" metalness={0.78} roughness={0.28} /></mesh>)}
      <group ref={hologram} position={[0, 0.16, 0.92]}>
        <mesh><icosahedronGeometry args={[0.28, 2]} /><meshStandardMaterial color="#0b3440" emissive="#6ceaff" emissiveIntensity={0.72} wireframe transparent opacity={0.76} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.42, 0.012, 6, 48]} /><meshBasicMaterial color="#7befff" transparent opacity={0.74} toneMapped={false} /></mesh>
      </group>
      <mesh position={[2.65, 0.18, 0.24]}><planeGeometry args={[1.05, 0.5]} /><meshBasicMaterial color="#53dbf3" transparent opacity={0.12} toneMapped={false} /></mesh>
      <Plant position={[-2.9, -0.55, 0.48]} />
      <Plant position={[2.95, -0.55, 0.48]} />
    </RoomShell>
  );
}

function JarvisOffice() {
  const orbit = useRef();
  useFrame((_, delta) => {
    if (orbit.current) orbit.current.rotation.z -= delta * 0.2;
  });

  return (
    <RoomShell center={[0, 0.1]} size={[6.9, 3.9]} color="#71e9ff" label="JARVIS COMMAND OFFICE" kicker="CENTRAL ORCHESTRATOR // OPERATOR LINK">
      <ServerRack position={[-2.72, -0.38, 0.24]} />
      <ServerRack position={[2.72, -0.38, 0.24]} />
      <mesh position={[-1.75, 0.72, 0.23]}><planeGeometry args={[1.2, 0.55]} /><meshBasicMaterial color="#58def4" transparent opacity={0.12} toneMapped={false} /></mesh>
      <mesh position={[1.75, 0.72, 0.23]}><planeGeometry args={[1.2, 0.55]} /><meshBasicMaterial color="#9d67ff" transparent opacity={0.1} toneMapped={false} /></mesh>
      <group ref={orbit} position={[0, 0.25, 0.21]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.02, 0.016, 8, 64]} /><meshBasicMaterial color="#72eaff" transparent opacity={0.24} toneMapped={false} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.34, 0.01, 8, 64]} /><meshBasicMaterial color="#a971ff" transparent opacity={0.16} toneMapped={false} /></mesh>
      </group>
      <Plant position={[-1.9, -1.48, 0.5]} />
      <Plant position={[1.9, -1.48, 0.5]} />
    </RoomShell>
  );
}

function AgentRoom({ agent, active, focused = false }) {
  const layout = roomLayout[agent.id];
  return (
    <RoomShell center={layout.center} size={layout.size} color={agent.color} active={active} label={focused ? null : agent.name} kicker={`${agent.floor} // ${agent.shortRole.toUpperCase()}`}>
      <mesh position={[0, -layout.size[1] / 2 + 0.23, 0.34]}><boxGeometry args={[layout.size[0] * 0.5, 0.025, 0.05]} /><meshBasicMaterial color={agent.color} transparent opacity={0.18} toneMapped={false} /></mesh>
    </RoomShell>
  );
}

function HeadquartersFloor({ agents, activeAgentId, focusedAgentId }) {
  const verticalGrid = [-6, -4, -2, 0, 2, 4, 6];
  const horizontalGrid = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

  return (
    <group>
      <mesh position={[0, 0, -1.32]}><boxGeometry args={[14.4, 8.8, 0.16]} /><meshStandardMaterial color="#02070d" emissive="#17384a" emissiveIntensity={0.11} metalness={0.68} roughness={0.48} /></mesh>
      <mesh position={[0, 0, -1.2]}><planeGeometry args={[14.1, 8.5]} /><meshBasicMaterial color="#113345" transparent opacity={0.05} depthWrite={false} toneMapped={false} /></mesh>
      {verticalGrid.map((x) => <mesh key={x} position={[x, 0, -1.1]}><boxGeometry args={[0.012, 8.45, 0.01]} /><meshBasicMaterial color="#4dddf5" transparent opacity={0.065} toneMapped={false} /></mesh>)}
      {horizontalGrid.map((y) => <mesh key={y} position={[0, y, -1.1]}><boxGeometry args={[14.05, 0.012, 0.01]} /><meshBasicMaterial color="#4dddf5" transparent opacity={0.05} toneMapped={false} /></mesh>)}
      {[-7.15, 7.15].map((x) => <mesh key={x} position={[x, 0, -0.22]}><boxGeometry args={[0.1, 8.85, 1.95]} /><meshStandardMaterial color="#17252f" emissive="#52dff7" emissiveIntensity={0.09} metalness={0.94} roughness={0.17} /></mesh>)}
      {[-4.35, 4.35].map((y) => <mesh key={y} position={[0, y, -0.22]}><boxGeometry args={[14.4, 0.1, 1.95]} /><meshStandardMaterial color="#17252f" emissive="#52dff7" emissiveIntensity={0.09} metalness={0.94} roughness={0.17} /></mesh>)}
      <ConferenceRoom />
      <JarvisOffice />
      {agents.map((agent) => <AgentRoom key={agent.id} agent={agent} active={agent.id === activeAgentId || agent.id === focusedAgentId} focused={agent.id === focusedAgentId} />)}
    </group>
  );
}

export default function MissionWorld3D({ visible, agents, activeAgentId, selectedAgentId, focusedAgentId, jarvisState, onSelectAgent, onCoreActivate, onEarthMode }) {
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  const focusedAgent = agents.find((agent) => agent.id === focusedAgentId);
  const linkedAgent = activeAgent ?? focusedAgent;

  return (
    <group visible={visible}>
      <ambientLight intensity={0.46} color="#8ccbe0" />
      <directionalLight position={[4, 8, 10]} intensity={1.45} color="#b9eaff" />
      <pointLight position={[0, 3.8, 5]} color="#62e4ff" intensity={1.8} distance={18} />
      <pointLight position={[0, -2.8, 4]} color="#9f4cff" intensity={1.1} distance={16} />
      <AmbientDataField />
      <HeadquartersFloor agents={agents} activeAgentId={activeAgentId} focusedAgentId={focusedAgentId} />
      <group position={CORE_POSITION} scale={0.64}><JarvisCore3D state={jarvisState} position={[0, 0, 0]} onActivate={onCoreActivate} onDoubleActivate={onEarthMode} /></group>
      {linkedAgent && <EnergyLink agent={linkedAgent} />}
      {agents.map((agent) => (
        <group key={agent.id}>
          <AgentWorkstation agent={agent} active={agent.id === activeAgentId} selected={agent.id === focusedAgentId} showRoomLabel={false} />
          <AgentAvatar agent={agent} active={agent.id === activeAgentId} selected={agent.id === selectedAgentId} focused={agent.id === focusedAgentId} onSelect={onSelectAgent} />
        </group>
      ))}
    </group>
  );
}
