# TODOs

Gaps between `docs/PRD_2026_HALLOWEEN.md` and the current implementation,
plus known issues, bugs and TODO items.

## One week before Halloween

- [ ] Regenerate + print QR codes with real tokens, then `make deploy`
- [ ] October dress rehearsal (checklist in `docs/deployment.md`)

## Stats page

- [ ] No vote buttons on `/stats` (PRD places voting there; currently only on
      the `/` viewer controls)
- [ ] Game scores not shown (blocked on game persistence above)

## Admin (PRD 9)

- [ ] "Admin Badge" generation not implemented - check.. this might be implemented

## Hardening (PRD 8)

- [ ] No SSE connection cap (~100 planned)
- [ ] `ZombieHorde` has no 50-zombie hard cap; zombie state grows linearly
      with `currentCount`
- [ ] Vote dedupe is in-memory only - a refresh allows re-voting (PRD: opt-in
      per device)
- [ ] `sendToSubscribers` still sends synchronously - a slow-but-alive client
      (TCP backpressure) can stall the broadcast loop; needs per-client async
      sends if it ever bites

## Cleanup

- [ ] `package.json` still ships legacy `server.js` scripts (`dev:server`,
      `dev:all`, `server`, `start`)

## Docs

- [ ] PRD section 4 WebSocket protocol is stale (`game_action` etc.); the real
      protocol lives in `docs/api.md`
