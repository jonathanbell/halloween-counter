import { Html } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { colors } from '../theme';
import { Character } from './Character';
import { isDecoy, type PopKind } from './protocol';
import { sfx, unlockAudio } from './sfx';
import './CastLineup.css';
import './GraveyardScene.css';

// The start screen's "who to bonk" poster, drawn with the game's own 3D
// cast. Emoji look nothing like our Grandma, cat or Kevin; this does.
//
//   🔨 BONK THESE!
//        ┌─────────────────┐
//        │ [zombie][golden]│      two slots wide, centred
//        └─────────────────┘
//          Zombie  Golden
//
//   🚫 DON'T BONK THESE!
//   ┌──────────────────────────┐
//   │ [grandma] [cat] [kevin]  │
//   └──────────────────────────┘
//     Grandma  The cat  Kevin
//
// Tapping a character is practice: it takes its in-game bonk (sound, gag,
// BONK! or OOPS!), then climbs back out. Nothing is scored or sent.

export interface CastMember {
  kind: PopKind;
  name: string;
  note?: string;
}

export type CastTone = 'bonk' | 'nope';

// A slot is a third of the card, so two zombies draw the same size as
// three decoys. World units
const SLOTS = 3;
const SLOT_WIDTH = 1.1;
const STAGE_HEIGHT = 1.8;

// A little above, looking down at chest height, like the phone's camera
const CAMERA_POSITION: [number, number, number] = [0, 2.6, 10];
const LOOK_AT_Y = 0.75;

// Tap target per slot, and where the practice label floats
const HITBOX_HEIGHT = 1.6;
const LABEL_Y = 1.1;

// The sounds the game plays for each bonk
const BONK_SFX: Record<PopKind, () => void> = {
  zombie: sfx.bonk,
  golden: () => { sfx.bonk(); sfx.ding(); },
  grandma: sfx.oof,
  cat: sfx.meow,
  kevin: sfx.hey,
};

interface Practice {
  bonked: boolean;
  round: number; // bumped to remount the character, so it rises again
}

interface CastLineupProps {
  heading: string;
  tone: CastTone;
  cast: CastMember[];
}

export function CastLineup({ heading, tone, cast }: CastLineupProps) {
  const stageWidth = cast.length * SLOT_WIDTH;
  const slotX = (i: number) => (i - (cast.length - 1) / 2) * SLOT_WIDTH;
  const stageStyle = { width: `${(100 * cast.length) / SLOTS}%`, aspectRatio: `${stageWidth} / ${STAGE_HEIGHT}` };
  const [practice, setPractice] = useState<Practice[]>(() => cast.map(() => ({ bonked: false, round: 0 })));

  const bonk = (i: number) => {
    if (practice[i].bonked) return;
    BONK_SFX[cast[i].kind]();
    setPractice(prev => prev.map((p, j) => (j === i ? { ...p, bonked: true } : p)));
  };

  const climbBack = (i: number) => {
    setPractice(prev => prev.map((p, j) => (j === i ? { bonked: false, round: p.round + 1 } : p)));
  };

  return (
    <section className={`cast ${tone}`} aria-label={heading}>
      <h3 className="cast-heading">{heading}</h3>

      <div className="cast-stage" style={stageStyle} aria-hidden>
        <Canvas flat orthographic dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: CAMERA_POSITION }}>
          <color attach="background" args={[colors.sceneSky]} />
          <FitWidth width={stageWidth} />

          {/* Same rig as the graveyard: key light from the front, blue rim */}
          <ambientLight color={colors.sceneMoonlight} intensity={0.5} />
          <directionalLight position={[-4, 8, 6]} color={colors.sceneMoon} intensity={0.95} />
          <directionalLight position={[3, 4, -6]} color={colors.sceneMoonlight} intensity={0.8} />

          {/* Dirt they climb out of; hides them while they are buried */}
          <mesh position={[0, -1, 0]}>
            <boxGeometry args={[stageWidth + 2, 2, 1.6]} />
            <meshStandardMaterial color={colors.sceneGround} roughness={1} />
          </mesh>

          {cast.map((c, i) => (
            <group key={c.kind} position={[slotX(i), 0, 0]}>
              <Character
                key={practice[i].round}
                kind={c.kind}
                state={practice[i].bonked ? 'bonked' : 'up'}
                position={[0, 0, 0]}
                onDrawn={sfx.boing}
                onDone={() => climbBack(i)}
              />

              {/* Audio unlocks on the press so the sound is ready by the
                  click. A click, not a press: a scroll never bonks */}
              <mesh position={[0, HITBOX_HEIGHT / 2, 0]} onPointerDown={unlockAudio} onClick={() => bonk(i)}>
                <boxGeometry args={[SLOT_WIDTH, HITBOX_HEIGHT, 1]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>

              {practice[i].bonked && <PracticeLabel kind={c.kind} />}
            </group>
          ))}
        </Canvas>
      </div>

      <ul className="cast-names">
        {cast.map(c => (
          <li key={c.kind} style={{ width: `${100 / SLOTS}%` }}>
            {c.name}
            {c.note && <small>{c.note}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The game's floating label: BONK! for a zombie, OOPS! for a decoy
function PracticeLabel({ kind }: { kind: PopKind }) {
  const decoy = isDecoy(kind);

  return (
    <Html position={[0, LABEL_Y, 0.5]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`bonk-label ${decoy ? 'bad' : 'great'}`}>
        <span>{decoy ? 'OOPS!' : 'BONK!'}</span>
      </div>
    </Html>
  );
}

// Orthographic and fitted to the stage's width, so character i sits right
// above name i, whatever the phone's width
function FitWidth({ width }: { width: number }) {
  const { camera, size } = useThree();

  useEffect(() => {
    camera.zoom = size.width / width;
    camera.lookAt(0, LOOK_AT_Y, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, width]);

  return null;
}
