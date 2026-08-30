# TODO

Gaps between `docs/PRD_2026_HALLOWEEN.md` and the current implementation,
plus known deployment blockers.

## Deployment blockers

- [ ] `Game.tsx` hardcodes `ws://localhost:8080/ws/game` - derive from
      `location.host` (`wss:` when served over https) so the game works
      off-localhost
- [ ] `useCounter.ts` falls back to the literal `dev-admin-token` in source
- [ ] Dockerfile sets `ADMIN_TOKEN=` / `SETTINGS_TOKEN=` to empty strings; an
      empty `?token=` param would then match. Drop the defaults or fail fast
      on blank tokens at startup

## Game (PRD 5-6)

- [ ] LIGHTNING difficulty has no "big zombie" visual on the projection -
      include difficulty (or a scale factor) in the `zombie_spawned` SSE
      payload
- [ ] Zombie color variety via `filter: hue-rotate()` per zombie id
- [ ] Game results are never persisted - `events` has `game_session_id` and
      `score` columns but the CHECK constraint has no game event type (needs
      a migration)
- [ ] Hit zombies are not broadcast over SSE, so projection sprites linger
      until their local 3s lifetime expires
- [ ] Phone controller lacks the "waiting for game" countdown state

## Stats page (PRD 5)

- [ ] No vote buttons on `/stats` (PRD places voting there; currently only on
      the `/` viewer controls)
- [ ] Game scores not shown (blocked on game persistence above)

## Admin (PRD 9)

- [ ] `settings.html` has no token-rotation UI (`/api/tokens/rotate` exists)
- [ ] "Admin Badge" generation not implemented

## Hardening (PRD 8)

- [ ] No SSE connection cap (~100 planned)
- [ ] `ZombieHorde` has no 50-zombie hard cap; zombie state grows linearly
      with `currentCount`
- [ ] Vote dedupe is in-memory only - a refresh allows re-voting (PRD: opt-in
      per device)

## Docs

- [ ] PRD section 4 WebSocket protocol is stale (`game_action` etc.); the real
      protocol lives in `AGENTS.md` section 4
- [ ] `docs/architecture.md` is referenced by README but does not exist
