# TODO

Gaps between `docs/PRD_2026_HALLOWEEN.md` and the current implementation,
plus known deployment blockers.

## Deployment blockers

- [ ] `useCounter.ts` falls back to the literal `dev-admin-token` in source

## Cloud rollout (ADR-013, docs/deployment.md)

- [x] App could never boot against real Postgres: Flyway 10 needs the
      `flyway-database-postgresql` artifact (H2 support is in core, so local
      dev and tests never caught it). Found by the local compose smoke test
      on 2026-08-31, fixed in `pom.xml`
- [x] Image builds for amd64 and the full compose stack verified locally:
      Flyway V1-V5 migrate on Postgres 16, health/state/auth/increment/stats
      endpoints all correct (2025 seed intact)
- [ ] DNS A record: `halloween-counter.jonathanbell.ca` -> the cloud box
- [ ] Box prep: Docker + ufw (80/443/SSH), copy `deploy/`, fill `deploy/.env`
- [ ] First deploy: build (`--platform linux/amd64`), ship, `compose up -d`,
      verify `/actuator/health` over HTTPS
- [ ] Regenerate + print QR codes for the new domain, rebundle, re-ship
- [ ] Backup cron on the box (`deploy/backup.sh`)
- [ ] October dress rehearsal (checklist at the bottom of
      `docs/deployment.md`)

## Bugs (code review, 2026-08-30)

- [x] Tapping an expired zombie double-penalizes - fixed: `processZombieHit`
      now atomically claims the zombie (`remove`, not `get`), so the resolver
      cannot charge it a second miss; expired taps also broadcast
      `zombie_missed` so the projection sprite clears
- [x] Up to 3 SSE connections per browser - fixed: `useSSE` now backs every
      hook instance with one shared, ref-counted `EventSource` per URL
- [x] Stale `initialCandyCount` on connected clients - fixed: count SSE
      messages now carry `initialCandyCount`; `useCounter` and `remote.html`
      pick it up
- [x] Projection refresh mid-game misses the overlay - fixed: `/api/state`
      now returns `gameActive` (from the in-memory session) and `useCounter`
      seeds from it. The `settings.active_game_session` column remains unused
- [x] `POST /api/counter` 500s on missing `year` - fixed with `@NotNull`
- [ ] `POST /api/counter` still accepts arbitrary years, polluting historical
      data (no range validation)
- [x] Failed increment left the optimistic +1 on screen - fixed: the revert
      is now symmetric and does not depend on prior SSE messages
- [x] Spacebar/Ctrl+R/Ctrl+F shortcuts bound for every visitor - fixed:
      gated on `?projection`
- [x] Projection `StatsDisplay` synthesized fake timestamps - fixed:
      `useStats` seeds from the real `/api/stats` histogram and appends live
      increments (large count jumps are treated as resyncs, not visitors)
- [x] `GameService` executor never shut down - fixed with `@PreDestroy`

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
- [x] No SSE heartbeat - fixed: comment frames every 15s keep proxied
      connections alive, and dead emitters are pruned on the first failed
      send instead of lingering
- [ ] `sendToSubscribers` still sends synchronously - a slow-but-alive client
      (TCP backpressure) can stall the broadcast loop; needs per-client async
      sends if it ever bites

## Cleanup

- [ ] 12+ stale hashed bundles in `src/main/resources/static/assets/` -
      `npm run bundle` now replaces the directory wholesale, but it still
      needs one successful run (blocked on `npm install`; `recharts` is
      missing from `node_modules`)
- [ ] `package.json` still ships legacy `server.js` scripts (`dev:server`,
      `dev:all`, `server`, `start`)

## Docs

- [ ] PRD section 4 WebSocket protocol is stale (`game_action` etc.); the real
      protocol lives in `docs/api.md`
