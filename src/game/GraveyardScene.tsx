import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Plane, Vector3 } from 'three';
import { colors } from '../theme';
import { Character, type ActorState } from './Character';
import { Splat as SplatMesh } from './Effects3D';
import { GRAVES, GRID_HALF_DEPTH, GRID_HALF_WIDTH, graveOf } from './graves';
import type { PopKind } from './protocol';
import { Scenery } from './Scenery';
import { SceneTimeProvider } from './sceneTime';
import './GraveyardScene.css';

// The graveyard both screens render. The phone gets a steep, tight camera
// and tappable graves; the garage door gets a low, wide, slowly drifting
// shot. Everything game-shaped (who is up, what got bonked) comes in as
// props, so the same scene serves the player and the broadcast.

export type SceneView = 'phone' | 'door';

export interface Actor {
  id: number;
  grave: number;
  kind: PopKind;
  state: ActorState;
}

export interface Splat {
  key: number;
  x: number;
  z: number;
}

export type LabelTone = 'good' | 'great' | 'bad' | 'meh';

// First line shouts ("BONK!"), the rest are details ("287ms", "+760")
export interface SceneLabel {
  key: string;
  grave: number;
  lines: string[];
  tone: LabelTone;
}

export interface GroundPoint {
  x: number;
  z: number;
}

// Where a grave lands on screen, as fractions of the canvas (0..1). The
// garage door aims its 2D lightning with it
export type GraveProjector = (grave: number) => { x: number; y: number };

interface GraveyardSceneProps {
  view: SceneView;
  actors: Actor[];
  splats: Splat[];
  labels: SceneLabel[];
  timeScale?: number;
  focusGrave?: number | null;
  onActorDrawn?: (id: number, at: number) => void;
  onActorDone?: (id: number) => void;
  onSplatDone?: (key: number) => void;
  // Return true when the tap bonked something; false lets it fall through
  // to the grave behind, then the grass
  onGraveTap?: (grave: number, at: number, ground: GroundPoint) => boolean;
  onGroundTap?: (at: number, ground: GroundPoint) => void;
  onFrame?: (now: number) => void;
  onProjector?: (project: GraveProjector) => void;
  children?: ReactNode;
}

const GROUND = new Plane(new Vector3(0, 1, 0), 0);

export function GraveyardScene(props: GraveyardSceneProps) {
  const { view, timeScale = 1 } = props;
  const fog = FOG[view];

  return (
    <Canvas flat dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: CAMERA[view].fov, near: 0.1, far: 80 }}>
      <color attach="background" args={[colors.sceneSky]} />
      <fog attach="fog" args={[colors.sceneSky, fog.near, fog.far]} />
      <SceneTimeProvider value={timeScale}>
        <CameraRig view={view} focusGrave={props.focusGrave ?? null} />
        <Lights />
        <Sky />
        <Ground onTap={props.onGroundTap} />

        <Suspense fallback={null}>
          <Scenery />
        </Suspense>

        {props.onGraveTap && <Hitboxes onTap={props.onGraveTap} />}

        {props.actors.map(a => (
          <Character
            key={a.id}
            kind={a.kind}
            state={a.state}
            position={[graveOf(a.grave).x, 0, graveOf(a.grave).z]}
            onDrawn={at => props.onActorDrawn?.(a.id, at)}
            onDone={() => props.onActorDone?.(a.id)}
          />
        ))}

        {props.splats.map(s => (
          <SplatMesh key={s.key} x={s.x} z={s.z} onDone={() => props.onSplatDone?.(s.key)} />
        ))}

        {props.labels.map(l => (
          <Html
            key={l.key}
            position={[graveOf(l.grave).x, 1.5, graveOf(l.grave).z]}
            center
            zIndexRange={[20, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className={`bonk-label ${l.tone}`}>
              {l.lines.map((line, i) => <span key={i}>{line}</span>)}
            </div>
          </Html>
        ))}

        {props.onFrame && <FrameHook onFrame={props.onFrame} />}
        {props.onProjector && <Projector onProjector={props.onProjector} />}
        {props.children}
      </SceneTimeProvider>
    </Canvas>
  );
}

// Fog is measured from the camera: the phone camera sits further back
const FOG: Record<SceneView, { near: number; far: number }> = {
  phone: { near: 12, far: 26 },
  door: { near: 8, far: 22 },
};

const CAMERA: Record<SceneView, { fov: number; elevation: number; target: Vector3 }> = {
  // Steep enough that no character hides the grave behind it
  phone: { fov: 50, elevation: (50 * Math.PI) / 180, target: new Vector3(0, 0.45, -0.35) },
  door: { fov: 42, elevation: (33 * Math.PI) / 180, target: new Vector3(0, 0.4, 0.3) },
};

const DOOR_DISTANCE = 6.9;
const DOOR_SWAY = 0.5;
const FIT_MARGIN = 1.08;
const CHARACTER_HEIGHT = 1.4;

// Replay close-up: the camera pushes in on one grave
const FOCUS_OFFSET = new Vector3(0, 1.5, 3.6);
const FOCUS_LOOK = new Vector3(0, 0.9, 0);
const FOCUS_EASE = 2.5; // per second

