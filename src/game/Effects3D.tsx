import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { colors } from '../theme';
import { useTimeScale } from './sceneTime';

const GRAVITY = 9.8;

// Candy colours borrowed from the UI palette
const CANDY_COLORS = [colors.accent, colors.gold, colors.vote, colors.success, colors.danger];

interface Particle {
  velocity: [number, number, number];
  spin: number;
  color: string;
  size: number;
}

const BURST_LIFE_S = 1.4;

// Candy flying out of Grandma's bowl or Kevin's bucket
export function CandyBurst({ count = 22, origin = [0, 0.5, 0.3] as [number, number, number] }) {
  const timeScale = useTimeScale();
  const refs = useRef<Array<Mesh | null>>([]);
  const age = useRef(0);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, () => ({
        velocity: [(Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.2) * 3],
        spin: (Math.random() - 0.5) * 20,
        color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
        size: 0.06 + Math.random() * 0.05,
      })),
    [count],
  );

  useFrame((_, delta) => {
    age.current += delta * timeScale;
    const t = age.current;

    particles.forEach((p, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      if (t > BURST_LIFE_S) {
        mesh.visible = false;
        return;
      }

      // Plain ballistic arc; candy that hits the grass stops there
      const y = Math.max(0.03, origin[1] + p.velocity[1] * t - 0.5 * GRAVITY * t * t);
      mesh.position.set(origin[0] + p.velocity[0] * t, y, origin[2] + p.velocity[2] * t);
      mesh.rotation.set(p.spin * t, p.spin * t * 0.7, 0);
    });
  });

  return (
    <group>
      {particles.map((p, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el; }} position={origin}>
          <boxGeometry args={[p.size, p.size, p.size * 1.6]} />
          <meshStandardMaterial color={p.color} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const SPLAT_POP_S = 0.08;
const SPLAT_LIFE_S = 1.2;

// Slime on the grass where a tap hit nothing
export function Splat({ x, z, onDone }: { x: number; z: number; onDone?: () => void }) {
  const timeScale = useTimeScale();
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const age = useRef(0);
  const done = useRef(false);
  const spin = useMemo(() => Math.random() * Math.PI, []);

  useFrame((_, delta) => {
    age.current += delta * timeScale;
    const t = age.current;
    if (!mesh.current || !material.current) return;

    mesh.current.scale.setScalar(Math.min(1, t / SPLAT_POP_S));
    material.current.opacity = Math.max(0, 1 - t / SPLAT_LIFE_S);

    if (t >= SPLAT_LIFE_S && !done.current) {
      done.current = true;
      onDone?.();
    }
  });

  return (
    <mesh ref={mesh} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, spin]}>
      <circleGeometry args={[0.3, 7]} />
      <meshBasicMaterial ref={material} color={colors.sceneSlime} transparent depthWrite={false} />
    </mesh>
  );
}
