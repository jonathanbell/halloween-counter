import { useCallback, useEffect, useRef, useState } from 'react';
import { GraveyardScene, type Actor, type GroundPoint, type SceneLabel, type Splat } from './GraveyardScene';
import { isDecoy, type DecoyKind, type PopKind } from './protocol';
import { DECOY_BANNERS } from './titles';
import { bonkLabel } from './labels';
import type { ActiveGame, PhonePhase, PhoneState } from './phoneReducer';
import { buzz, sfx } from './sfx';
import './PhoneGame.css';

// The player's screen during a game: runs the schedule on this phone's
// clock, turns taps into bonks or splats, and reports both to the server.
//
//   frame loop ── pop due? ──> actor rises ── first frame drawn ──> pop_shown
//   tap on grave ── actor up? ──yes──> bonk {id, ms}   (ms = tap - drawn)
//                             └─no───> splat + tap {x, z}

const LABEL_MS = 1100;
const BANNER_MS = 1300;
const GO_FLASH_MS = 600;
const BONK_BUZZ_MS = 30;
const DECOY_BUZZ_MS = 120;
const QUIT_ARMED_MS = 3000;

interface Bonked {
  grave: number;
  kind: PopKind;
  ms: number;
}

interface PhoneGameProps {
  game: ActiveGame;
  phase: PhonePhase;
  score: number;
  verdicts: PhoneState['verdicts'];
  now: number;
  onShown: (id: number) => void;
  onBonk: (id: number, ms: number) => void;
  onTap: (x: number, z: number) => void;
  onQuit: () => void;
}

