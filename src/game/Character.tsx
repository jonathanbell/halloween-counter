import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, PointLight } from 'three';
import { colors } from '../theme';
import { BURIED_Y } from './graves';
import type { PopKind } from './protocol';
import { CandyBurst } from './Effects3D';
import { useTimeScale } from './sceneTime';

// The cast is built from boxes and spheres in code: the Kenney kit has no
// Grandma, cat or Kevin, and everyone should look like they belong together.
//
// Life of a character (seconds of scene time):
//
//   up:       rise 0.22 (overshoot) -> idle wobble until bonked / escaped
//   bonked:   zombie   squash 0.08 -> launch 0.7 -> twinkle 0.4   (Team Rocket)
//             grandma  spin 0.6 + candy burst -> sink 0.4
//             cat      flip 0.7, lands on its feet -> sink 0.35
//             kevin    mask flies off + candy spill 0.6 -> sink 0.35
//   escaped:  taunt wiggle 0.3 -> sink 0.3

export type ActorState = 'up' | 'bonked' | 'escaped';

// Bigger than life next to the Kenney headstones: these are tap targets
const CAST_SCALE = 1.3;

const RISE_S = 0.22;
const SQUASH_S = 0.08;
const LAUNCH_S = 0.7;
const TWINKLE_S = 0.4;
const DECOY_GAG_S = 0.6;
const CAT_FLIP_S = 0.7;
const TAUNT_S = 0.3;
const SINK_S = 0.35;

// Where a launched zombie vanishes, relative to its grave
const LAUNCH_END: [number, number, number] = [0.6, 6.5, -4];

const DONE_AT: Record<PopKind, Record<Exclude<ActorState, 'up'>, number>> = {
  zombie: { bonked: SQUASH_S + LAUNCH_S + TWINKLE_S, escaped: TAUNT_S + SINK_S },
  golden: { bonked: SQUASH_S + LAUNCH_S + TWINKLE_S, escaped: TAUNT_S + SINK_S },
  grandma: { bonked: DECOY_GAG_S + SINK_S, escaped: TAUNT_S + SINK_S },
  cat: { bonked: CAT_FLIP_S + SINK_S, escaped: TAUNT_S + SINK_S },
  kevin: { bonked: DECOY_GAG_S + SINK_S, escaped: TAUNT_S + SINK_S },
};

// Spring out of the grave and settle: overshoots ~10% before landing
function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface CharacterProps {
  kind: PopKind;
  state: ActorState;
  position: [number, number, number];
  onDrawn?: (at: number) => void;
  onDone?: () => void;
}

export function Character({ kind, state, position, onDrawn, onDone }: CharacterProps) {
  const timeScale = useTimeScale();
  const body = useRef<Group>(null);
  const twinkle = useRef<Mesh>(null);
  const mask = useRef<Group>(null);

  const phaseTime = useRef(0);
  const idleTime = useRef(0);
  const startY = useRef(BURIED_Y);
  const lastState = useRef<ActorState>(state);
  const drawn = useRef(false);
  const done = useRef(false);

  useFrame((_, delta) => {
    const g = body.current;
    if (!g) return;

    // Every state change restarts the clock from wherever the body is now,
    // so a bonk during the rise launches from mid-rise. Checked here, not
    // in an effect, so no frame runs the new state on the old clock
    if (lastState.current !== state) {
      lastState.current = state;
      phaseTime.current = 0;
      startY.current = g.position.y;
    }

    // The reaction clock starts on the first frame this character is drawn
    if (!drawn.current) {
      drawn.current = true;
      onDrawn?.(performance.now());
    }

    const step = delta * timeScale;
    phaseTime.current += step;
    idleTime.current += step;
    const t = phaseTime.current;

    if (state === 'up') animateUp(g, t, idleTime.current);
    if (state === 'escaped') animateEscape(g, t, startY.current);
    if (state === 'bonked') animateBonk(kind, g, t, startY.current, twinkle.current, mask.current);

    if (state !== 'up' && !done.current && t >= DONE_AT[kind][state]) {
      done.current = true;
      onDone?.();
    }
  });

  const dizzy = state === 'bonked';

  return (
    <group position={position}>
      <group ref={body} position={[0, BURIED_Y, 0]}>
        <group scale={CAST_SCALE}>
          {kind === 'zombie' && <Zombie dizzy={dizzy} />}
          {kind === 'golden' && <Zombie dizzy={dizzy} golden />}
          {kind === 'grandma' && <Grandma dizzy={dizzy} />}
          {kind === 'cat' && <Cat dizzy={dizzy} />}
          {kind === 'kevin' && <Kevin dizzy={dizzy} maskRef={mask} />}
        </group>
      </group>

      {(kind === 'zombie' || kind === 'golden') && (
        <mesh ref={twinkle} position={LAUNCH_END} visible={false}>
          <octahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color={colors.sceneGoogly} fog={false} />
        </mesh>
      )}

      {state === 'bonked' && kind === 'grandma' && <CandyBurst count={26} origin={[0, 0.55, 0.35]} />}
      {state === 'bonked' && kind === 'kevin' && <CandyBurst count={12} origin={[0.27, 0.4, 0.1]} />}
    </group>
  );
}

