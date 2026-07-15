import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import JarvisCore3D from "./JarvisCore3D";

function GraphHalo() {
  const halo = useRef();
  const geometry = useMemo(() => {
    const nodes = [];
    const segments = [];
    let seed = 31;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 96; index += 1) {
      const direction = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
      nodes.push(direction.multiplyScalar(3.65 + random() * 1.65));
    }
    for (let index = 0; index < nodes.length; index += 1) {
      const next = nodes[(index + 7) % nodes.length];
      if (nodes[index].distanceTo(next) < 4.1) segments.push(...nodes[index].toArray(), ...next.toArray());
    }
    return {
      nodes: new Float32Array(nodes.flatMap((node) => node.toArray())),
      segments: new Float32Array(segments),
    };
  }, []);

  useFrame(({ clock }) => {
    if (!halo.current) return;
    halo.current.rotation.y = clock.elapsedTime * -0.018;
    halo.current.rotation.x = Math.sin(clock.elapsedTime * 0.11) * 0.08;
  });

  return (
    <group ref={halo}>
      <points>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[geometry.nodes, 3]} /></bufferGeometry>
        <pointsMaterial color="#7beaff" size={0.035} transparent opacity={0.46} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[geometry.segments, 3]} /></bufferGeometry>
        <lineBasicMaterial color="#28738f" transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

export default function ParticleEarth3D({ visible = true, jarvisState = "idle", onCoreActivate, onCoreDoubleActivate }) {
  const earth = useRef();
  const points = useMemo(() => {
    const count = 2600;
    const data = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * index;
      const surfaceNoise = 2.97 + Math.sin(index * 1.713) * 0.035;
      data[index * 3] = Math.cos(theta) * radiusAtY * surfaceNoise;
      data[index * 3 + 1] = y * surfaceNoise;
      data[index * 3 + 2] = Math.sin(theta) * radiusAtY * surfaceNoise;
    }
    return data;
  }, []);

  const networkSegments = useMemo(() => {
    const data = [];
    for (let index = 0; index < points.length / 3 - 28; index += 24) {
      const next = index + 24;
      data.push(points[index * 3], points[index * 3 + 1], points[index * 3 + 2]);
      data.push(points[next * 3], points[next * 3 + 1], points[next * 3 + 2]);
    }
    return new Float32Array(data);
  }, [points]);

  useFrame(({ clock }, delta) => {
    if (!visible || !earth.current) return;
    earth.current.rotation.y += delta * 0.052;
    const pulse = 1 + Math.sin(clock.elapsedTime * 0.72) * 0.008;
    earth.current.scale.setScalar(pulse);
  });

  return (
    <group visible={visible}>
      <ambientLight intensity={0.35} color="#61dfff" />
      <pointLight position={[0, 0, 5]} color="#57ddff" intensity={4.2} distance={16} />
      <GraphHalo />
      <group ref={earth} position={[0, 0.2, 0]}>
        <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
          <pointsMaterial color="#68e6ff" size={0.039} transparent opacity={0.92} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
        <lineSegments>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[networkSegments, 3]} /></bufferGeometry>
          <lineBasicMaterial color="#2a86aa" transparent opacity={0.15} blending={THREE.AdditiveBlending} toneMapped={false} />
        </lineSegments>
        <mesh>
          <sphereGeometry args={[2.92, 48, 48]} />
          <meshBasicMaterial color="#050f18" transparent opacity={0.25} side={THREE.BackSide} />
        </mesh>
      </group>
      <group position={[0, 0.2, 0.35]} scale={0.54}>
        <JarvisCore3D
          state={jarvisState}
          position={[0, 0, 0]}
          onActivate={onCoreActivate}
          onDoubleActivate={onCoreDoubleActivate}
        />
      </group>
    </group>
  );
}
