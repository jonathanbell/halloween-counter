import { Clone, useGLTF } from '@react-three/drei';
import { colors } from '../theme';
import { GRAVES, HEADSTONE_OFFSET_Z } from './graves';
import { modelUrl, type ModelName } from './models';

// One headstone style per grave, so the grid reads as a real graveyard
const HEADSTONES: ModelName[] = [
  'gravestone-round', 'gravestone-cross', 'gravestone-bevel',
  'gravestone-decorative', 'gravestone-roof', 'gravestone-wide',
  'gravestone-broken', 'gravestone-round', 'gravestone-bevel',
];

// Fixed, slightly crooked tilts: nothing in a graveyard stands straight
const HEADSTONE_TILT = [0.08, -0.12, 0.04, -0.06, 0.1, -0.03, 0.14, -0.09, 0.05];

interface Prop {
  model: ModelName;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}

// The set around the 3x3 grid. Sides are cropped on a portrait phone and
// fully visible on the garage door
const SET: Prop[] = [
  { model: 'crypt-small', position: [-3.1, 0, -5], rotation: 0.35, scale: 1.5 },
  { model: 'pine-crooked', position: [3.4, 0, -4.6], scale: 1.4 },
  { model: 'pine-crooked', position: [-4.7, 0, -2.2], rotation: 1.2, scale: 1.2 },
  { model: 'pine-crooked', position: [2.8, 0, -7], rotation: 2.1, scale: 1.7 },
  { model: 'pine-fall-crooked', position: [4.4, 0, 0.9], rotation: -0.6, scale: 1.1 },
  { model: 'pine-fall-crooked', position: [-4.3, 0, 2.4], rotation: 0.9 },
  { model: 'lightpost-single', position: [2.4, 0, -3.1], rotation: -0.3 },
  { model: 'pumpkin-carved', position: [-2.15, 0, 2.6], rotation: 0.5 },
  { model: 'pumpkin-carved', position: [2.25, 0, -1.1], rotation: -0.7, scale: 0.8 },
  { model: 'lantern-candle', position: [2.15, 0, 1.5] },
  { model: 'lantern-candle', position: [-2.2, 0, -0.7] },
  { model: 'rocks', position: [3.7, 0, 3.3], rotation: 0.4 },
  { model: 'rocks', position: [-3.5, 0, -3.9], rotation: 2 },
  { model: 'trunk', position: [3, 0, 2.3], rotation: 1.1 },
];

// Fence along the back with a gate in the middle
const FENCE_Z = -3.3;
const FENCE_SEGMENTS = 9;
const FENCE: Prop[] = Array.from({ length: FENCE_SEGMENTS }, (_, i) => {
  const x = i - (FENCE_SEGMENTS - 1) / 2;
  return { model: x === 0 ? 'iron-fence-border-gate' : 'iron-fence', position: [x, 0, FENCE_Z] };
});

// Warm glow from the lanterns and the lamp post
const LANTERN_LIGHTS: Array<[number, number, number]> = [
  [2.15, 0.35, 1.5],
  [-2.2, 0.35, -0.7],
  [2.4, 1.2, -3.1],
];

function Model({ model, position, rotation = 0, scale = 1 }: Prop) {
  const { scene } = useGLTF(modelUrl(model));
  return <Clone object={scene} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

export function Scenery() {
  return (
    <group>
      {GRAVES.map((spot, i) => (
        <group key={i} position={[spot.x, 0, spot.z]}>
          <Model model="grave" position={[0, 0, 0]} />
          <Model model={HEADSTONES[i]} position={[0, 0, HEADSTONE_OFFSET_Z]} rotation={HEADSTONE_TILT[i]} />
        </group>
      ))}

      {[...SET, ...FENCE].map((prop, i) => <Model key={i} {...prop} />)}

      {LANTERN_LIGHTS.map((p, i) => (
        <pointLight key={i} position={p} color={colors.sceneLantern} intensity={2.2} distance={3.5} decay={1.6} />
      ))}
    </group>
  );
}