function animateUp(g: Group, t: number, idle: number) {
  const rise = clamp01(t / RISE_S);
  g.position.y = BURIED_Y + -BURIED_Y * easeOutBack(rise);

  // Idle: sway like something that has been dead a while
  g.rotation.set(0, Math.sin(idle * 1.7) * 0.15, Math.sin(idle * 5.5) * 0.07);
  g.scale.setScalar(1);
}

function animateEscape(g: Group, t: number, fromY: number) {
  if (t < TAUNT_S) {
    // Taunt: a fast wiggle at the player who was too slow
    g.position.y = fromY;
    g.rotation.z = Math.sin(t * 45) * 0.3;
    return;
  }

  const p = clamp01((t - TAUNT_S) / SINK_S);
  g.rotation.z = 0;
  g.position.y = fromY + (BURIED_Y - fromY) * p;
}

function animateBonk(kind: PopKind, g: Group, t: number, fromY: number, twinkle: Mesh | null, mask: Group | null) {
  if (kind === 'zombie' || kind === 'golden') return animateLaunch(g, t, fromY, twinkle);
  if (kind === 'cat') return animateCatFlip(g, t, fromY);
  return animateDecoyGag(kind, g, t, fromY, mask);
}

// Team Rocket: squash, then off into the night sky, spinning and shrinking,
// ending in a twinkle
function animateLaunch(g: Group, t: number, fromY: number, twinkle: Mesh | null) {
  if (t < SQUASH_S) {
    const p = t / SQUASH_S;
    g.scale.set(1 + 0.25 * p, 1 - 0.4 * p, 1 + 0.25 * p);
    g.position.y = fromY;
    return;
  }

  const p = clamp01((t - SQUASH_S) / LAUNCH_S);
  g.scale.setScalar(Math.max(0.01, 1 - 0.9 * p));
  g.position.set(LAUNCH_END[0] * p, fromY + (LAUNCH_END[1] - fromY) * (p * (2 - p)), LAUNCH_END[2] * p);
  g.rotation.set(p * 9, p * 4, p * 13);

  if (!twinkle) return;
  const tw = (t - SQUASH_S - LAUNCH_S) / TWINKLE_S;
  twinkle.visible = tw > 0 && tw < 1;
  g.visible = tw <= 0;
  if (twinkle.visible) {
    twinkle.scale.setScalar(Math.sin(tw * Math.PI));
    twinkle.rotation.set(0, tw * 6, tw * 3);
  }
}

// The cat goes up, does a full flip and lands on its feet. Of course it does
function animateCatFlip(g: Group, t: number, fromY: number) {
  if (t < CAT_FLIP_S) {
    const p = t / CAT_FLIP_S;
    g.position.y = fromY + Math.sin(p * Math.PI) * 2.2;
    g.rotation.set(-p * Math.PI * 2, 0, 0);
    return;
  }

  const p = clamp01((t - CAT_FLIP_S) / SINK_S);
  g.rotation.set(0, 0, 0);
  g.position.y = fromY + (BURIED_Y - fromY) * p;
}

// Grandma spins (bowl bursts, see CandyBurst); Kevin loses his mask
function animateDecoyGag(kind: PopKind, g: Group, t: number, fromY: number, mask: Group | null) {
  if (t < DECOY_GAG_S) {
    const p = t / DECOY_GAG_S;
    g.position.y = fromY;
    if (kind === 'grandma') g.rotation.set(0, p * Math.PI * 4, Math.sin(p * 30) * 0.1);
    if (kind === 'kevin') g.rotation.set(0, 0, Math.sin(p * 12) * 0.15);

    if (mask) {
      mask.position.set(0.3 * p, 1.02 + 2.4 * p - 2 * p * p, -0.02);
      mask.rotation.set(-0.5 - p * 8, p * 3, 0);
    }
    return;
  }

  const p = clamp01((t - DECOY_GAG_S) / SINK_S);
  g.position.y = fromY + (BURIED_Y - fromY) * p;
}

// --- The cast ---------------------------------------------------------------

interface PartProps {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  metal?: boolean;
}

function Part({ size, position, color, rotation, metal = false }: PartProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      {metal ? (
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.35} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.85} />
      )}
    </mesh>
  );
}