function CameraRig({ view, focusGrave }: { view: SceneView; focusGrave: number | null }) {
  const { camera, size } = useThree();
  const preset = CAMERA[view];

  // How far back the phone camera must sit for the whole grid to fit the
  // screen's width and height, whatever its shape
  const phoneDistance = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const halfV = (preset.fov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * aspect);

    const forWidth = GRID_HALF_WIDTH / Math.tan(halfH);
    const depth = 2 * GRID_HALF_DEPTH * Math.sin(preset.elevation) + CHARACTER_HEIGHT * Math.cos(preset.elevation);
    const forHeight = depth / 2 / Math.tan(halfV);
    return Math.max(forWidth, forHeight) * FIT_MARGIN;
  }, [size.width, size.height, preset]);

  const look = useMemo(() => new Vector3(), []);
  const goal = useMemo(() => new Vector3(), []);

  useFrame(({ clock }, delta) => {
    const distance = view === 'phone' ? phoneDistance : DOOR_DISTANCE;
    goal.set(0, Math.sin(preset.elevation) * distance, Math.cos(preset.elevation) * distance).add(preset.target);
    look.copy(preset.target);

    if (view === 'door') goal.x += Math.sin(clock.elapsedTime * 0.15) * DOOR_SWAY;

    if (focusGrave !== null) {
      const spot = graveOf(focusGrave);
      goal.set(spot.x, 0, spot.z).add(FOCUS_OFFSET);
      look.set(spot.x, 0, spot.z).add(FOCUS_LOOK);
    }

    // Ease toward the goal; the phone snaps (it must not drift mid-game)
    const ease = view === 'phone' ? 1 : Math.min(1, delta * FOCUS_EASE);
    camera.position.lerp(goal, ease);
    camera.lookAt(look);
  });

  return null;
}

function Lights() {
  return (
    <>
      <ambientLight color={colors.sceneMoonlight} intensity={0.5} />
      {/* Key light from the front so faces read; blue rim from behind */}
      <directionalLight position={[-4, 8, 6]} color={colors.sceneMoon} intensity={0.95} />
      <directionalLight position={[3, 4, -6]} color={colors.sceneMoonlight} intensity={0.8} />
    </>
  );
}

const STAR_COUNT = 160;

function Sky() {
  const stars = useMemo(() => {
    const points = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      points[i * 3] = (Math.random() - 0.5) * 70;
      points[i * 3 + 1] = 6 + Math.random() * 18;
      points[i * 3 + 2] = -18 - Math.random() * 12;
    }
    return points;
  }, []);

  return (
    <group>
      <mesh position={[-6, 8, -20]}>
        <sphereGeometry args={[1.6, 24, 16]} />
        <meshBasicMaterial color={colors.sceneMoon} fog={false} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial color={colors.sceneMoon} size={0.08} fog={false} />
      </points>
    </group>
  );
}

// Event time in performance.now() units. Event.timeStamp is when the touch
// happened, before any handler queueing; fall back if a browser reports
// something else (old engines used epoch milliseconds)
function eventTime(e: ThreeEvent<PointerEvent>): number {
  const now = performance.now();
  const stamp = e.nativeEvent.timeStamp;
  return stamp > 0 && stamp <= now && now - stamp < 1000 ? stamp : now;
}

function groundPoint(e: ThreeEvent<PointerEvent>): GroundPoint {
  const hit = e.ray.intersectPlane(GROUND, new Vector3()) ?? e.point;
  return { x: hit.x, z: hit.z };
}

function Ground({ onTap }: { onTap?: (at: number, ground: GroundPoint) => void }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={onTap ? e => { e.stopPropagation(); onTap(eventTime(e), groundPoint(e)); } : undefined}
    >
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color={colors.sceneGround} roughness={1} />
    </mesh>
  );
}

// One invisible box per grave, much bigger than the character in it, so a
// small finger anywhere near the right grave counts (the old game's tiny
// tummy-only hit area was its worst bug). Boxes overlap on screen: a tall
// box in front covers the mound behind it, so a tap only stops at a box
// whose grave actually had someone to bonk.
const HITBOX: [number, number, number] = [1.2, 1.8, 1.8];

function Hitboxes({ onTap }: { onTap: (grave: number, at: number, ground: GroundPoint) => boolean }) {
  return (
    <>
      {GRAVES.map((spot, i) => (
        <mesh
          key={i}
          position={[spot.x, HITBOX[1] / 2, spot.z + 0.1]}
          onPointerDown={e => { if (onTap(i, eventTime(e), groundPoint(e))) e.stopPropagation(); }}
        >
          <boxGeometry args={HITBOX} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// Head height above the grave: where a bolt should land
const STRIKE_HEIGHT = 1;

function Projector({ onProjector }: { onProjector: (project: GraveProjector) => void }) {
  const { camera } = useThree();

  useEffect(() => {
    const v = new Vector3();
    onProjector(grave => {
      const spot = graveOf(grave);
      v.set(spot.x, STRIKE_HEIGHT, spot.z).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    });
  }, [camera, onProjector]);

  return null;
}

function FrameHook({ onFrame }: { onFrame: (now: number) => void }) {
  useFrame(() => onFrame(performance.now()));
  return null;
}
