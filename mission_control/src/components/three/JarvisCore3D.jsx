import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const stateColors = {
  idle: "#67e8ff",
  listening: "#c8fbff",
  thinking: "#78d7ff",
  speaking: "#f3ffff",
};

const stateProfiles = {
  idle: { radius: 1, wave: 0.02, turbulence: 0.015, scatter: 0.05, speed: 0.18, response: 4.2 },
  listening: { radius: 1.16, wave: 0.085, turbulence: 0.025, scatter: 0.18, speed: 0.42, response: 6.2 },
  thinking: { radius: 0.54, wave: 0.1, turbulence: 0.17, scatter: 0.12, speed: 1.65, response: 8.4 },
  speaking: { radius: 0.9, wave: 0.2, turbulence: 0.055, scatter: 0.55, speed: 0.58, response: 9.5 },
};

function createParticleField(count, seed, coreLayer = false) {
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scatter = new Float32Array(count);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let value = seed;
  const random = () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index + (random() - 0.5) * 0.2;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    const shellParticle = random() > (coreLayer ? 0.72 : 0.22);
    const radius = coreLayer
      ? shellParticle ? 0.38 + random() * 0.32 : 0.07 + random() * 0.42
      : shellParticle ? 0.76 + random() * 0.28 : 0.13 + random() * 0.68;
    const whiteMix = coreLayer ? 0.72 + random() * 0.28 : 0.14 + random() * 0.62;

    directions[offset] = x;
    directions[offset + 1] = y;
    directions[offset + 2] = z;
    positions[offset] = x * radius;
    positions[offset + 1] = y * radius;
    positions[offset + 2] = z * radius;
    colors[offset] = 0.32 + whiteMix * 0.68;
    colors[offset + 1] = 0.78 + whiteMix * 0.22;
    colors[offset + 2] = 1;
    radii[index] = radius;
    phases[index] = random() * Math.PI * 2;
    speeds[index] = 0.72 + random() * 0.72;
    scatter[index] = random() > 0.84 ? 0.3 + random() * 0.9 : 0;
  }

  return { positions, directions, colors, radii, phases, speeds, scatter, count, coreLayer };
}

function updateParticleField(object, field, time, delta, state) {
  if (!object?.geometry?.attributes?.position) return;
  const attribute = object.geometry.attributes.position;
  const positions = attribute.array;
  const profile = stateProfiles[state] ?? stateProfiles.idle;
  const interpolation = 1 - Math.exp(-delta * profile.response);
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const listening = state === "listening";
  const globalVoice = speaking ? Math.sin(time * 9.5) * 0.68 + Math.sin(time * 17.3) * 0.32 : 0;

  for (let index = 0; index < field.count; index += 1) {
    const offset = index * 3;
    const baseX = field.directions[offset];
    const baseY = field.directions[offset + 1];
    const baseZ = field.directions[offset + 2];
    const phase = field.phases[index];
    const spin = time * profile.speed * field.speeds[index] + baseY * (thinking ? 3.8 : 0.55) + phase * 0.035;
    const cosine = Math.cos(spin);
    const sine = Math.sin(spin);
    const rotatedX = baseX * cosine - baseZ * sine;
    const rotatedZ = baseX * sine + baseZ * cosine;
    const travellingWave = listening
      ? Math.sin(time * 4.2 + baseY * 9 + phase * 0.24)
      : thinking
        ? Math.sin(time * 8.4 + phase * 1.7)
        : speaking
          ? globalVoice + Math.sin(time * 12 + phase) * 0.26
          : Math.sin(time * 2.1 + phase) * 0.6;
    const speechScatter = speaking ? Math.max(0, globalVoice) * 0.46 + 0.15 : 1;
    const layerScale = field.coreLayer ? (thinking ? 0.86 : 0.72) : 1;
    const radius = Math.max(
      0.035,
      field.radii[index] * profile.radius * layerScale
        + travellingWave * profile.wave
        + field.scatter[index] * profile.scatter * speechScatter,
    );
    const turbulenceX = Math.sin(time * 6.2 + phase + baseY * 4) * profile.turbulence;
    const turbulenceY = Math.cos(time * 5.4 + phase * 1.3 + baseX * 3) * profile.turbulence;
    const turbulenceZ = Math.sin(time * 7.1 + phase * 0.8 + baseZ * 5) * profile.turbulence;
    const targetX = rotatedX * radius + turbulenceX;
    const targetY = baseY * radius + turbulenceY;
    const targetZ = rotatedZ * radius + turbulenceZ;

    positions[offset] += (targetX - positions[offset]) * interpolation;
    positions[offset + 1] += (targetY - positions[offset + 1]) * interpolation;
    positions[offset + 2] += (targetZ - positions[offset + 2]) * interpolation;
  }

  attribute.needsUpdate = true;
}

export default function JarvisCore3D({ state = "idle", position = [0, 0.8, 0], onActivate, onDoubleActivate }) {
  const cloud = useRef();
  const mainPoints = useRef();
  const corePoints = useRef();
  const mainField = useMemo(() => createParticleField(2200, 71), []);
  const coreField = useMemo(() => createParticleField(560, 127, true), []);
  const color = stateColors[state] ?? stateColors.idle;

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    updateParticleField(mainPoints.current, mainField, time, delta, state);
    updateParticleField(corePoints.current, coreField, time + 0.34, delta, state);
    if (cloud.current) {
      cloud.current.rotation.x = Math.sin(time * 0.19) * 0.075;
      cloud.current.rotation.y = Math.sin(time * 0.13) * 0.15;
    }
  });

  function activate(event) {
    event.stopPropagation();
    onActivate?.();
  }

  function doubleActivate(event) {
    event.stopPropagation();
    onDoubleActivate?.();
  }

  return (
    <group position={position} onClick={activate} onDoubleClick={doubleActivate}>
      <group ref={cloud}>
        <points ref={mainPoints}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[mainField.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[mainField.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial color={color} vertexColors size={state === "speaking" ? 0.044 : 0.038} sizeAttenuation transparent opacity={0.88} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
        <points ref={corePoints}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[coreField.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[coreField.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#f4ffff" vertexColors size={0.025} sizeAttenuation transparent opacity={0.96} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      </group>
      <pointLight color={color} intensity={state === "speaking" ? 3.1 : 2.25} distance={7} decay={2} />
      <mesh onClick={activate} onDoubleClick={doubleActivate}>
        <sphereGeometry args={[1.3, 20, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center position={[0, -1.48, 0]} distanceFactor={9} style={{ pointerEvents: "none" }}>
        <div className="core-nameplate">
          <strong>J.A.R.V.I.S.</strong>
          <span>{state.toUpperCase()}</span>
        </div>
      </Html>
    </group>
  );
}