// Googly eye: the pupil rattles around, and spins after a bonk
function Googly({ position, radius, dizzy }: { position: [number, number, number]; radius: number; dizzy: boolean }) {
  const pupil = useRef<Mesh>(null);
  const seed = useRef(Math.random() * 100);
  const timeScale = useTimeScale();
  const time = useRef(0);

  useFrame((_, delta) => {
    if (!pupil.current) return;
    time.current += delta * timeScale;
    const t = time.current + seed.current;
    const r = radius * 0.4;

    const angle = dizzy ? t * 25 : Math.sin(t * 3.1) * 2 + Math.sin(t * 7.3);
    const reach = dizzy ? r : r * (0.4 + 0.3 * Math.sin(t * 5.7));
    pupil.current.position.set(Math.cos(angle) * reach, Math.sin(angle) * reach, radius * 0.75);
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshStandardMaterial color={colors.sceneGoogly} roughness={0.3} />
      </mesh>
      <mesh ref={pupil}>
        <sphereGeometry args={[radius * 0.48, 12, 10]} />
        <meshStandardMaterial color={colors.scenePupil} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Zombie({ dizzy, golden = false }: { dizzy: boolean; golden?: boolean }) {
  const skin = golden ? colors.gold : colors.sceneZombieSkin;
  const shirt = golden ? colors.gold : colors.sceneZombieShirt;
  const pants = golden ? colors.gold : colors.sceneZombiePants;
  const glow = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    if (glow.current) glow.current.intensity = 1.5 + Math.sin(clock.elapsedTime * 6) * 0.6;
  });

  return (
    <group>
      <Part size={[0.16, 0.34, 0.18]} position={[-0.11, 0.17, 0]} color={pants} metal={golden} />
      <Part size={[0.16, 0.34, 0.18]} position={[0.11, 0.17, 0]} color={pants} metal={golden} />
      <Part size={[0.46, 0.4, 0.26]} position={[0, 0.54, 0]} color={shirt} metal={golden} />

      {/* Arms straight out at whoever is holding the phone */}
      <Part size={[0.12, 0.12, 0.44]} position={[-0.29, 0.66, 0.17]} rotation={[0.15, 0, 0]} color={skin} metal={golden} />
      <Part size={[0.12, 0.12, 0.44]} position={[0.29, 0.66, 0.17]} rotation={[0.05, 0, 0]} color={skin} metal={golden} />

      <group position={[0, 0.95, 0]} rotation={[0, 0, 0.12]}>
        <Part size={[0.38, 0.38, 0.38]} position={[0, 0, 0]} color={skin} metal={golden} />
        <Part size={[0.18, 0.05, 0.02]} position={[0, -0.09, 0.195]} color={colors.sceneMouth} />

        {golden ? (
          // Too cool for googly eyes
          <>
            <Part size={[0.14, 0.08, 0.03]} position={[-0.09, 0.04, 0.2]} color={colors.scenePupil} />
            <Part size={[0.14, 0.08, 0.03]} position={[0.09, 0.04, 0.2]} color={colors.scenePupil} />
            <Part size={[0.06, 0.02, 0.03]} position={[0, 0.06, 0.2]} color={colors.scenePupil} />
          </>
        ) : (
          <>
            <Googly position={[-0.09, 0.04, 0.19]} radius={0.085} dizzy={dizzy} />
            <Googly position={[0.1, 0.05, 0.19]} radius={0.07} dizzy={dizzy} />
          </>
        )}
      </group>

      {golden && <pointLight ref={glow} position={[0, 0.8, 0.6]} color={colors.gold} distance={2.5} />}
    </group>
  );
}

function Grandma({ dizzy }: { dizzy: boolean }) {
  return (
    <group>
      <Part size={[0.46, 0.6, 0.32]} position={[0, 0.3, 0]} color={colors.sceneGrandmaCardigan} />
      <Part size={[0.12, 0.12, 0.3]} position={[-0.2, 0.48, 0.2]} color={colors.sceneGrandmaCardigan} />
      <Part size={[0.12, 0.12, 0.3]} position={[0.2, 0.48, 0.2]} color={colors.sceneGrandmaCardigan} />

      {/* The candy bowl she was bringing to the door */}
      <mesh position={[0, 0.5, 0.36]}>
        <cylinderGeometry args={[0.2, 0.12, 0.12, 16]} />
        <meshStandardMaterial color={colors.accent} roughness={0.6} />
      </mesh>
      {[colors.gold, colors.vote, colors.success, colors.danger].map((c, i) => (
        <mesh key={c} position={[-0.09 + i * 0.06, 0.58, 0.36 + (i % 2) * 0.04]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}

      <group position={[0, 0.82, 0]}>
        <mesh>
          <sphereGeometry args={[0.21, 16, 12]} />
          <meshStandardMaterial color={colors.sceneGrandmaSkin} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.07, -0.04]}>
          <sphereGeometry args={[0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={colors.sceneGrandmaHair} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.25, -0.08]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshStandardMaterial color={colors.sceneGrandmaHair} roughness={0.9} />
        </mesh>

        <Googly position={[-0.08, 0.02, 0.17]} radius={0.065} dizzy={dizzy} />
        <Googly position={[0.08, 0.02, 0.17]} radius={0.065} dizzy={dizzy} />
        {[-0.08, 0.08].map(x => (
          <mesh key={x} position={[x, 0.02, 0.225]}>
            <torusGeometry args={[0.075, 0.012, 8, 20]} />
            <meshStandardMaterial color={colors.scenePupil} />
          </mesh>
        ))}
        <Part size={[0.1, 0.03, 0.02]} position={[0, -0.1, 0.2]} color={colors.sceneMouth} />
      </group>
    </group>
  );
}

function Cat({ dizzy }: { dizzy: boolean }) {
  return (
    <group>
      <Part size={[0.3, 0.32, 0.42]} position={[0, 0.16, -0.05]} color={colors.sceneCat} />
      <Part size={[0.06, 0.42, 0.06]} position={[0.13, 0.36, -0.25]} rotation={[-0.3, 0, 0.25]} color={colors.sceneCat} />

      <group position={[0, 0.46, 0.1]}>
        <Part size={[0.34, 0.28, 0.28]} position={[0, 0, 0]} color={colors.sceneCat} />
        {[-0.1, 0.1].map(x => (
          <mesh key={x} position={[x, 0.19, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.07, 0.14, 4]} />
            <meshStandardMaterial color={colors.sceneCat} />
          </mesh>
        ))}
        <Googly position={[-0.075, 0.03, 0.145]} radius={0.07} dizzy={dizzy} />
        <Googly position={[0.075, 0.03, 0.145]} radius={0.07} dizzy={dizzy} />
        <Part size={[0.05, 0.035, 0.02]} position={[0, -0.05, 0.145]} color={colors.sceneCatNose} />
      </group>
    </group>
  );
}

// Kevin: a kid in a zombie costume. The green mask is pushed up on his head,
// and the white sneakers and pumpkin bucket give him away
function Kevin({ dizzy, maskRef }: { dizzy: boolean; maskRef: React.RefObject<Group | null> }) {
  return (
    <group>
      <Part size={[0.15, 0.07, 0.22]} position={[-0.08, 0.035, 0.03]} color={colors.sceneSneaker} />
      <Part size={[0.15, 0.07, 0.22]} position={[0.08, 0.035, 0.03]} color={colors.sceneSneaker} />
      <Part size={[0.13, 0.26, 0.15]} position={[-0.08, 0.2, 0]} color={colors.sceneKevinJeans} />
      <Part size={[0.13, 0.26, 0.15]} position={[0.08, 0.2, 0]} color={colors.sceneKevinJeans} />
      <Part size={[0.38, 0.34, 0.22]} position={[0, 0.5, 0]} color={colors.sceneKevinHoodie} />
      <Part size={[0.1, 0.3, 0.1]} position={[0.24, 0.45, 0.02]} rotation={[0, 0, 0.15]} color={colors.sceneKevinHoodie} />

      {/* Trick-or-treat bucket */}
      <mesh position={[0.28, 0.3, 0.06]}>
        <cylinderGeometry args={[0.11, 0.09, 0.15, 14]} />
        <meshStandardMaterial color={colors.accent} roughness={0.6} />
      </mesh>

      <group position={[0, 0.83, 0]}>
        <Part size={[0.32, 0.32, 0.32]} position={[0, 0, 0]} color={colors.sceneKevinSkin} />
        <Googly position={[-0.075, 0.03, 0.165]} radius={0.07} dizzy={dizzy} />
        <Googly position={[0.075, 0.03, 0.165]} radius={0.07} dizzy={dizzy} />
        <Part size={[0.12, 0.03, 0.02]} position={[0, -0.08, 0.165]} color={colors.sceneMouth} />
      </group>

      <group ref={maskRef} position={[0, 1.02, -0.02]} rotation={[-0.5, 0, 0]}>
        <Part size={[0.34, 0.2, 0.34]} position={[0, 0, 0]} color={colors.sceneZombieSkin} />
        <Part size={[0.07, 0.05, 0.02]} position={[-0.08, 0.02, 0.17]} color={colors.scenePupil} />
        <Part size={[0.07, 0.05, 0.02]} position={[0.08, 0.02, 0.17]} color={colors.scenePupil} />
      </group>
    </group>
  );
}