export function PhoneGame({ game, phase, score, verdicts, now, onShown, onBonk, onTap, onQuit }: PhoneGameProps) {
  const [actors, setActors] = useState<Actor[]>([]);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [bonked, setBonked] = useState<Record<number, Bonked>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const activated = useRef(new Set<number>());
  const resolved = useRef(new Set<number>());
  const drawnAt = useRef(new Map<number, number>());
  const actorsRef = useRef<Actor[]>([]);
  const splatKey = useRef(0);
  actorsRef.current = actors;

  const playFrom = game.startedAt + game.countdownMs;
  const canTap = phase === 'playing' || phase === 'finishing';

  // Runs every frame: raise pops that are due, send up the ones nobody hit
  const onFrame = useCallback((t: number) => {
    const elapsed = t - playFrom;
    if (elapsed < 0) return;

    for (const pop of game.pops) {
      if (pop.atMs > elapsed || elapsed > game.durationMs) break;
      if (activated.current.has(pop.id)) continue;
      activated.current.add(pop.id);
      setActors(prev => [...prev, { id: pop.id, grave: pop.grave, kind: pop.kind, state: 'up' }]);
    }

    for (const [id, at] of drawnAt.current) {
      if (resolved.current.has(id) || t - at <= game.upMs) continue;
      resolved.current.add(id);
      setActors(prev => withState(prev, id, 'escaped'));
    }
  }, [game, playFrom]);

  const onActorDrawn = useCallback((id: number, at: number) => {
    drawnAt.current.set(id, at);
    onShown(id);
    sfx.boing();
  }, [onShown]);

  const onActorDone = useCallback((id: number) => {
    setActors(prev => prev.filter(a => a.id !== id));
  }, []);

  const splat = useCallback((ground: GroundPoint) => {
    const key = splatKey.current++;
    setSplats(prev => [...prev, { key, x: ground.x, z: ground.z }]);
    onTap(ground.x, ground.z);
    sfx.splat();
  }, [onTap]);

  // True when this grave had someone to bonk. False lets the tap carry on
  // to the grave behind and finally the grass, which splats
  const onGraveTap = useCallback((grave: number, at: number): boolean => {
    if (!canTap) return false;

    const actor = actorsRef.current.find(a =>
      a.grave === grave && a.state === 'up' && drawnAt.current.has(a.id) && !resolved.current.has(a.id));
    if (!actor) return false;

    resolved.current.add(actor.id);
    const ms = Math.max(0, Math.round(at - (drawnAt.current.get(actor.id) ?? at)));
    setActors(prev => withState(prev, actor.id, 'bonked'));
    onBonk(actor.id, ms);
    setBonked(prev => ({ ...prev, [actor.id]: { grave, kind: actor.kind, ms } }));
    window.setTimeout(() => setBonked(prev => without(prev, actor.id)), LABEL_MS);

    if (!isDecoy(actor.kind)) {
      sfx.bonk();
      if (actor.kind === 'golden') sfx.ding();
      buzz(BONK_BUZZ_MS);
      return true;
    }

    DECOY_SFX[actor.kind]();
    buzz(DECOY_BUZZ_MS);
    setBanner(DECOY_BANNERS[actor.kind]);
    window.setTimeout(() => setBanner(null), BANNER_MS);
    return true;
  }, [canTap, onBonk]);

  const onGroundTap = useCallback((_at: number, ground: GroundPoint) => {
    if (canTap) splat(ground);
  }, [canTap, splat]);

  const labels: SceneLabel[] = Object.entries(bonked).map(([id, b]) => {
    const verdict = verdicts[Number(id)];
    return { key: id, grave: b.grave, ...bonkLabel(b.kind, b.ms, verdict?.verdict, verdict?.points) };
  });

  return (
    <div className="phone-game">
      <GraveyardScene
        view="phone"
        actors={actors}
        splats={splats}
        labels={labels}
        onFrame={onFrame}
        onActorDrawn={onActorDrawn}
        onActorDone={onActorDone}
        onSplatDone={key => setSplats(prev => prev.filter(s => s.key !== key))}
        onGraveTap={onGraveTap}
        onGroundTap={onGroundTap}
      />

      <Hud initials={game.initials} score={score} secondsLeft={secondsLeft(game, now)} />
      <Countdown phase={phase} msToGo={playFrom - now} />
      {banner && <div className="phone-banner" key={banner}>{banner}</div>}
      {phase === 'finishing' && <div className="phone-overlay">TIME'S UP!</div>}
      {phase !== 'finishing' && <QuitButton onQuit={onQuit} />}
    </div>
  );
}

const withState = (actors: Actor[], id: number, state: Actor['state']) =>
  actors.map(a => (a.id === id ? { ...a, state } : a));

function without<T>(record: Record<number, T>, id: number): Record<number, T> {
  const next = { ...record };
  delete next[id];
  return next;
}

const DECOY_SFX: Record<DecoyKind, () => void> = {
  grandma: sfx.oof,
  cat: sfx.meow,
  kevin: sfx.hey,
};

function secondsLeft(game: ActiveGame, now: number): number {
  const elapsed = now - (game.startedAt + game.countdownMs);
  return Math.ceil(Math.max(0, Math.min(game.durationMs, game.durationMs - elapsed)) / 1000);
}

function Hud({ initials, score, secondsLeft }: { initials: string; score: number; secondsLeft: number }) {
  return (
    <div className="phone-hud">
      <span className="hud-initials">{initials}</span>
      <span className="hud-score readout">{score}</span>
      <span className="hud-clock">{secondsLeft}s</span>
    </div>
  );
}

// Small, dim and two taps deep, so a mashing kid can't end their own game:
// ✕ arms it as "End game?" for a few seconds, a second tap ends it
function QuitButton({ onQuit }: { onQuit: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), QUIT_ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      className={`phone-quit${armed ? ' armed' : ''}`}
      onClick={() => (armed ? onQuit() : setArmed(true))}
      aria-label={armed ? 'Tap again to end the game' : 'End game'}
    >
      {armed ? 'End game?' : '✕'}
    </button>
  );
}

// 3, 2, 1, BONK! with a beep per number
function Countdown({ phase, msToGo }: { phase: PhonePhase; msToGo: number }) {
  const number = Math.ceil(msToGo / 1000);
  const showGo = phase === 'playing' && msToGo > -GO_FLASH_MS;

  useEffect(() => {
    if (phase === 'countdown' && number > 0) sfx.tick();
  }, [phase, number]);

  useEffect(() => {
    if (phase === 'playing') sfx.go();
    if (phase === 'finishing') sfx.buzzer();
  }, [phase]);

  if (phase === 'countdown' && number > 0) {
    return <div className="phone-overlay" key={number}>{number}</div>;
  }
  if (showGo) return <div className="phone-overlay go">BONK!</div>;
  return null;
}
