import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

function StationSigil({ agent, opacity }) {
  const basic = <meshBasicMaterial color={agent.color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />;
  return (
    <>
      {agent.stationType === "trading" && [-0.3, -0.1, 0.1, 0.3].map((x, index) => <mesh key={x} position={[x, (index + 1) * 0.06 - 0.15, 0]}><boxGeometry args={[0.08, 0.16 + index * 0.1, 0.06]} />{basic}</mesh>)}
      {agent.stationType === "coding" && [-0.24, -0.08, 0.08, 0.24].map((y, index) => <mesh key={y} position={[index % 2 ? 0.08 : -0.08, y, 0]}><boxGeometry args={[0.42 - (index % 2) * 0.12, 0.035, 0.04]} />{basic}</mesh>)}
      {agent.stationType === "research" && [-0.26, 0, 0.26].map((x, index) => <mesh key={x} position={[x, Math.sin(index) * 0.1, 0]} rotation={[0, 0, x]}><boxGeometry args={[0.18, 0.28, 0.04]} />{basic}</mesh>)}
      {agent.stationType === "memory" && <><mesh><octahedronGeometry args={[0.3]} />{basic}</mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.46, 0.018, 8, 48]} />{basic}</mesh></>}
      {agent.stationType === "finance" && <><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.34, 0.06, 10, 40]} />{basic}</mesh><mesh><cylinderGeometry args={[0.12, 0.12, 0.06, 20]} />{basic}</mesh></>}
      {agent.stationType === "marketing" && [-0.3, 0, 0.3].map((x, index) => <mesh key={x} position={[x, index === 1 ? 0.12 : -0.02, 0]} rotation={[0, 0, x]}><planeGeometry args={[0.22, 0.34]} />{basic}</mesh>)}
      {agent.stationType === "security" && <><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.38, 0.025, 8, 48]} />{basic}</mesh><mesh><cylinderGeometry args={[0.18, 0.14, 0.07, 6]} />{basic}</mesh></>}
      {agent.stationType === "automation" && <><mesh><icosahedronGeometry args={[0.25, 1]} />{basic}</mesh>{[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.08, 12, 12]} />{basic}</mesh>)}</>}
    </>
  );
}

