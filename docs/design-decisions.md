# Architecture Decision Record (ADR): Halloween 2026

Why we built it this way, and in what sequence it was decided.

## ADR-001: Backend rewrite (Node → Spring Boot)

The original counter was a Vite/React frontend + Node `server.js`. The user requested a full rewrite to Spring Boot in a Docker image. The JVM was chosen for official Postgres driver support, Uniform DI, WebSocket, SSE, and bundled runtime (JAR). This replaced connectivity with a uniform, lightweight API the frontend updates through.

**Decision:** Full re-write to Spring Boot. Frontend kept, backend replaced.

## ADR-002: SSE for counter+projection, WebSocket for game

For the projection side, Server-Sent Events (SSE) are accurate enough (uses EventSource; every subscriber receives same feed). The game client needed bidirectional flow (button taps) and is best served through WebSocket.

**Decision:** SSE broadcasts state; WebSocket handles game.

## ADR-003: Admin token via QR URL param

Viewer QR codes contain the public URL. Admin uses a second QR with a token param on the URL (`?token=...`). Bearer headers are also accepted. This aligns with print-friendly QR admin flow and avoids auth UIs.

**Decision:** token-in-URL & Bearer header both accepted.

## ADR-004: Events table with year column

All events (increment, vote, lightning, rain) record into one `events` table with a year filter. This makes 2025-vs-2026 comparisons live on a single table without schema bloat.

**Decision:** Single `events` table with `year` column.

## ADR-005: H2 fallback for local dev (`application-local.yml`)

Developers can run `mvn spring-boot:run -Dspring-boot.run.profiles=local` without a Postgres container. The H2 URL uses PostgreSQL syntax `jdbc:h2:mem:candydb;MODE=PostgreSQL`. Freight is the local-only profile enabled. Caps on comments within SQL scripts.

**Decision:** H2 only when running local; Postgres in production.

## ADR-006: Quoted "year"/"timestamp" identifiers

Both H2 and Postgres treat `year` and `timestamp` as reserved keywords. Extracting quotes at schema + JPA level makes Flyway marshaling deterministic and avoids select dropouts that previously caused 500s in Spring Data.

**Decision:** `"year"` and `"timestamp"` are quoted in SQL and in `@Column(name = "\"year\"")` JPA annotations.

## ADR-007: count_adjustment over event deletion

Setting totals manually (e.g., "redirected the marks") is achieved by adding an adjustment column to `settings`, added as an offset to the `events` SUM. This preserves event history.

**Decision:** `count_adjustment` joins options write to projections +- event history.

## ADR-008: WebSocket one-session gate

Concurrent games are simply disallowed globally. A new `game_start` event gets rejected when any session is active. Losing websocket scope resets the situation when the projection model removes the game.

**Decision:** single global session map; attempt to start logs `game_start_denied`.

## ADR-009: Recharts for stats pages

Data by unidirection and pattern is expressed best with a curated charting library. Recharts accounts for month renderers while left some visuals intentionally minimal.

**Decision:** Recharts for statistics views; custom CSS for elsewhere.

## ADR-010: 30s auto-end on game sessions

With the WebSocket session alive when the phone disconnects, the projection would hang indefinitely. The side server auto-end, after which projection returns to the official counter expected.

**Decision:** `GAME_DURATION_MS` (30s) auto-scheduled at start; projection ends when WS disconnects.

## ADR-011: Vite → Spring Boot static bundle

Frontend source lives in `src/`. Running `npm run build` produces `dist/`, which is copied into `src/main/resources/static/`. The Spring Boot static resource handler serves it. Backs a frontend server development from distributing load.

**Decision:** react/other compiled in pre-processing via the same published file during Docker builds.

## ADR-012: Projection hides controls via ?projection query param

Projectors use the same frontend and the same frontend endphone attempts to stuff them onto projectors. Tracking down a page with a query param from hidden combacks keeps the components worker minimum, rendering the overlay unemployed during the ecycle.

**Decision:** hiding controls on `?projection` URL param.

## ADR-013: Colocate app + Postgres on one cloud box, drop Tailscale (2026-08-30)

The PRD topology ran the app on a personal server reached over Tailscale
WireGuard (garage) and Tailscale Funnel (phones), against a managed remote
Postgres. Replaced with a single Ubuntu cloud server (Oregon) running a
compose stack: Caddy (TLS via Let's Encrypt), the app, and Postgres on an
internal network with a volume. Public DNS: `halloween-counter.jonathanbell.ca`.
The garage laptop becomes a plain browser client.

Rationale:

- The frontend was already location-agnostic (relative API URLs, WS URL
  derived from `location.host`), so the move costs zero app code.
- Latency is a non-issue: BC to Oregon is 15-35 ms RTT against a game
  hit/miss window of 1500-3000 ms and server ticks of 500-600 ms. Funnel's
  relay hop is removed, so phones likely get faster, not slower.
- Removes three moving parts (WireGuard tunnel, Funnel, managed DB vendor)
  and adds one stable, printable domain with real TLS.
- Tradeoffs accepted: the night depends on garage internet (mitigated by
  cell tethering; SSE reconnect and `/api/state` re-seeding already handle
  drops), and DB durability moves from a managed vendor to `pg_dump`
  backups of the `pgdata` volume (fine for a candy counter; pointing
  `DATABASE_URL` back at a managed host remains a one-line revert).

**Decision:** one cloud box, compose stack (caddy + app + postgres), no
Tailscale. Full runbook in `docs/deployment.md`.

*Amended by ADR-014: the cloud-box direction stands, but the dedicated
compose stack this ADR shipped was replaced when the target turned out to
be a shared server.*

## ADR-014: Deploy to the shared box `francesco`; repo ships only the image (2026-08-31)

ADR-013 assumed a dedicated, empty server and shipped a self-contained
stack (`deploy/`: own Caddy, own Postgres container, own compose project).
The actual target is `francesco`, a shared box that already runs a Caddy
owning ports 80/443, a host PostgreSQL 16, and one compose project at
`/opt/stack`. On that box the repo's stack is not redundant but harmful:
a second Caddy fails to bind (taking the port fight to the existing
sites), a second Postgres wastes the box's scarcest resource (RAM), and a
second compose project violates its one-project rule.

So the split is now:

- **This repo ships**: the `Dockerfile`, the env-var contract
  (`docs/configuration.md`), a `Makefile` (build, ship over ssh, release,
  rollback, verify), and `compose.smoke.yml` for local testing against
  real Postgres.
- **The box owns**: its compose service block, the Caddy site block, the
  `candy` database on the host PostgreSQL, and secrets in
  `/opt/stack/.env` - all maintained on the box, alongside its own
  runbooks.
- Images are tagged by git sha, shipped with `docker save | ssh | docker
  load`, and released by re-pointing the box's compose file - which makes
  rollback an exact, one-command operation.

**Decision:** the repo builds and ships a pinned image; all runtime
topology belongs to the server. `deploy/` is deleted.

---

More context in `agents.md` root file. All of the exact texts above are specific design decisions made by session, not preferences.
