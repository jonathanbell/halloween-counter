import { useGLTF } from '@react-three/drei';

// Kenney Graveyard Kit 5.0 (CC0, public/models/graveyard/License.txt).
// The GLBs share Textures/colormap.png, resolved relative to each file.
const MODEL_DIR = '/models/graveyard';

const MODELS = [
  'grave',
  'gravestone-round',
  'gravestone-cross',
  'gravestone-bevel',
  'gravestone-decorative',
  'gravestone-roof',
  'gravestone-broken',
  'gravestone-wide',
  'pine-crooked',
  'pine-fall-crooked',
  'iron-fence',
  'iron-fence-border-gate',
  'crypt-small',
  'pumpkin-carved',
  'lantern-candle',
  'lightpost-single',
  'rocks',
  'trunk',
] as const;

export type ModelName = (typeof MODELS)[number];

export const modelUrl = (name: ModelName) => `${MODEL_DIR}/${name}.glb`;

// Start fetching while the player types their initials
export function preloadScenery(): void {
  MODELS.forEach(name => useGLTF.preload(modelUrl(name)));
}