function WorkstationAnimation({ agent, active }) {
  const symbol = useRef();
  const radar = useRef();
  const scan = useRef();
  const bars = useRef([]);

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime + agent.id.length;
    if (symbol.current) {
      symbol.current.rotation.y += delta * (active ? 0.75 : 0.16);
      symbol.current.position.y = 1.25 + Math.sin(time * 2) * 0.05;
    }
    if (radar.current) radar.current.rotation.z -= delta * (active ? 1.4 : 0.3);
    if (scan.current) {
      scan.current.position.y = 0.88 + ((time * (active ? 0.62 : 0.18)) % 0.66);
      scan.current.material.opacity = active ? 0.72 : 0.18;
    }
    bars.current.forEach((bar, index) => {
      if (!bar) return;
      const amount = 0.42 + (Math.sin(time * (active ? 2.4 : 0.7) + index * 1.7) + 1) * (active ? 0.3 : 0.09);
      bar.scale.x = amount;
    });
  });

  const glow = active ? 1 : 0.4;
  const ticks = Array.from({ length: 16 }, (_, index) => index);
  const hexes = [[-0.48, -0.2], [-0.38, -0.2], [-0.43, -0.11], [-0.48, -0.02], [-0.38, -0.02], [-0.43, 0.07]];

  return (
    <group>
      <group ref={symbol} position={[0, 1.25, 0]}>
        <StationSigil agent={agent} opacity={glow} />
      </group>

      <group position={[0, 1.2, -0.12]} rotation={[-0.12, 0, 0]}>
        <group ref={radar}>
          <mesh><torusGeometry args={[0.37, 0.009, 6, 64]} /><meshBasicMaterial color={agent.color} transparent opacity={active ? 0.72 : 0.2} depthWrite={false} toneMapped={false} /></mesh>
          <mesh><ringGeometry args={[0.21, 0.215, 48]} /><meshBasicMaterial color={agent.color} transparent opacity={active ? 0.34 : 0.1} depthWrite={false} toneMapped={false} /></mesh>
          {ticks.map((index) => {
            const angle = (index / ticks.length) * Math.PI * 2;
            return <mesh key={index} position={[Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0.004]} rotation={[0, 0, angle]}><boxGeometry args={[index % 4 === 0 ? 0.08 : 0.045, 0.012, 0.008]} /><meshBasicMaterial color={agent.color} transparent opacity={active ? 0.7 : 0.16} depthWrite={false} toneMapped={false} /></mesh>;
          })}
        </group>

        <group position={[0, 0, 0.008]}>
          {hexes.map(([x, y], index) => <mesh key={`${x}-${y}`} position={[x, y, 0]}><ringGeometry args={[0.035, 0.048, 6]} /><meshBasicMaterial color={agent.color} transparent opacity={active && index % 2 === 0 ? 0.62 : 0.16} depthWrite={false} toneMapped={false} /></mesh>)}
        </group>

        <group position={[0.43, 0.02, 0.009]}>
          {[0, 1, 2, 3].map((index) => (
            <group key={index} position={[0, 0.19 - index * 0.13, 0]}>
              <mesh><boxGeometry args={[0.28, 0.018, 0.006]} /><meshBasicMaterial color="#173845" transparent opacity={0.55} depthWrite={false} toneMapped={false} /></mesh>
              <mesh ref={(node) => { bars.current[index] = node; }} position={[0, 0, 0.006]}><boxGeometry args={[0.27, 0.021, 0.006]} /><meshBasicMaterial color={agent.color} transparent opacity={active ? 0.78 : 0.24} depthWrite={false} toneMapped={false} /></mesh>
            </group>
          ))}
        </group>

        <mesh ref={scan} position={[0, 0.9, 0.018]}><boxGeometry args={[1.16, 0.012, 0.006]} /><meshBasicMaterial color={agent.color} transparent opacity={0.22} depthWrite={false} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

function ConsolePanel({ position, rotation, size, agent, active, opacity = 0.58 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[size[0], size[1], 0.055]} />
        <meshStandardMaterial color="#05111b" emissive={agent.color} emissiveIntensity={active ? 0.72 : 0.2} transparent opacity={active ? opacity + 0.15 : opacity} metalness={0.72} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.035]}><planeGeometry args={[size[0] * 0.9, size[1] * 0.82]} /><meshBasicMaterial color={agent.color} transparent opacity={active ? 0.08 : 0.025} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

export default function AgentWorkstation({ agent, active, selected = false, showRoomLabel = true }) {
  const energized = active || selected;
  return (
    <group position={agent.stationPosition} rotation={[0, agent.facing + Math.PI, 0]} scale={agent.stationScale ?? 0.68}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.85, 1.0, 0.12, 6]} />
        <meshStandardMaterial color="#07121b" emissive={agent.color} emissiveIntensity={energized ? 0.52 : 0.12} metalness={0.88} roughness={0.24} />
      </mesh>
      <ConsolePanel position={[0, 1.2, -0.18]} rotation={[-0.12, 0, 0]} size={[1.35, 0.86]} agent={agent} active={energized} opacity={0.58} />
      <ConsolePanel position={[-0.88, 1.14, -0.08]} rotation={[-0.1, 0.27, 0.03]} size={[0.48, 0.62]} agent={agent} active={energized} opacity={0.42} />
      <ConsolePanel position={[0.88, 1.14, -0.08]} rotation={[-0.1, -0.27, -0.03]} size={[0.48, 0.62]} agent={agent} active={energized} opacity={0.42} />
      <mesh position={[0, 0.62, -0.22]}><boxGeometry args={[0.09, 0.72, 0.09]} /><meshStandardMaterial color="#13202b" metalness={0.85} roughness={0.2} /></mesh>
      <WorkstationAnimation agent={agent} active={energized} />
      {showRoomLabel && (
        <Html center position={[0, 2.18, 0]} distanceFactor={10} style={{ pointerEvents: "none" }}>
          <div className="room-sign" style={{ "--agent-color": agent.color }}><span>{agent.floor}</span><strong>{agent.room}</strong></div>
        </Html>
      )}
      {active && (
        <Html center position={[0, 2.68, 0]} distanceFactor={10} style={{ pointerEvents: "none" }}>
          <div className="station-task" style={{ "--agent-color": agent.color }}><span>ACTIVE TASK</span><strong>{agent.task}</strong></div>
        </Html>
      )}
    </group>
  );
}
