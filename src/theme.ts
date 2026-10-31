// Design tokens for JS-side consumers - Recharts props and three.js
// materials cannot read CSS variables. public/theme.css mirrors these; a test
// guards the parity. Palette lifted from the projection screen.

export const colors = {
  accent: '#ff6b35', // pumpkin orange - buttons, borders, highlights
  accentGlow: 'rgba(255, 107, 53, 0.5)',
  gold: '#ffd700', // counter digits, scores
  bg: '#0a0a14', // deep dark page background
  bg2: '#161226', // page gradient end
  panel: '#1a1a1a', // digit wells, progress trough, chart tooltip
  panelHi: '#2d2d2d',
  surface: 'rgba(255, 255, 255, 0.08)', // cards, panels
  border: 'rgba(255, 255, 255, 0.25)',
  hairline: 'rgba(255, 255, 255, 0.1)', // grid lines
  hairlineStrong: 'rgba(255, 255, 255, 0.18)',
  text: '#f5f0e6', // bone white
  textDim: 'rgba(245, 240, 230, 0.6)',
  success: '#4caf50',
  warning: '#fbbf24',
  danger: '#dc2626',
  alarm: '#ff0000', // out-of-candy strikethrough + banner
  vote: '#9b59b6', // purple - vote widgets only
  wood: '#8b4513', // progress trough

  // Graveyard Bonk scene - three.js materials and lights cannot read CSS
  // variables, so the whole cast and set is listed here
  sceneSky: '#0b0d1f', // clear colour + fog
  sceneGround: '#1d2b1f',
  sceneMoon: '#fff3c4',
  sceneMoonlight: '#9fb4ff', // ambient + rim light
  sceneLantern: '#ffb35c', // warm point lights
  sceneSlime: '#8cff5a', // missed-tap splats
  sceneGoogly: '#ffffff', // eye whites
  scenePupil: '#111111',
  sceneZombieSkin: '#86b56a',
  sceneZombieShirt: '#56698f',
  sceneZombiePants: '#3b3346',
  sceneMouth: '#3a1020',
  sceneGrandmaSkin: '#f1c7a1',
  sceneGrandmaHair: '#d8d8e0',
  sceneGrandmaCardigan: '#c58fd8',
  sceneCat: '#1a1a22',
  sceneCatNose: '#ff8fb1',
  sceneKevinSkin: '#e8b48a',
  sceneKevinHoodie: '#3d7bd9',
  sceneKevinJeans: '#2f4a7a',
  sceneSneaker: '#f2f2f2',
} as const;

export const fonts = {
  display: "'Creepster', cursive",
  counter: "'Digital-7', monospace",
  body: "system-ui, Avenir, Helvetica, Arial, sans-serif",
  mono: "monospace",
} as const;
