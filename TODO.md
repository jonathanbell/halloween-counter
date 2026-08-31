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
- [x] DNS A record: resolves to francesco (5.78.90.6)
- [x] One-time server setup on the box: `candy` DB + role, `HALLOWEEN_*`
      secrets, compose service block, Caddy site block - all in place
- [x] First deploy shipped and verified on 2026-08-31
      (`candy-counter:2026-test-1`): Flyway V1-V5 on the host Postgres,
      HTTPS cert issued, SSE heartbeat streams through Caddy, WS upgrade
      reaches the app, no leaky headers, app at ~290 MiB of its 768 MiB cap.
      Two first-boot bugs found and fixed along the way: missing
      `flyway-database-postgresql`, and `baseline-on-migrate: true`
      silently skipping V1 because the box's `template1` seeds new
      databases with orphan sequences (now `false`; fails loudly instead)
- [ ] Tell the box's admin that `template1` is dirty (six orphan
      `*_id_seq` sequences) - every future `CREATE DATABASE` inherits them
- [ ] Clear the 5 leftover 2026 effect events before Halloween (they do not
      affect the counter or stats, which only read increment/vote rows, but
      the night should start from an empty table)
- [x] Server audit 2026-08-31: container healthy on `unless-stopped` with a
      768 MiB cap and no published ports; secrets 0600 with real 48-char
      values (not the weak defaults); `candy` role non-superuser, connlimit
      20, CONNECT revoked from PUBLIC; Flyway V1-V5 all `success=true`; TLS
      valid to Nov 29; Docker enabled at boot; 1.1 GiB RAM and 30 GB disk
      free. Found and fixed: `/game` and `/stats` 404'd in production
- [ ] Regenerate + print QR codes with real tokens, then `make deploy`
- [ ] Switch to git-sha tags after the test period (`make deploy` with no
      TAG override does this automatically)
- [ ] October dress rehearsal (checklist in `docs/deployment.md`)

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
